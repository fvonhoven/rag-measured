import type { ChatClient } from "./providers/types.ts";
import type { Hit } from "./types.ts";
import { tokenize } from "./tokenize.ts";

// Stage 6: rerank the candidate list. Retrieval optimizes for recall over the
// whole corpus; the reranker looks at each candidate with the query in hand
// and reorders. Two implementations behind one type.

export type Reranker = (query: string, hits: Hit[]) => Promise<Hit[]>;

// Fraction of query terms that appear in the chunk. Ties keep retrieval order.
export function lexicalOverlap(query: string, text: string): number {
  const q = new Set(tokenize(query));
  if (q.size === 0) return 0;
  const t = new Set(tokenize(text));
  let n = 0;
  for (const term of q) if (t.has(term)) n++;
  return n / q.size;
}

export const lexicalReranker: Reranker = async (query, hits) =>
  hits
    .map((h, i) => ({ h, i, s: lexicalOverlap(query, h.chunk.text) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ h, s }) => ({ chunk: h.chunk, score: s }));

export const RERANK_SYSTEM =
  "You grade whether a passage answers a question. Reply with a single integer from 0 (irrelevant) to 10 (directly answers). No other text.";

export function llmReranker(client: ChatClient, model: string): Reranker {
  return async (query, hits) => {
    const scored = await Promise.all(
      hits.map(async (h, i) => {
        const res = await client({
          model,
          system: RERANK_SYSTEM,
          maxTokens: 4,
          temperature: 0,
          messages: [{ role: "user", content: `Question: ${query}\n\nPassage:\n${h.chunk.text}\n\nScore:` }],
        });
        const m = /\d+/.exec(res.text);
        const s = m ? Math.min(10, Math.max(0, Number(m[0]))) : -1;
        return { h, i, s };
      }),
    );
    return scored.sort((a, b) => b.s - a.s || a.i - b.i).map(({ h, s }) => ({ chunk: h.chunk, score: s }));
  };
}
