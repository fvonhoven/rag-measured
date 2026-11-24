import { join } from "node:path";
import type { ChatClient, Embedder } from "./providers/types.ts";
import { anthropicClient } from "./providers/anthropic.ts";
import { openaiEmbedder, type UsageTrackingEmbedder } from "./providers/openai.ts";
import { fakeClient } from "./providers/fake.ts";
import { loadRecording, recordingClient, replayClient, saveRecording, type Recording } from "./providers/replay.ts";
import { hashEmbedder } from "./embed.ts";
import { loadEmbeddings, recordingEmbedder, replayEmbedder, saveEmbeddings, type EmbeddingRecording } from "./providers/embedReplay.ts";
import { lexicalReranker, llmReranker, type Reranker } from "./rerank.ts";

// Picks live or offline implementations for each stage from the environment.
// Scripts print `describe` at the top so a reader knows which numbers they
// are looking at.

export const DEFAULT_CHAT_MODEL = "claude-haiku-4-5";
export const DEFAULT_EMBED_MODEL = "text-embedding-3-small";
export const REPLAY_PATH = join(import.meta.dirname, "..", "data", "replay", "chat.json");
export const EMBED_REPLAY_PATH = join(import.meta.dirname, "..", "data", "replay", "embeddings.json");

export type Runtime = {
  embedder: Embedder;
  embedUsage?: { inputTokens: number };
  client: ChatClient;
  // Every chat call in this process (rerank and answer), for cost reporting.
  chatUsage: { inputTokens: number; outputTokens: number; calls: number };
  reranker: Reranker;
  chatModel: string;
  embedModel: string;
  liveEmbeddings: boolean;
  liveChat: boolean;
  // True when the chat numbers come from a live model, now or in a recording.
  modelChat: boolean;
  describe: string;
  finish: () => void;
};

export function resolveRuntime(env: NodeJS.ProcessEnv = process.env): Runtime {
  const chatModel = env.RAG_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const embedModel = env.RAG_EMBED_MODEL || DEFAULT_EMBED_MODEL;
  const liveEmbeddings = Boolean(env.OPENAI_API_KEY);
  const liveChat = Boolean(env.ANTHROPIC_API_KEY);

  let embedder: Embedder;
  let embedUsage: { inputTokens: number } | undefined;
  let embedRecording: EmbeddingRecording | undefined;
  let embedLabel: string;
  const existingEmbeddings = loadEmbeddings(EMBED_REPLAY_PATH);
  if (liveEmbeddings) {
    const e: UsageTrackingEmbedder = openaiEmbedder(env.OPENAI_API_KEY as string, embedModel);
    embedRecording = { model: embedModel, recordedAt: new Date().toISOString().slice(0, 10), inputTokens: 0, entries: {} };
    embedder = recordingEmbedder(e, embedRecording);
    embedUsage = e.usage;
    embedLabel = `live ${embedModel} embeddings, recording to data/replay/embeddings.json`;
  } else if (existingEmbeddings && existingEmbeddings.model === embedModel) {
    embedder = replayEmbedder(existingEmbeddings);
    embedUsage = { inputTokens: existingEmbeddings.inputTokens };
    embedLabel = `${embedModel} embeddings replayed from data/replay/embeddings.json (recorded ${existingEmbeddings.recordedAt})`;
  } else {
    embedder = hashEmbedder();
    embedLabel = "offline hashed token bag embeddings";
  }

  const existing = loadRecording(REPLAY_PATH);
  let client: ChatClient;
  let reranker: Reranker;
  let recording: Recording | undefined;
  let chatLabel: string;
  if (liveChat) {
    recording = { recordedWith: "live", entries: {} };
    client = recordingClient(anthropicClient(env.ANTHROPIC_API_KEY as string), recording);
    reranker = llmReranker(client, chatModel);
    chatLabel = `live ${chatModel} for rerank and answer, recording to data/replay/chat.json`;
  } else {
    const rec = existing ?? { recordedWith: "fake", entries: {} };
    client = replayClient(rec, fakeClient);
    if (!existing) {
      // First offline run: record the fake's answers so the fixture exists.
      recording = rec;
      client = recordingClient(client, rec);
    }
    reranker = lexicalReranker;
    if (existing?.recordedWith === "live") {
      chatLabel = `${chatModel} rerank and answer replayed from data/replay/chat.json (recorded live), deterministic fake answerer for misses`;
    } else {
      const source = existing
        ? `replaying data/replay/chat.json (recorded with: ${existing.recordedWith})`
        : "no recording found, recording the fake answerer's output";
      chatLabel = `offline, lexical rerank, ${source}, deterministic fake answerer for misses`;
    }
  }

  const chatUsage = { inputTokens: 0, outputTokens: 0, calls: 0 };
  const inner = client;
  client = async (req) => {
    const res = await inner(req);
    chatUsage.calls++;
    chatUsage.inputTokens += res.usage.inputTokens;
    chatUsage.outputTokens += res.usage.outputTokens;
    return res;
  };
  // A live recording includes the reranker's calls, so replaying it means
  // replaying the LLM reranker too, not swapping in the lexical one.
  const modelChat = liveChat || existing?.recordedWith === "live";
  if (modelChat) reranker = llmReranker(client, chatModel);

  return {
    embedder,
    embedUsage,
    client,
    chatUsage,
    reranker,
    chatModel,
    embedModel,
    liveEmbeddings,
    liveChat,
    modelChat,
    describe: `${embedLabel}; ${chatLabel}`,
    finish: () => {
      if (recording) saveRecording(REPLAY_PATH, recording);
      if (embedRecording && embedUsage) {
        embedRecording.inputTokens = embedUsage.inputTokens;
        saveEmbeddings(EMBED_REPLAY_PATH, embedRecording);
      }
    },
  };
}
