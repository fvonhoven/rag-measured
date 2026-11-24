# rag-measured

## What this is

A small retrieval-augmented generation system over React Native documentation, with every stage written by hand and no runtime dependencies. It measures how good retrieval is (recall, precision, MRR) separately from how good the answers are (do they cite the right chunk, do they decline when they should), so you can tell which stage to fix.

## The problem it solves

A language model only knows what was in its training data and what you put in its prompt. To answer questions about your own documents you either paste all of them into every prompt, or you find the few passages that matter and paste only those. The second approach is retrieval-augmented generation (RAG).

RAG is easy to build and hard to know whether it works. The usual failure is that someone reads three good answers, ships it, and never learns that the retriever misses a third of the questions. The retriever and the answerer fail in different ways and need different fixes, so this repo measures each one on its own with a labeled question set, and the offline run prints the real numbers.

## How it works

```
data/corpus/*.md
      |
      v
 load.ts        read markdown files, one Doc per file
      |
      v
 chunk.ts       fixed windows (120 words, 20 overlap)  or  one chunk per heading
      |
      v
 embed.ts       hashed token bag (offline)  or  text-embedding-3-small (live)
      |
      v
 index.ts       VectorIndex (cosine)  +  BM25Index (Okapi, k1=1.2, b=0.75)
      |
      v
 search.ts      bm25 | vector | hybrid (reciprocal rank fusion, k=60)
      |
      v
 rerank.ts      lexical overlap (offline)  or  LLM pointwise 0..10 (live)
      |
      v
 answer.ts      ChatClient with <document> blocks as data, citations as [id]
      |
      v
 metrics.ts     recall@k, precision@k, MRR   |   faithful, abstain rate
```

Stage by stage:

- `src/load.ts` reads every `.md` file under `data/corpus/`. The file name is the doc id.
- `src/chunk.ts` implements both strategies. Each chunk records the heading it starts under and every section it covers at least 25 percent of, so the labels in `data/questions.json` (doc plus heading) apply to either strategy.
- `src/embed.ts` is the offline embedder: tokens and token bigrams hashed into 512 dimensions, L2 normalized. It captures lexical overlap only. `src/providers/openai.ts` has the live embedder.
- `src/index.ts` holds the two indexes. Brute force cosine for vectors, an inverted index with the Okapi BM25 formula for keywords.
- `src/search.ts` builds both indexes over the chunks and answers a query in one of three modes. Hybrid pulls a candidate pool from each index and fuses with reciprocal rank fusion. If the query embedding fails it answers from BM25 alone and flags the result as degraded. If a chunk could not be embedded at index time it stays reachable through BM25 and every vector or hybrid query reports degraded mode.
- `src/rerank.ts` reorders candidates. The LLM reranker scores each candidate 0 to 10 in its own call. The lexical reranker scores by the fraction of query terms present in the chunk.
- `src/answer.ts` builds one user message with the retrieved chunks inside `<document id="...">` blocks and the question at the end. The system prompt is a constant. No tools are offered. Citations are parsed from `[id]` and only ids that were actually retrieved count. A reply with no valid citation counts as an abstention.
- `src/metrics.ts` and `src/evaluate.ts` compute the numbers. Unanswerable questions are excluded from retrieval averages and reported as an abstain rate.
- `src/providers/` has the raw `fetch` clients for Anthropic and OpenAI, a replay client keyed by request hash, and the deterministic fake answerer used offline.
- `src/runtime.ts` chooses live or offline implementations from the environment and prints which.

Data:

- `data/corpus/` is a hand-written fixture of 14 short markdown docs (260 to 320 words each) about React Native: Hermes, the New Architecture, FlatList performance, Metro config, Turbo Native Modules, navigation, flexbox, networking, animations, debugging, testing, platform specific code, upgrading, images. It stands in for the real docs so tests and metrics run offline. It is not the official documentation and may simplify or lag it.
- `scripts/fetch-corpus.ts` downloads 17 pages from `facebook/react-native-website` on GitHub into `data/corpus-fetched/` (gitignored). Set `RAG_CORPUS_DIR=data/corpus-fetched` to run the pipeline over them. The labeled questions target the fixture, so metrics over the fetched docs are not meaningful without relabeling.
- `data/questions.json` has 25 questions: 20 labeled with the relevant doc and heading, 5 deliberately unanswerable from the corpus (push notifications, Xcode minimum version, Flutter comparison, battery level, EAS pricing).
- `data/replay/chat.json` holds the recorded chat calls and `data/replay/embeddings.json` the recorded embeddings (base64 float32, keyed by a hash of model and text), both from the live run. Without them, the offline fallbacks are a hashed bag of words embedder, a lexical reranker and a deterministic fake answerer.

