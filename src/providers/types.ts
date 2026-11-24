// Shared provider contract. Everything above this layer takes a ChatClient as
// an argument so tests can inject a fake and never touch the network.

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ToolSpec = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type ChatRequest = {
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  tools?: ToolSpec[];
};

export type ChatResponse = {
  text: string;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
  model: string;
  stopReason: string;
};

export type ChatClient = (req: ChatRequest) => Promise<ChatResponse>;

// Embedders share the same shape: a function, injected, never a global.
export type Embedder = (texts: string[]) => Promise<number[][]>;
