import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordingClient, replayClient, requestKey, type Recording } from "./replay.ts";
import type { ChatClient, ChatRequest } from "./types.ts";

const req: ChatRequest = { model: "m", system: "s", messages: [{ role: "user", content: "hi" }], temperature: 0 };
const canned = { text: "recorded", toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 }, latencyMs: 9, model: "m", stopReason: "end_turn" };

describe("replay", () => {
  it("keys requests by content so a changed prompt misses", () => {
    assert.equal(requestKey(req), requestKey({ ...req }));
    assert.notEqual(requestKey(req), requestKey({ ...req, system: "other" }));
    assert.notEqual(requestKey(req), requestKey({ ...req, messages: [{ role: "user", content: "hi!" }] }));
  });

  it("serves hits from the recording and misses from the fallback", async () => {
    const rec: Recording = { recordedWith: "live", entries: { [requestKey(req)]: canned } };
    let fallbackCalls = 0;
    const fallback: ChatClient = async () => {
      fallbackCalls++;
      return { ...canned, text: "fallback" };
    };
    const client = replayClient(rec, fallback);
    assert.equal((await client(req)).text, "recorded");
    assert.equal((await client({ ...req, system: "x" })).text, "fallback");
    assert.equal(client.hits(), 1);
    assert.equal(fallbackCalls, 1);
  });

  it("recordingClient stores every response under the request key", async () => {
    const rec: Recording = { recordedWith: "live", entries: {} };
    const inner: ChatClient = async () => canned;
    await recordingClient(inner, rec)(req);
    assert.deepEqual(rec.entries[requestKey(req)], canned);
  });
});
