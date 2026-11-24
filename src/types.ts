export type Doc = { id: string; text: string };

export type Chunk = {
  id: string;
  docId: string;
  // Nearest markdown heading above the chunk start, without the # marks.
  // Empty string when the document has no headings.
  heading: string;
  // Every section this chunk covers substantially (see chunk.ts, COVERAGE).
  // Always includes `heading`. Labels match against this list.
  headings: string[];
  text: string;
};

export type ChunkStrategy = "fixed" | "heading";

export type ChunkConfig = {
  strategy: ChunkStrategy;
  // Fixed strategy: window size and overlap in words. Heading strategy: sections
  // longer than maxWords are split into fixed windows of maxWords.
  maxWords: number;
  overlapWords: number;
};

export type SearchMode = "bm25" | "vector" | "hybrid";

export type Hit = { chunk: Chunk; score: number };

// One labeled question. `relevant` is empty for questions the corpus cannot
// answer. A chunk counts as relevant when it matches any entry by id, or by
// doc plus heading (so labels survive a change of chunking strategy).
export type RelevanceLabel = { chunkId: string } | { doc: string; heading: string };

export type Question = {
  id: string;
  question: string;
  relevant: RelevanceLabel[];
};
