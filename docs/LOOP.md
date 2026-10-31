# The local loop

`npm run loop` runs Claude Code on this computer, checks each attempt itself, and
leaves the changes for review. A Hetzner server is optional; it only provides an
always-on machine. The local runner needs Node >=22, the locked dependencies
installed in this checkout, and an installed, authenticated `claude` CLI. Model
calls still need internet access and use the CLI's normal account or API billing.
No account setup, server provision or model call happens in `--dry-run`.

## Run a planned change

Write the outcome and acceptance in `docs/changes/<name>.md`. Add one executable
block to that same plan. The task list is explicit JSON inside a Markdown fence:

````markdown
```luvani-loop
{
  "version": 1,
  "tasks": [
    {
      "id": "T1",
      "goal": "Describe one bounded change and its observable result.",
      "dependsOn": [],
      "files": ["apps/mobile/src/auth/SignInScreen.tsx"],
      "checks": [["npm", "test", "--workspace=@luvani/mobile"]]
    }
  ]
}
```
````

`files` contains exact repository-relative files, or a directory ending in `/`.
Dependencies must name other task IDs and cannot form a cycle. Include the test
files and the defect ledger in the write scope when the task needs them. Keep the
plan outside every task's write scope: the worker cannot mark its own work done.
Commands are argument arrays, executed without a shell. They are trusted local
commands you choose, so review them before running a downloaded or generated plan.
A task cannot be accepted without at least one command and a successful agent exit.

```bash
npm run loop -- --plan docs/changes/local-loop-example.md --dry-run
# After reviewing and committing the plan in a clean checkout:
npm run loop -- --plan docs/changes/local-loop-example.md --branch codex/local-loop-smoke --max 2 --minutes 20
```

The example creates one small documentation file, then verifies its contents.
Replace it with your own task plan after proving the local setup. `--dry-run`
prints the next prompt and limits, including on a dirty checkout, without creating
logs, changing branches, running checks or contacting a model.

Tasks run sequentially in dependency order, even when the baseline gate is green.
Each task is accepted only after the runner executes its checks successfully.
Failed checks and CLI errors go into the next repair prompt; partial edits remain
available. After all task checks pass, the runner executes the full `npm run gate`
implementation. Only its successful exit and `ok: true` result complete the run.
Visual, device, hosted and paid acceptance still need their own evidence; the local
gate does not prove those outcomes.

## Limits, logs and resume

```bash
npm run loop -- --plan docs/changes/my-change.md --max 5 --minutes 45 --patience 2
npm run loop -- --resume <run-id> --max 3 --minutes 20
```

`--max` limits agent attempts in this invocation; `--patience` stops a task after
consecutive failed attempts. `--minutes` is a deadline for the entire invocation,
including agents and checks. Ctrl-C stops the child process group on macOS/Linux.
The runner preserves the last edits and writes a checkpoint when stopping.

Logs live in the ignored `.loop/<run-id>/` directory:

- `journal.md`: task progress and check commands.
- `iterations.jsonl`: actual exit codes and interruption results.
- `state.json`: accepted tasks, last failure, Git revision and file fingerprints.
- `prompt-<attempt>.md` and command logs: full local attempt evidence.

Resume requires the same checkout, branch, Git revision, plan and working-file
contents. The runner rechecks accepted tasks before trusting their dependencies.
If anything changed externally, review the partial edits, commit the reconciled
state and start a new run. A scope violation cannot be resumed blindly. Copy a
concise result into the tracked plan's execution log after review; the runner does
not rewrite the human plan or stage its logs.

`--model <name>` selects an installed CLI-supported model. Optional
`--max-budget-usd <amount>` sets the Claude CLI's dollar cap **per agent attempt**,
not for the whole loop; it and the model selection persist across resume. Other
limits reset to the flags of each new invocation. No model is silently pinned or
upgraded by this runner.

The Mac must stay awake while the terminal is running. For a deliberate long run:

```bash
caffeinate -i npm run loop -- --plan docs/changes/my-change.md --max 5 --minutes 45
```

This keeps the machine awake during the command; it cannot make a closed laptop
run indefinitely. Keep the terminal open. You can resume after an interruption.

## Review boundaries

Live runs require a clean checkout and a dedicated branch. `--branch codex/<name>`
creates a new branch from the current revision; it never switches to an existing
branch. A detached checkout needs this flag or an explicit branch first. The
runner never stages, commits, pushes, resets, cleans or discards edits. Review the
diff and use the normal repository landing process yourself.

The available tools exclude delegation and destructive Git commands. Permissions
default to `dontAsk` with explicit edit/read and check-command allowlists;
`--permission-mode acceptEdits` is also supported. Permission bypass is rejected.
After each agent and its checks, the runner detects Git-visible edits outside the
task scope, staged changes, commits or branch changes and stops for review. This
is detection after execution, not an OS sandbox: ignored files and arbitrary
trusted check commands are not isolated. Use a dedicated checkout and narrow
write scopes. Paths cannot escape the repo or traverse known symlinks.

## Before every push

`/push-check` (`.claude/commands/push-check.md`, founder rule 2026-10-31) runs before any
push: the gate, a Playwright pass over the screens the diff touches at 320 and 375 in
light and dark, a local boot and smoke of touched services, parallel `push-reviewer`
agents (frontend, backend, tests) with the built-in `/code-review`, and a fix loop until
nothing new above low is found. `--main` adds the built-in `/security-review` on the
merge diff. It ends by stamping the commit
(`<git common dir>/push-check/<sha>.json`); the `PreToolUse` hook
`scripts/push-check-guard.mjs hook` refuses a Claude session's `git push` without a
passing stamp, and a push to `main` without a passing security review. The `pre-push`
git hook still runs the full gate as the last check.

## Repair a failing gate

Without `--plan`, the runner retains bug-repair mode. It runs the gate first and
stops if green. On red, it selects an open P0/P1 or the failing check and uses the
ledger's named file paths as scope. Ambiguous scopes need an explicit override:

```bash
npm run loop -- --files apps/mobile/src/auth/,docs/KNOWN_ISSUES.md --max 3 --minutes 30
```

Defects still belong in `docs/KNOWN_ISSUES.md`, with exact `verified-by:` test
titles. Never weaken assertions or floors to obtain green. The gate enforces
workspace counts, types, database/release proofs, hygiene, secrets, agent pins and
ledger evidence. `npm run gate:fast` remains file hygiene rather than full proof.

This sequential runner does not invoke `/forge`, bug-hunter, fix-verifier or a
Fable reviewer. Those remain the separate interactive workflow in [FORGE.md](FORGE.md).
The local plan runner is available without wiring that multi-agent workflow.
