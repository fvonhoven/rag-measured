import type { ChatClient, ChatRequest, ChatResponse, ToolCall } from "./types.ts";

// Raw Anthropic Messages API shapes, only the fields this repo reads.
type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type AnthropicResponse = {
  model: string;
  stop_reason: string;
  content: AnthropicContentBlock[];
  usage: { input_tokens: number; output_tokens: number };
};

export function anthropicClient(apiKey: string, fetchFn: typeof fetch = fetch): ChatClient {
  return async (req: ChatRequest): Promise<ChatResponse> => {
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      messages: req.messages,
    };
    if (req.system !== undefined) body.system = req.system;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.tools) {
      body.tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }
    const started = performance.now();
    const res = await fetchFn("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as AnthropicResponse;
    const text = data.content
      .filter((b): b is Extract<AnthropicContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    const toolCalls: ToolCall[] = data.content
      .filter((b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));
    return {
      text,
      toolCalls,
      usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens },
      latencyMs: Math.round(performance.now() - started),
      model: data.model,
      stopReason: data.stop_reason,
    };
  };
}
