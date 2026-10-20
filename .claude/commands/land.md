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

Run everything from the **main checkout**, never from `.claude/worktrees/`. A worktree has
no `node_modules`, so Node resolution walks up and binds the wrong copy of a dependency:
`packages/brain` reports 122 tests from a worktree and 146 from the main checkout, and the
missing suite fails silently by never loading. A gate that green-lit a merge from a worktree
green-lit a lie.

If the shell is in a worktree, `cd` to the main checkout is **not** the fix — that lands
your edits in the shared tree. Re-run there deliberately, or stop.

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
`main` that turns out to be half a change costs everyone who pulls it. This repo has two
merge commits in its whole history and a linear trunk otherwise, so `main` is genuinely the
shared floor rather than a staging area.

## 6. Landing

Only on **LAND**, and only in this order:

```bash
git switch -c <branch>          # if the work is sitting on main, branch it first
git add <explicit paths>        # never -A, never .
git commit                      # pre-commit runs gate:fast
git switch main && git merge --no-ff <branch>
git push                        # pre-push runs the full gate
git branch -d <branch>          # retire the label, now that main carries the work
```

`--no-ff` so the branch is one revertable unit. The `pre-push` hook runs the full gate, so
pushing is the last honest check; let it run rather than working around it.

**Delete the branch in the same breath as the merge.** Work leaves this repo by going to
`main` and pushing `main`, so a landed branch has nothing left to say. (Since 2026-10-20 a
branch with unlanded work may be pushed under its own name as a backup; once it lands,
delete it locally and on `origin`.) Left alone the labels accumulate, and a later reader cannot tell a branch holding
real unpushed work from one that merged three weeks ago. Use lowercase `-d`, which refuses
anything unmerged and so cannot lose work. If git objects that the branch is not merged to
its *upstream* even though it is merged to HEAD, that is a stale remote pointer rather than
work at risk: confirm with `git rev-list --count main..<branch>` and only drop the label
when the answer is `0`.

Commit messages end with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**Never, on any verdict:** `--force`, `--no-verify`, a rebase of anything already pushed, a
commit of files this session did not write, or a merge while another session is mid-edit.
There is no argument that makes these safe, including being asked.

## 7. Say what happened

Five lines: the verdict, what the gate said with its number, the one thing most likely to
bite, what landed or did not, and what was deliberately left alone. If the answer is "not
yet, and here is the single reason", that is a complete answer.
