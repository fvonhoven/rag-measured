import type { Embedder } from "./providers/types.ts";
import type { Chunk, Hit, SearchMode } from "./types.ts";
import { BM25Index, VectorIndex, type Scored } from "./index.ts";

// Stage 5: hybrid search. Vector and BM25 each produce a ranked list; the two
// are fused with reciprocal rank fusion, which needs no score calibration
// between the two systems (cosine and BM25 live on unrelated scales).

export const RRF_K = 60;

export function reciprocalRankFusion(lists: Scored[][], k: number = RRF_K): Scored[] {
  const fused = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      fused.set(item.id, (fused.get(item.id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return [...fused.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export type RetrievalResult = {
  hits: Hit[];
  // The mode actually used. Differs from the requested mode when the pipeline
  // fell back to BM25 because the query embedding failed.
  mode: SearchMode;
  degraded: boolean;
  reason?: string;
};

export type Retriever = {
  chunks: Map<string, Chunk>;
  vectors: VectorIndex;
  bm25: BM25Index;
  // Chunk ids that have no vector because embedding them failed at index time.
  missingVectors: string[];
  search: (query: string, mode: SearchMode, k: number) => Promise<RetrievalResult>;
};

export async function buildRetriever(chunks: Chunk[], embedder: Embedder, batchSize = 32): Promise<Retriever> {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const vectors = new VectorIndex();
  const bm25 = new BM25Index();
  const missingVectors: string[] = [];
  for (const c of chunks) bm25.add(c.id, c.text);

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    let vecs: number[][] | undefined;
    try {
      vecs = await embedder(batch.map((c) => c.text));
    } catch {
      // Retry one at a time so a single bad chunk does not take down the batch.
      vecs = [];
      for (const c of batch) {
        try {
          vecs.push((await embedder([c.text]))[0] ?? []);
        } catch {
          vecs.push([]);
        }
      }
    }
    batch.forEach((c, j) => {
      const v = vecs?.[j];
      if (v && v.length > 0) vectors.add(c.id, v);
      else missingVectors.push(c.id);
    });
  }

  const toHits = (scored: Scored[], k: number): Hit[] =>
    scored
      .slice(0, k)
      .map((s) => ({ chunk: byId.get(s.id) as Chunk, score: s.score }))
      .filter((h) => h.chunk !== undefined);

  const search = async (query: string, mode: SearchMode, k: number): Promise<RetrievalResult> => {
    // Pull more candidates than k from each system so fusion has room to reorder.
    const pool = Math.max(k * 4, 20);
    if (mode === "bm25") return { hits: toHits(bm25.search(query, k), k), mode, degraded: false };

    let queryVec: number[];
    try {
      queryVec = (await embedder([query]))[0] ?? [];
      if (queryVec.length === 0) throw new Error("empty query embedding");
    } catch (err) {
      const reason = `query embedding failed (${(err as Error).message}); fell back to BM25 only`;
      return { hits: toHits(bm25.search(query, k), k), mode: "bm25", degraded: true, reason };
    }
    const vectorHits = vectors.search(queryVec, pool);
    const degraded = missingVectors.length > 0;
    const reason = degraded ? `${missingVectors.length} chunk(s) have no vector and are only reachable via BM25` : undefined;
    if (mode === "vector") return { hits: toHits(vectorHits, k), mode, degraded, reason };
    const fused = reciprocalRankFusion([vectorHits, bm25.search(query, pool)]);
    return { hits: toHits(fused, k), mode, degraded, reason };
  };

  return { chunks: byId, vectors, bm25, missingVectors, search };
}
