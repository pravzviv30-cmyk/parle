# Deletion and supersession ledger

Nothing here is deleted until imports, navigation, persisted data, compatibility reads,
replacement tests, focused tests, and the full gate have been checked.

| Candidate | Status | Replacement/condition | Persisted-data concern |
|---|---|---|---|
| Duplicate `SplashScreen` plus seen store | Scheduled | One welcome with correct signed-in bypass | Device-level seen flag may be left harmlessly or migrated |
| Old name/motivation/cake onboarding pages | Scheduled | Situation, support, readiness and age policy | Preserve profile repair; optional nulls cannot re-onboard |
| Four-page `TutorIntro` and seen state | Scheduled | One readiness view, contextual coach marks, Help | Remove `tutorIntro` suffix only after compatibility audit |
| Leaderboard and fake friend/rank data | Scheduled | No launch social surface; My French holds real evidence | Inspect `friends` scoped payload before key removal |
| Duplicate practice presentation/mastery counters | Audit required | One scheduler and evidence model | Review/drill/topic/journal payloads must survive |
| Implicit production mock auth | Superseded | Explicit local-development flag | Local mock accounts remain dev-only fixtures |
| Plain AsyncStorage Supabase bearer | Superseded | Native chunked SecureStore adapter | Failed migration now removes plaintext and requires sign-in |
| File/memory production entitlement authority | Superseded | Atomic Supabase RPC | File store remains explicit local tooling only |
| Non-idempotent two-argument debit RPC | Superseded by migration | UUID session ledger RPC | Drop happens in ordered migration |
| Placeholder/fake payment UI | Do not build | Verified store purchase lifecycle first | No entitlement may originate on client |
| Placeholder legal text presented as policy | Blocked replacement | Reviewed Privacy and Terms | Current UI must continue saying policies are not written |

