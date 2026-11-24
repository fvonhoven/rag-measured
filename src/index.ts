import { tokenize } from "./tokenize.ts";

// Stage 4: two indexes written by hand.
//
// VectorIndex: brute force cosine over normalized vectors. Fine for thousands
// of chunks; past that you would want an approximate index, which this repo
// deliberately does not have (see README, When not to use this).
//
// BM25Index: the standard Okapi BM25 formula with k1 = 1.2 and b = 0.75.

export type Scored = { id: string; score: number };

export class VectorIndex {
  private readonly ids: string[] = [];
  private readonly vectors: number[][] = [];

  add(id: string, vector: number[]): void {
    this.ids.push(id);
    this.vectors.push(vector);
  }

  get size(): number {
    return this.ids.length;
  }

  search(query: number[], k: number): Scored[] {
    const scored: Scored[] = [];
    for (let i = 0; i < this.vectors.length; i++) {
      const v = this.vectors[i] as number[];
      let dot = 0;
      const n = Math.min(v.length, query.length);
      for (let j = 0; j < n; j++) dot += (v[j] as number) * (query[j] as number);
      scored.push({ id: this.ids[i] as string, score: dot });
    }
    return scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
  }
}

export class BM25Index {
  private readonly k1: number;
  private readonly b: number;
  private readonly docLengths = new Map<string, number>();
  private readonly termFreqs = new Map<string, Map<string, number>>(); // term -> (id -> tf)
  private totalLength = 0;

  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  get size(): number {
    return this.docLengths.size;
  }

  add(id: string, text: string): void {
    const toks = tokenize(text);
    this.docLengths.set(id, toks.length);
    this.totalLength += toks.length;
    for (const t of toks) {
      let posting = this.termFreqs.get(t);
      if (!posting) {
        posting = new Map();
        this.termFreqs.set(t, posting);
      }
      posting.set(id, (posting.get(id) ?? 0) + 1);
    }
  }

  search(query: string, k: number): Scored[] {
    const n = this.docLengths.size;
    if (n === 0) return [];
    const avgLen = this.totalLength / n;
    const scores = new Map<string, number>();
    for (const term of new Set(tokenize(query))) {
      const posting = this.termFreqs.get(term);
      if (!posting) continue;
      const df = posting.size;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      for (const [id, tf] of posting) {
        const len = this.docLengths.get(id) ?? 0;
        const denom = tf + this.k1 * (1 - this.b + (this.b * len) / avgLen);
        scores.set(id, (scores.get(id) ?? 0) + idf * ((tf * (this.k1 + 1)) / denom));
      }
    }
    return [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, k);
  }
}
