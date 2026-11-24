import type { ChatClient, Embedder } from "./providers/types.ts";
import type { Chunk, ChunkConfig, Doc, Hit, SearchMode } from "./types.ts";
import { chunkCorpus } from "./chunk.ts";
import { buildRetriever, type RetrievalResult, type Retriever } from "./search.ts";
import type { Reranker } from "./rerank.ts";
import { answer, type Answer } from "./answer.ts";

// Wires the stages together. Build once per corpus and chunk config; ask
// many times with different search modes and rerankers.

export type Pipeline = { chunks: Chunk[]; retriever: Retriever };

export async function buildPipeline(docs: Doc[], chunkConfig: ChunkConfig, embedder: Embedder): Promise<Pipeline> {
  const chunks = chunkCorpus(docs, chunkConfig);
  const retriever = await buildRetriever(chunks, embedder);
  return { chunks, retriever };
}

export type AskOptions = {
  mode: SearchMode;
  k: number;
  // Candidates pulled before reranking. Only the top k after rerank reach the answer.
  candidates?: number;
  reranker?: Reranker;
  client?: ChatClient;
  model?: string;
};

export type AskResult = {
  retrieval: RetrievalResult;
  // Final ranked list handed to the answer stage (after rerank if any).
  ranked: Hit[];
  answer?: Answer;
};

export async function ask(p: Pipeline, question: string, opts: AskOptions): Promise<AskResult> {
  const candidates = opts.reranker ? (opts.candidates ?? opts.k * 3) : opts.k;
  const retrieval = await p.retriever.search(question, opts.mode, candidates);
  let ranked = retrieval.hits;
  if (opts.reranker) ranked = (await opts.reranker(question, ranked)).slice(0, opts.k);
  const result: AskResult = { retrieval, ranked };
  if (opts.client) {
    result.answer = await answer(opts.client, opts.model ?? "fake", question, ranked.map((h) => h.chunk));
  }
  return result;
}
