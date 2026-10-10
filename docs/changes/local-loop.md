# Local change runner

- Status: verified locally; awaiting integration
- Updated: 2026-10-10
- Checkout: /Users/pravz_07/.codex/worktrees/a821/Luvani, starting 37bed2a7
- Owner: current Codex session
- Decision: [DEV-003](../../DECISIONS.md)
- Defect: F786 in [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

Run bounded changes locally without a server. Extend the existing Claude CLI
runner to consume explicit tasks from tracked plans, even with a green baseline.
Keep the integrator responsible for the human plan and final landing.

| Task | Depends on | Allowed paths | Status |
|---|---|---|---|
| T1: local plan execution, checks and checkpoints | none | scripts/loop.mjs, scripts/loop.test.mjs | done |
| T2: gate proof and runner documentation | T1 | scripts/gate.mjs, docs/LOOP.md, docs/FORGE.md, docs/changes/, DECISIONS.md, docs/KNOWN_ISSUES.md, docs/README.md | done |
| T3: integrated verification | T2 | this plan | done |

Screens and states: not applicable. The separate auth fix is recorded in
[auth-field-polish.md](auth-field-polish.md).

## Execution log

| Task | Action | Actual proof | Next |
|---|---|---|---|
| T1 | Replaced automatic commit/rollback with preserved patches, task checks, deadline cancellation and fingerprinted resume | `node --test scripts/loop.test.mjs`: 12 passing fixture tests; no real model calls | full gate |
| T2 | Added the runner proof suite to the full gate and documented the executable format, limits and smoke example | `npm run loop -- --plan docs/changes/local-loop-example.md --dry-run`: exit 0 in this dirty checkout, no mutation or model call | full gate |

Real CLI execution, paid model use and physical overnight/laptop-sleep operation
were not run. The installed Claude Code 2.1.285 help supports the flags used.
The example is ready to review and run after the plan is committed in a clean
checkout on a dedicated branch. No scheduler or forge reviewer was invoked.

Landing disposition: HOLD, uncommitted edits in the attached worktree; review and
integrate through the normal process. No other worktree was changed.

## Integrated verification

- Full gate: green. Workspace tests: core 798, brain 468, tutor 610, token 441,
  playground 26, mobile 2751 (5094 total); 89 shared/script/release proofs, zero
  failures. All eight SQL proofs replayed the 39 migrations.
- Fast gate and diff whitespace: passed. 108 local documentation links checked.
- The smoke example's exact acceptance command also passed in an isolated fixture.
- Graph refresh: 15792 nodes, 42427 edges, 614 communities. No model labeling call.
  The graph tool reported missing SQL extraction support (`tree_sitter_sql`) for
  78 SQL files and 253 source files without nodes. Existing database proof tests
  remain the SQL evidence.

Final source-state confirmation: `npm run gate` passed again after the password-control sizing adjustment; counts and all eight SQL proofs match the results above. The working-tree secret scan is clean.
