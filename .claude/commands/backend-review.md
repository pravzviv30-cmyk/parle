---
description: Route a backend change or release through the relevant architecture specialists and return evidence-based readiness.
argument-hint: [change, candidate commit or intended deployment]
---

Review `$ARGUMENTS`; change no source or external state. Read `CLAUDE.md` and
`docs/TEAM.md`. Identify candidate commit, changed paths, intended environment and
the user's existing authorization. If no candidate is supplied, inspect the current
checkout and say that it is the review target.

Dispatch `backend-architect` for cross-service changes. Select only the applicable
specialists below; independent reviews may run in parallel, with disjoint scopes.

| Change | Architect |
|---|---|
| auth, RLS, grants, storage, retention, export/deletion, migrations | **database-security-architect** |
| LiveKit, data-channel input, STT/TTS/model, metering, session/queue lifecycle | **voice-reliability-architect** |
| public release, CI, hosting, secrets, schema rollout, recovery or capacity | **deployment-architect** |

Give each reviewer the original request, raw diff, relevant source, environment and
checks actually run. Do not give only the builder's success summary. Respect model
pins and report any unavailable dispatch instead of claiming review completion.

Combine findings into one `READY`, `REVISE` or `HOLD` verdict. List each blocker,
evidence, implementation owner and acceptance check; retain unknown critical deployment
facts as holds. Do not edit ledger severity or tick checks during this read-only command.
Route implementation to existing territory engineers through the normal workflow.
Architecture approval never triggers deployment or a recurring automation by itself.
