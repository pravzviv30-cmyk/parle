# Onboarding — everything before the first French word

The path from opening the app for the first time to speaking French, what it
costs a learner, and which of those costs are measured rather than asserted.

Owner: `onboarding-ux-engineer`. The copy on the disclosure screens is owned by
`privacy-safety-engineer` and lives in `apps/mobile/src/onboarding/disclosure.ts`;
the rules of the flow live in `apps/mobile/src/onboarding/answers.ts`, where a
test can reach them.

## The shape now

Pre-account onboarding renders **5 pages**: `welcome`, `situations`, `life`, `voice`, `ready`.

A brand-new learner crosses **7 screens** before the first scene: those five
pages, account creation, and the mission chooser. The age confirmation is part
of Ready, not a separate marketing screen.

The selected voice, the age confirmation and the usage-data answer are the whole
pre-account draft. It contains no name, transcript, raw audio or other free-form
learner data, and is cleared as soon as it becomes the signed-in learner's normal
profile.

The usage-data answer is the switch on Ready, off unless the learner turns it on,
and it rides the draft because it is given before there is an account to key it
to. `App.tsx` writes it to `analytics/consentStore.ts` before it hands the
profile over, so nothing is counted against an answer that has not reached the
disk. The recovery flow below asks the same question on its Meet page, and only
of a learner with no record at all, so nobody is asked twice.

| # | Screen | The one thing it does |
|---|---|---|
| 1 | Welcome (`onboarding/PreAccountOnboarding.tsx`) | Makes one honest promise about speaking with an AI tutor |
| 2 | Speak in real situations | Shows that a spoken conversation becomes future practice |
| 3 | Life happens | Says progress remains without streak pressure |
| 4 | Meet the selected Tutor | Lets the learner choose and manually preview one of eight voices |
| 5 | Ready | Gives compact AI, microphone and history information, offers the usage-data switch, then records the 13+ confirmation |
| 6 | Sign up (`auth/SignUpScreen.tsx`) | Creates an account by email/password, Google, or Apple on iOS |
| 7 | Mission chooser (`missions/`) | Chooses the first situation to speak in |

Then the scene, where the first French is spoken.

## Historical context

| # | Screen | What it wanted |
|---|---|---|
| 1 | Splash page 1 | "Welcome to Luvani!", tap Let's go |
| 2 | Splash page 2 | Three sentences on why speaking out loud works |
| 3 | Auth welcome | "Find your voice in French", tap Create account |
| 4 | Sign up | Email and password |
| 5 | Onboarding: name | A name |
| 6 | Onboarding: age | One tap: thirteen or older |
| 7 | Onboarding: why | One of four reasons, or Skip |
| 8 | Mission chooser | Which situation to speak in |

Three of those screens introduced the product: splash page 2, the auth welcome's
subline, and TutorIntro's first page on the Tutor tab. None of the three said the
tutor is AI.

## What changed, and why each one

The current path is the five-page pre-account flow above. The retained
age/name/meet/voice flow below is a recovery path for older profiles, so its
age-first ordering remains a safeguard without moving normal account creation
behind a second onboarding sequence.

**The splash is gone, and its café scene moved.** A device-level flag decided
whether a two-page introduction ran before the app knew who the learner was; the
account already knows whether somebody has been here. The animated café that
screen established the app's motion vocabulary with now belongs to the welcome,
imported from `illustrations/scenes/cafe.tsx` rather than copied, so the durations
still come from `illustrations/timing.ts` and reduce motion still renders the final
frame rather than nothing.

**Each page now arrives with the same restrained settle used by the rest of the
app.** The content fades and travels ten points into place when the page changes;
there is no carousel slide and no bounce. It runs through `motion.ts`, so reduced
motion renders the final frame immediately and the words are never withheld.

**The age gate moved to the front.** It used to be the second question, which
meant the app took a learner's name and then decided whether to serve them at all.
Nothing was ever persisted on a refusal, but the question had still been asked.
The refusal itself is unchanged: one honest sentence, no retry button dressed up as
a second chance, nothing written to disk, and the question offered again on the
next launch, which is the escape hatch for a mis-tap.

**The why page is gone.** It asked which of four reasons brought the learner here,
and nothing ever read the answer: `motivation` was stored, defaulted on upgrade,
merged by the sync policy, and reported as one analytics boolean. Not one line of
the product changed shape because of it. The field stays in the stored record, so
nobody's data is thrown away and the synced blob keeps its shape; the flow simply
stops asking, and hands back whatever the record already carried.

**Meet Luc arrived in its place.** One page, no question, the last thing before
the voice step: the tutor is AI, he is a character somebody wrote, no
person hears you, your phone will ask for the microphone at the first scene, and
typing is offered as a choice in any scene. Every line comes from
`onboarding/disclosure.ts`, which also feeds the welcome subline and TutorIntro's
persona page, so the three cannot drift apart.

