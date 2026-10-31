---
description: Check the version you are about to push, frontend or backend, find sloppy code, fix it, and stamp the commit so the push is allowed. Add --main before landing to include the security review.
argument-hint: "[--main] [optional: what the branch does]"
---

Run this **before every push**, of a branch or of `main` (founder rule, 2026-10-31). It
looks at the exact version being pushed, in the browser and through reviewers, and fixes
what it finds before anyone pulls it. A `PreToolUse` hook (`scripts/push-check-guard.mjs`)
refuses `git push` from a Claude session until this command has stamped the commit, and
refuses a push to `main` until the stamp also holds a passing security review.

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
`code-review`, effort `high`). Before acting on any finding, check it in the code yourself.
Reviewers report; they do not edit.

## 6. Fix loop

For each confirmed finding: fix it (yourself if it is one line, otherwise the owning
specialist or `implementer` with the absolute checkout path), commit by explicit path, and
re-run the gate and the check that found it. Repeat steps 3 to 5 on the new diff until the
reviewers and `/code-review` find nothing new above low.

A finding left unfixed (out of scope, needs a decision) is written in the report and in the
branch's `docs/changes/` log, never dropped quietly. If one blocks correctness, the result
is `fail`.

## 7. Before main: security review

Only with `--main`, after step 6 is clean. Run the built-in **`/security-review`** (Skill
`security-review`) on the merge diff, `git diff origin/main...HEAD`. Any high or medium
finding blocks the landing until it is fixed or the founder accepts it in chat; record the
founder's words if so. For a backend or data change, also consider `/backend-review`.

## 8. Stamp

Stamp the exact commit that will be pushed, after the last fix commit. For a landing, that
is first the branch tip; the merge commit then needs its own stamp (see `/land` §6):

```bash
node scripts/push-check-guard.mjs stamp --gate pass --playwright <pass|fail|n/a> --backend <pass|fail|n/a> --review pass --security <pass|n/a> --notes "<counts, reviewers, findings fixed>"
```

`n/a` is for checks that do not apply to this diff, never for one that was skipped. The
stamp is per commit: a new commit needs a new check.

Push as its own Bash command. The guard refuses `git commit ... && git push` (or a
switch, merge or ref rewrite before the push) in one call, because it checks the commit
before the earlier command makes a new one.

## 9. Report

Five lines: the gate count, what the browser pass covered (screens, sizes, modes) and
found, what the reviewers and `/code-review` found and what was fixed, the security result
when `--main`, and the stamp result. Then push (with the keepalive
`GIT_SSH_COMMAND="ssh -o ServerAliveInterval=20 -o ServerAliveCountMax=30"`) and confirm
with `git ls-remote`.
