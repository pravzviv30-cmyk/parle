# Testing

## Running

```bash
npm test                          # every workspace
npm test --workspace=@parle/core  # one
npm run typecheck                 # all six, tsc --noEmit
npm run gate                      # the whole bar — see LOOP.md
```

**Run from the repo root, never from a worktree.** A `.claude/worktrees/` checkout
has no `node_modules` of its own, so Node resolution walks up past it and can bind
to the wrong copy of a dependency. `packages/brain` is where this bites: it
depends on `@anthropic-ai/sdk@^0.117.1` and gets a nested install, while
`@livekit/agents-plugin-anthropic` pulls `^0.33.1` up to the root.

The symptom is a module that fails to **load**, not an assertion that fails:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '<repo>/node_modules/@anthropic-ai/sdk/helpers/zod.mjs'
  imported from packages/brain/src/contract/schemas.test.ts
```

A file that never loads takes its whole suite with it **silently**, and the run
still exits 0. This is why `npm run gate` reads the test *count* and not only the
failure count, and why the floors in `scripts/gate.floors.json` only ever go up.

## Writing

Node's built-in runner. No Jest, no Vitest, no test dependencies anywhere.

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
```

- `*.test.ts`, colocated beside what it tests. Never a `__tests__` directory.
- `describe` blocks are named for a **behaviour**, with an em dash:
  `'ladder — the stuck learner'`.
- Test names are full sentences about the learner, not about the API:
  `'a short pause is thinking, and is left completely alone'`.
- Assertion messages carry the reasoning:
  `assert.equal(state.streak, 0, 'streak resets after promotion')`.
- Local factory helpers at the top of the file, above the describes.
- Explicit `.ts` extensions; cross-package imports by workspace name.

## The rule that matters most

**A test that passes before the fix is testing nothing.** Write it, watch it fail
for the reason you predicted, then fix the code. When you cannot easily run the
suite against the old behaviour, revert the source change alone and confirm the
new test goes red:

```bash
git stash push -- path/to/source.ts && npm test --workspace=@parle/core; git stash pop
```

This is not ceremony. Two tests in this repo's history passed on first write
against unfixed code — one because the fixture accidentally avoided the bug it was
meant to prove, one because the mock timer let `clearTimeout` mask the race.
Both looked like green coverage of a fixed bug and were neither.

## Never

- Weaken a test to reach green: no deleted assertions, no loosened matchers, no
  `.skip`, no `.only`. The gate fails on the last two by name.
- Lower a floor in `scripts/gate.floors.json`. `npm run gate:bless` raises them
  after a green run; nothing lowers them automatically.
- Tick a box in `docs/KNOWN_ISSUES.md` without a passing test named on its
  `verified-by:` line. The gate checks.

## What is not covered

`apps/mobile` has a suite now, but a small one, and it only covers logic that can
be imported without React Native. Today that is eight files: `copy.test.ts`, the
pure rules under `src/live/` (`thinking.ts`, `journal.ts`, `serverUrl.ts`), and
`friends/logic.ts`, `nav/wiring.ts`, `practice/statusLine.ts` and
`profile/upgrade.ts`.

There is no renderer and no component test. `live/turns.ts`, `live/failure.ts` and
`mockSpeech.ts` exist and have no suite of their own — they are the obvious next
candidates for the treatment below.

That shapes how app bugs get fixed: **pull the rule out into a plain module and
test it there**, rather than leaving it inline and untestable. `thinking.ts` is
the worked example — the "is the tutor still deciding" rule lived in five
branches of a switch, which is exactly how a sixth branch came to be missed.
Anything still inside a component or a hook is verified by running the app; see
the verification workflow in LOOP.md, and say which parts were proven by test and
which by eye.

The evals in `services/brain-playground` (`npm run eval`) measure AI quality and
need real keys, so they are not part of the gate.
