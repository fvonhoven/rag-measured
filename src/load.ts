import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Doc } from "./types.ts";

// Stage 1: load every .md file in a folder. The doc id is the file name
// without extension, so a label like { doc: "hermes" } points at hermes.md.

export function loadCorpus(dir: string): Doc[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  return files.map((f) => ({
    id: basename(f, ".md"),
    text: readFileSync(join(dir, f), "utf8"),
  }));
}
