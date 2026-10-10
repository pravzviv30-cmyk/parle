# Agent workflow entry points

- Status: verified and approved for main
- Updated: 2026-10-10
- Checkout / starting revision: Codex worktree `a821/Luvani`, `37bed2a7`
- Owner / integrator: active Codex session

## Outcome and scope

Adapt the reference video's context, decisions and bounded-task workflow to the
existing Luvani repository so later changes need less rediscovery and have a
clearer handoff. Keep the six workspaces and existing gates as they are.

- Existing seam: the documentation index, `CLAUDE.md`, `.claude/` roles and gate.
- Context: [architecture](../ARCHITECTURE.md), [forge](../FORGE.md),
  [loop](../LOOP.md), [testing](../TESTING.md).
- Non-goals: app behaviour, dependency changes, agent orchestration, VPS setup,
  unattended execution, deployment and changes in other checkouts.
- Risk: duplicated context can become stale. Use links and an entry point rather
  than restating feature specifications. Task status requires real evidence.
- Decisions: [DEV-001 and DEV-002](../../DECISIONS.md).
- Defects: none introduced; this is a documentation workflow change.

## Screens and states

Not applicable. No learner-facing UI changes.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T1 | Discoverable repository rules, context and decision history | Codex | none | `AGENTS.md`, `CONTEXT.md`, `DECISIONS.md`, `CLAUDE.md` | done |
| T2 | Reusable tasks and logs reachable from the existing docs | Codex | T1 | `docs/changes/`, `docs/README.md`, `README.md` | done |
| T3 | Checked documentation and an honest gate/handoff record | Codex | T1, T2 | `docs/changes/agent-workflow.md` | done |

### T1 — Repository entry points

Add a small root instruction file, route context to the existing domain docs,
and record only new lasting choices. Link Claude's entry point to the shared
structure and clarify testing in a worktree with its own install.

Acceptance: paths and workspace names match this checkout; instructions preserve
single ownership, existing gates and scoped Expo guidance; no blanket model or
unattended-run policy is introduced.

### T2 — Bounded tasks and execution memory

Add a change template with dependencies, allowed files, acceptance checks, screen
states and a concise execution log. Connect it to the current documentation map.

Acceptance: local links resolve; a future session can identify the next task and
its proof; the existing defect ledger, forge contracts and loop retain their roles.

### T3 — Verification and handoff

Check Markdown links and whitespace, run the fast and full gates, and record the
actual outcomes. Keep this worktree's pre-existing `.codex/` file untouched.

Acceptance: documentation checks pass; gate results and any environment gaps are
recorded without weakening checks; the final disposition identifies what remains
before landing.

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-10-10 / discovery | Reviewed the reference video's visible workflow and inspected the workspace map, forge/loop contracts and gate | Existing architecture, role ownership and full gate already cover much of the method; root `AGENTS.md` and reusable tracked task contracts were missing | Add the small entry points and tracked plan |
| 2026-10-10 / T1, T2 | Added the root map, context index, decision entries, change template and documentation links; corrected screen paths to match this checkout | 8 Markdown files and 88 local links checked; all mapped paths resolve; `git diff --check` and `npm run gate:fast` pass | Check the added root README link and finish integrated verification |
| 2026-10-10 / environment | Attempted `npm run gate` in the changed worktree | Exit 1: no installed workspace dependencies, `tsc` missing, suites fail to load and SQL proofs cannot import PGlite; this is not a valid full verification result | Attempt the locked install from the existing local npm cache |
| 2026-10-10 / environment | Installed 900 locked packages with `npm ci --ignore-scripts --offline` from the local cache, then ran `node scripts/patchExpoModulesJsi.mjs`; skipped install hooks to avoid changing shared Git configuration | Install passes; workspace links and brain's nested SDK resolve inside this worktree; tracked manifests unchanged | Run the full gate with the correct local dependencies |
| 2026-10-10 / T3 | Rechecked the root README link, all changed Markdown and untracked documents | 9 Markdown files and 97 local links pass; `git diff --check` and `npm run scan:secrets:all` pass | Finish the full gate |
| 2026-10-10 / environment | Ran the installed full gate, then isolated the failing voice-proxy fixtures | 5,087 workspace tests loaded; all eight database proofs pass; focused failures show `listen EPERM` on `127.0.0.1` in the sandbox. The two decoder-slot tests pass in isolation | Rerun the full gate with localhost access |
| 2026-10-10 / T3 | Ran `npm run gate` with localhost access against this worktree's locked install | Exit 0: 5,087 workspace tests and 77 release/provider proofs pass; all eight SQL proofs replay all 39 migrations; typecheck, hygiene, secrets, agent pins and ledger checks pass | Leave the verified change for integration; no runtime edits or gate changes were needed |

## Initial verification and handoff

- Focused checks: 97 local links across all 9 changed Markdown files resolve;
  mapped repository paths are present; whitespace checks, `npm run gate:fast`
  and `npm run scan:secrets:all` pass.
- Full gate: `npm run gate` exits 0 with localhost access. Workspace counts:
  core 798, brain 468, tutor-agent 610, token-server 441, brain-playground 26,
  mobile 2,744. All floors pass. The 77 shared release/provider tests and eight
  database proofs also pass; each proof replays all 39 migrations.
- UI / hosted / device / paid checks: not applicable to this change.
- Documentation and decisions: root entry points and `docs/changes/`.
- Landing disposition: LAND with explicit founder approval. The combined changes
  are verified against current main and ready for a normal merge and push. The
  pre-existing `.codex/environments/environment.toml` is untouched.
- Next task: publish the verified merge to main.

## Main integration — 10 October 2026

The founder requested publication to main and removal of superseded code. The
unpublished changes were replayed onto origin/main at b8f2d2e7. Main's newer
sign-in presentation and keyboard protections were preserved; the 300 ms
handoff, vertical field alignment and reduced focus-frame delay apply to that
implementation. The loop is replaced in place, including removal of automatic
staging, commits and destructive rollback. No duplicate runner was added.

The integrated full gate passes: core 798, brain 468, tutor 610, token 441,
playground 26, mobile 2758 (5101 workspace tests), plus 89 shared/script/release
proofs, all zero failures. All eight database proofs replay 39 migrations. The
integrated sign-in browser check confirms the handoff, left alignment, even
vertical padding and Show/Hide focus. The local runner dry-run also passes.

Landing disposition: LAND with explicit founder approval. Publish as a normal
merge and push with hooks; no force push or hook bypass. The generated graph
was refreshed from the integrated source (15800 nodes, 42468 edges, 646
communities). Physical-device keyboard timing and a paid real-CLI run remain
unperformed, as recorded above.
