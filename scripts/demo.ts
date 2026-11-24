import { join } from "node:path";
import { loadCorpus } from "../src/load.ts";
import { buildPipeline, ask } from "../src/pipeline.ts";
import { resolveRuntime } from "../src/runtime.ts";
import type { Hit } from "../src/types.ts";

// Runs two questions through the full pipeline and prints what each stage
// produced: the BM25 list, the vector list, the fused list, the reranked
// list, and the final answer with its citations. The second question is not
// answerable from the corpus, so the expected outcome is an abstention.

const ROOT = join(import.meta.dirname, "..");
const QUESTIONS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["Which style properties does useNativeDriver support?", "How do I read the device battery level from JavaScript?"];

function show(label: string, hits: Hit[]): void {
  console.log(`  ${label}`);
  hits.slice(0, 5).forEach((h, i) => {
    console.log(`    ${i + 1}. ${h.chunk.id.padEnd(26)} ${h.score.toFixed(4)}  ${h.chunk.docId} / ${h.chunk.heading}`);
  });
}

async function main(): Promise<void> {
  const rt = resolveRuntime();
  console.log(`mode: ${rt.describe}`);
  const docs = loadCorpus(process.env.RAG_CORPUS_DIR || join(ROOT, "data", "corpus"));
  const cfg = { strategy: "heading" as const, maxWords: 120, overlapWords: 20 };
  const p = await buildPipeline(docs, cfg, rt.embedder);
  console.log(`corpus: ${docs.length} docs -> ${p.chunks.length} chunks (${cfg.strategy}, max ${cfg.maxWords} words)`);
  console.log(`index: ${p.retriever.vectors.size} vectors, ${p.retriever.bm25.size} BM25 documents`);

  for (const q of QUESTIONS) {
    console.log();
    console.log(`question: ${q}`);
    const bm25 = await p.retriever.search(q, "bm25", 5);
    show("bm25", bm25.hits);
    const vec = await p.retriever.search(q, "vector", 5);
    show("vector", vec.hits);
    const res = await ask(p, q, { mode: "hybrid", k: 5, reranker: rt.reranker, client: rt.client, model: rt.chatModel });
    show("hybrid (reciprocal rank fusion)", res.retrieval.hits);
    show("after rerank", res.ranked);
    if (res.retrieval.degraded) console.log(`  degraded: ${res.retrieval.reason}`);
    const a = res.answer;
    if (a) {
      console.log(`  answer: ${a.text}`);
      console.log(`  citations: ${a.citations.length ? a.citations.join(", ") : "(none)"}   abstained: ${a.abstained}`);
      console.log(`  tokens: ${a.usage.inputTokens} in, ${a.usage.outputTokens} out`);
    }
  }
  rt.finish();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
