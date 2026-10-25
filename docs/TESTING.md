# Testing

## Running

```bash
npm test                          # every workspace
npm test --workspace=@luvani/core  # one
npm run typecheck                 # all six, tsc --noEmit
npm run gate                      # the whole bar — see LOOP.md
```

**Run from the repo root, never from a worktree.** A `.claude/worktrees/` checkout
has no `node_modules` of its own, so Node resolution walks up past it and can bind
to the wrong copy of a dependency. The exception: a worktree where `npm ci` has run
has its own `node_modules` and is a root in its own right, so its tests resolve
inside it (check the brain count to be sure). `packages/brain` is where this bites: it
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

### The canvas learner (local screenshots)

To see every slot on the design artboards filled, run a local mock build with
`EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT=1 EXPO_PUBLIC_LUVANI_CANVAS_LEARNER=1`.
`apps/mobile/src/dev/canvasLearner.ts` then seeds the signed-in mock account as
Yasmin: a three-day run, 140 XP, 6 of 10 minutes today, Le premier café done on
her own and Au café du coin next, two labelled sample conversations with fixes, a
few due cards, and tutor memory. It refuses in production, without either flag,
or on any adapter but the mock one, writes only through the stores' own
functions, and never overwrites a record the account already holds.

### The Your French preview

To screenshot the Journey's Your French section, run the app with
`EXPO_PUBLIC_LUVANI_SCREEN_PREVIEW=1` and open
`?preview=your-french-<full|sounds|scenes|forward|free>&theme=<light|dark>&controls=0`.
It draws the real section on the Journey ground, with no account and no
storage. Without `theme`, it follows the device, so the simulator's appearance
picks the mode on native. The fixed learners are in
`apps/mobile/src/journey/yourFrenchFixtures.ts`. Keep the screenshots in
`artifacts/your-french-2026-10-22/`.

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
git stash push -- path/to/source.ts && npm test --workspace=@luvani/core; git stash pop
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

`apps/mobile` now has 196 test files and hundreds of assertions across pure rules,
storage boundaries, sync convergence and source contracts. That is substantial
coverage of decisions and wiring, but it is still not component coverage: the app
contains 104 TSX components and no `.test.tsx` renderer test.

Source-reading tests can prove that a prop, accessibility role or navigation call
is present. They cannot prove React Navigation precedence, a control's focus order,
layout at dynamic type, native permission timing, or what a screen reader actually
announces. F58 is the worked warning: `initialRouteName` was correctly passed and
the web linking state still overruled it at runtime.

That shapes how app bugs get fixed: **pull the rule out into a plain module and
test it there**, rather than leaving it inline and untestable. `thinking.ts` is
the worked example — the "is the tutor still deciding" rule lived in five
branches of a switch, which is exactly how a sixth branch came to be missed.
Anything still inside a component or a hook is verified by running the app; see
the verification workflow in LOOP.md, and say which parts were proven by test and
which by eye.

The evals in `services/brain-playground` (`npm run eval`) measure AI quality and
need real keys, so they are not part of the gate.

Three playground evals need no key:

- `npm run eval:sessions -w @luvani/brain-playground` scores recorded sessions turn by turn
  (rescue, no read-back, gentle, level fit, safety, way back, no repeat question, grief,
  reply wait). The synthetic set is
  hand-labelled with one deliberate failure per check, so a clean run exits 1 and lists them.
  The test `the session eval agrees with every hand label in the synthetic set` holds the
  checks to those labels in the gate. Each record names its mode (lesson, mission or
  conversation) and a scripted lesson's rescue is judged by the lesson rule, not the quiet-hint
  rule. `--jev` adds Jev's advisory opinion on synthetic and dev
  records only.
- `npm run chat -w @luvani/brain-playground -- --record` saves a dev session for it, in the
  gitignored `services/brain-playground/sessions/`.
- `npm run eval:beta-numbers -w @luvani/brain-playground -- <export.json>` summarises an
  export of `live_session_finished` rows and refuses any field beyond the six it allows.

`eval:replay --provider <name>` replays recorded sessions on a model and reports the cost per
accepted turn. It spends money on any provider but `mock`; see
[changes/vendor-comparison.md](changes/vendor-comparison.md).
