# Tutor experience revision — 20 September 2026

Implemented within the established Modern Atelier / French Journal UI: warm
paper, ink primary actions, chartreuse feature panels, shared rows, DM Sans
headings and Fraunces French. No new visual system or backend dependency.

## Changes and rationale

| Surface | Implemented improvement |
| --- | --- |
| Tutor landing (Speak tab) | Actual-history recommendation with purpose and estimated duration; compact orb; explicit Speak/Type and Start action; direct pronunciation, memory and guide destinations. No invented learner history. |
| Everyday missions | English outcomes lead, with French context, goals and real status; mode carries into the room; guided pronunciation is visible before the remaining catalogue. |
| Real-moment rehearsal | Max disclosed before setup; loading and failed plan checks distinguished from upgrade eligibility; retry keeps the draft; bounded multiline context; custom situations require a description. |
| Live conversation | Meaningful room heading, compact mic near reply controls, bounded reading width, keyboard avoidance, blank-send prevention, in-room quiet switch, gentler correction presentation and a latest-message control when reading older turns. |
| Guided pronunciation | Plain-language support, optional sound guide, quiet-mode switch for live rooms, and a keyboard-aware response area. Offline typed practice now actually stays silent, has no silence timer and produces no fabricated pronunciation observations. Offline demos are labelled. |
| Recap and summary | Useful next practice is prominent, completion labels are explicit, phrase-save failure has retry, and percentage scores no longer dominate the lesson summary. |
| Tutor memory | Clear explanation of personalisation, edit facts and goals, individual removal, confirmed bulk clearing that preserves goals and preferences. Edits retire old wording and clear stale translations/openers. |
| Help and recovery | Guide reachable directly from Tutor; connection failures offer guided practice; microphone errors point to platform-appropriate settings. |

## Verification

Browser checks use an isolated local mock account with no live tutor backend.
They cover phone layouts at 390px and 320px, Tutor navigation, mode propagation,
typed offline lesson progression, sound-guide expansion, rehearsal draft retention
after a failed plan retry, goal creation/editing and guide access. The Tutor
landing and supporting rows were also visually checked at 1280px.

Completed checks: `npm test` (3,092 tests passing across all workspaces),
`npm run typecheck`, `npm run build:web`, and `git diff --check`.

Automated checks include recommendation/continuation identity, memory edits and
tombstones, quiet offline practice, route wiring and existing session/lease guards.
Source-contract tests were updated for the intentionally changed UI; tests were
not skipped or deleted.

Live microphone capture, paid tutor audio, native keyboard behaviour and live
billing success states still require device/backend QA before release. Browser
mock checks do not establish those behaviours.
