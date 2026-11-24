import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isFaithful, isRelevant, mean, precisionAtK, recallAtK, reciprocalRank } from "./metrics.ts";

const relevant = new Set(["r1", "r2", "r3", "r4"]);
const ranked = ["x", "r1", "y", "r2", "z", "r3"];

describe("retrieval metrics against hand computed values", () => {
  it("recall@k", () => {
    assert.equal(recallAtK(ranked, relevant, 5), 2 / 4);
    assert.equal(recallAtK(ranked, relevant, 6), 3 / 4);
    assert.equal(recallAtK(ranked, relevant, 1), 0);
    assert.equal(recallAtK([], relevant, 5), 0);
    assert.equal(recallAtK(ranked, new Set(), 5), 0);
  });

  it("precision@k divides by k even when fewer than k results come back", () => {
    assert.equal(precisionAtK(ranked, relevant, 5), 2 / 5);
    assert.equal(precisionAtK(ranked, relevant, 2), 1 / 2);
    assert.equal(precisionAtK(["r1"], relevant, 5), 1 / 5);
  });

  it("reciprocal rank", () => {
    assert.equal(reciprocalRank(ranked, relevant), 1 / 2);
    assert.equal(reciprocalRank(["r4"], relevant), 1);
    assert.equal(reciprocalRank(["x", "y"], relevant), 0);
    assert.equal(mean([1 / 2, 1, 0]), 0.5);
    assert.equal(mean([]), 0);
  });
});

describe("label matching and faithfulness", () => {
  const chunk = { id: "hermes#3", docId: "hermes", heading: "Debugging with Hermes", headings: ["Bytecode precompilation", "Debugging with Hermes"], text: "" };

  it("matches by chunk id or by any covered doc plus heading", () => {
    assert.equal(isRelevant(chunk, [{ chunkId: "hermes#3" }]), true);
    assert.equal(isRelevant(chunk, [{ chunkId: "hermes#4" }]), false);
    assert.equal(isRelevant(chunk, [{ doc: "hermes", heading: "Bytecode precompilation" }]), true);
    assert.equal(isRelevant(chunk, [{ doc: "hermes", heading: "Known limitations" }]), false);
    assert.equal(isRelevant(chunk, [{ doc: "metro-config", heading: "Debugging with Hermes" }]), false);
    assert.equal(isRelevant(chunk, []), false);
  });

  it("an answer is faithful when at least one citation is relevant", () => {
    assert.equal(isFaithful(["hermes#3", "metro#1"], new Set(["hermes#3"])), true);
    assert.equal(isFaithful(["metro#1"], new Set(["hermes#3"])), false);
    assert.equal(isFaithful([], new Set(["hermes#3"])), false);
  });
});
