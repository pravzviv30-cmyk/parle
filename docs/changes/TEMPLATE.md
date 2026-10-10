# <Change name>

- Status: draft
- Updated: <YYYY-MM-DD>
- Checkout / starting revision: <path and commit>
- Owner / integrator: <person or active session>
- Existing programme / contract: <link, if one already covers this change>

## Outcome and scope

<The requested outcome, current behaviour, and observable result after the change.>

- Existing seam: <the implementation being extended>
- Context: <links to the relevant domain docs and symbols>
- Non-goals: <explicit boundaries>
- Risks / unresolved choices: <concrete items, or none>
- Decisions: <links to DECISIONS.md entries where needed>
- Defects: <KNOWN_ISSUES.md IDs where applicable>

## Screens and states

<For UI work: routes, expected interactions, loading/empty/error/offline states,
returning-user behaviour, accessibility, and the app/device verification needed.
For other work: mark this not applicable.>

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T1 | <bounded observable result> | <owner> | none | <paths> | todo |
| T2 | <consumer of T1, if needed> | <owner> | T1 | <paths> | todo |

### T1 — <Name>

<Brief implementation steps and the existing pattern to follow.>

Acceptance:

- <Named behaviour or evidence that proves the outcome.>
- `<focused command>` → <expected result>.

### T2 — <Name>

<Steps, dependency/interface requirements and acceptance checks; remove if unused.>

## Optional local execution contract

For a reviewed plan that should run with `npm run loop`, add one `luvani-loop`
JSON fence as documented in [../LOOP.md](../LOOP.md). Use the same task IDs,
explicit dependencies, narrow file scopes and command-array acceptance checks.
Keep this plan outside the workers' write scopes. Remove this section for manual
work; placeholders are not executable acceptance.

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| <date / ID> | <what actually happened> | <actual command and result> | <concrete next action> |

Record only actions and checks that actually occurred. Keep failed attempts.
Use `not run` for missing proof, and identify required external acceptance.

## Integrated verification and handoff

- Focused checks: <actual results>
- Full gate: <actual result, workspace counts, or exact blocker>
- UI / hosted / device / paid checks: <actual evidence or remaining gap>
- Documentation and decisions: <updated links>
- Landing disposition: <LAND / HOLD / SPLIT / ASK, with reason>
- Next task: <ID, remaining acceptance, or none>
