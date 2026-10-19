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

## UX-001 — C2/M2/M3 extends the existing learning and motion owners

- Date: 2026-10-18
- Status: accepted by the founder’s implementation request
- Decision: retain RootNavigator, core pedagogy, server admission and existing
  conversation/review stores while exposing Home, Explore, Speak, My French and
  Progress. Keep legacy links compatible through the same main page components.
  Explicit onboarding level/support/focus choices live in the existing profile;
  they alter presentation and requested conversation support, never earned grades.
- Reason: a clear consumer learning loop needs one place for saved conversations,
  one resumable practice owner and honest progress. A second store, navigator or
  assessment rule would create conflicting state.
- Consequence: original conversation text stays separately consented and linked
  by exact session identity. Account-local appearance is exported/reset but not
  synced between devices. Remotion authors reviewable art timing; the existing
  native engine drives layered vectors and cancels on lifecycle/reduced-motion
  changes. The post-verification name step uses the existing durable preference
  queue and causal clock. M4 is not a design source.
- Native acceptance refinement: Screen owns actual-origin keyboard avoidance;
  ScrollScreen owns focused-group visibility using the existing form geometry
  helpers. Callers identify an input and its immediate guidance/action rather
  than duplicating scroll maths or adding a form/navigation subsystem.
- Sources: [design](DESIGN.md), [onboarding](docs/ONBOARDING.md),
  [implementation contract](docs/changes/c2-main-app-implementation.md).

## UX-002 — Browseable collections with lasting samples and server-owned plan access

- Date: 2026-10-18
- Status: accepted by the founder's free-content and seven-day trial request
- Decision: expose the existing authored scenario catalogue through real
  collection routes. Thirty permanent samples cover every theme and authored
  pitch; an active Starter or Max standing opens the rest. Existing local
  word/phrase/mission practice and personal learning retain their free access.
  Store trial eligibility and localized prices are actual store facts; the
  server retains thirty one-time introduction minutes and forty-two/seventy
  minutes during the confirmed seven-day Starter/Max store trial.
- Reason: a lasting useful sample should match the learner's stated ability.
  Hiding personal learning after expiry would undermine the conversation-to-
  practice loop. Bundled catalogue locks are product presentation controls;
  all generated conversations remain subject to server admission and metering.
- Consequence: an unread server response is recovery, not a guessed paid/free
  answer. Annual allowance-window end is not interpreted as paid-through.
  First-run offers wait for Home and retire on departure/background/account
  changes. Collection purchase returns to the original scene. Annual saving
  compares finite positive numeric store prices for the same tier and currency,
  rounded down, rather than parsing localized strings. Prices are configured
  only after store setup; preview figures are explicitly synthetic.
- Sources: [design](DESIGN.md), [setup](docs/REVENUECAT_SETUP.md),
  [implementation contract](docs/changes/c2-main-app-implementation.md).
