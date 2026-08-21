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
| Who owns which part of the codebase, and which agent to call | `docs/TEAM.md` |
| What is known to be broken | `docs/KNOWN_ISSUES.md` |

Before finishing any change, run `npm run gate`. It checks typecheck, every
suite, the per-workspace test-count floors, that every agent is still pinned to
its model, and that no P0 or P1 in the ledger is still open — where a ticked box
only counts if the test it names actually passed.

Two git hooks enforce it without being asked: `pre-commit` runs `npm run gate:fast`
(the file-reading checks only, well under a second) and `pre-push` runs the full
bar. They live in `.githooks/` and `npm install` points git at them. Fast mode
deliberately ignores open P0/P1 work, because `/forge` files its ledger entries
*before* it builds — a red ledger is what a healthy in-progress branch looks like.

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

## The team

Sixteen agents work in this repo. Four are **roles in a loop** — `design-architect`
decides the shape, `bug-hunter` repairs, `fix-verifier` refutes, `work-judge` says
SHIP. Twelve are **engineers who own a territory** of the codebase. The roster and
the territories are in `docs/TEAM.md`.

| Want | Run |
|---|---|
| Something built properly | `/forge <what you want built>` |
| To know if it is safe to release | `/ship` |
| To know if this belongs on main yet | `/land` |
| One pass at the ledger's top open item | `/bug-sweep` |
| A specific specialist | ask for it by name |

`/forge` designs on Fable, routes the build to whichever engineer owns the files
the contract touches, then judges on Fable until the gate is green.

Two rules hold the team together. **An engineer edits only its own territory** and
files work outside it, which is what stops three agents editing the same file in
one round. And **`packages/core` pedagogy has no specialist on purpose**:
`ARCHITECTURE.md` gives the ladder, the matching and the summary exactly one owner
each, and a second opinion about them is how a repo grows two ladders.

## graphify

This project has a knowledge graph at `graphify-out/` — 2277 nodes, 5554 links
across the source files, grouped into 151 named communities.

**Route by the shape of the question, and name real symbols.** Reaching for a bare
`graphify query` is the wrong default here: it truncates. A prose live-voice question
finds 304 nodes, shows 61, and the node list it returns carries no edges — so it costs
tokens without answering.

| Question shape | Command |
|---|---|
| What breaks if I change X / who uses X | `graphify affected "X"` |
| What is X | `graphify explain "X"` |
| How do these symbols connect | `graphify query "sym1 sym2 sym3" --context call --budget 3000` |
| Relationship between two symbols | `graphify path "A" "B" --undirected` |
| Broad architecture | `graphify-out/wiki/index.md`, then `GRAPH_REPORT.md` § Community Hubs |

Rules:
- **Seed `query` on symbol names, never on a sentence.** This is the difference between
  a useful answer and an empty one, not a style preference. `"how does the live voice
  session work"` seeds on `Session` from the playground and `session()` from a *test
  file*, and returns 5 nodes with no edges. `"useLiveSession ParleTutor grantSession"`
  returns 50 nodes and 52 edges, complete and untruncated.
- **Always pass `--context call`** to `query`. You get `EDGE a --calls [...]--> b
  at=file:L123` lines instead of a bare list of names. If a result still says
  `[!] TRUNCATED`, narrow the context or switch to `affected`/`explain` — do not just
  raise `--budget`. A result that says it is *over* budget but complete is fine: edges
  are never dropped once every node fits, so raising `--budget` will not shrink it.
- **`path` needs `--undirected`.** The graph is built undirected, but `path` defaults
  to a directed search and reports "No directed path found" on edges that do exist.
- `affected` and `explain` are the precise commands — both cite `file:line`. Prefer
  them whenever the question names a symbol, which is most of the time.
- Start broad navigation at `graphify-out/wiki/index.md` (161 concept articles, ~2.3k
  tokens) rather than `GRAPH_REPORT.md` (~5.5k tokens).
- Going straight to a file to edit or debug specific lines is fine. The graph is for
  orientation, not a gate.
- After modifying code, run `graphify update .` to keep the graph current (AST-only,
  no API cost). **`update` re-clusters and renames communities after its hub files**,
  so if you care about the names, run `graphify label . --backend claude-cli` *after*
  `update`, then `graphify export wiki` — in that order. Use `claude-cli`, not
  `claude`: the plain `claude` backend demands an `ANTHROPIC_API_KEY` and silently
  falls back to filename labels.

Known limits (do not mistake these for working):
- **Docs do not link to code.** The 101 nodes under `docs/` form a closed island — zero
  edges into source, measured — so prose cannot route you to a symbol. Closing this
  needs a `--mode deep` rebuild.
- **Theme primitives inflate the hubs.** `space()` from `apps/mobile/src/theme.ts` is
  now the **most** connected node in the repo (69 edges), so UI-adjacent traversals pull
  in the styling layer. `--context call` sidesteps it.
- **Seeding is lexical, not semantic.** Asking "what counts as a *right* answer" seeds
  on a node named `counts` and on `ArrowRight()`. This is the same trap as the first
  rule above, and it is the single most common way to waste a query here.

## Landing work on main

**Decide this yourself, and decide it out loud.** When a piece of work reaches a natural
stopping point, do not wait to be asked whether it should go to `main`. Run the judgement in
`.claude/commands/land.md` and say which of the four verdicts it is: **LAND**, **HOLD**,
**SPLIT** or **ASK**. Landing on a clear LAND is authorised standing work; so is holding.
Saying nothing is the only wrong answer, because it leaves finished work sitting in a dirty
tree where the next session can absorb it.

Two of those verdicts are worth more than they look. **SPLIT** is the usual right answer for
a session that drifted into a second topic, and **HOLD** is nearly always better than a
marginal LAND: a branch that waits a day costs one person, and half a change on `main` costs
everyone who pulls.

Three hard stops, and none of them is negotiable by being asked:

- **Never stage what this session did not write.** `git add -A` and `git add .` are
  forbidden here; two sessions share this tree often enough that the sweep is a real way to
  publish somebody's half-finished work under your name. Stage explicit paths, and if you
  cannot tell whose a file is, that is **ASK**.
- **Never merge while another session is mid-edit.** `git status` showing files you did not
  touch, or `git worktree list` showing a live worktree, means someone is working. Your own
  files may still land; theirs never do.
- **Never `--force`, `--no-verify`, or rebase anything already pushed.** The hooks are the
  last honest check on the way out; a change that needs them off is a change that is not
  ready.

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
