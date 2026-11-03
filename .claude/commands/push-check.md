---
description: Check the version you are about to push, frontend or backend, with the gate, a browser pass, reviewers and an Impeccable design review, fix what they find, and stamp the commit so the push is allowed. Add --main before landing to include the security review.
argument-hint: "[--main] [optional: what the branch does]"
---

Run this **before every push**, of a branch or of `main` (founder rule, 2026-10-31). It
looks at the exact version being pushed, in the browser and through reviewers (for the
frontend, Impeccable's design reviewer too), and fixes what it finds before anyone pulls it.
A `PreToolUse` hook (`scripts/push-check-guard.mjs`) refuses `git push` from a Claude
session until this command has stamped the commit, refuses a frontend push without a
passing Impeccable review, and refuses a push to `main` until the stamp also holds a
passing security review.

`$ARGUMENTS` containing `--main` means the next push is a landing on `main` (`/land` runs
it that way). Anything else in `$ARGUMENTS` is what the branch does, for the reviewers.

Work in the checkout being pushed (a worktree with its own `npm ci`, or the main
checkout), never in another session's tree. Stage by explicit path; never `git add -A`,
`--force` or `--no-verify`.

## 1. Scope

```bash
git status --porcelain
git fetch origin --quiet
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

The scope is always the whole branch against `origin/main`, not only what is new since
the last push, so the reviewers see every commit together. Shell state does not carry
between calls, so write `origin/main...HEAD` out each time rather than a variable.

The working tree must be clean apart from files this session wrote and is about to commit;
the check covers HEAD, so commit first. Sort the changed files:

- **Frontend:** `apps/mobile/**` and `packages/core/**` (the app imports it).
- **Backend:** `services/**`, `packages/brain/**`, `supabase/**`, `deployment/**`. A
  change in `packages/brain` that the app also imports gets both reviewers.
- **Docs or tooling only:** neither suite of runtime checks applies; the gate and the
  review still do.

## 2. Gate

```bash
npm run gate
```

Red is a stop: fix it first. Record the counts it prints.

## 3. Frontend: look at the version being pushed (Playwright)

Only when frontend files changed. Start this checkout's web build in the background, on a
free port, from the checkout root:

```bash
EXPO_PUBLIC_LUVANI_SCREEN_PREVIEW=1 npm run web --workspace=@luvani/mobile -- --port <port>
```

Use the screen-preview build for screens with `?preview=` keys (`dev/OnboardingPreview.tsx`),
and a second build without `EXPO_PUBLIC_LUVANI_SCREEN_PREVIEW` (add
`EXPO_PUBLIC_LUVANI_CANVAS_LEARNER=1` for a signed-in learner) for real flows.

With the **Playwright plugin** (`mcp__plugin_playwright_playwright__*`), for every screen
the diff touches and the screens that import a changed shared part:

1. `browser_resize` to 375x812, then 320x640; `browser_emulate_media` light, then dark.
2. `browser_navigate`, wait for the launch screen to leave, `browser_snapshot`.
3. Press each control the diff added or changed (`browser_click`), and go back.
4. Collect `browser_console_messages` (errors and warnings) and `browser_network_requests`
   (anything 4xx/5xx or failed).
5. `browser_take_screenshot` into `reviews/push-check/<YYYY-MM-DD>-<branch-slug>/`, which
   git ignores, so the check leaves the tree clean.

Report as a finding: a console error or React warning, a failed request, clipped or
overlapping text, a control that does nothing, a horizontal scroll or broken layout at
320, a state that never leaves loading, or dark mode showing light colours. `npm run shots`
is the quick way to get the 320/375 light/dark set as well.

Stop the servers when done.

## 4. Backend: boot and smoke

Only when backend files changed.

- Run the touched workspaces' suites (`npm test --workspace=<name>`), already in the gate,
  plus any `verify*` script that names the touched area.
- Boot each touched service locally in the background (`npm run dev --workspace=@luvani/token-server`,
  the `token-server-local` entry in `.claude/launch.json`), then hit `GET /health` and
  `GET /ready`, and each endpoint the diff touched with a valid and an invalid request.
  Read the logs for errors, unhandled rejections and secrets printed.
- Never call paid providers or production; local and fake providers only.

## 5. Review fan-out

Dispatch these **in one message, in parallel**, each a `push-reviewer` (read-only,
Sonnet). Give each the diff (`git diff origin/main...HEAD -- <its files>`), the branch's
purpose, the plan or spec in `docs/changes/` if there is one, and the browser and backend
findings so far:

| Reviewer | When | Looks for |
|---|---|---|
| frontend | frontend files changed | crashes and wrong behaviour, sloppy code (dead code, swallowed errors, unhandled promises, stale state across accounts, effects without cleanup, missing loading/failed/empty states), accessibility (labels, 44pt targets, reduced motion), tokens and copy rules from `DESIGN.md` |
| backend | backend files changed | validation of untrusted input, error paths, races and double writes, auth and ownership checks, leaks of keys or learner data into logs, cost or quota bypass |
| tests | always | does every changed behaviour have a test that would fail if it regressed; tests that pass vacuously; floors or pins weakened |

In the same message, run the built-in **`/code-review`** on the diff (Skill
`code-review`, effort `high`), and for frontend changes dispatch the Impeccable design
reviewer of section 6 as well. Before acting on any finding, check it in the code yourself.
Reviewers report; they do not edit.

## 6. Impeccable design review

Only when frontend files changed (`apps/mobile/**`, `packages/core/**`). Dispatch it **in
the same parallel message** as the section 5 reviewers and `/code-review`. Founder rule,
2026-10-31: Impeccable's own reviewer looks at every frontend push.

**Who.** Agent `subagent_type: "impeccable:impeccable-finish-reviewer"` with
`model: "opus"`. Say the model out loud, because the agent's frontmatter only inherits;
its effort is `high` from the plugin. The founder approved this under the model-routing
rule. It is read-only and has no browser, so it judges from files.

**Prepare.** Write the diff and list the screenshots in the review folder (git ignores it):

```bash
git diff origin/main...HEAD -- apps/mobile packages/core > reviews/push-check/<YYYY-MM-DD>-<branch-slug>/frontend.diff
```

Name the section 3 screenshot paths in the brief. The plugin version directory changes, so
find the newest with `ls ~/.claude/plugins/cache/impeccable/impeccable/ | sort -V | tail -1`
(a plain `ls` puts 4.10.0 before 4.8.0).

**Optional detector.** Against the section 3 web build:

```bash
~/.claude/plugins/cache/impeccable/impeccable/<version>/skills/impeccable/scripts/impeccable detect --json --viewport 375x812 <web build URL>
```

Pass the output to the reviewer as advisory web-only findings. The detector reads web
markup, so it is never the native verdict.

**Brief.** Fill in the paths and send this:

```text
Review a finished frontend change for Luvani, an Expo / React Native app (iOS first, and
Android). This is NOT an Impeccable build: there is no direction contract, no approved
comp, no concept seed and no .impeccable/ state. Skip check 1's build-state parts, check
2's comp matrix and check 4's seed check. DESIGN.md plus the landed system below stand in
for the comp and for OWN-WORLD; judge TYPE, MATERIAL and GROUND against them.

Platform: no detector ran on native. For check 0, the required captures are the
Playwright web-build captures named here (375 and 320, light and dark), not phone.png.
Judge them as stand-ins for device captures.

Inputs:
- Diff: <review folder>/frontend.diff
- Screenshots: <list every screenshot path, with size and mode>
- PRODUCT.md and DESIGN.md (read DESIGN.md's Colour, Type, Surfaces and controls, Copy
  and Motion sections)
- docs/changes/today-sky.md, docs/changes/drill-b.md, docs/changes/live-room-d.md
- Plugin references in <plugin version dir>/skills/impeccable/reference/: audit.native.md,
  craft-floor.md, ios.md; critique.md only to frame proposals
- Detector output, advisory and web-only: <paste, or "none">
- What the branch does: <one line>

Read in this order, because your turn budget is short: the screenshots, the diff, the
DESIGN.md sections, craft-floor.md, then the rest. Name anything left unread.

The landed system: LipTile (a solid tile on a darker lip, like a pressable game button);
chunky stat tiles (coin, big number, one word); one stage tint per drill family from
existing tokens (Choose lavender, Build butter, Write sage, Speak peach, Review butter);
EndScene, the one dark-aware ending; one accent; Cloud and the mascots appear at moments
only (the right sheet, listening on speak drills, endings, wins, empty states), never on
the question; a screen has one focal point; a card groups related things and is never the
default container; copy is warm, short, plain, no em dashes, never scolding.

Sorting rules. Slop is anything that breaks DESIGN.md or PRODUCT.md: raw hex instead of
tokens, a radius off the scale, emoji in chrome, two labels for one intent, contrast,
44 pt targets, a broken dark mode, ignored reduced motion, AI-default styling, copy that
scolds. A redesign proposal is anything that would change the look beyond DESIGN.md.

Output: the disposition word first, then your usual sections, plus two more.
  slop: uncapped. Each item is file:line, the DESIGN.md or PRODUCT.md rule it breaks, and
    the fix.
  redesign_proposals: at most four, most valuable first. Each is the screen, the problem,
    and a direction that fits the landed system. They are never applied in this push.
```

**Sorting the result.** The session checks every item in the code before acting.

- **Slop** on lines this diff added or changed goes through the section 7 fix loop like
  any other finding. Slop the reviewer finds in older code nearby is written up as out of
  scope, the way section 7 allows, and never blocks the push. On a later round,
  send the same reviewer the recaptured screenshots with `SendMessage` instead of starting
  a new one: it scores its earlier fixes (its verdict pass) and names at most three
  regressions.
- **Redesign proposals** are never applied in this push and never block it.

**Result.** `pass` when every confirmed slop item is fixed (or, as section 7 allows,
written up as out of scope with nothing blocking correctness); `fail` otherwise.
Proposals never change the result. `n/a` only when no frontend file changed; the guard
refuses `n/a` for a frontend commit.

**Proposals log.** Before the section 9 stamp, so the rows are part of the checked commit,
add each proposal as a row in the "Proposals from push-check" table in
`docs/DESIGN_PARTNERSHIP.md` with State `asked, no answer yet`, and commit by path. That
commit only adds rows to a doc, so it does not reopen sections 3 to 6; the gate still runs
on it, and the stamp goes on it.

**Asking the founder.** After the push (section 10), see there. The push never waits for
the answer.

## 7. Fix loop

For each confirmed finding: first write a test that reproduces it and fails (founder rule,
2026-11-01; a doc or copy-only fix needs no failing test first; copy that a test already pins still updates that test), then fix it (yourself if it is one line, otherwise the owning specialist or
`implementer` with the absolute checkout path) so the test passes, commit by explicit path, and
re-run the gate and the check that found it. Repeat sections 3 to 6 on the new diff until
the reviewers, `/code-review` and the Impeccable reviewer find nothing new above low
(proposals do not count; they are logged, not looped on).

A finding left unfixed (out of scope, needs a decision) is written in the report and in the
branch's `docs/changes/` log, never dropped quietly. If one blocks correctness, the result
is `fail`.

## 8. Before main: security review

Only with `--main`, after section 7 is clean. Run the built-in **`/security-review`** (Skill
`security-review`) on the merge diff, `git diff origin/main...HEAD`. Any high or medium
finding blocks the landing until it is fixed or the founder accepts it in chat; record the
founder's words if so. For a backend or data change, also consider `/backend-review`.

## 9. Stamp

Stamp the exact commit that will be pushed, after the last fix commit. For a landing, that
is first the branch tip; the merge commit then needs its own stamp (see `/land` section 6):

```bash
node scripts/push-check-guard.mjs stamp --gate pass --playwright <pass|fail|n/a> --backend <pass|fail|n/a> --review pass --impeccable <pass|fail|n/a> --security <pass|n/a> --notes "<counts, reviewers, findings fixed>"
```

`n/a` is for checks that do not apply to this diff, never for one that was skipped. The
guard refuses `--impeccable n/a` on a frontend commit and refuses a frontend push without
`--impeccable pass`. The stamp is per commit: a new commit needs a new check.

Push as its own Bash command. The guard refuses `git commit ... && git push` (or a
switch, merge or ref rewrite before the push) in one call, because it checks the commit
before the earlier command makes a new one.

## 10. Report

Six lines: the gate count, what the browser pass covered (screens, sizes, modes) and
found, what the reviewers and `/code-review` found and what was fixed, the Impeccable
disposition word with the slop found and fixed and the number of proposals asked (frontend
only), the security result when `--main`, and the stamp result. Then push (with the
keepalive `GIT_SSH_COMMAND="ssh -o ServerAliveInterval=20 -o ServerAliveCountMax=30"`) and
confirm with `git ls-remote`.

Then, if the Impeccable reviewer made proposals, ask the founder in **one
`AskUserQuestion`**: one question per proposal (at most four), each with the options
"Queue for a board", "Fold into the screen's redesign" and "Not now". Do not wait on the
answer before pushing. When it comes, update each row's State in
`docs/DESIGN_PARTNERSHIP.md` to `queued for a board`, `folded into <screen> redesign`, or
`not now: <reason, from the founder's note, or "no reason given">`, and commit by path.
That commit goes out with the next push, checked like any other. After a landing the
branch is gone, so make that commit on `main` in the main checkout and push it with
`/push-check --main`; it only touches a doc, so Impeccable is `n/a` there. If the founder
is not there, the rows already say `asked, no answer yet`.
