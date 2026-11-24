import type { ChatClient, ChatRequest, ChatResponse, Embedder } from "./types.ts";

// Raw OpenAI shapes, only the fields this repo reads.
type OpenAIChatResponse = {
  model: string;
  choices: {
    message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
    finish_reason: string;
  }[];
  usage: { prompt_tokens: number; completion_tokens: number };
};

type OpenAIEmbeddingResponse = {
  data: { index: number; embedding: number[] }[];
  usage: { prompt_tokens: number };
};

export function openaiClient(apiKey: string, fetchFn: typeof fetch = fetch): ChatClient {
  return async (req: ChatRequest): Promise<ChatResponse> => {
    const messages: { role: string; content: string }[] = [];
    if (req.system !== undefined) messages.push({ role: "system", content: req.system });
    for (const m of req.messages) messages.push(m);
    const body: Record<string, unknown> = { model: req.model, messages };
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.tools) {
      body.tools = req.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      }));
    }
    const started = performance.now();
    const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as OpenAIChatResponse;
    const choice = data.choices[0];
    return {
      text: choice?.message.content ?? "",
      toolCalls: (choice?.message.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        input: JSON.parse(c.function.arguments) as Record<string, unknown>,
      })),
      usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens },
      latencyMs: Math.round(performance.now() - started),
      model: data.model,
      stopReason: choice?.finish_reason ?? "unknown",
    };
  };
}

// Embedding usage is tracked on the returned function so measure can cost it.
export type UsageTrackingEmbedder = Embedder & { usage: { inputTokens: number } };

export function openaiEmbedder(apiKey: string, model: string, fetchFn: typeof fetch = fetch): UsageTrackingEmbedder {
  const usage = { inputTokens: 0 };
  const embed = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];
    const res = await fetchFn("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: texts }),
    });
    if (!res.ok) throw new Error(`openai embeddings ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as OpenAIEmbeddingResponse;
    usage.inputTokens += data.usage.prompt_tokens;
    const out: number[][] = new Array(texts.length);
    for (const item of data.data) out[item.index] = item.embedding;
    return out;
  };
  return Object.assign(embed, { usage });
}
