import type { Question } from "./types.ts";
import { ask, type AskOptions, type Pipeline } from "./pipeline.ts";
import { isFaithful, mean, precisionAtK, recallAtK, reciprocalRank, relevantIds } from "./metrics.ts";

// Runs every labeled question through one configuration and aggregates.
// Retrieval numbers come from the ranked list; answer numbers from citations.
// Unanswerable questions (empty relevant set) are excluded from retrieval
// averages and reported through abstainRate instead.

export type EvalRow = {
  label: string;
  recallAt5: number;
  precisionAt5: number;
  mrr: number;
  faithful: number; // fraction of answerable questions whose answer cites a relevant chunk
  abstainRate: number; // fraction of unanswerable questions where the answer abstained
  falseAbstain: number; // fraction of answerable questions where the answer abstained
  degradedQueries: number;
  usage: { inputTokens: number; outputTokens: number };
};

export async function evaluate(label: string, p: Pipeline, questions: Question[], opts: AskOptions): Promise<EvalRow> {
  const recalls: number[] = [];
  const precisions: number[] = [];
  const rrs: number[] = [];
  const faithful: number[] = [];
  const falseAbstains: number[] = [];
  const abstains: number[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let degradedQueries = 0;

  for (const q of questions) {
    const res = await ask(p, q.question, opts);
    if (res.retrieval.degraded) degradedQueries++;
    const relevant = relevantIds(p.chunks, q);
    const ranked = res.ranked.map((h) => h.chunk.id);
    if (res.answer) {
      usage.inputTokens += res.answer.usage.inputTokens;
      usage.outputTokens += res.answer.usage.outputTokens;
    }
    if (q.relevant.length === 0) {
      if (res.answer) abstains.push(res.answer.abstained ? 1 : 0);
      continue;
    }
    if (relevant.size === 0) {
      // Labeled, but no chunk matches the label: a label error. Score as a
      // miss rather than hiding it as unanswerable.
      console.error(`warning: ${q.id} has labels that match no chunk`);
    }
    recalls.push(recallAtK(ranked, relevant, 5));
    precisions.push(precisionAtK(ranked, relevant, 5));
    rrs.push(reciprocalRank(ranked, relevant));
    if (res.answer) {
      faithful.push(isFaithful(res.answer.citations, relevant) ? 1 : 0);
      falseAbstains.push(res.answer.abstained ? 1 : 0);
    }
  }

  return {
    label,
    recallAt5: mean(recalls),
    precisionAt5: mean(precisions),
    mrr: mean(rrs),
    faithful: mean(faithful),
    abstainRate: mean(abstains),
    falseAbstain: mean(falseAbstains),
    degradedQueries,
    usage,
  };
}