## Results

Live, 2026-11-24: text-embedding-3-small for the vector index, claude-haiku-4-5 for the reranker and the answers. The embeddings are recorded to `data/replay/embeddings.json` and every chat call (750 rerank, 200 answer) to `data/replay/chat.json`. The block below is `npm run measure` with no keys, replaying both; the live run printed the same tables.

```
rag-measured: 2026-11-24
mode: text-embedding-3-small embeddings replayed from data/replay/embeddings.json (recorded 2026-11-24); claude-haiku-4-5 rerank and answer replayed from data/replay/chat.json (recorded live), deterministic fake answerer for misses
corpus: 14 docs, 25 questions (20 answerable, 5 unanswerable), k=5

chunking  variant         chunks  recall@5   prec@5     MRR       faithful   abstain    falseAbs 
--------  --------------  ------  ---------  ---------  --------  ---------  ---------  ---------
fixed     bm25            42       95.0%      26.0%     100.0%    100.0%     100.0%       0.0%   
fixed     vector          42      100.0%      28.0%      97.5%    100.0%     100.0%       0.0%   
fixed     hybrid          42       95.0%      26.0%      97.5%    100.0%     100.0%       0.0%   
fixed     hybrid+rerank   42       97.5%      27.0%     100.0%    100.0%     100.0%       0.0%   
heading   bm25            90      100.0%      21.0%      92.7%    100.0%     100.0%       0.0%   
heading   vector          90      100.0%      21.0%      87.3%    100.0%     100.0%       0.0%   
heading   hybrid          90      100.0%      21.0%      90.8%    100.0%     100.0%       0.0%   
heading   hybrid+rerank   90      100.0%      21.0%     100.0%    100.0%     100.0%       0.0%   

faithful: answerable questions whose answer cites a labeled relevant chunk.
abstain: unanswerable questions where the answer declined. falseAbs: answerable questions where it declined.

tokens this run (reported by API in the recorded run):
  answer stage: 155997 in, 19361 out over 200 calls
  rerank stage: 132681 in, 3000 out over 750 calls
  embeddings:   13196 in
  cost at list price if live: claude-haiku-4-5 $0.4005 + text-embedding-3-small $0.0003 = $0.4007

break-even: whole corpus is about 6456 tokens; a RAG prompt averaged 780 tokens.
  at claude-haiku-4-5 input price, full context costs $0.00646 per query vs $0.00078 with retrieval.
```

How to read it:

- With real embeddings, vector search finds more than keywords on fixed chunks: recall@5 of 100% against 95% for BM25. BM25 still ranks better. Its MRR on heading chunks is 92.7% against 87.3% for vector, and hybrid lands between them.
- The LLM reranker fixes the ranking. Hybrid plus rerank reaches 100% MRR on both chunkings: the relevant chunk is first for every answerable question. It is also the expensive stage: 750 of the run's 950 chat calls and 37% of its cost.
- The answer stage is saturated on this corpus. Haiku cited a labeled relevant chunk for every answerable question in every configuration, declined all five unanswerable questions, and never declined an answerable one. With 14 short documents and five candidates in the prompt, the differences between configurations are all in retrieval order, which is why the retrieval and answer columns are reported separately.
- Precision@5 is capped by the labels. Most questions have one relevant section, so the best possible precision@5 is about 0.2 with heading chunks. Fixed chunks straddle sections, so more of them count as relevant, which is why fixed shows higher precision. Compare rows within a chunking strategy, not across.
- Retrieval pays for itself against stuffing the corpus into the prompt: 780 input tokens per question instead of about 6,456, an eighth of the input cost.

To re-record: set `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` and run `npm run measure`. Both recordings are overwritten.

A single trace from `npm run demo` (replay of the same recording), showing each stage for one answerable and one unanswerable question:

