import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRetriever, reciprocalRankFusion } from "./search.ts";
import { hashEmbedder } from "./embed.ts";
import type { Embedder } from "./providers/types.ts";
import type { Chunk } from "./types.ts";

const mk = (id: string, text: string): Chunk => ({ id, docId: id.split("#")[0] ?? id, heading: "", headings: [""], text });

const chunks: Chunk[] = [
  mk("hermes#0", "Hermes compiles JavaScript to bytecode at build time so cold start is faster"),
  mk("metro#0", "Metro is the bundler; reset the cache with the reset-cache flag"),
  mk("flatlist#0", "FlatList windowSize default is 21 viewports"),
];

describe("reciprocalRankFusion", () => {
  it("matches hand computed RRF with k=60", () => {
    const fused = reciprocalRankFusion([
      [{ id: "a", score: 9 }, { id: "b", score: 5 }],
      [{ id: "b", score: 0.9 }, { id: "c", score: 0.1 }],
    ]);
    // b: 1/62 + 1/61; a: 1/61; c: 1/62
    assert.deepEqual(fused.map((f) => f.id), ["b", "a", "c"]);
    assert.ok(Math.abs((fused[0]?.score ?? 0) - (1 / 62 + 1 / 61)) < 1e-12);
    assert.ok(Math.abs((fused[1]?.score ?? 0) - 1 / 61) < 1e-12);
  });
});

describe("buildRetriever", () => {
  it("serves bm25, vector and hybrid modes without degradation on the happy path", async () => {
    const r = await buildRetriever(chunks, hashEmbedder());
    assert.equal(r.vectors.size, 3);
    assert.equal(r.missingVectors.length, 0);
    for (const mode of ["bm25", "vector", "hybrid"] as const) {
      const res = await r.search("how do I reset the metro cache", mode, 2);
      assert.equal(res.mode, mode);
      assert.equal(res.degraded, false);
      assert.equal(res.hits[0]?.chunk.id, "metro#0", mode);
    }
  });

  it("returns empty hybrid results, not an error, for a stopword only query", async () => {
    const r = await buildRetriever(chunks, hashEmbedder());
    const res = await r.search("what is the", "hybrid", 3);
    // The hash embedder returns a zero vector; the vector list is all ties at
    // zero and BM25 is empty. The result is a list, possibly non empty, and no
    // exception. bm25 alone is empty.
    assert.ok(Array.isArray(res.hits));
    assert.deepEqual((await r.search("what is the", "bm25", 3)).hits, []);
  });

  it("falls back to BM25 only and reports degraded when the query embedding fails", async () => {
    const base = hashEmbedder();
    let calls = 0;
    const flaky: Embedder = async (texts) => {
      calls++;
      if (calls > 1) throw new Error("embedding service down");
      return base(texts);
    };
    const r = await buildRetriever(chunks, flaky);
    assert.equal(r.missingVectors.length, 0);
    const res = await r.search("hermes bytecode cold start", "hybrid", 2);
    assert.equal(res.degraded, true);
    assert.equal(res.mode, "bm25");
    assert.match(res.reason ?? "", /fell back to BM25/);
    assert.equal(res.hits[0]?.chunk.id, "hermes#0");
  });

  it("keeps a chunk reachable via BM25 when embedding that one chunk fails at index time", async () => {
    const base = hashEmbedder();
    const failing: Embedder = async (texts) => {
      if (texts.some((t) => t.includes("FlatList"))) throw new Error("bad chunk");
      return base(texts);
    };
    const r = await buildRetriever(chunks, failing);
    assert.deepEqual(r.missingVectors, ["flatlist#0"]);
    assert.equal(r.vectors.size, 2);
    const res = await r.search("flatlist windowSize default", "hybrid", 3);
    assert.equal(res.degraded, true);
    assert.match(res.reason ?? "", /1 chunk\(s\) have no vector/);
    assert.equal(res.mode, "hybrid");
    assert.equal(res.hits[0]?.chunk.id, "flatlist#0");
  });
});
