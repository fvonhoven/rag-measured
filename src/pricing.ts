// List prices in USD per million tokens as of 2026-09. Prices change; update
// here and every cost figure in the repo follows.

export const PRICES = {
  "claude-opus-4-1": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
} as const;

export type PricedModel = keyof typeof PRICES;

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model as PricedModel];
  if (!price) return 0;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
