import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ChatClient, ChatRequest, ChatResponse } from "./types.ts";

// A recording is a map from request hash to response. A live run records into
// it; an offline run replays from it. Requests that are not in the recording go
// to the fallback client (in this repo, the deterministic fake answerer).

export type Recording = {
  recordedWith: "live" | "fake";
  entries: Record<string, ChatResponse>;
};

export function requestKey(req: ChatRequest): string {
  const canonical = JSON.stringify({
    model: req.model,
    system: req.system ?? null,
    messages: req.messages,
    maxTokens: req.maxTokens ?? null,
    temperature: req.temperature ?? null,
    tools: req.tools ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}

export function loadRecording(path: string): Recording | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as Recording;
}

export function saveRecording(path: string, rec: Recording): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rec, null, 2) + "\n");
}

export function replayClient(rec: Recording, fallback: ChatClient): ChatClient & { hits: () => number } {
  let hits = 0;
  const client = async (req: ChatRequest): Promise<ChatResponse> => {
    const found = rec.entries[requestKey(req)];
    if (found) {
      hits++;
      return { ...found, latencyMs: 0 };
    }
    return fallback(req);
  };
  return Object.assign(client, { hits: () => hits });
}

export function recordingClient(inner: ChatClient, rec: Recording): ChatClient {
  return async (req: ChatRequest): Promise<ChatResponse> => {
    const res = await inner(req);
    rec.entries[requestKey(req)] = res;
    return res;
  };
}
