# Why it is built this way

## Tradeoffs made

**Everything by hand, zero dependencies.** BM25, cosine search, reciprocal rank fusion, and the provider clients are each under a hundred lines. A vector database or a RAG framework would do the same job with less code to read, but the point of the repo is that a reader can see what those tools do underneath. The cost is that the vector index is brute force and the tokenizer is a regex with a one-rule stemmer. Both are stated in the README rather than hidden.

**A fake answerer instead of no answer metrics offline.** The repo was built without API keys, so the first answer columns came from a deterministic function that cites by lexical overlap. It would have been cleaner to show only retrieval numbers offline. The fake was kept because it exercises the whole path (prompt building, citation parsing, abstention handling), and it is still what runs when there is neither a key nor a recording. The README now shows the live numbers.

**Labels by section, with a coverage rule.** Labeling by chunk id would have been simpler and exact, but it would have tied the question set to one chunking configuration. The section based labels make the fixed versus heading comparison possible at the price of a 25 percent coverage threshold that is a judgment call. Changing it changes the fixed chunking rows.

**The offline embedder is lexical.** A hashed bag of words is honest about what it is: a way to run the vector path with no network. It is not a stand-in for semantic embeddings, and offline it lost to BM25 on every row. With real embeddings the picture changed: vector search found more relevant chunks than BM25 on fixed chunks, and ranked them slightly worse on both chunkings.

## What I would do differently

**Record real embeddings from the start.** The first live run recorded only the chat calls, so a keyless replay fell back to hashed embeddings and printed a different table from the live one. Embeddings are now recorded too (`src/providers/embedReplay.ts`), and a replay misses loudly instead of mixing vector spaces. That should have been in the first version.

**More questions, and multi-section ones.** Twenty answerable questions is enough to see a 5 point difference and not enough to trust a 2 point one. Questions whose answer spans two sections would make precision@5 more informative than it is with one relevant chunk per question.

**An LLM judge as a second answer metric, live only.** Citation overlap catches wrong-chunk answers but not answers that cite the right chunk and misstate it. A judge that reads the chunk and the answer would catch that, at the cost of a second model in the loop. It belongs in live mode, next to the citation check, not instead of it.

**Chunk size sweep.** Sweeping `maxWords` from 60 to 300 for each strategy would show where recall and prompt size trade off on this corpus. The code already takes it as a parameter.
