import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeVector, encodeVector, recordingEmbedder, replayEmbedder, type EmbeddingRecording } from "./embedReplay.ts";

describe("embedding replay", () => {
  it("replays exactly what the recording embedder returned", async () => {
    const rec: EmbeddingRecording = { model: "m", recordedAt: "2026-11-20", inputTokens: 0, entries: {} };
    const inner = async (texts: string[]) => texts.map((t) => [t.length / 3, -0.1234567891, 1]);
    const live = await recordingEmbedder(inner, rec)(["alpha", "beta"]);
    const replayed = await replayEmbedder(rec)(["beta", "alpha"]);
    assert.deepEqual(replayed, [live[1], live[0]]);
  });

  it("round trips through float32", () => {
    const v = decodeVector(encodeVector([0.5, -0.25, 3]));
    assert.deepEqual(v, [0.5, -0.25, 3]);
  });

  it("throws on a text that was never recorded instead of mixing vector spaces", async () => {
    const rec: EmbeddingRecording = { model: "m", recordedAt: "2026-11-20", inputTokens: 0, entries: {} };
    await assert.rejects(replayEmbedder(rec)(["unseen"]), /not in data\/replay\/embeddings.json/);
  });
});
