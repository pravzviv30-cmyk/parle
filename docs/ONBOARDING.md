# Onboarding — everything before the first French word

The path from opening the app for the first time to speaking French, what it
costs a learner, and which of those costs are measured rather than asserted.

Owner: `onboarding-ux-engineer`. The copy on the disclosure screens is owned by
`privacy-safety-engineer` and lives in `apps/mobile/src/onboarding/disclosure.ts`;
the rules of the flow live in `apps/mobile/src/onboarding/answers.ts`, where a
test can reach them.

## The shape now

Pre-account onboarding renders **6 pages**: `hear-it`, `first-line`, `start-level`, `reason`, `plan`, `save`.

A brand-new learner crosses **8 screens** before the first spoken line: those six
pages, account creation, and the first scene's microphone primer. The age
confirmation is part of the save page, not a separate marketing screen. (Notebook
redesign, 2026-09-27.)

Pages 1 and 2 play bundled recordings only, so nothing reaches an AI service
before the save page is passed.

The usage-data answer is the switch on the save page, off unless the learner turns it on,
and it rides the draft because it is given before there is an account to key it
to. `App.tsx` writes it to `analytics/consentStore.ts` before it hands the
profile over, so nothing is counted against an answer that has not reached the
disk. The recovery flow below asks the same question on its Meet page, and only
of a learner with no record at all, so nobody is asked twice.

| # | Screen | The one thing it does |
|---|---|---|
| 1 | Hear it first (`hear-it`, `onboarding/PreAccountOnboarding.tsx`) | Plays a recorded, captioned three-line exchange at a café and says the tutor is AI. "I have an account" leads to sign-in |
| 2 | Your first line (`first-line`) | The learner taps the reply, hears it in the tutor's recording, and it is marked with the highlighter. "I'm stuck" hands back the start of the line |
| 3 | Where are you starting? (`start-level`) | One tap: from zero, a few words, or "I can get by" |
| 4 | What's it for? (`reason`) | One tap from five reasons, or skip it |
| 5 | Your plan (`plan`) | The suggested minutes a day, a reminder time marked as not on yet, the first three scenes in French with their can-do lines, the tutor's voice, the goal, and how it works. It shows the plan rather than asking again: the minutes and the reminder are changed later in Profile and Settings |
| 6 | Save your plan (`save`) | An optional first name, the AI, microphone and history notes, the usage-data switch (off), then "I am 13 or older, create account". "I am younger than that" shows the refusal, which moving between the pages does not undo |
| 7 | Sign up (`auth/SignUpScreen.tsx`) | Creates an account by email/password, Google, or Apple on iOS |
| 8 | Your first scene (`onboarding/FirstSceneScreen.tsx`) | The microphone primer for the scene the plan put first. One button raises the phone's prompt, and "Type instead" is always there |

The words on pages 1 to 6 live in `onboarding/firstRun.ts` and `onboarding/plan.ts`.
The first scene is `firstSceneFor` in `plan.ts`: the first coffee, or the full café
for "I can get by". `App.tsx` opens it once, over Today, so a back lands on Today.
The primer's choices are `onboarding/micPrimer.ts`: a granted microphone opens the
ordinary conversation, and a refusal leads with typing, which cannot fail, and
offers the phone's Settings second where there are any.

Then the scene, where the first French is spoken, and then the recap as a keepsake
(`RecapScreen.tsx`, decided in `live/keepsake.ts`). It shows the learner's own
lines (the last three), one phrase kept on the highlighter and saved to My French,
one sound, and "Next time" naming the next scene on the spine. Only after that,
and only when the conversation had something in it, it offers a daily reminder at
the time chosen in the plan. The phone's notification dialog is raised only if the
learner accepts.

### The draft before the account

The pre-account draft (`onboarding/preAccountDraft.ts`) lives on the device only.
It holds the selected voice, the age confirmation, the usage-data answer, the page
the learner is on, the starting level, the reason, the minutes a day, the reminder
time, and an optional first name. It holds no transcript and no audio.

- **The name.** `firstNameFrom` trims it and removes control and format
  characters, which includes bidi overrides and zero-width spaces. It keeps the
  two joiners (ZWNJ and ZWJ), because they carry spelling in scripts such as
  Persian and Sinhala. A name that is empty once joiners are ignored, or longer
  than 40 characters, is stored as no name. It is refused, never cut.
- **Repair on load.** A stored draft must be version 1 with the age confirmed, or
  it is dropped. Any answer that is not one of this build's values reads as not
  answered. A missing or odd usage-data answer reads as no. A voice that left the
  catalogue becomes the default.
- **When it is thrown away.** On every link to sign in: "I have an account",
  "I already have an account", and sign-up's own link to sign in
  (`discardPreAccountDraft` in `App.tsx`). Also once a signed-in learner's profile
  is complete, whether or not the draft was used (`CompleteProfileDraftCleanup`).
- **When it becomes the profile.** Only when this device has no profile and
  `mayAdoptPreAccountDraft` in `app/freshDevice.ts` says yes, which is on an
  `empty` account read or on `no-sync`. A timed-out or failed read, or an account
  that already had state, never adopts it, because the draft on this device may be
  somebody else's answers. Those learners get the recovery flow below instead.
