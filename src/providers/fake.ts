import type { ChatClient, ChatRequest, ChatResponse } from "./types.ts";
import { ABSTAIN_TEXT, ANSWER_SYSTEM } from "../answer.ts";
import { RERANK_SYSTEM, lexicalOverlap } from "../rerank.ts";
import { estimateTokens } from "../tokenize.ts";

// Deterministic stand-in for a chat model, used offline. It is not a model:
// it answers by lexical overlap between the question and each retrieved
// document, cites the best one when overlap is high enough, and abstains
// otherwise. Numbers produced with it measure the retrieval pipeline and the
// plumbing, not a language model's judgment. The README says so.

export const FAKE_ANSWER_THRESHOLD = 0.5;

function respond(req: ChatRequest, text: string): ChatResponse {
  const inputTokens = estimateTokens((req.system ?? "") + req.messages.map((m) => m.content).join(""));
  return {
    text,
    toolCalls: [],
    usage: { inputTokens, outputTokens: estimateTokens(text) },
    latencyMs: 0,
    model: "fake",
    stopReason: "end_turn",
  };
}

export const fakeClient: ChatClient = async (req) => {
  const user = req.messages[req.messages.length - 1]?.content ?? "";
  if (req.system === RERANK_SYSTEM) {
    const q = /Question: (.*)\n/.exec(user)?.[1] ?? "";
    const passage = /Passage:\n([\s\S]*)\n\nScore:/.exec(user)?.[1] ?? "";
    return respond(req, String(Math.round(lexicalOverlap(q, passage) * 10)));
  }
  if (req.system === ANSWER_SYSTEM) {
    const question = /Question: (.*)$/.exec(user)?.[1] ?? "";
    let best: { id: string; text: string; s: number } | undefined;
    for (const m of user.matchAll(/<document id="([^"]+)"[^>]*>\n([\s\S]*?)\n<\/document>/g)) {
      const s = lexicalOverlap(question, m[2] as string);
      if (!best || s > best.s) best = { id: m[1] as string, text: m[2] as string, s };
    }
    if (!best || best.s < FAKE_ANSWER_THRESHOLD) return respond(req, ABSTAIN_TEXT);
    const firstSentence = best.text.split("\n").filter((l) => l.trim())[1] ?? best.text;
    return respond(req, `${firstSentence.slice(0, 200)} [${best.id}]`);
  }
  return respond(req, "");
};
