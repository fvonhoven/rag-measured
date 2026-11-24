// One tokenizer shared by BM25, the hash embedder, and the lexical reranker so
// that the three agree on what a term is.

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from", "has", "have",
  "how", "i", "if", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "their", "then",
  "there", "these", "they", "this", "to", "was", "what", "when", "where", "which", "who", "why", "will",
  "with", "you", "your", "should", "would", "could", "my", "me", "we", "our", "not", "no", "so", "than",
]);

// Minimal stemming: drop a trailing "s" from words of four or more letters
// so "controls" and "control" match. Not a real stemmer, but enough for
// documentation prose and cheap to reason about.
function stem(t: string): string {
  return t.length >= 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

export function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

// Rough token estimate for cost reporting: about four characters per token
// for English prose. Stated as an estimate wherever it is printed.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