- **How it is written.** `onboarding/createFromDraft.ts` turns it into the
  profile through doors that already exist: the name, the age, the reason as
  `motivation` and as a seeded goal, the minutes as the daily goal, the starting
  level as a low-confidence CEFR estimate, and the voice. The usage-data answer is
  saved first, and the reminder time is saved switched off.

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

The current path is the six-page pre-account flow above. The older
age/name/meet/voice flow (`onboarding/OnboardingFlow.tsx`, pages in `PAGES` in
`answers.ts`) is kept as a recovery path. It runs for a signed-in learner who has
no profile the draft may become, or an older profile that never answered the age
question. It asks the age first, so a learner is never asked their name and then
told they cannot stay.

**The product is heard before it is described.** The first page plays a real
recorded exchange instead of explaining what speaking practice is, and the second
lets the learner say a line of their own before anything is asked of them. Both
use bundled recordings, so nothing reaches an AI service and no microphone is
opened before an account exists.

**The AI disclosure comes first, and again before the account.** The first page's
subline says the tutor is AI (`WELCOME_SUBLINE` in `onboarding/disclosure.ts`).
The save page says it again beside the privacy line (`SAVE_PRIVACY`), which also
names the typed answers the account will carry. The recovery flow's Meet page and
TutorIntro's persona page read from the same module, so the surfaces cannot drift
apart.

**The age question sits on the save page.** It is the pill that creates the
account: "I am 13 or older, create account". "I am younger than that" replaces the
page with a calm page of its own (the frame drawing, "Luvani is for learners
thirteen and up.", then one line) and removes the pill. Moving back and forward
between the pages does not undo it. Leaving through "I have an account" starts
the first run fresh, and closing the app reopens the save page with the question
asked again, the same close-the-app escape the age gate keeps for a mis-tap. No
account is created and nothing is sent anywhere.

**The reason is asked again, because it is used now.** The old why page was
removed because nothing read its answer. The `reason` page is different: its
answer sets the suggested minutes on the plan, is written to `motivation`, and
becomes the goal the tutor is given on the first session (`SEEDED_GOAL` in
`onboarding/plan.ts`). It can be skipped, and a skip writes no goal.

**The first scene opens the app, not the chooser.** On web, `NavigationContainer`
resolves `/` to Home before a stack `initialRouteName` can win, so `App.tsx` waits
for `onReady` and then `openFirstRun` resets the root once to Today with the first
scene above it (`[Tabs, FirstScene { missionId }]`). The scene is the one the plan
put first. A back from the primer or the scene lands on Today. The flag that
triggers this lives in memory and is never persisted, so an app killed between
sign-up and the first frame opens on Today. The chooser is never the first screen
a new learner sees. It is still reachable from Speak's level path and from My
French.

**History.** Until the notebook redesign on 2026-09-27, the front door was a
different set of pages, and before that a two-page splash. The splash used a
device-level flag and an animated café scene, and it was removed because the
account already knows whether somebody has been here. The five-page flow that
followed had a welcome, "Speak in real situations", "Life happens", a voice page
and a "Ready" page, and it ended on the ten-way mission chooser. The chooser
carried the first-run promise and the just-in-time microphone line, and a driven
local mock-auth web journey proved its one-shot `/missions` landing on
2026-08-27. The notebook redesign replaced all of that with the six pages, the
first scene and its microphone primer. The one-shot landing on `FirstScene` has not
yet been proven the same way.

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

Net: a learner hears the product and says a line before anything is asked of
them, knows what they are talking to before they talk to it, and lands in the
scene the plan promised.

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
| The six-page pre-account front door | `apps/mobile/src/onboarding/PreAccountOnboarding.tsx` |
| The words on those pages, and the plan they build | `apps/mobile/src/onboarding/firstRun.ts`, `apps/mobile/src/onboarding/plan.ts` |
| The four-page account recovery flow | `apps/mobile/src/onboarding/OnboardingFlow.tsx` |
| The compact local hand-off, and how it becomes a profile | `apps/mobile/src/onboarding/preAccountDraft.ts`, `apps/mobile/src/onboarding/createFromDraft.ts` |
| When the draft may be adopted | `mayAdoptPreAccountDraft` in `apps/mobile/src/app/freshDevice.ts` |
| The rules: pages, the gate, the leaving guard | `apps/mobile/src/onboarding/answers.ts` |
| The words about AI, privacy and the microphone | `apps/mobile/src/onboarding/disclosure.ts` |
| Who is asked at all | `apps/mobile/src/app/ProfileContext.tsx` |
| What is stored afterwards | `apps/mobile/src/profile/store.ts`, [STATE_AND_STORAGE.md](STATE_AND_STORAGE.md) |
| What the first run promises a learner | [PRIVACY_AND_SAFETY.md](PRIVACY_AND_SAFETY.md) |
| The first scene and its microphone primer | `apps/mobile/src/onboarding/FirstSceneScreen.tsx`, `apps/mobile/src/onboarding/micPrimer.ts` |
| Why the first scene opens once, after web linking resolves | `apps/mobile/App.tsx` (`openFirstRun`), `apps/mobile/src/nav/theme.ts` |
| The recap keepsake and its reminder offer | `apps/mobile/src/RecapScreen.tsx`, `apps/mobile/src/live/keepsake.ts` |
