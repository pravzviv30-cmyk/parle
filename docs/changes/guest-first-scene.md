# Guest first scene

- Status: in-progress
- Updated: 2026-10-23
- Checkout / starting revision: `Luvani-worktrees/guest-first-scene`, branch
  `claude/guest-first-scene` from `main` at 3acc25b5
- Owner / integrator: the guest-first-scene orchestrator session
- Decision: UI-011 in [DECISIONS.md](../../DECISIONS.md) (reverses UI-003)

## Outcome and scope

A learner who has not made an account can do one short scripted café exchange in
French, by voice or by typing, before the account form. The scene has five turns, no
language model and a hard 180-second ceiling. It is available once per installation
per 30 days, within a service-wide daily ceiling. If the learner then creates an
account, the lines they said go into their phrasebook.

- Existing seam: the local guest live path (`onboardingGuest.ts`, `guestLive.ts`,
  `/onboarding/*`, the guest lifecycle in `sessionLifecycle.ts`, `FirstLivePractice`,
  `GuestAccountHandoff`), the scripted lesson tutor (`LuvaniTutor`), and the paid
  voice proxy.
- Context: [FIRST_LIVE_PRACTICE.md](../FIRST_LIVE_PRACTICE.md),
  [ONBOARDING.md](../ONBOARDING.md), the "Guest speech" section of
  [BACKEND_RELEASE_RUNBOOK.md](../BACKEND_RELEASE_RUNBOOK.md) (the D13 precedent).
- Non-goals: a free LLM conversation for guests; DeviceCheck, App Attest or Play
  Integrity; any Supabase migration; any hosted action.
- Risks: the installation id is a forgeable courtesy limit. The money limit is
  `LUVANI_GUEST_SCENE_DAILY` scenes, each capped at 180 s of audio and 48 TTS calls.

## Wire contract (shared by the server, the worker and the app)

Names come from `@luvani/core` (`packages/core/src/lessons/guestCafe.ts`):
`GUEST_SCENE` (`'guest-cafe'`), `GUEST_SCENE_TURN_IDS`, `GuestSceneTurnId`,
`GUEST_SCENE_MAX_SECONDS` (180), `GUEST_CAFE_SCENE` (lesson id `cafe-guest`),
`parseGuestSceneTurnIds`, `guestScenePhrases`.

1. **Start.** `POST /onboarding/start` with the existing body plus `live: true,
   scene: 'guest-cafe'`. The response is as today, plus `scene: 'guest-cafe'`.
   Refusals use 503 with `error`:
   - `guest-live-unavailable`: the switch is off, a dependency is missing, or today's
     ceiling is spent (a read-only check).
   - `guest-scene-used`: this installation already started a scene in the last 30 days.
   - `voice-unavailable`: unchanged.
   A repeat start that presents the same still-valid capability from the same
   installation returns that capability and books nothing new.
2. **Room grant.** `POST /onboarding/live` with the guest header and the body
   `{ mode: 'lesson' | 'lesson-text' }` for a scene capability. Any other mode
   returns 400. The scene room ignores the brief, so changing the brief never mints a
   second room. `maxSeconds` is 180 and the join deadline is 120 s. The same unclaimed
   room is reissued after a failed connection; a claimed room is never reissued.
3. **Signed metadata** (`tokens.ts`): `scene: 'guest-cafe'`, `mode` from the grant,
   `lessonId: 'cafe-guest'`, `memoryLocked: true`, `guestLifecycleKey`,
   `secondsRemaining: 180`, plus the existing `sessionId`, `lifecycleVersion` and
   `tutorVoice`. No `firstPractice` brief, `seedTopic` or `missionId` on a scene.
4. **Worker claim.** `POST /agent/guest/<key>/claim` with `mode` equal to the signed
   mode (`lesson` or `lesson-text` for a scene room, `convo` for the old path). The
   first claim books one slot of today's ceiling atomically; a repeat claim with the
   same fence books nothing. A spent ceiling refuses the claim (403). The response's
   `maxSeconds` is 180, and the worker refuses a scene claim whose `maxSeconds` exceeds 180.
