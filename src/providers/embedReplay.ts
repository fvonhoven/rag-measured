import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Embedder } from "./types.ts";

// Recorded embeddings, so an offline run retrieves exactly what the live run did.
// Each vector is stored as base64 float32 keyed by a hash of model and text. The
// live path rounds to float32 too, so live and replay compute identical scores.

export type EmbeddingRecording = {
  model: string;
  recordedAt: string;
  inputTokens: number; // as reported by the API for the recorded run
  entries: Record<string, string>;
};

export function embedKey(model: string, text: string): string {
  return createHash("sha256").update(model + "\n" + text).digest("hex").slice(0, 24);
}

export function encodeVector(v: number[]): string {
  return Buffer.from(new Float32Array(v).buffer).toString("base64");
}

export function decodeVector(s: string): number[] {
  const b = Buffer.from(s, "base64");
  return Array.from(new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4));
}

export function loadEmbeddings(path: string): EmbeddingRecording | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as EmbeddingRecording;
}

export function saveEmbeddings(path: string, rec: EmbeddingRecording): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rec) + "\n");
}

export function recordingEmbedder(inner: Embedder, rec: EmbeddingRecording): Embedder {
  return async (texts) => {
    const vectors = await inner(texts);
    return vectors.map((v, i) => {
      const encoded = encodeVector(v);
      rec.entries[embedKey(rec.model, texts[i] as string)] = encoded;
      return decodeVector(encoded);
    });
  };
}

// A miss is an error, not a fallback: mixing recorded vectors with offline ones
// would compare vectors from two different spaces and produce plausible garbage.
export function replayEmbedder(rec: EmbeddingRecording): Embedder {
  return async (texts) =>
    texts.map((t) => {
      const found = rec.entries[embedKey(rec.model, t)];
      if (!found) throw new Error("text not in data/replay/embeddings.json; the corpus changed since the live run. Set OPENAI_API_KEY to re-record, or delete the file to use offline embeddings.");
      return decodeVector(found);
    });
}
