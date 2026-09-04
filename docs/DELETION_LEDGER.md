# Deletion and supersession ledger

Nothing here is deleted until imports, navigation, persisted data, compatibility reads,
replacement tests, focused tests, and the full gate have been checked.

| Candidate | Status | Replacement/condition | Persisted-data concern |
|---|---|---|---|
| `splash/store.ts` and the `luvani.seenSplash.v1` flag | Done | Nothing replaces it: the flag recorded that this install had seen a screen that no longer exists | Audit re-run 2026-08-26 — written by `markSplashSeen`, read by `hasSeenSplash`, sole importer `App.tsx`, never user-scoped, never synced, no reader left. Swept by `RETIRED_DEVICE_KEYS` in `migrateLegacyStores`, ahead of the legacy marker so devices that already inherited still sweep. Proved by `the retired splash flag is removed by the storage sweep` |
| Duplicate pre-auth `SplashScreen.tsx` and retired `WelcomeScreen.tsx` | Unreachable after the five-page first-run flow | One front door, `onboarding/PreAccountOnboarding.tsx`, with the signed-in bypass the gate already had | The pre-account draft holds only the age confirmation and voice choice, then is cleared after profile creation |
| Old name/motivation/cake onboarding pages | Scheduled — the why page goes with F108 | `PAGES` becomes age, name, Meet Luc: age first because it is the gate, name second, one readiness page third | `motivation` stays in `StoredProfile`, in `upgradeStored` and in the sync merge policy — stored records carry it and the profile blob syncs whole; the flow writes `null`. `ageGate` and `needsOnboarding` are untouched, so no returning learner is re-onboarded |
| Four-page `TutorIntro` and seen state | Scheduled — not this phase, and the condition is written down | Two things must be true first: something else must teach the three orb colours, which `tutor/gate.test.ts` pins `TutorIntro` as the only current teacher of (`Amber, it is thinking`), and the `tutorIntro` namespace needs a retirement path | `tutorIntro` is a synced set-union namespace with a registered adopter and a name in the `learner_state` check constraint, so other devices keep pushing it after this one stops reading it. Removing it is a sync-compatibility job, not a screen deletion |
| Leaderboard and fake friend/rank data | Scheduled | No launch social surface; My French holds real evidence | Inspect `friends` scoped payload before key removal |
| Duplicate practice presentation/mastery counters | Audit required | One scheduler and evidence model | Review/drill/topic/journal payloads must survive |
| Implicit production mock auth | Superseded | Explicit local-development flag | Local mock accounts remain dev-only fixtures |
| Plain AsyncStorage Supabase bearer | Superseded | Native chunked SecureStore adapter | Failed migration now removes plaintext and requires sign-in |
| File/memory production entitlement authority | Superseded | Atomic Supabase RPC | File store remains explicit local tooling only |
| Non-idempotent two-argument debit RPC | Superseded by migration | UUID session ledger RPC | Drop happens in ordered migration |
| Placeholder/fake payment UI | Do not build | Verified store purchase lifecycle first | No entitlement may originate on client |
| Placeholder legal text presented as policy | Blocked replacement | Reviewed Privacy and Terms | Current UI must continue saying policies are not written |

**Done** here means the audit was re-run against the tree, not that it was run once
when the row was written. Every Done row names the evidence and the test that keeps it
true; a row whose reader is gone but whose key is still on the device is not Done,
because a device-level key survives both account reset and account deletion.