```
mode: text-embedding-3-small embeddings replayed from data/replay/embeddings.json (recorded 2026-11-24); claude-haiku-4-5 rerank and answer replayed from data/replay/chat.json (recorded live), deterministic fake answerer for misses
corpus: 14 docs -> 90 chunks (heading, max 120 words)
index: 90 vectors, 90 BM25 documents

question: Which style properties does useNativeDriver support?
  bm25
    1. animations#2               10.6441  animations / useNativeDriver
    2. animations#1               5.4924  animations / The Animated API
    3. flatlist-performance#5     4.7945  flatlist-performance / Avoid anonymous functions and inline styles in rows
    4. animations#5               3.2760  animations / Choosing between them
    5. hermes#5                   3.2427  hermes / Known limitations
  vector
    1. animations#2               0.6132  animations / useNativeDriver
    2. animations#5               0.3899  animations / Choosing between them
    3. testing#2                  0.3765  testing / Component tests
    4. new-architecture#0         0.3577  new-architecture / The New Architecture
    5. turbo-native-modules#0     0.3575  turbo-native-modules / Turbo Native Modules
  hybrid (reciprocal rank fusion)
    1. animations#2               0.0328  animations / useNativeDriver
    2. animations#5               0.0318  animations / Choosing between them
    3. flatlist-performance#5     0.0302  flatlist-performance / Avoid anonymous functions and inline styles in rows
    4. hermes#5                   0.0276  hermes / Known limitations
    5. animations#4               0.0248  animations / Reanimated
  after rerank
    1. animations#2               8.0000  animations / useNativeDriver
    2. animations#4               3.0000  animations / Reanimated
    3. animations#5               2.0000  animations / Choosing between them
    4. flatlist-performance#5     2.0000  flatlist-performance / Avoid anonymous functions and inline styles in rows
    5. animations#1               2.0000  animations / The Animated API
  answer: According to the documentation, `useNativeDriver` supports non-layout properties. Specifically, `transform` and `opacity` work, while `width`, `height`, and `flex` do not [animations#2].
  citations: animations#2   abstained: false
  tokens: 600 in, 50 out

question: How do I read the device battery level from JavaScript?
  bm25
    1. testing#0                  6.4562  testing / Testing
    2. platform-specific-code#1   4.8511  platform-specific-code / The Platform module
    3. debugging#5                3.9671  debugging / Native logs
    4. turbo-native-modules#2     3.3241  turbo-native-modules / Codegen
    5. networking#5               3.2760  networking / Inspecting requests
  vector
    1. flatlist-performance#6     0.3321  flatlist-performance / Measure before tuning
    2. new-architecture#1         0.2723  new-architecture / What was wrong with the bridge
    3. animations#2               0.2686  animations / useNativeDriver
    4. platform-specific-code#4   0.2645  platform-specific-code / Common differences
    5. debugging#5                0.2643  debugging / Native logs
  hybrid (reciprocal rank fusion)
    1. debugging#5                0.0313  debugging / Native logs
    2. testing#0                  0.0309  testing / Testing
    3. hermes#4                   0.0299  hermes / Debugging with Hermes
    4. networking#5               0.0297  networking / Inspecting requests
    5. animations#2               0.0294  animations / useNativeDriver
  after rerank
    1. platform-specific-code#1   2.0000  platform-specific-code / The Platform module
    2. debugging#1                2.0000  debugging / The developer menu
    3. new-architecture#2         2.0000  new-architecture / JSI
    4. turbo-native-modules#5     2.0000  turbo-native-modules / Synchronous methods
    5. debugging#5                0.0000  debugging / Native logs
  answer: I cannot answer this from the provided documents.

The provided documents cover topics like platform-specific code, debugging, JSI, Turbo Native Modules, and native logs, but they do not contain information about how to read the device battery level from JavaScript in React Native.
  citations: (none)   abstained: true
  tokens: 594 in, 60 out
```

## Design decisions

**Hybrid search over vector-only.** The obvious modern choice is embeddings alone. They are rejected as the sole retriever because documentation questions are full of exact identifiers (`windowSize`, `useNativeDriver`, `--reset-cache`) that embeddings blur and BM25 matches exactly, and because BM25 keeps working when the embedding service does not. Reciprocal rank fusion was chosen over weighted score sums because cosine and BM25 scores are on unrelated scales and RRF needs no calibration: it only looks at ranks. The offline table shows the cost of this choice too: fusing a weak vector list into a strong BM25 list can lower MRR. Hybrid is a hedge, not a free win, and the table is there so you can see which it is on your data.

**Retrieval metrics separated from answer metrics.** A single "answer accuracy" number hides which stage failed. If recall@5 is 0.95 and faithfulness is 0.60, the retriever is fine and the prompt or model is the problem. If recall@5 is 0.60, no prompt engineering will fix the 40 percent of questions whose evidence never reached the model. Retrieval metrics are also cheap and deterministic (no model call), so they can run in CI on every change to chunking or indexing. Answer metrics need the model and are measured less often.

**Labels by doc plus heading, not by chunk id.** Chunk ids change whenever the chunking strategy or size changes, which would make the question set unusable for exactly the comparison this repo exists to make. Labels name a section instead, and each chunk records which sections it covers. The cost is a judgment call in `chunk.ts` (a fixed chunk must hold 25 percent of a section to count) that affects the numbers. It is a constant, documented, and the same for every row.

