---
description: Decide whether this branch should go to main, and land it if the answer is yes.
argument-hint: "[optional: what the branch does]"
---

Decide whether the current work belongs on `main` yet, and act on the answer. Unlike
`/ship`, which only looks, this one **commits and merges when the verdict is LAND**. That
authority is the point of the command, so the hard stops below are not advisory.

Return one of four verdicts, and never invent a fifth: **LAND**, **HOLD**, **SPLIT**, **ASK**.

---

## 1. Who else is in this tree

Do this **first**, before the gate, before reading a diff, before anything.

```bash
git status --porcelain
git worktree list
git branch --sort=-committerdate | head
```

This repo is regularly worked by **two Claude sessions at once**, sometimes in the same
checkout and sometimes in a worktree. That makes one specific mistake available, and it is
the worst one on this page: `git add -A` sweeps another session's half-finished work into
your commit, and merging that to `main` publishes code nobody reviewed and whose author is
mid-thought.

So, before staging anything, list the files **this session actually edited**. Anything
modified that is not on that list belongs to somebody else.

- Files you did not touch are dirty → **ASK**. Say whose they look like and stop. Do not
  stage them, do not stash them, do not `git checkout --` them.
- A worktree is checked out on another branch (`+` in `git branch`) → that session is live.
  Your own files may still be landable; theirs never are.
- You cannot tell which are yours → **ASK**. Uncertainty here is not a tie to break.

**Stage by explicit path. `git add -A` and `git add .` are forbidden in this repo.**

## 2. Where you are standing

Run the gate from the checkout that holds the change, with its own locked install
(`npm ci`), never from a worktree that has none. An uninstalled worktree has
no `node_modules`, so Node resolution walks up and binds the wrong copy of a dependency:
`packages/brain` reports 122 tests from a worktree and 146 from the main checkout, and the
missing suite fails silently by never loading. A gate that green-lit a merge from a worktree
green-lit a lie.

If the shell is in a worktree with no install, `cd` to the main checkout is **not** the fix —
that lands your edits in the shared tree. Run `npm ci` in the worktree and re-run there, or stop.

## 3. The gate

```bash
npm run gate
```

Green is necessary and not sufficient. Read the numbers, not just the word:

- A **red gate** is always **HOLD**. Never weaken a test, lower a floor, or tick a ledger
  box to turn it green. If the gate is red because of an open P0/P1 that this branch
  introduced, that is a bug to fix, not a gate to argue with.
- A **red ledger on an in-progress branch is normal** and is not on its own a reason to
  hold: `/forge` files its entries *before* it builds, which is why `gate:fast` ignores
  P0/P1 deliberately. But an entry this branch opened and did not close **does** block
  landing, because `main` is where the ledger is supposed to be honest.
- **Floors move only through `npm run gate:bless`**, never by hand, and never while another
  session has uncommitted tests in the tree: you would bless a floor onto their work and
  break it the moment they revert.

## 4. The shape of the branch

Dispatch **release-engineer** with the diff and `$ARGUMENTS`, review only. Ask it for branch
shape, commit hygiene, and the revert path. Then judge these yourself, because they are the
questions that decide the verdict:

| Question | LAND if |
|---|---|
| Is this one coherent thing? | Yes. Two unrelated things is **SPLIT**, not a bigger commit. |
| Does a test fail if it regresses? | Yes, and it is a real test, not a tripwire that passes vacuously. |
| Is the revert one commit? | Yes. If backing it out means unpicking three, land it as one merge with `--no-ff`. |
| Did behaviour change where a learner can see it? | Only if it was actually run, not only typechecked. A screenshot or a driven browser, not a claim. |
| Does a doc now say something false? | No. `DESIGN.md` is recorded from the built artifact, so a change that contradicts it lands **with** the doc edit, never before it. |

## 5. Deciding

- **LAND** — everything above holds, and the work is finished rather than merely stopping.
- **HOLD** — one named thing is wrong. Say the one thing. Do not list effort.
- **SPLIT** — the work is good but is two changes. Name the seam to cut on.
- **ASK** — a human has to choose: someone else's work is in the tree, the change is
  irreversible in a way a revert does not undo, or "finished" is a judgement call you do not
  have the standing to make.

