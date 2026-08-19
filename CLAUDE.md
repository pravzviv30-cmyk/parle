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
| What is known to be broken | `docs/KNOWN_ISSUES.md` |

Before finishing any change, run `npm run gate`. It checks typecheck, every
suite, the per-workspace test-count floors, and that no P0 or P1 in the ledger is
still open — where a ticked box only counts if the test it names actually passed.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

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
