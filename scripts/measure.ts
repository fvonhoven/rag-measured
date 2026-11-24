import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChunkConfig, Question, SearchMode } from "../src/types.ts";
import { loadCorpus } from "../src/load.ts";
import { buildPipeline } from "../src/pipeline.ts";
import { evaluate, type EvalRow } from "../src/evaluate.ts";
import { resolveRuntime } from "../src/runtime.ts";
import { costUsd } from "../src/pricing.ts";
import { estimateTokens } from "../src/tokenize.ts";

// Runs every question through every configuration and prints one table.
// Retrieval columns (recall, precision, MRR) depend only on the ranked list.
// Answer columns (faithful, abstain) depend on the answer stage as well.

const ROOT = join(import.meta.dirname, "..");
const K = 5;

const CHUNK_CONFIGS: ChunkConfig[] = [
  { strategy: "fixed", maxWords: 120, overlapWords: 20 },
  { strategy: "heading", maxWords: 120, overlapWords: 20 },
];

const VARIANTS: { label: string; mode: SearchMode; rerank: boolean }[] = [
  { label: "bm25", mode: "bm25", rerank: false },
  { label: "vector", mode: "vector", rerank: false },
  { label: "hybrid", mode: "hybrid", rerank: false },
  { label: "hybrid+rerank", mode: "hybrid", rerank: true },
];

function pct(x: number): string {
  return (x * 100).toFixed(1).padStart(5) + "%";
}

function row(cells: string[], widths: number[]): string {
  return cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ");
}

async function main(): Promise<void> {
  const rt = resolveRuntime();
  const docs = loadCorpus(process.env.RAG_CORPUS_DIR || join(ROOT, "data", "corpus"));
  const questions = JSON.parse(readFileSync(join(ROOT, "data", "questions.json"), "utf8")) as Question[];
  const answerable = questions.filter((q) => q.relevant.length > 0).length;

  console.log(`rag-measured: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`mode: ${rt.describe}`);
  console.log(`corpus: ${docs.length} docs, ${questions.length} questions (${answerable} answerable, ${questions.length - answerable} unanswerable), k=${K}`);
  console.log();

  const widths = [8, 14, 6, 9, 9, 8, 9, 9, 9];
  const header = ["chunking", "variant", "chunks", "recall@5", "prec@5", "MRR", "faithful", "abstain", "falseAbs"];
  console.log(row(header, widths));
  console.log(row(widths.map((w) => "-".repeat(w)), widths));

  const rows: EvalRow[] = [];
  let degradedTotal = 0;
  for (const cfg of CHUNK_CONFIGS) {
    const pipeline = await buildPipeline(docs, cfg, rt.embedder);
    for (const v of VARIANTS) {
      const r = await evaluate(`${cfg.strategy}/${v.label}`, pipeline, questions, {
        mode: v.mode,
        k: K,
        reranker: v.rerank ? rt.reranker : undefined,
        client: rt.client,
        model: rt.chatModel,
      });
      rows.push(r);
      degradedTotal += r.degradedQueries;
      console.log(
        row(
          [cfg.strategy, v.label, String(pipeline.chunks.length), pct(r.recallAt5), pct(r.precisionAt5), pct(r.mrr), pct(r.faithful), pct(r.abstainRate), pct(r.falseAbstain)],
          widths,
        ),
      );
    }
  }
  console.log();
  console.log("faithful: answerable questions whose answer cites a labeled relevant chunk.");
  console.log("abstain: unanswerable questions where the answer declined. falseAbs: answerable questions where it declined.");
  if (degradedTotal > 0) console.log(`degraded queries (BM25 fallback): ${degradedTotal}`);
  if (!rt.modelChat) console.log("answer columns come from the deterministic fake answerer, not a model. Set ANTHROPIC_API_KEY to measure a model.");

  // Cost across every configuration in this run. Rerank calls happen live or from a
  // live recording; the offline lexical reranker makes none.
  const answerIn = rows.reduce((a, r) => a + r.usage.inputTokens, 0);
  const answerOut = rows.reduce((a, r) => a + r.usage.outputTokens, 0);
  const chatIn = rt.chatUsage.inputTokens;
  const chatOut = rt.chatUsage.outputTokens;
  const embedIn = rt.embedUsage?.inputTokens ?? estimateTokens(docs.map((d) => d.text).join("")) * CHUNK_CONFIGS.length;
  console.log();
  console.log(`tokens this run (${rt.liveChat ? "reported by API" : rt.modelChat ? "reported by API in the recorded run" : "estimated at 4 chars/token"}):`);
  console.log(`  answer stage: ${answerIn} in, ${answerOut} out over ${rows.length * questions.length} calls`);
  console.log(`  rerank stage: ${chatIn - answerIn} in, ${chatOut - answerOut} out over ${rt.chatUsage.calls - rows.length * questions.length} calls`);
  console.log(`  embeddings:   ${embedIn} in`);
  const chatCost = costUsd(rt.chatModel, chatIn, chatOut);
  const embedCost = costUsd(rt.embedModel, embedIn, 0);
  console.log(`  cost at list price if live: ${rt.chatModel} $${chatCost.toFixed(4)} + ${rt.embedModel} $${embedCost.toFixed(4)} = $${(chatCost + embedCost).toFixed(4)}`);

  // Break-even against stuffing the whole corpus into every prompt.
  const corpusTokens = estimateTokens(docs.map((d) => d.text).join("\n"));
  const perQueryRag = Math.round(answerIn / (rows.length * questions.length));
  console.log();
  console.log(`break-even: whole corpus is about ${corpusTokens} tokens; a RAG prompt averaged ${perQueryRag} tokens.`);
  console.log(`  at ${rt.chatModel} input price, full context costs $${costUsd(rt.chatModel, corpusTokens, 0).toFixed(5)} per query vs $${costUsd(rt.chatModel, perQueryRag, 0).toFixed(5)} with retrieval.`);

  rt.finish();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