**Prefer HOLD over a marginal LAND.** Work sitting on a branch costs a day. Work landed on
`main` that turns out to be half a change costs everyone who pulls it. Every code landing is
now a PR merge commit, one revertable unit, so `main` is genuinely the shared floor rather
than a staging area.

## 6. Landing

Only on **LAND**. Code (app, services, database, scripts, workflow tooling) reaches `main`
through a GitHub pull request (founder, 2026-11-15), in this order:

1. Commit on a branch by explicit path:

   ```bash
   git switch -c <branch>          # if the work is sitting on main, branch it first
   git add <explicit paths>        # never -A, never .
   git commit                      # pre-commit runs gate:fast
   ```

2. On the committed branch tip, run **`/push-check --main`** (founder rule, 2026-10-31):
   the Playwright pass on the version being landed, the review fan-out, the built-in
   `/code-review`, the Impeccable and unslop design reviews for frontend changes, and the
   built-in `/security-review` on `git diff origin/main...HEAD`. A high or medium security
   finding is **HOLD** until it is fixed or the founder accepts it in chat.
3. Push the branch: `git push -u origin <branch>` (pre-push runs the full gate).
4. Open the PR: `gh pr create --base main --head <branch>`. The body holds the summary,
   the push-check stamp results (`node scripts/push-check-guard.mjs status`) and the
   founder's OK where one was needed.
5. Once `/push-check --main` has passed and its stamp is on the tip GitHub holds, enable
   auto-merge (founder rule, 2026-11-19) instead of waiting on the checks:
   `gh pr merge <n> --auto --merge --delete-branch --match-head-commit <tip sha>`. The guard
   refuses `--auto` without `--match-head-commit` set to the PR head, so auto-merge can only
   land the commit that was checked. GitHub merges when `gate` and `source-contract` are
   green. A red check is **HOLD**; fix it on the branch, re-run `/push-check --main` on the
   new tip, push again and enable auto-merge on the new tip. GitHub keeps auto-merge armed
   across pushes and the guard only checks at enable time, so once auto-merge is enabled,
   any further push to that branch first disables it (`gh pr merge <n> --disable-auto`);
   then the new tip gets `/push-check --main` again and auto-merge is re-enabled with the
   new `--match-head-commit`.
6. Fallback, when auto-merge is unavailable (not enabled on the repo, or `gh` refuses it):
   wait with `gh pr checks <n> --watch` until `gate` and `source-contract` are green, then
   `gh pr merge <n> --merge --delete-branch`. `--merge` keeps one revertable merge
   commit, like `--no-ff`. The guard checks the PR's head commit for a passing stamp with
   `security: pass` (and `impeccable: pass` and `unslop: pass` for frontend files), so the
   stamp from step 2 must be on the tip GitHub holds.
7. Come back to main and confirm:

   ```bash
   git switch main && git pull --ff-only
   git ls-remote origin main       # matches the merge commit
   git branch -d <branch>
   git worktree remove <path>      # when the work lived in a worktree
   ```

**Docs-only records** (only `docs/` and root `*.md` files: the founder's decisions, ledger
notes, logs) may still go straight to `main`: commit, run `/push-check --main`, then
`git push`. The guard refuses a direct push to `main` that touches anything else.

**Delete the branch in the same breath as the merge.** A landed branch has nothing left to
say. (Since 2026-10-20 a branch with unlanded work may be pushed under its own name as a
backup.) Left alone the labels accumulate, and a later reader cannot tell a branch holding
real unpushed work from one that merged three weeks ago. Use lowercase `-d`, which refuses
anything unmerged and so cannot lose work. If git objects that the branch is not merged to
its *upstream* even though it is merged to HEAD, that is a stale remote pointer rather than
work at risk: confirm with `git rev-list --count main..<branch>` and only drop the label
when the answer is `0`.

Commit messages end with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

**Never, on any verdict:** `--force`, `--no-verify`, a rebase of anything already pushed, a
commit of files this session did not write, or a merge while another session is mid-edit.
There is no argument that makes these safe, including being asked.

## 7. Say what happened

Five lines: the verdict, what the gate said with its number, the one thing most likely to
bite, what landed or did not, and what was deliberately left alone. If the answer is "not
yet, and here is the single reason", that is a complete answer.
