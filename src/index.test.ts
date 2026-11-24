import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BM25Index, VectorIndex } from "./index.ts";
import { hashEmbed } from "./embed.ts";

describe("BM25Index", () => {
  it("matches a hand computed Okapi BM25 score", () => {
    const idx = new BM25Index();
    idx.add("a", "hermes engine hermes");
    idx.add("b", "metro bundler");
    idx.add("c", "hermes bytecode");
    const hits = idx.search("hermes", 10);
    assert.deepEqual(hits.map((h) => h.id), ["a", "c"]);

    // By hand: N=3, df=2, avgLen=7/3, k1=1.2, b=0.75.
    const idf = Math.log(1 + (3 - 2 + 0.5) / (2 + 0.5));
    const avg = 7 / 3;
    const score = (tf: number, len: number) => idf * ((tf * 2.2) / (tf + 1.2 * (1 - 0.75 + (0.75 * len) / avg)));
    assert.ok(Math.abs((hits[0]?.score ?? 0) - score(2, 3)) < 1e-9);
    assert.ok(Math.abs((hits[1]?.score ?? 0) - score(1, 2)) < 1e-9);
  });

  it("returns nothing for a query made only of stopwords", () => {
    const idx = new BM25Index();
    idx.add("a", "the hermes engine");
    assert.deepEqual(idx.search("what is the", 5), []);
    assert.deepEqual(new BM25Index().search("hermes", 5), []);
  });
});

describe("VectorIndex", () => {
  it("ranks by cosine and is deterministic on ties", () => {
    const idx = new VectorIndex();
    idx.add("x", [1, 0]);
    idx.add("y", [0, 1]);
    idx.add("z", [Math.SQRT1_2, Math.SQRT1_2]);
    const hits = idx.search([1, 0], 3);
    assert.deepEqual(hits.map((h) => h.id), ["x", "z", "y"]);
    assert.ok(Math.abs((hits[0]?.score ?? 0) - 1) < 1e-12);
  });
});

describe("hashEmbed", () => {
  it("is deterministic, unit length, and zero for empty text", () => {
    const a = hashEmbed("Hermes bytecode precompilation");
    const b = hashEmbed("Hermes bytecode precompilation");
    assert.deepEqual(a, b);
    const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    assert.ok(Math.abs(norm - 1) < 1e-9);
    assert.ok(hashEmbed("").every((x) => x === 0));
    assert.ok(hashEmbed("the and of").every((x) => x === 0));
  });

  it("scores overlapping text higher than unrelated text", () => {
    const q = hashEmbed("flatlist windowSize default");
    const near = hashEmbed("windowSize controls how many viewports the flatlist keeps mounted");
    const far = hashEmbed("configure metro resolver source extensions");
    const dot = (u: number[], v: number[]) => u.reduce((s, x, i) => s + x * (v[i] ?? 0), 0);
    assert.ok(dot(q, near) > dot(q, far));
  });
});
