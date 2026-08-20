## Context docs

`docs/` is the map. Read [docs/README.md](docs/README.md) first and then the one
file that answers your question — not the whole folder, and not the source.

| Question | File |
|---|---|
| What the workspaces are, who owns which decision | `docs/ARCHITECTURE.md` |
| How a live session works end to end | `docs/LIVE_VOICE.md` |
| The ladder, the rescue, what counts as a right answer | `docs/PEDAGOGY.md` |
| Where the learner's data lives | `docs/STATE_AND_STORAGE.md` |
| How to run and write tests | `docs/TESTING.md` |
| The gate, the bug loop, the agents | `docs/LOOP.md` |
| Building something new, and which model does what | `docs/FORGE.md` |
| What is known to be broken | `docs/KNOWN_ISSUES.md` |

Before finishing any change, run `npm run gate`. It checks typecheck, every
suite, the per-workspace test-count floors, and that no P0 or P1 in the ledger is
still open — where a ticked box only counts if the test it names actually passed.

## Think like a senior engineer

Every design, implementation, and intelligence decision in this repo gets
senior-level scrutiny before code is written:

- Question the design first: what problem is this actually solving, and is there
  a smaller shape that solves it?
- Prefer an existing seam over a new mechanism — the adapter pattern (`auth/`),
  the brain activity table (`llm/routing.ts`), a protocol tag, a versioned store.
  This repo rewards pattern-following and punishes parallel inventions.
- Name the tradeoffs and risks before building, not after they are discovered.
- The model observes, code decides: intelligence features put judgement in
  prompts and policy in code, never the reverse.
- User-facing copy is design: warm, human, short plain sentences, no em dashes,
  no scolding, honest about what the product is.
- Nothing ships without a test that fails if the behaviour regresses, and
  `npm run gate` green.

## graphify

This project has a knowledge graph at `graphify-out/` — 1939 nodes, 4888 links
across the source files, grouped into 116 named communities.

**Route by the shape of the question.** Reaching for a bare `graphify query` is the
wrong default here: it truncates. A live-voice question finds 269 nodes and shows 60,
and the node list it returns carries no edges — so it costs tokens without answering.

| Question shape | Command |
|---|---|
| What breaks if I change X / who uses X | `graphify affected "X"` |
| What is X | `graphify explain "X"` |
| How does \<subsystem\> work | `graphify query "..." --context call --budget 3000` |
| Relationship between two symbols | `graphify path "A" "B" --undirected` |
| Broad architecture | `graphify-out/wiki/index.md`, then `GRAPH_REPORT.md` § Community Hubs |

Rules:
- **Always pass `--context call`** to `query`. It drops that same live-voice question
  from 269 nodes to 33 with no truncation, and returns 37 `--calls-->` edges with
  `file:line` instead of a bare list of names. If a result still says `[!] TRUNCATED`,
  narrow the context or switch to `affected`/`explain` — do not just raise `--budget`.
- **`path` needs `--undirected`.** The graph is built undirected, but `path` defaults
  to a directed search and reports "No directed path found" on edges that do exist.
- `affected` and `explain` are the precise commands — both cite `file:line`. Prefer
  them whenever the question names a symbol.
- Start broad navigation at `graphify-out/wiki/index.md` (110 concept articles, ~1.9k
  tokens) rather than `GRAPH_REPORT.md` (~5.3k tokens).
- Going straight to a file to edit or debug specific lines is fine. The graph is for
  orientation, not a gate.
- After modifying code, run `graphify update .` to keep the graph current (AST-only,
  no API cost). **`update` re-clusters and renames communities after its hub files**,
  so if you care about the names, run `graphify label . --backend claude-cli` *after*
  `update`, then `graphify export wiki` — in that order. Use `claude-cli`, not
  `claude`: the plain `claude` backend demands an `ANTHROPIC_API_KEY` and silently
  falls back to filename labels.

Known limits (do not mistake these for working):
- **Docs do not link to code.** The 69 nodes under `docs/` form a closed island — zero
  edges into source — so prose cannot route you to a symbol. Closing this needs a
  `--mode deep` rebuild.
- **Theme primitives inflate the hubs.** `space()` from `apps/mobile/src/theme.ts` is
  the third most-connected node (62 edges), so UI-adjacent traversals pull in the
  styling layer. `--context call` sidesteps it.
- **Seeding is lexical, not semantic.** Asking "what counts as a *right* answer" seeds
  on a node named `counts` and on `ArrowRight()`. Name real symbols in queries.

## Worktrees

Run tests from the main checkout, not from a `.claude/worktrees/` worktree. A
worktree has no `node_modules` of its own, so Node resolution walks up past it
into the parent directories and can bind to the wrong copy of a dependency.

`packages/brain` is where this bites: it depends on `@anthropic-ai/sdk@^0.117.1`
and gets its own nested install, while `@livekit/agents-plugin-anthropic` pulls
`^0.33.1` up to the root. Both copies are correct and intentional. From a
worktree, brain's nested copy is invisible and the old root one wins.

The symptom is a module that fails to *load*, not an assertion that fails:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '<repo>/node_modules/@anthropic-ai/sdk/helpers/zod.mjs'
  imported from packages/brain/src/contract/schemas.test.ts
```

Read the test count, not just the failure count — a file that never loads takes
its whole suite with it silently (brain reports 122 tests from a worktree, 146
from the main checkout). Either `npm install` inside the worktree, or run tests
from the repo root.
