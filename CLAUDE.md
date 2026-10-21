## Shared entry points

Read [AGENTS.md](AGENTS.md) for the repository map and common working rules.
[CONTEXT.md](CONTEXT.md) routes to existing domain documents;
[DECISIONS.md](DECISIONS.md) records new lasting choices. Substantial changes
can use the tracked task contract in [docs/changes/](docs/changes/README.md).
The Claude Code commands, model pins and review sequences below remain in force
when those workflows are used.

## Where this project lives

The permanent home of this project is `/Users/pravz_07/Developer/StartUps/Luvani`
(renamed from the old `Parle` path, and moved out of the iCloud-synced `~/Documents`
on 2026-10-20 so iCloud cannot evict project files; `~/Documents/StartUps` is only a link). It is the integration destination. Work in
the checkout attached to the current task; a worktree is a valid editing root.
Worktree changes are not landed until integrated through the existing landing
workflow. Do not silently move edits into another session's checkout.

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

## TypeSafe Jev

Jev, TypeSafe's model, answers typed judgments: yes or no, one option from a set,
or a score on levels. It writes no text. When a task involves an LLM call whose
whole answer is a judgment, load the TypeSafe skill (`/typesafe:typesafe-ai`) and
read its live docs before designing. Writing stays on the brain: turns, frames,
memory, drills and extensions.

- The integration today: `packages/brain/src/llm/jevJudge.ts` screens the
  own-words judge, and `typesafe.ts` is the HTTP client. `brainClientFromEnv`
  wraps whichever brain `TUTOR_LLM` chose in `JevFirstBrainClient` when
  `TYPESAFE_API_KEY` is set, so there is still one factory.
- Jev may only remove a brain call, never change what the brain would have been
  asked. Anything uncertain goes to the brain. The pass thresholds are `JEV_PASS`;
  do not lower them without an eval on real attempts, because Jev's strongest
  language is English and learners write French.
- The token server logs `[luvani:judge] answered by <model>` for every check,
  which is how to see what Jev settled.
- Sending learner text to Jev makes TypeSafe a recipient of it, so
  `apps/mobile/src/legal/policy.ts` has to name it before production.
- Dev-time checks: `npm run jev` asks Jev a typed question about repo text (copy,
  doc drift, agent reports). It is advisory and never sends `.env` contents, keys,
  learner or account data. Rules are in `../CLAUDE.md`, "Jev in the session
  workflow".

## Mercury development model routing

This section governs Mercury's Agent dispatch for development, not the app's tutor
models. The Claude Code `/forge` commands and their gate-enforced agent pins remain
unchanged; their mandatory Fable design/judge sequence is not Mercury's default loop.
`MERCURY.md` imports this file so the routing policy has one home.

| Role | Model | When to use it |
|---|---|---|
| Lead and integrator | `gpt-6-astra` main session | Own scope, acceptance checks, shared interfaces, integration and final report. Do tiny fixes directly. |
| Default builder | Agent `model: "claude-opus-5-5"` | Delegate substantial, bounded implementation with tests, using the relevant specialist role when available. |
| Escalation architect or judge | Agent `model: "fable"` | Unresolved architecture, difficult cross-cutting failures, or independent review of high-risk changes. |
| Independent verifier and bounded alternate builder | Agent `model: "gpt-6-sol"` | Review Opus-built changes read-only; take bounded fixes/tests when a separate builder is useful. |

As of 2026-09-23, a direct Mercury Agent request with `model: "gpt-6-sol"`
successfully executed. Use this exact ID, not the older `gpt-5.6-sol` bundled entry.
The successful dispatch confirms access, not comparative quality or current pricing.
Explicit model overrides must succeed;
if a builder is unavailable, report that and use Astra for the bounded implementation
rather than silently claiming the requested model ran. An independent review must
remain a fresh read-only agent, never the lead reviewing its own work. If a required
Fable reviewer is unavailable, stop and report the missing review; do not downgrade it.
Never override a Fable-pinned role with another engine. In Mercury, use the separate
Claude Code `/forge` workflow only when explicitly requested and available; do not
invent or invoke an unavailable command.

### Smallest sufficient workflow

- **Small, clear change:** Astra edits and runs the relevant checks. No planning
  agent, implementation handoff or duplicate model opinion just for ceremony.
- **Normal feature:** Astra sets the acceptance criteria and file boundaries;
  Opus implements and tests; Astra inspects the diff, integrates and verifies.
  For work needing independent verification, use a fresh read-only verifier,
  normally Sol for an Opus-built change, or Opus for a Sol-built change. Give it the
  original requirements and diff, not just the builder's success summary. This provides
  a different model perspective, not a guarantee of independent errors. Agent type
  supplies the role; the explicit model supplies the engine.
- **High-risk or ambiguous change:** use Fable for a bounded design decision when
  ambiguity warrants it; Opus builds; a separate read-only Fable verifier challenges
  security, payments, learner-data, migration, or cross-service invariants. Planning
  is not verification, and a green model verdict never replaces executable checks.
- **Repeated failure:** after two unsuccessful repair attempts on the same issue,
  send the reproducer, attempted fixes and evidence to Fable for diagnosis. Do not
  keep cycling models or widening scope. Stop for a concrete external blocker.

