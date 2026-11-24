import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Downloads a fixed list of React Native docs pages from the website repo
// into data/corpus-fetched/ (gitignored). The committed fixture corpus in
// data/corpus/ is hand written and stands in for these so tests and measure
// run offline. To measure over the real docs, run this and then point the
// scripts at the fetched folder with RAG_CORPUS_DIR.
//
// Paths follow the docs/ layout of facebook/react-native-website on main at
// the time of writing. A page that has moved returns 404 and is reported,
// not fatal, so one rename does not break the whole fetch.

const BASE = "https://raw.githubusercontent.com/facebook/react-native-website/main/docs";

const PAGES = [
  "hermes",
  "the-new-architecture/landing-page",
  "flatlist",
  "optimizing-flatlist-configuration",
  "performance",
  "metro",
  "turbo-native-modules-introduction",
  "fabric-native-components-introduction",
  "navigation",
  "flexbox",
  "network",
  "animations",
  "debugging",
  "testing-overview",
  "platform-specific-code",
  "upgrading",
  "images",
];

async function main(): Promise<void> {
  const outDir = join(import.meta.dirname, "..", "data", "corpus-fetched");
  mkdirSync(outDir, { recursive: true });
  let ok = 0;
  for (const page of PAGES) {
    const url = `${BASE}/${page}.md`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`skip ${page}: HTTP ${res.status}`);
      continue;
    }
    const text = await res.text();
    const file = join(outDir, `${page.replace(/\//g, "-")}.md`);
    writeFileSync(file, text);
    ok++;
    console.log(`fetched ${page} (${text.length} chars)`);
  }
  console.log(`${ok}/${PAGES.length} pages written to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