**Faithfulness as "cites a relevant chunk" rather than an LLM judge.** An LLM judge would give a richer score but cannot run offline, costs money per evaluation, and introduces a second model whose errors are hard to separate from the first. Citation overlap is crude, measurable with no network, and catches the two failures that matter most: answering from a wrong chunk and answering with no evidence at all.

**Abstention measured explicitly.** Five of 25 questions have no answer in the corpus. Without them a system that always answers would look perfect. The abstain column is the rate at which the answer stage says it cannot answer; falseAbs is the rate at which it says so wrongly. Both need to be watched, because a prompt that raises one usually raises the other.

## When not to use this

**Small corpus, low volume: put the documents in the prompt.** This fixture corpus is about 6,456 tokens (estimated at 4 characters per token). Every modern model accepts that with room to spare. Putting the whole corpus in every prompt gives recall of 1.0 by construction, needs no chunking, no index, no labels, and no reranker. The cost of that simplicity, from `src/pricing.ts` at 2026-09 list prices:

- Full corpus per query on claude-haiku-4-5: 6,456 tokens times $1.00 per million = $0.0065.
- RAG prompt per query, measured in this run: 837 tokens = $0.0008.
- Difference: about $0.0056 per query, or $56 per 10,000 queries. On claude-sonnet-4-5 (input $3.00 per million) the difference is $0.017 per query, $169 per 10,000.

So the break-even is not about tokens until volume is high or the corpus is large. Below roughly 10,000 queries a month on a corpus that fits in context, the engineering time to build and maintain retrieval costs more than the tokens it saves, and full context answers better. Prompt caching narrows the gap further. Build retrieval when the corpus does not fit (or fits only by crowding out the question), when per-query latency from a large prompt matters, or when the token arithmetic above crosses your engineering cost.

**Corpus above a few thousand chunks.** The vector index is brute force. Fine at 90 chunks, fine at 5,000, not fine at 500,000. That needs an approximate nearest neighbor index, which this repo does not have.

**Questions that need reasoning across many documents.** Top-5 retrieval assumes the answer sits in a few passages. "Which docs mention Hermes?" or "summarize everything about performance" needs a different design.

**No labeled questions.** The measurement half of this repo is worth nothing without a question set that someone labeled by hand. If you will not write and maintain one, you get a RAG system that you cannot tell is working, which is the situation this repo exists to avoid.

## Running it

Requires Node 22.18 or later. No install step is needed to run:

```
npm test            # 38 tests, offline, no keys
npm run measure     # full comparison table, offline by default
npm run demo        # one trace through every stage; pass your own question as an argument
```

Both `npm test` and `npm run measure` work with no network and no environment variables.

To typecheck, `npm install` (installs typescript and @types/node only) then `npm run typecheck`.

Live mode: copy `.env.example` to `.env`, fill in `OPENAI_API_KEY` for embeddings and `ANTHROPIC_API_KEY` for rerank and answers, export them, and run `npm run measure` again. The first line of output says which stages are live. Either key alone switches only that stage. `RAG_CHAT_MODEL` and `RAG_EMBED_MODEL` override the defaults (`claude-haiku-4-5`, `text-embedding-3-small`). `RAG_CORPUS_DIR` points the scripts at another folder of markdown, such as `data/corpus-fetched` after `npm run fetch-corpus`.

## Cost

Token counts from the 2026-11-24 live run, as reported by the APIs. Prices are 2026-09 list prices from `src/pricing.ts` and will change.

Answer stage: 200 calls (25 questions times 8 configurations), 155,997 input and 19,361 output tokens.

- claude-haiku-4-5: 155,997 x $1.00/M + 19,361 x $5.00/M = $0.156 + $0.097 = $0.253

Rerank stage: 2 configurations use the LLM reranker, 25 questions each, 15 candidates each = 750 calls, 132,681 input and 3,000 output tokens.

- claude-haiku-4-5: 132,681 x $1.00/M + 3,000 x $5.00/M = $0.133 + $0.015 = $0.148

Embeddings: 13,196 tokens (both chunkings of the corpus plus the queries).

- text-embedding-3-small: 13,196 x $0.02/M = $0.0003

Total for one live measure run: $0.40. On claude-sonnet-4-5 the two chat stages cost three times as much, about $1.20. Per production query with hybrid plus rerank on haiku: about 780 input tokens for the answer plus 15 rerank calls of about 177 input tokens each, roughly 3,400 input and 160 output tokens, about $0.004.
