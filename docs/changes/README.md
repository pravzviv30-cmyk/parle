# Planning changes

For work that crosses workspaces, needs ordered tasks or will span sessions,
copy [TEMPLATE.md](TEMPLATE.md) to `docs/changes/<short-kebab-case-name>.md`.
Reuse a programme plan that already has the same information. Small fixes can
use a short scope and verification summary without a new document.

This gives the planning approach from the reference video a home in Luvani's
existing structure. It does not require a directory reorganisation.

| Video practice | Luvani implementation |
|---|---|
| Describe the app and design the screens | Existing `PRODUCT.md`, `DESIGN.md` and domain docs; specify the changed screens and states in the plan |
| Map agent responsibilities | Root [AGENTS.md](../../AGENTS.md), existing [TEAM.md](../TEAM.md) and scoped mobile instructions |
| Save context and decisions | [CONTEXT.md](../../CONTEXT.md) routes to existing docs; [DECISIONS.md](../../DECISIONS.md) records new lasting choices |
| Break the remaining work into tickets | One plan with dependency-ordered tasks, bounded files and acceptance checks |
| Log successes and failures | Execution log in the plan; exact command, result, remaining gap and next action |
| Run agents overnight on a VPS | Deferred: the default unattended loop's tool allowlist excludes specialist dispatch; see [FORGE.md](../FORGE.md) |

## Working through a plan

1. Capture the requested outcome, current behaviour, existing seam and non-goals.
   Link the relevant domain docs and any existing programme acceptance holds.
2. Split by independently verifiable behaviour, not an arbitrary ticket count.
   Each task names dependencies, allowed files and the proof that will finish it.
   Specify affected UI states before coding and shared interfaces before consumers.
3. Start a task only after its dependencies are verified. Use `todo`, `in-progress`,
   `blocked` and `done`; record the concrete blocker when one exists. Do not call
   a task done while its own acceptance checks are missing or failing.
4. Run focused checks as work proceeds. Log failures and attempted repairs so a
   new session can resume from evidence. Keep raw run output in the existing local
   run folders, and keep the tracked log concise and free of secrets or user data.
5. Run the existing full gate for the integrated result and verify changed UI
   journeys in the app. Record external acceptance separately. A green local gate
   cannot prove a hosted rollout, device check or paid voice eval.
6. Update existing behaviour docs and add a decision entry only for a lasting
   choice. Finish with a landing disposition and the remaining acceptance gaps.

If the work uses Claude Code `/forge`, its existing contract, model pins and
approval sequence still apply. Link that contract and put the reusable scope and
handoff evidence in the tracked plan; do not create a competing judge loop.
Defects stay in [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) with their named test proofs.

Parallel execution needs authorised agents, independent dependencies, disjoint
write sets and an integrator for shared interfaces. A task list alone does not schedule
agents, grant credentials or provision a VPS. For sequential local execution,
add the explicit contract in [LOOP.md](../LOOP.md) and preview it first.
The integrator owns the shared plan and execution log. Workers return changed
paths and check results, and edit only their assigned files.

## Resuming work

Read the plan, confirm the checkout and revision, then verify the recorded file
state. Start with the first unblocked task whose dependencies have evidence.
Inspect the previous failed attempt before trying the same repair again.

Example request: “Use `docs/changes/<name>.md`; complete the next unblocked task,
run its acceptance checks, and update the execution log.”

The first application of this workflow is [agent-workflow.md](agent-workflow.md).
