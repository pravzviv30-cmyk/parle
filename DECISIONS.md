# Decision log

Record new lasting architecture and development-workflow choices here. This log
starts on 10 October 2026; it does not reconstruct the project's earlier history.
Existing product and technical decisions remain in [PRODUCT.md](PRODUCT.md),
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the domain documents.

Use a stable ID, date, status (`accepted`, `proposed` or `superseded`), decision,
reason, consequence and source. A proposal is not permission to implement it.
When a decision changes, add a superseding entry and link it from the old one.
Routine task progress belongs in its change plan.

## DEV-001 — Add a small shared agent entry point

- Date: 2026-10-10
- Status: accepted
- Decision: use root `AGENTS.md` for repository navigation and working rules,
  and `CONTEXT.md` as an index into the existing documents.
- Reason: Luvani already has detailed context, but its root instructions were
  centred on Claude Code. A root entry point makes the same structure discoverable
  to Codex without loading every document.
- Consequence: retain the current workspaces and domain sources of truth; keep
  Claude-specific commands and model pins in `CLAUDE.md` and `.claude/`.
- Sources: [change plan](docs/changes/agent-workflow.md),
  [official AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## DEV-002 — Keep reusable change contracts in Git

- Date: 2026-10-10
- Status: accepted
- Decision: use a Markdown change plan with dependency-ordered tasks, allowed
  files, acceptance checks and an execution log for substantial work. Reuse
  an existing programme plan when it already supplies those fields.
- Reason: `.forge/` and `.loop/` contain ignored local run state. A small tracked
  contract lets another session resume work without reconstructing a chat.
- Consequence: [docs/changes/](docs/changes/README.md) holds reusable contracts;
  `KNOWN_ISSUES.md` remains the defect ledger. Tiny fixes do not need a ticket.
- Sources: [workflow](docs/changes/README.md), [forge](docs/FORGE.md),
  [loop](docs/LOOP.md).

## DEV-003 — Execute reviewed change plans sequentially on the local machine

- Date: 2026-10-10
- Status: accepted
- Decision: extend `scripts/loop.mjs` with one executable `luvani-loop` JSON
  block inside a tracked change plan. Use task dependencies, narrow write scopes,
  runner-owned checks, invocation deadlines and ignored local resume state.
- Reason: a green bug gate does not mean a feature plan is complete. The existing
  local CLI seam can perform planned changes without a VPS or a new scheduler.
- Consequence: no automatic staging, commits or destructive rollback. Failed
  patches survive for repair and review. Only a full green gate completes a run.
  Scope checks detect Git-visible violations after execution; they are not an
  OS sandbox. `/forge` and its pinned reviewers remain a separate workflow.
- Sources: [loop contract](docs/LOOP.md),
  [implementation and evidence](docs/changes/local-loop.md).