5. **Checkpoint and complete** for a scene room. The digest payload is
   `{ revision, seconds, learnerTurns, serviceFailure, baseline: null,
   firstPracticeComplete, sceneTurns }`, plus `firstPracticeStopped: true` on a
   safety stop. `sceneTurns` is the list of scene turn ids the learner answered
   acceptably, by voice or typing, validated with `parseGuestSceneTurnIds`. It never
   shrinks between revisions. `learnerTurns > 0` with a null baseline is valid for a
   scene. `firstPracticeComplete` is true only when the scene finished with at least
   one learner turn. A convo room keeps today's payload, with no `sceneTurns` key.
6. **Result.** `POST /onboarding/live-result` (and `/onboarding/end`) for a scene room
   returns today's fields plus `scene: 'guest-cafe'` and `sceneTurns`; `pack` is null.
7. **Claim.** `POST /onboarding/claim` binds the owner as today. It copies no pack,
   returns `sceneTurns`, then shrinks the record to `{ id, owner, installation,
   expiresAt }` with a 48-hour TTL. Refusals use 409 with distinct `error` values:
   `guest-claimed-elsewhere`, `guest-expired` and `guest-active`.
8. **Switches.** The API opens scenes only with `LUVANI_GUEST_SCENE=1`, Upstash, the
   agent secret and the LiveKit keys. `LUVANI_GUEST_SCENE_DAILY` is a whole number
   from 1 to 2,000 (default 24); any other value keeps scenes off. The tutor role also
   needs `LUVANI_GUEST_SCENE=1`, or it refuses scene rooms. The guest convo path stays
   closed in production on both sides.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T1 | Scene and shared names in core | implementer | none | `packages/core/src/lessons/guestCafe*.ts`, `lessons/index.ts` | in-progress |
| T2 | Server: start, grant, claim, ceiling, record shrink | auth-engineer | T1 | `services/token-server/src/{onboardingGuest,guestLive,server,tokens,guestSceneAdmission}*.ts` and their tests | todo |
| T3 | Worker: scene tutor with no model, guest scene gate | voice-platform-engineer | T1 | `services/tutor-agent/src/{agent,tutor,paidVoiceProxy,guestSceneGate,sessionLifecycle}*.ts` and their tests | todo |
| T4 | App: scene practice, recap, adoption, refusals | onboarding-ux-engineer | T1 | `apps/mobile/src/onboarding/**`, `apps/mobile/src/live/useLiveSession.ts` | todo |
| T5 | Privacy copy and data tables | privacy-safety-engineer | T2, T3 | `apps/mobile/src/legal/policy.ts`, `docs/PRIVACY_AND_SAFETY.md`, `docs/STATE_AND_STORAGE.md` | todo |
| T6 | Decision, runbook, env contract, beta-launch steps | orchestrator | T2–T4 | docs, `deployment/environment-contract.json` | todo |
| T7 | Gate, floors, evidence, web check, handoff | orchestrator | all | `docs/IMPLEMENTATION_EVIDENCE.md`, `scripts/gate.floors.json` | todo |

## Worst-case cost

The worst case is a scene with a cold voice cache on all 48 TTS calls the gate allows,
about 2,900 characters, in a voice that bills twice:

- TTS: $0.464, or $0.232 in a single-rate voice.
- STT: $0.027 for 180 s.
- LiveKit: about $0.006, an estimate.
- No model and no scoring.

That is about $0.50 a scene. At the default ceiling of 24 a day, the worst day costs
about $12 and the worst 30 days about $360. With the voice cache warm, a scene costs
about $0.03. The revenue review of 2026-10-23 corrected an earlier figure of $4.68 a
day, which had counted each line only once.

## Execution log

| Date | Step | Result |
|---|---|---|
| 2026-10-23 | Plan approved by the founder (reverses UI-003); read-only reviews by security-engineer and database-security-architect folded in | worktree created, `npm ci` clean |
