import type { Chunk, Question, RelevanceLabel } from "./types.ts";

// Retrieval metrics over a ranked list of chunk ids against a relevant set.
// These say nothing about the answer; see faithfulness below for that.

export function isRelevant(chunk: Chunk, labels: RelevanceLabel[]): boolean {
  return labels.some((l) =>
    "chunkId" in l ? l.chunkId === chunk.id : l.doc === chunk.docId && chunk.headings.includes(l.heading),
  );
}

export function relevantIds(chunks: Chunk[], q: Question): Set<string> {
  return new Set(chunks.filter((c) => isRelevant(c, q.relevant)).map((c) => c.id));
}

// Fraction of the relevant set that appears in the top k.
export function recallAtK(ranked: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0;
  const top = ranked.slice(0, k);
  let n = 0;
  for (const id of top) if (relevant.has(id)) n++;
  return n / relevant.size;
}

// Fraction of the top k that is relevant. Divides by k, not by the number
// returned, so a short result list is penalized rather than rewarded.
export function precisionAtK(ranked: string[], relevant: Set<string>, k: number): number {
  const top = ranked.slice(0, k);
  let n = 0;
  for (const id of top) if (relevant.has(id)) n++;
  return n / k;
}

// 1 / rank of the first relevant result, 0 if none.
export function reciprocalRank(ranked: string[], relevant: Set<string>): number {
  const i = ranked.findIndex((id) => relevant.has(id));
  return i < 0 ? 0 : 1 / (i + 1);
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Answer metric, kept apart from retrieval: an answer is faithful when it
// cites at least one chunk the labels mark as relevant. Measurable offline.
export function isFaithful(citations: string[], relevant: Set<string>): boolean {
  return citations.some((c) => relevant.has(c));
}
