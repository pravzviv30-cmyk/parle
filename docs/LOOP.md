# The loop

A prompt answers once and stops, whether or not the answer was any good — and then
it is your job to check it and prompt again. A loop removes you from that cycle:
set a goal, let Claude work, let it **check its own work**, and if it is not there
yet let it **write the next prompt itself**.

The part that decides whether this is useful or theatre: **the goal has to be
something Claude can actually check.** "Make it better" is not a goal. "Zero
failing tests, no workspace below its floor, and every ledger item closed by a
named passing test" is.

## The bar

```bash
npm run gate          # exits 0 or 1
npm run gate -- --json
npm run gate:bless    # raise the test floors after a green run
```

`scripts/gate.mjs` checks five things, in order:

1. **Typecheck** across all six workspaces.
2. **Tests** — zero failures, *and* no workspace below its floor in
   `scripts/gate.floors.json`. The count matters as much as the failures: a suite
   that fails to load takes its whole file down silently and still exits 0
   (see TESTING.md).
3. **Hygiene** — no `.only`, no `.skip`.
4. **Agents** — every file in `.claude/agents/` is pinned to a model the gate
   knows about, and `/forge`, `/bug-sweep` and `/ship` all exist. An agent that
   loses its `model:` line still dispatches and silently inherits the session
   model, so nothing else would ever notice (see FORGE.md and TEAM.md).
5. **The goal** — `docs/KNOWN_ISSUES.md` has no open P0 or P1, and every ticked
   box names a test that actually ran and actually passed.

Check 5 is the one that makes the rest trustworthy. Without it the loop closes an
item by editing a checkbox. With it, the only way to tick a box is to make a named
test pass — and deleting the entry fails the gate too.

## Giving it a goal

`docs/KNOWN_ISSUES.md` is the goal file, and it is parsed, not read:

```markdown
### B4 — A rescue and a spoken turn can both apply
- severity: P1
- status: [ ]
- where: services/tutor-agent/src/agent.ts:169
- note: nothing serialises state, and clearing the timer cannot cancel a rescue
  already in flight.
- verified-by: `a rescue that loses the race is discarded`
```

Severity drives ordering (P0 before P1 before P2) and P2 items do not block the
gate. `verified-by:` is the contract — one line per test, all must pass.

Write the entry **before** the work. An item you cannot phrase as "this test will
prove it" is an item you do not understand well enough to hand to a loop.

## Running it

```bash
npm run loop                                   # up to 10 iterations, 60 minutes
npm run loop -- --max 3 --minutes 20
npm run loop -- --dry-run                      # compose the prompt, run nothing
npm run loop -- --branch loop/my-sweep --model opus
```

Each iteration: run the gate → if green, stop → otherwise compose a prompt from
the failures, the ledger, and **the dead ends from earlier iterations** → run
`claude -p` → re-run the gate. An iteration that improved the number is committed
on its own; one that did not is reverted and recorded, so the next attempt does
not repeat it.

It stops on green, on `--max`, on `--minutes`, or after two iterations that moved
nothing — a loop with no stop condition is a runaway, not an agent.

**Guard rails**: it refuses to run on `main` and refuses a dirty tree, works only
on its own branch, and never pushes. Permissions default to `acceptEdits` with a
narrow tool allowlist; `--yolo` switches to `bypassPermissions` if you want it
fully unattended and understand what that means.

The journal lands in `.loop/<runId>/` (gitignored): `journal.md` to read, and
`iterations.jsonl` for the numbers.

## The agents

Both are ordinary Claude Code subagents in `.claude/agents/`, usable on their own:

- **bug-hunter** — finds real defects and fixes them, failing test first. Carries
  the product invariants from PEDAGOGY.md, because a change that breaks one of
  those is a bug however green the suite is.
- **fix-verifier** — tries to *refute* a fix. Checks the new test actually fails
  without the change, that nothing was weakened, that the count did not drop.

`/bug-sweep` runs one pass of gate → hunt → verify → update the ledger. It is
written to be looped interactively:

```
/loop 15m /bug-sweep
```

which is the same discipline as `npm run loop`, with you in the room.

## The other half: building something new

`/bug-sweep` only works on what the ledger already knows is wrong. For work that has not
been designed yet there is `/forge`, which puts the thinking on Fable and the building
here, then has Fable judge the result and order revisions until the gate is green:

```
/forge let a learner replay the last scene without losing their rung
```

Its two agents — **design-architect** and **work-judge** — are pinned to Fable and have no
`Edit` or `Write`, the same way fix-verifier is kept from fixing what it reviews. The gate's
`agents` check exists to notice if one of those pins ever quietly disappears.

See [FORGE.md](FORGE.md), especially the part about why the judge's findings have to land in
the ledger rather than in a reply.

## Verifying UI work

The gate cannot see the app. `apps/mobile`'s suite covers only what imports
without React Native, so anything visual is verified by running it — `npm run web`, drive the preview, read the console — and
by saying plainly which parts were proven by test and which by eye.
