import type { Embedder } from "./providers/types.ts";
import { tokenize } from "./tokenize.ts";

// Stage 3: turn text into vectors.
//
// The offline embedder is a hashed bag of tokens: each token (and each token
// bigram, at half weight) is hashed to a dimension and a sign, summed, then
// L2 normalized. It captures lexical overlap only, no semantics. It exists so
// the whole pipeline runs deterministically with no network. Live runs use
// openaiEmbedder from src/providers/openai.ts.

export const HASH_DIM = 512;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function hashEmbed(text: string, dim: number = HASH_DIM): number[] {
  const v = new Array<number>(dim).fill(0);
  const toks = tokenize(text);
  const add = (term: string, weight: number) => {
    const h = fnv1a(term);
    const idx = h % dim;
    const sign = (h >>> 31) === 0 ? 1 : -1;
    v[idx] = (v[idx] ?? 0) + sign * weight;
  };
  for (let i = 0; i < toks.length; i++) {
    add(toks[i] as string, 1);
    if (i + 1 < toks.length) add(`${toks[i]}_${toks[i + 1]}`, 0.5);
  }
  return normalize(v);
}

export function normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const n = Math.sqrt(sum);
  return n === 0 ? v : v.map((x) => x / n);
}

export function hashEmbedder(dim: number = HASH_DIM): Embedder {
  return async (texts) => texts.map((t) => hashEmbed(t, dim));
}
