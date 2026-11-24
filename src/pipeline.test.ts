import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCorpus } from "./load.ts";
import { buildPipeline, ask } from "./pipeline.ts";
import { evaluate } from "./evaluate.ts";
import { hashEmbedder } from "./embed.ts";
import { fakeClient } from "./providers/fake.ts";
import { lexicalReranker, llmReranker } from "./rerank.ts";
import { relevantIds } from "./metrics.ts";
import type { Question } from "./types.ts";

const ROOT = join(import.meta.dirname, "..");
const docs = loadCorpus(join(ROOT, "data", "corpus"));
const questions = JSON.parse(readFileSync(join(ROOT, "data", "questions.json"), "utf8")) as Question[];

describe("end to end, offline", () => {
  it("loads the fixture corpus and every label points at a real chunk under both strategies", async () => {
    assert.ok(docs.length >= 12 && docs.length <= 15);
    for (const strategy of ["fixed", "heading"] as const) {
      const p = await buildPipeline(docs, { strategy, maxWords: 120, overlapWords: 20 }, hashEmbedder());
      for (const q of questions) {
        if (q.relevant.length === 0) continue;
        assert.ok(relevantIds(p.chunks, q).size > 0, `${q.id} under ${strategy}`);
      }
    }
    assert.equal(questions.filter((q) => q.relevant.length === 0).length, 5);
  });

  it("answers an answerable question with a citation into a relevant chunk", async () => {
    const p = await buildPipeline(docs, { strategy: "heading", maxWords: 120, overlapWords: 20 }, hashEmbedder());
    const q = questions.find((x) => x.id === "q06") as Question;
    const res = await ask(p, q.question, { mode: "hybrid", k: 5, reranker: lexicalReranker, client: fakeClient });
    assert.equal(res.retrieval.degraded, false);
    assert.equal(res.ranked.length, 5);
    const relevant = relevantIds(p.chunks, q);
    assert.ok(res.ranked.some((h) => relevant.has(h.chunk.id)));
    assert.ok(res.answer);
    assert.equal(res.answer.abstained, false);
    assert.ok(res.answer.citations.some((c) => relevant.has(c)));
  });

  it("abstains on a question the corpus cannot answer", async () => {
    const p = await buildPipeline(docs, { strategy: "heading", maxWords: 120, overlapWords: 20 }, hashEmbedder());
    const res = await ask(p, "How do I read the device battery level from JavaScript?", { mode: "hybrid", k: 5, client: fakeClient });
    assert.equal(res.answer?.abstained, true);
    assert.deepEqual(res.answer?.citations, []);
  });

  it("evaluate produces numbers in range and excludes unanswerable questions from retrieval averages", async () => {
    const p = await buildPipeline(docs, { strategy: "heading", maxWords: 120, overlapWords: 20 }, hashEmbedder());
    const row = await evaluate("t", p, questions, { mode: "bm25", k: 5, client: fakeClient });
    for (const v of [row.recallAt5, row.precisionAt5, row.mrr, row.faithful, row.abstainRate, row.falseAbstain]) {
      assert.ok(v >= 0 && v <= 1);
    }
    assert.ok(row.recallAt5 > 0.5, "bm25 recall on the fixture should be well above chance");
    assert.equal(row.degradedQueries, 0);
    // precision@5 cannot exceed (relevant chunks per question) / 5, which is small here
    assert.ok(row.precisionAt5 < 0.5);
  });

  it("the LLM reranker parses scores and keeps retrieval order on ties", async () => {
    const p = await buildPipeline(docs, { strategy: "heading", maxWords: 120, overlapWords: 20 }, hashEmbedder());
    const res = await ask(p, "How do I hide a specific warning in LogBox?", { mode: "hybrid", k: 3, reranker: llmReranker(fakeClient, "fake") });
    assert.equal(res.ranked.length, 3);
    assert.equal(res.ranked[0]?.chunk.docId, "debugging");
    for (let i = 1; i < res.ranked.length; i++) assert.ok((res.ranked[i - 1]?.score ?? 0) >= (res.ranked[i]?.score ?? 0));
  });
});
