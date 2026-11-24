import type { Chunk, ChunkConfig, Doc } from "./types.ts";
import { words } from "./tokenize.ts";

// Stage 2: split documents into chunks. Two strategies, chosen by config.
//
// fixed:   sliding window of maxWords words with overlapWords overlap. Ignores
//          structure. Chunks can straddle headings.
// heading: one chunk per markdown section. Sections longer than maxWords are
//          split into fixed windows so no chunk exceeds the budget.
//
// Both record the nearest heading above the chunk start so labels in
// data/questions.json (doc plus heading) apply to either strategy.

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = { strategy: "heading", maxWords: 120, overlapWords: 20 };

type Section = { heading: string; lines: string[] };

const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;

export function splitSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { heading: "", lines: [] };
  for (const line of text.split(/\r?\n/)) {
    const m = HEADING.exec(line);
    if (m) {
      if (current.lines.some((l) => l.trim().length > 0) || current.heading) sections.push(current);
      current = { heading: m[1] ?? "", lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((l) => l.trim().length > 0) || current.heading) sections.push(current);
  return sections;
}

function windows<T>(ws: T[], size: number, overlap: number): T[][] {
  if (ws.length === 0) return [];
  const step = Math.max(1, size - overlap);
  const out: T[][] = [];
  for (let start = 0; start < ws.length; start += step) {
    out.push(ws.slice(start, start + size));
    if (start + size >= ws.length) break;
  }
  return out;
}

// A fixed chunk "covers" a section when it holds at least this fraction of
// the section's words. Labels name sections, so this decides which fixed
// chunks count as relevant. 0.25 means a chunk holding a few trailing words
// of a section does not get credit for it.
export const COVERAGE = 0.25;

export function chunkDoc(doc: Doc, cfg: ChunkConfig): Chunk[] {
  const sections = splitSections(doc.text);
  const chunks: Chunk[] = [];
  const push = (heading: string, headings: string[], text: string) => {
    if (text.trim().length === 0) return;
    chunks.push({ id: `${doc.id}#${chunks.length}`, docId: doc.id, heading, headings, text });
  };

  if (cfg.strategy === "heading") {
    for (const s of sections) {
      const body = s.lines.join("\n").trim();
      const bodyWords = words(body);
      if (bodyWords.length <= cfg.maxWords) {
        push(s.heading, [s.heading], s.heading ? `${s.heading}\n\n${body}` : body);
      } else {
        for (const w of windows(bodyWords, cfg.maxWords, cfg.overlapWords)) {
          push(s.heading, [s.heading], s.heading ? `${s.heading}\n\n${w.join(" ")}` : w.join(" "));
        }
      }
    }
    return chunks;
  }

  // fixed: one word stream, each word tagged with the heading it sits under.
  const stream: { word: string; heading: string }[] = [];
  const sectionLength = new Map<string, number>();
  for (const s of sections) {
    const text = s.heading ? `${s.heading} ${s.lines.join("\n")}` : s.lines.join("\n");
    const ws = words(text);
    sectionLength.set(s.heading, (sectionLength.get(s.heading) ?? 0) + ws.length);
    for (const w of ws) stream.push({ word: w, heading: s.heading });
  }
  for (const w of windows(stream, cfg.maxWords, cfg.overlapWords)) {
    const counts = new Map<string, number>();
    for (const x of w) counts.set(x.heading, (counts.get(x.heading) ?? 0) + 1);
    const first = w[0]?.heading ?? "";
    const headings = [...counts.entries()]
      .filter(([h, n]) => h === first || n >= COVERAGE * (sectionLength.get(h) ?? Infinity))
      .map(([h]) => h);
    push(first, headings, w.map((x) => x.word).join(" "));
  }
  return chunks;
}

export function chunkCorpus(docs: Doc[], cfg: ChunkConfig): Chunk[] {
  return docs.flatMap((d) => chunkDoc(d, cfg));
}