**The chooser keeps both first-run promises at the point of action.** A learner
who has never spoken sees the first-useful-line promise and one just-in-time line:
the microphone opens only when they tap the circle, and they can type instead.
Both expire after the first conversation. On web, `NavigationContainer` resolves
`/` to Home before a stack `initialRouteName` can win, so `App.tsx` waits for
`onReady` and resets the new learner's root to Missions exactly once. Native uses
the same rule; the flag is never persisted. This is the implemented mechanism,
and a driven local mock-auth web journey proved the one-shot `/missions` landing
and Back/reload behavior on 2026-08-27. Supabase, native and five-viewport evidence
remain separate in `DEVICE_VERIFICATION.md`.

**A third door, where the platform has one (F375, F376).** Sign up and sign in
both draw "Continue with Apple" above the Google outline, and only when
`appleSignInOffered()` in `auth/apple.native.ts` says the device can open it,
which today means iOS. Android and web see exactly the two doors they saw
before, because a button that opens onto an unconfigured flow costs more than a
missing one. The screen count and the tap count above are unchanged: it is a
third way through the same screen, not another screen.

What is proven here is the wiring, not the sign-in. `auth/apple.test.ts` and
`auth/appleNonce.test.ts` hold the preflight order, the nonce pairing, the
button's placement and the build config. The sheet itself, Apple's signature
over the nonce, and Supabase accepting the identity token all need the paid
Apple Developer capability and the project's Apple provider, and neither exists
on the machine this was written on. That half belongs to
[DEVICE_VERIFICATION.md](DEVICE_VERIFICATION.md) and has not been run.

Net: one page removed, one page added, one screen of splash removed twice over,
and a learner who now knows what they are talking to before they talk to it.

## Who never sees any of this

- **A returning learner on the same device.** `needsOnboarding` in `answers.ts`
  reads `ageConfirmed`, the one question nobody is allowed to decline. Anyone who
  has been through the flow has it stored as `true`, whatever else they skipped.
- **A returning learner on a new phone.** Phase 2's `app/freshDevice.ts` gives the
  account a bounded moment to answer before the app decides the device is empty, so
  a reinstall adopts the stored profile instead of writing a beginner over it.
- **Someone who skipped their name.** The guard used to read the name, which is a
  field a learner is allowed to leave empty, so skipping it sent them back to page
  one on that launch and every launch after. A question about a *journey* cannot be
  answered from a *field*.

Nothing in the reorder touches that rule, and it is deliberately written so it
cannot: `needsOnboarding` names no page, so adding, removing or reordering pages
can never change who is asked.

## What is measured here, and what is not

**Not measured: wall-clock time to first useful French.** That is the number this
phase actually cares about, and it cannot be produced on the machine this was
written on — no device or simulator is verified available here, the mobile
workspace has no renderer, and a stopwatch against a bundle that never runs is a
guess with a decimal point on it. Nobody should quote one until it has been run.

**Measured instead, as the static proxy:** the screen count, the tap count and the
page count above, held to the code by
`apps/mobile/src/onboarding/answers.test.ts` → `the onboarding doc claims the same
page count the flow renders`. If a page is added or renamed and this file is not
updated, that test fails. It proves the doc is honest about the flow. It proves
nothing about how long the flow takes.

The stopwatch belongs to **F114** in [KNOWN_ISSUES.md](KNOWN_ISSUES.md), with the
runbook in [DEVICE_VERIFICATION.md](DEVICE_VERIFICATION.md) — five viewports, both
platforms, VoiceOver and TalkBack, and the time from first launch to first spoken
French recorded per device. Until that pass runs, the table above is the only
honest screen-count claim; it does not imply a measured time to first
conversation.

## The files

| What | Where |
|---|---|
| The five-page pre-account front door | `apps/mobile/src/onboarding/PreAccountOnboarding.tsx` |
| The four-page account recovery flow | `apps/mobile/src/onboarding/OnboardingFlow.tsx` |
| The compact local hand-off | `apps/mobile/src/onboarding/preAccountDraft.ts` |
| The rules: pages, the gate, the leaving guard | `apps/mobile/src/onboarding/answers.ts` |
| The words about AI, privacy and the microphone | `apps/mobile/src/onboarding/disclosure.ts` |
| Who is asked at all | `apps/mobile/src/app/ProfileContext.tsx` |
| What is stored afterwards | `apps/mobile/src/profile/store.ts`, [STATE_AND_STORAGE.md](STATE_AND_STORAGE.md) |
| What the first run promises a learner | [PRIVACY_AND_SAFETY.md](PRIVACY_AND_SAFETY.md) |
| Why the chooser opens after web linking resolves | `apps/mobile/App.tsx`, `apps/mobile/src/nav/theme.ts` |