Every handoff names the objective, allowed files, relevant project rules, acceptance
checks, non-goals, and whether editing is permitted. Return changed paths, checks
actually run, failures and remaining uncertainty. Preserve the territory ownership
rules below. Parallelize only independent work with disjoint write sets; default to
one builder, at most two when independence is clear. Astra owns shared interfaces.
Do not have multiple models re-read the entire repository or rebuild the same feature.
Run focused tests during development and `npm run gate` before completion; prove
changed UI journeys on the actual app when applicable. Do not weaken existing gates.

Treat this routing as a starting policy, not a model-performance ranking. For the
next five substantial tasks, include model used, elapsed time, repair rounds,
verification result and actual usage/cost when available in the existing task report.
Compare cost per accepted change, not token price alone. The bundled price table
records Opus 5.5 at $4/$20 and Astra/Fable at $10/$50 per million input/output tokens;
these are not refreshed billing quotes or subscription-quota estimates. Sol 6 pricing
has not been verified; do not reuse Sol 5.6 prices. Change the default builder only
with evidence from comparable bounded tasks.

## The team

The repository agents include **roles in a loop** — `design-architect` decides the
shape, `bug-hunter` repairs, `fix-verifier` refutes, `work-judge` says SHIP — and
**engineers who own a territory** of the codebase. Four backend architecture guards
review cross-service design, database security, voice reliability and deployment.
The current roster, territories and review triggers are in `docs/TEAM.md`.

| Want | Run |
|---|---|
| Something built properly | `/forge <what you want built>` |
| To know if it is safe to release | `/ship` |
| A backend architecture review before implementation or promotion | `/backend-review <scope>` |
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

This project has a knowledge graph at `graphify-out/` — 14870 nodes, 40303 links
across the extracted source files, grouped into 557 communities. Re-measured by the
AST-only update on 2026-10-07 after integrating Come Alive with main’s Hum launch,
Expo patches and audio cleanup fixes. This update omitted 78 SQL files because
`tree_sitter_sql` is absent;
SQL validation uses the executable full-schema proofs, not this incomplete graph.
The community
names are **placeholders** (`Community N`) as of that rebuild: `graphify label . --backend
claude-cli` needs a signed-in `claude` CLI, and the session on this Mac had expired, so the
first session with a working `claude login` should run `graphify label . --backend
claude-cli` and then `graphify export wiki` to restore real names. The hub order and the
docs-island figures below were not re-measured on 2026-09-17 and may have moved.

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
  file*, and returns 5 nodes with no edges. `"useLiveSession LuvaniTutor grantSession"`
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
- Start broad navigation at `graphify-out/wiki/index.md` (307 concept articles, ~5k
  tokens) rather than `GRAPH_REPORT.md`, which is now ~15k.
- Going straight to a file to edit or debug specific lines is fine. The graph is for
  orientation, not a gate.
- After modifying code, run `graphify update .` to keep the graph current (AST-only,
  no API cost). **`update` re-clusters and renames communities after its hub files**,
  so if you care about the names, run `graphify label . --backend claude-cli` *after*
  `update`, then `graphify export wiki` — in that order. Use `claude-cli`, not
  `claude`: the plain `claude` backend demands an `ANTHROPIC_API_KEY` and silently
  falls back to filename labels.

Known limits (do not mistake these for working):
- **Docs do not link to code.** The 692 nodes under `docs/` form a closed island — 697
  edges among themselves and **zero** into source, measured again on 2026-09-05 — so prose
  cannot route you to a symbol. Closing this needs a `--mode deep` rebuild. The island has
  nearly doubled and its grip has tightened: the single most connected node in the whole
  graph is still the ledger's own format block, `Format` from `docs/KNOWN_ISSUES.md`, and
  it is now at **498** edges, close to three times the largest real code node. Ranking
  nodes by degree therefore puts a docs node first that cannot reach one line of source:
  read hub lists source-side or they will point you at prose.
- **Theme primitives inflate the hubs, but no longer top them.** `space()` from
  `apps/mobile/src/theme.ts` sits at 102 edges and has slipped to sixth source-side. The
  order is now `core/src/index.ts` (185), `ConvoScreen.tsx` (137), `convo.ts` (122),
  `ProfileTab.tsx` (112), `convo.test.ts` (111), then `space()`. It still pulls the
  styling layer into UI-adjacent traversals, and `--context call` still sidesteps it.
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
- **Push active work branches as backups (founder, 2026-10-20).** A branch that holds
  committed work not yet on `main` may be pushed to `origin` under its own name so the work
  is safe on GitHub; it still reaches `main` only through this landing workflow. Push from a
  checkout whose gate is green, because the pre-push hook gates the checkout you push from.
  Old branches kept only for reference go to `archive/<name>-<date>` before local deletion.
- **Never `--force`, `--no-verify`, or rebase anything already pushed.** The hooks are the
  last honest check on the way out; a change that needs them off is a change that is not
  ready.

## Worktrees

Run tests from the checkout containing the change, with its own locked dependency
install (`npm ci`). As [docs/TESTING.md](docs/TESTING.md) explains, an installed
worktree is a root in its own right. A worktree without `node_modules` can resolve
dependencies from parent directories and bind to the wrong copy; do not use an
unchanged main checkout's green tests as proof of a worktree change.

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
its whole suite with it silently (an earlier uninstalled worktree reported 122
brain tests against 146 in the main checkout). Install dependencies inside the
worktree and run from that checkout's root; current counts are enforced by
`scripts/gate.floors.json`.
