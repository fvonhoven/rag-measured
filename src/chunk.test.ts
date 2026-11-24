import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkDoc, splitSections } from "./chunk.ts";
import { words } from "./tokenize.ts";

const doc = {
  id: "d",
  text: [
    "# Title",
    "Intro sentence about the topic.",
    "",
    "## First section",
    ...Array.from({ length: 6 }, (_, i) => `first section line ${i} with a few more words here.`),
    "",
    "## Second section",
    ...Array.from({ length: 6 }, (_, i) => `second section line ${i} with a few more words here.`),
  ].join("\n"),
};

describe("splitSections", () => {
  it("splits on markdown headings and strips the marks", () => {
    const s = splitSections(doc.text);
    assert.deepEqual(
      s.map((x) => x.heading),
      ["Title", "First section", "Second section"],
    );
  });
});

describe("chunkDoc heading strategy", () => {
  it("makes one chunk per section, prefixed with the heading text", () => {
    const chunks = chunkDoc(doc, { strategy: "heading", maxWords: 200, overlapWords: 0 });
    assert.equal(chunks.length, 3);
    assert.equal(chunks[1]?.heading, "First section");
    assert.ok(chunks[1]?.text.startsWith("First section\n\n"));
    assert.deepEqual(chunks[1]?.headings, ["First section"]);
    assert.equal(chunks[0]?.id, "d#0");
  });

  it("splits a long section into windows that respect maxWords", () => {
    const chunks = chunkDoc(doc, { strategy: "heading", maxWords: 20, overlapWords: 5 });
    assert.ok(chunks.length > 3);
    for (const c of chunks) assert.ok(words(c.text).length <= 20 + 2, c.id); // heading line adds two words
    assert.ok(chunks.every((c) => ["Title", "First section", "Second section"].includes(c.heading)));
  });
});

describe("chunkDoc fixed strategy", () => {
  it("windows with overlap and tags every section a window substantially covers", () => {
    const chunks = chunkDoc(doc, { strategy: "fixed", maxWords: 40, overlapWords: 10 });
    const total = words(doc.text.replace(/^#+\s*/gm, "")).length;
    assert.equal(chunks.length, Math.ceil((total - 40) / 30) + 1);
    // overlap: last 10 words of chunk 0 are the first 10 of chunk 1
    const a = words(chunks[0]?.text ?? "");
    const b = words(chunks[1]?.text ?? "");
    assert.deepEqual(a.slice(-10), b.slice(0, 10));
    // a window straddling the boundary lists both sections
    const straddler = chunks.find((c) => c.headings.length > 1);
    assert.ok(straddler, "expected a chunk covering two sections");
    assert.ok(straddler.headings.includes(straddler.heading));
  });
});

describe("chunkDoc adversarial input", () => {
  it("handles a document with no headings", () => {
    const plain = { id: "p", text: "just some words on a line\nand another line of words" };
    for (const strategy of ["fixed", "heading"] as const) {
      const chunks = chunkDoc(plain, { strategy, maxWords: 100, overlapWords: 0 });
      assert.equal(chunks.length, 1);
      assert.equal(chunks[0]?.heading, "");
      assert.deepEqual(chunks[0]?.headings, [""]);
      assert.ok(chunks[0]?.text.includes("another line"));
    }
  });

  it("produces zero chunks for an empty or whitespace document", () => {
    for (const strategy of ["fixed", "heading"] as const) {
      assert.deepEqual(chunkDoc({ id: "e", text: "" }, { strategy, maxWords: 50, overlapWords: 5 }), []);
      assert.deepEqual(chunkDoc({ id: "e", text: "\n\n  \n" }, { strategy, maxWords: 50, overlapWords: 5 }), []);
    }
  });

  it("does not loop forever when overlap is greater than or equal to size", () => {
    const chunks = chunkDoc(doc, { strategy: "fixed", maxWords: 10, overlapWords: 50 });
    assert.ok(chunks.length > 0 && chunks.length < 1000);
  });
});
