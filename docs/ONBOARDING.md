> The current C2 presentation is recorded below and in [DESIGN.md](../DESIGN.md).
> The real first-live-practice contract remains in [FIRST_LIVE_PRACTICE.md](FIRST_LIVE_PRACTICE.md).
> Older notebook/service records below are historical where that contract differs;
> they do not establish C2 verification or production guest activation.


# Onboarding

The 14 October 2026 C2 implementation follows the approved Bold rhythm Figma
flow: illustrated choices, cloud/flame mascots, a real first tutor session,
earned results and account handling. It retains the existing draft, navigation,
authentication, guest ownership and server admission contracts. The
[change plan](changes/bold-rhythm.md) owns current checks and outstanding holds.

## Current journey

Pre-account onboarding renders **8 setup pages**: `hear-it`, `reason`, `interests`,
`start-level`, `confidence`, `focus`, `time`, `plan`. `FULL_SETUP` in
`onboarding/flow.ts` owns the order; the existing shorter experiment omits level
only. `choose-tutor` follows the plan, then the before-practice disclosures.
Where the service admits guest live practice, that continues through real
practice, completed-session celebration (`recap`), achievements (`keep`),
account form and account welcome. Partial/interrupted sessions use their truthful
summary without a completion celebration. Historical draft routes repair through
the existing resume model; older answers and consent survive. New drafts require
an explicit tutor choice: hearing a sample or a catalogue default never counts
as choosing. A resumed first session requires its real durable guest record.

### Account handoff when guest live is unavailable

Start live practice asks for the guest café scene (`scene: 'guest-cafe'`, see
the [change plan](changes/guest-first-scene.md)); the guest conversation stays
closed. Three `/onboarding/start` refusals offer **Create account to start** and
**I already have an account** on the disclosure page and no Try again, because
retrying now cannot change them. Each says why in its own line:
`guest-live-unavailable` (scenes switched off or today's places full) says
"Live practice is resting right now. Create an account to start.";
`guest-scene-used` (this phone had its scene in the last 30 days) says "Nice to
see you again. Create an account and your tutor will pick up from here."; and a
429 (this network's daily guest starts are spent) says "Today’s free scenes
from this network are used up. Create an account to start." The lines live in
`apps/mobile/src/onboarding/guestScene.ts`. The learner chooses that detour; a failed request does not submit an
account or fabricate practice. The existing AuthFlow carries the answered plan,
chosen tutor and optional preferences. A general connection failure keeps its
connection recovery. Unsupported speaking is a separate `voice-unavailable`
response: the page explains that speaking is unavailable and offers retry,
without promising that account creation adds voice.

An authenticated learner with unfinished setup completes the profile through
its existing owner rather than requesting another guest capability. Strict
guest-record reads distinguish completed practice from a pending first scene;
accepting Terms is not session completion. After the durable profile writes, a
no-guest plan is consumed once and the existing `FirstScene` microphone primer
opens with Home behind it, after the new-account welcome where applicable.
Normal authenticated session admission still decides whether the room can
start. Completed guest practice retains its existing adoption and result
handoff. An account with an existing profile keeps that profile. These routing
rules do not establish hosted activation or real-device acceptance; current
runtime evidence remains in the [change plan](changes/bold-rhythm.md).

## Shared layout and progress

The C2 frame uses cream/navy setup pages, violet/white earned-result and welcome
pages, 24-point gutters and a reading column at most 560 points wide. Shared
primary buttons are 52 points high with 20-point corners; gold actions lead on
violet. System back preserves the existing answers and draft ownership. Account
forms scroll their action after the fields and measure the focused field group
against the visible form body; they never float the action above the keyboard.

`onboarding/onboardingProgress.ts` owns both route history and C2's four visible
stages. The normal signed-out sequence has fourteen steps: eight setup pages,
tutor choice, practice, recap, achievements/save, account creation and account
welcome. The shorter variant removes level; signed-in setup omits the account
steps. Explicitly skipped optional setup routes leave the denominator; required
tutor, practice and completion routes cannot be removed by a malformed skip
list. Repeated practice exchanges share the same route. The before-practice
surface is an increment within stage two. Repair and eligibility-only flows
keep their actual route sequence instead of borrowing the full journey.

Completed-route history survives back and resume, and only the durable completion
handoff reports completion. C2 fills each of four stages from the actual pages
asked; loading, focus and error states retain the parent page's progress. The
header remains mounted and interpolates for 300 ms. Shared content transitions
fade/translate for 300 ms using explicit completion callbacks and a synchronous
advancement lock; reduced motion and backgrounding settle them immediately.
Sign in, account welcome and Home omit progress. Account welcome has an explicit
Continue and no skip or automatic exit; only its logo ring begins rotating after
800 ms, over a continuous 8.8-second cycle.

The unsigned draft preserves its route, answers, deliberate tutor selection, experiment variant, completed/skipped routes and account email/form mode. Passwords are never persisted. Signed-in setup and repair drafts use separate account-scoped local keys, reject stale account writes and clear after completion or refusal. A refusal retains no typed answers or refusal marker.

| Surface | Action and consequence |
|---|---|
| Opening | The startup mark and rotating orb lead into Get Started, then Welcome to Luvani and Start your personal plan. The coffee/tea preference question is retired; old drink answers remain readable for existing task records. |
| Goal | "This picks your first practice." Six answers: food, family, a trip, moving, work or Just exploring. Each concrete goal has its own authored starter. |
| Interests | Closed food, travel, music and everyday choices persist with the plan and accompany the first-practice brief. |
| Level | How’s your French? Four fully labelled self-reported choices: new to French, a few words, get by, comfortable talking. Getting by and comfortable talking start at a conservative low-confidence A1 suggestion; this is never a certified placement. |
| Confidence | Three answers determine whether the first reply starts with a model and translation or invites an independent attempt. A hesitant learner receives support even when their level is higher. |
| Focus | Understand what I hear, Speak with confidence, or Find the right words changes the first-practice method and reply mode. Listening and words start typed; speaking can start spoken only when the service offers speech and the learner did not ask for a gentle start. Every mode keeps the microphone closed until an explicit recording action. |
| Daily goal | "Last question. You can change it any time." Casual 5, Regular 10, Serious 15 or Intense 20 minutes a day, each with a dial, or Choose each time. "Suggested" marks only the tier the learner's own answers point at, never one drawn from an answer nobody gave (in the short variant, which does not ask the level, only work or a move suggest a tier), and nothing is preselected. Twenty runs the same three starter tasks as fifteen (`starterMinutes` in `onboarding/guestProgress.ts`), so the starter service never sees a value it refuses. |
| Plan | The correctly centred daily-minute ring, purpose, support and practice method reflect the learner’s answers. No tutor pill repeats the next step. Next: Choose your tutor opens the dedicated choice page. Confidence and focus also become bounded learner goals for the real tutor when the account is created. |
| Tutor | “Meet your tutor” and “Listen, then choose your tutor.” lead the page. C2 sage, peach, lavender and butter cards keep larger names without AI Tutor text; a chosen card becomes violet with a gold check. All six portraits gently lift and sway in the continuous 4.8-second C2 cycle, without moving the card or restarting on selection/playback changes; foreground/activity and live Reduce Motion guards apply. The integrated violet/gold Listen pill uses shared press feedback, activity icons and actual media progress, with stacked controls at large text. Catalogue-backed selection and playback are independent: Listen, Pause, Resume and replay retain their real media lifecycle. Starting requires a deliberate choice. |
| Before practice | The main page keeps the AI notice and local/temporary-summary retention, with service/provider processing facts available through Privacy details and the full policy before Start practice. The agreement notice and Terms/Privacy buttons are centred. Optional analytics and learning memory remain off by default. The deliberate Start tap persists the existing eligibility declaration before invoking the eligible-only service; opening a legal link or arriving on the page accepts nothing. No separate age question is shown. |
| Practice | The existing real first-session owner supplies prompts, replies, support and recovery to the shared C2 room. Transcript/composer behavior matches other live sessions. No audio records merely because a page opens; available speech is determined by the service grant. |
| Completed session | The durable completed record opens violet Well done with the celebrating cloud and one entry confetti burst. See my achievements is explicit. Partial/interrupted outcomes bypass that celebration. |
| Achievements/save | The proud cloud floats with a subtle heart pulse above actual record-derived achievements and next practice. No invented phrase, pronunciation grade or ability claim is added. Save your progress opens the account form; a failed save remains visible and retryable. |
| Earned streak | The separate C2 streak surface uses the cloud, flame and an actual-count badge on violet, with a cream seven-day summary. One day says “Your streak has started”; longer runs use their real count. Opening the page awards nothing. Existing durable receipts, qualifying-date rules and optional reminder permission flow remain authoritative. Home uses the same flame family. |
| Historical guest Home | Older drafts remain readable through the existing repair path; the deleted notebook page is not an additional C2 route. |
| Hand-off | A verified new email signup adopts its own guest progress automatically and celebrates only after the writes and guest clearing are durable, then opens Home. Existing accounts retain explicit ownership review. Keep this practice saves the task's natural line, says "Saved to your phrasebook." once the phrasebook write is durable, records the guest's finished days as the account's practice days without lighting day one a second time, and says the time with the tutor the server holds ("You have 29 free minutes with your AI tutor.", or minutes on a plan). The card names the newest phrase the save writes; with none it says "Your practice is saved." and names no phrase. Start fresh declines the import and still reconciles usage. |
| First-run offer | Existing-account handoffs only, after a kept practice and once: when the navigator is ready, the existing plans wall opens at its `path-complete` door, but only after the server says this account holds no paid plan and the store has plans to sell. An unread status, a paid plan, no store (the web) or a failed read shows nothing, and nothing is remembered to show it later. The wall itself is unchanged here. |

All six setup question pages and their plan-edit choices use C2 sage, peach,
lavender and butter cards, with larger answer titles. A selected answer becomes
violet with white words and a gold mark; radio and checkbox semantics stay
distinct. The shared raised press spring supplies feedback, while Continue
and See your plan retain their explicit action and disabled state, with a gold
directional arrow on the live violet face. The privacy opt-ins stay neutral.

Question pages place their distinct topic illustration above the focused title
in a colour band with a curved paper edge. A frame-owned hero slot bleeds only
the decoration beyond the normal gutters; answer and footer edges stay aligned
at phone and tablet widths. A later founder-requested redraft replaces the first
export recompositions with six custom local SVG characters: map, book, plant,
speech, conversation partners and a clock holding a mug. Their rounded expressive
forms follow the cloud family's style without putting a cloud on every page.
The C2 palette, restrained flat depth and larger coherent focal shapes complement
each topic. Conservative painted bounds and actual render checks cover full motion
clearance. Their small whole-scene float and natural gestures share the existing
4.8-second clock: compass offer, welcoming book hands, swaying leaves and held
watering can, open arms and a soft sound-badge pulse, inward conversation leans,
and a mug tilt with wafting steam. Rigid semantic SVG groups use fixed source
pivots and stable keys; held props follow their arms across paint planes. All
gestures settle at the authored Rest pose at the loop boundary and under live
Reduce Motion. Answer updates never reset the phase or recreate XML.
Compact/large-text layouts shrink the illustration first and leave the question
and answers scrollable. Sheets pause the underlying art; activity and foreground
retain the shared policy. Web heading
focus prevents automatic scrolling so the initial or restored page offset stays
with the existing scroll owner.

Core answers stay selected until their named Next action. One focused heading
and a consistent bottom action lead each page. Account fields and provider
choices scroll; the centred signup agreement and policy links sit directly
above Create account in the footer and hide with it during keyboard editing.
C2's exported SVG layers replace the older C Rive composition
through one shared activity-aware renderer; presentation components receive real
values by props and do not own admission, storage or grading.

Button and text placement follows the shared frame: aligned side gutters, a single working heading, one consistently placed primary action, and quieter optional actions below it. C2 question cards have a minimum 72-point tap area; Continue is 52 points and secondary controls remain at least 44 points. Compact phones use the shared layout mode and existing readable type tokens; the six goal answers were checked in the web preview at 320 × 700 on 6 October 2026, wrapping rather than truncating. On an iPad the pages and their sheets sit in a 560-point reading column. Text remains scalable and scrollable, never truncated to fit; side-by-side tiles stack at the largest reading sizes. Plan edits use full rows with a label, current answer and arrow, then one focused choice group. Done/Cancel and start controls stay fixed outside the sheet's scroll area. All six tutors remain available in the single-column list, with scrolling at every text size. Hearing a sample does not select it. Signup uses the shared onboarding frame with one stable scrolling page with native keyboard insets. Create account sits below the fields, hides while the software keyboard is visible, and returns when editing ends. Focus scrolling measures the visible form body and the entire active field group, including its guidance. Email advances only with Next; Password advances to Confirm with Next. Confirm's Done validates and dismisses the keyboard without submitting. Eight characters is the local password minimum; Supabase remains authoritative for acceptance. The strength meter offers animated advice under Password only, and Confirm shows match feedback. Entered values survive system-back and sign-in detours in the auth flow's memory; passwords do not enter the saved onboarding draft.

`EXPO_PUBLIC_ONBOARDING_VARIANT=five` retains the existing experiment flag, now covering welcome, purpose, confidence, focus, daily goal and plan. It omits level only; the retired drink question does not count as earned progress. Level remains editable in the plan review. This is an experiment, not an established conversion improvement. The plan offer comes after value and after account handling: once, after a kept practice, on the existing wall with its real store products, terms and free exit, and otherwise as voluntary See plans. The comparison of pre-practice versus post-feedback commercial timing needs cohort evidence; this revision does not fabricate prices or require a purchase.

## Accounts and returning users

Device history chooses only the signed-out entry. After a completed account reaches the app, a non-personal `yes` marker opens Sign in on logout. Existing locally completed profiles provide an upgrade hint. iOS uses SecureStore plus a device fallback; the keychain can survive reinstall but Apple does not guarantee it. Android uninstall clears app storage, so the app cannot reliably distinguish a reinstall from a first install before authentication. After sign-in, the account profile is authoritative on every platform: completed accounts skip onboarding; empty new accounts receive the same modern onboarding; incomplete older profiles use the existing repair flow. Create an account on Welcome back opens the account form directly. This route clears the previous anonymous draft and cancels its reminder; it does not manufacture a completed profile. After successful authentication, an empty account starts onboarding through ProfileGate, while an existing completed account opens Home. Back and Sign in return to Welcome back, preserving signup fields in memory. A completed guest plan is still retained when switching between its account forms. While the sign-in keyboard is open, the account-switch link is hidden alongside the primary action; native background taps dismiss the keyboard and restore the full sign-in composition without changing routes. Web leaves pointer and keyboard focus to the browser so clicking an input does not immediately blur it.

Apple and Google appear on sign-in and signup. iOS Apple uses the system sheet with the hashed/raw nonce pairing; Android uses browser PKCE; web redirects through Supabase. Cancellation returns to the originating result. Live Apple operation requires the project’s Apple provider and developer configuration, including Services ID/return URL and current client secret for browser flows. Native browser OAuth uses the exact `luvani://auth/callback` return with S256 PKCE, which must be allowed in Supabase URL configuration. Apple must also be enabled in Supabase and signed with its native entitlement; the local Personal Team binary cannot provide that entitlement. Local mock buttons demonstrate navigation only, not a successful production OAuth exchange.

C2 embeds the official provider buttons in the form. Returning Sign in omits
onboarding progress, guest-practice copy and password requirements; its larger
“Good to have you back” sits above the centred form. Create account retains
“Your practice stays with you”, password guidance and the linked declaration.

Sign-in from the mounted onboarding page explicitly carries its current answers
and tutor, including edits made after returning from signup. The signup form's
email is retained separately, including an intentionally cleared value; its
cached plan cannot overwrite those newer answers. Ordinary signup-to-sign-in
detours still use the form's saved plan. Press callbacks supply the current
draft or no argument, never a native/browser press event as a draft.

Anonymous choices and practice remain separate during authentication. An empty OAuth account confirms the phone’s plan before adopting preferences; the review says whether the first run's reminder is on, and Start a new plan instead cancels that reminder before the plan is let go. Keep this practice explicitly imports phrases into Practice and a device-local continuation into the authenticated namespace; a populated account’s profile is never silently overwritten. Start fresh declines phrase import but still reconciles metered usage. Server ownership binds a guest capability to one authenticated account and is idempotent. Storage acknowledgements wait for successful writes; account switches and refusal invalidate stale asynchronous work.

## Guest practice and recovery

The task-based guest limits below describe the retained authored-task API.
C2's live guest route has the stricter production guard and explicit account
handoff described [above](#account-handoff-when-guest-live-is-unavailable);
enabling task transcription does not enable an anonymous live room.

The token service issues one opaque guest capability per installation per day, with a 24-hour service lifetime. IP limits, installation binding and atomic per-task reservations permit two attempts per introduced task, at most three tasks. Guest speech has its own anonymous admission context, separate from the authenticated quote/budget boundary (founder decision D13, F735). Production opens it only with `LUVANI_GUEST_SPEECH=1`, a Deepgram key, the durable Redis store and the reviewed audio decoder; a key alone, or a local flag in production, opens nothing. Before every transcription the server reserves the twenty-second capture cap atomically on four budgets: sixty seconds per guest capability in total, sixty seconds per installation per UTC day, three hundred seconds per address per UTC day (an IPv6 address counts by its /64), and a service-wide daily ceiling (`LUVANI_GUEST_SPEECH_DAILY_SECONDS`, default 3,600), logged once per day per process when it first refuses. Speech is reserved before the attempt, so a full budget never spends one of the learner's attempts. In production the take is decoded and cut to the reserved seconds before it is sent, and the reservation settles to the duration sent; locally it settles to the duration the transcription reports. A take that never reached the vendor returns its reservation, including one whose request ended before transcription started; one that reached it without a measurement keeps it. Guest takes hold at most one of the process's two audio decoders, so paid scoring always keeps one. The service reports speech availability at the start and refuses a take once any budget is full, and the learner continues with typing. Explicit local development with a configured speech key can exercise recording without the production switch. Native capture stops at twenty seconds; the server additionally caps audio at 2 MiB and reserves attempts before transcription, including failed transcription. The budgets are counters under hashed capability, installation and address keys that expire after two days; they hold no audio or text. Guest credentials never enter URLs, analytics or account sync. Production uses the existing durable Redis service; local development uses an in-memory store.

Active practice seconds are capped per attempt and total, pause in the background on the client, and cannot exceed elapsed capability time on the server. On authenticated adoption, the existing one-time trial boundary owns the allowance and the guest record ID debits usage idempotently. Declining import does not reset the allowance. A capability can be claimed during the 30-day ownership ledger retention even after online practice expires. Offline use preserves any existing capability for later reconciliation.

An unavailable service has a direct local counterpart for the selected task, with honest authored phrase feedback and no pronunciation claim. The local draft includes eligibility, choices, page, voice, opt-ins and reminder choice; the separate guest record holds bounded replies and feedback. Corrupt records cannot invent eligibility, capabilities, task IDs or durable saving. An unsent reply prompts before leaving practice. Completed attempts and the same task survive relaunch; a transient unsent input is not promised as a durable submission. Storage failure keeps the current attempt visible and offers retry without claiming it was kept. Native temporary recordings are discarded on consumption, failure, background and unmount.

**The linked declaration precedes first processing.** Terms say Luvani is for
learners aged 13 and over. Start practice, email Create account, an account
provider action or repair Continue accepts the visible notice; reading Terms,
typing a field or navigation does not. Acceptance is not age verification or a
new server policy. A known underage/refusal state still blocks continuation and
keeps the existing draft/guest cleanup and reminder cancellation. Page changes,
sign-in, sign-out and account switching cannot bypass that launch's refusal.
No date of birth or new first name is collected. Legal review and server-side
eligibility/admission enforcement remain release requirements.

**The guest café scene.** An admitted start records `scene` on the guest
record, and `FirstLivePractice` opens the scripted lesson tutor on lesson id
`cafe-guest` instead of a conversation: mode `lesson` by voice, or
`lesson-text` when the learner chooses typing. A joined room switches to typing
in place through the existing quiet door. When it cannot (still connecting, or
granted and never joined, as after a refused microphone), the scene restarts as
`lesson-text`; the server re-signs an unclaimed room in that mode, and a room
claimed after all answers 409, which shows the scene-ended state below. The room grant body is
`{ mode }`. The screen reuses the lesson presentation from `LiveSessionScreen`:
the tutor line in the transcript, the position ("2 of 5"), the target and tap
options through `SupportBlock`, the hint and the turn note, inside the
onboarding frame with its progress and safety exit. The scene lasts about two
minutes; the service stops it at 180 seconds and the screen ends it at the same
point as a backstop. It ends on the lesson `summary`, then reads
`/onboarding/live-result`. A guest room already claimed (the app closed
mid-scene) is never granted again: the 409 from `/onboarding/live` shows "This
scene has ended" with **See what you reached**, which ends and collects the
result, and no retry or typing door. The guest record keeps only the confirmed turn ids
(`sceneTurns`), never what the learner typed or said: a scene record always has
no contributions and no pack, and its repair drops anything else. The recap and
summary name the lines answered with the reviewed French from
`guestScenePhrases`; a completed scene celebrates ("The café scene, done."), a
partial or interrupted one keeps the existing truthful copy.

On Keep this practice, `/onboarding/claim` returns the scene's turn ids, which
are trusted over the phone's copy. Those lines go to the phrasebook through the
same durable `addPhrases` write, "Saved to your phrasebook." follows that write
as before, day one settles once through `settleGuestHandoff`, and no pack is
loaded. Claim refusals have their own calm lines: `guest-claimed-elsewhere` and
`guest-expired` say the practice cannot be kept and Start fresh still finishes;
`guest-active` asks to try again in a moment. A record without `scene` (an older
guest conversation) adopts exactly as before.

## Motion, haptics and sheets

Press feedback uses the shared spring and accepted-action haptic; Settings still
owns the haptic preference, and a live microphone suppresses vibration. C2 page
and progress motion takes 300 ms. Exact exported illustration layers share
closed 4.8-second Rest/Float loops through the existing Reanimated driver, with
screen activity, AppState and live reduced-motion guards. Proud-cloud heart and
streak-badge pulses remain subtle layer transforms. Background/hidden artwork
pauses; reduced or unknown preference shows still art. Only the welcome logo
ring spins after its 800 ms delay; the page and wordmark remain still. Forms,
selection, completion receipts and navigation do not repeat with decorative
cycles. Entry confetti is an earned one-shot, never an idle reward loop. See
[C2 design and motion](../DESIGN.md#14-october-2026--c2-bold-rhythm) and
[UI-002](../DECISIONS.md#ui-002--render-c2s-exact-figma-layers-through-the-shared-motion-engine).

Plan illustrations pause under edit sheets and resume their existing phase.
An unanswered Next tap presents its guidance inside the reserved button face,
without moving the footer. Achievement words reveal in order after the motion
preference is known; earned words, rows and the Save action remain visible when
that preference changes. Cleanup before starting a new plan waits for both
guest removal and confirmed reminder cancellation. Rejection or native
`failed` cancellation keeps the owning draft and offers retry; a stale,
unmounted or switched-account operation cannot discard another plan.

Sheets preserve the parent behind an inactive scrim, animate open/close in 310/250 ms, and support a handle, swipe, visible Close/Cancel, keyboard movement, safe areas, Android Back and screen-reader escape. Focus enters the modal heading; the web modal traps/restores focus and native restores the originating heading. Pending writes reject dismissal and a refused swipe settles back. Short edits stay in sheets; core questions remain pages. Account forms can expand for keyboard and verification.

Reminder editing remains available from the streak page, historical guest Home and account settings through the shared ask. The streak page offers Remind me tomorrow only where reminders are available and none is enabled; the learner chooses and confirms a time in the sheet. Only the tap on Remind me raises the OS permission dialog, and only a granted permission and a schedule the system accepted turn the preference on; denial, unavailability or a scheduling failure leave it off and say so once. A granted reminder schedules the chosen daily preset. No permission dialog is raised on arrival. Until the Phase 4 reminder planner ships, the scheduler still fires on a day the learner has already practised, so the ask's promise not to depends on that planner (come alive, README Part 5.F).

## Report coverage and verification

| Report requirement | Implementation |
|---|---|
| Remove redundant demo/copy/pills | Get Started, Welcome, compact results and a full-page account form after practice; Save has one action |
| Concrete illustrated choices and deliberate navigation | Four aligned French levels, named Next actions, real shared onboarding progress, a centred minute goal and a dedicated tutor chooser |
| Real personalisation | Goal selects the first practice; level and confidence determine support; focus determines the practice method; the daily goal and bounded tutor preferences are saved |
| Value before registration | Bounded typed/spoken guest task, actual feedback and exact retry |
| Endowment/save/return | Durable kept phrase; explicit account adoption; Home continuation before unrelated daily content |
| Vivid responsive UI | Exact C2 SVG scenes and cloud/flame mascots, activity-aware loops, responsive page/button/sheet motion and haptics |
| Contextual editing/help/privacy | Shared accessible sheets, provisional edits, actual policy, conservative feedback details |
| Recovery and privacy | Explicit eligibility, separate off-by-default opt-ins, local counterpart, cancellation, generation guards and bounded server ownership |
| Scheduling and commercial follow-ups | Optional reminder editing uses the existing sheet from the streak page and historical guest Home, with permission only on the tap. A newly created email account celebrates and opens Home; the existing commercial offer remains gated by actual account/store status |
| Measurement | Closed anonymous daily starter event counts by variant/evidence only after opt-in; authenticated useful-return event after an accepted reply, not login |

Optional guest analytics use fixed names: practice_started, useful_reply, feedback_seen, retry, help_used, phrase_kept, save_progress, useful_return and practice_finished. No words, audio, answer values or user/install IDs are written to these counts. Counts expire at ninety days; the capability ledger expires at thirty days. Account analytics read the account’s current consent. These are evidence hooks, not a completed user study or proof that a design wins.

Automated unit/integration checks, the repository quality gate and browser screenshots are recorded with the implementation evidence. F114’s physical-device stopwatch, haptic tuning, iOS/Android microphone and notification dialogs, VoiceOver/TalkBack and live Apple authentication cannot be produced on the machine through a browser-only walkthrough. Run the device matrix in `docs/DEVICE_VERIFICATION.md`; do not call native behavior or French native-speaker review verified without those passes. Observe new, returning, family/work and quiet-use learners without coaching, including editing, denial, offline recovery, saving and useful return, before declaring conversion or comprehension outcomes.

## Historical browser redesign checks, before C2

These earlier browser checks covered tutor initial/selected/playing states and
representative setup/account/streak pages, with media playback and persisted
route/tutor selection. They do not verify C2. Current C2 gate, review and browser
evidence belong to the [change plan](changes/bold-rhythm.md); native keyboard,
device audio interruptions, haptics, VoiceOver and TalkBack require fresh device
QA. No production or native acceptance is inferred from a screen preview.

## Historical native correction checks, before this redesign

The following results describe the prior implementation on 10 October 2026. They have not been rerun against the shared-frame tutor redesign and are retained only as historical evidence.

The root quality gate passed: 4,956 workspace tests, 77 shared release/provider proof tests, and eight disposable SQL proofs replaying all 39 migrations. Typechecks and the final web export passed. Both iOS device and simulator builds succeeded with the native Rive runtime. The device binary was installed without clearing the learner’s data.

Native iPhone 13 mini QA at 375 × 812 checked startup, Welcome, four level rows, confidence/focus/daily-goal navigation, the centred plan ring, all six tutor choices, sample playback, and selection enabling first practice. The today-first streak fit in one viewport. Signup was checked in an inert iPhone simulator preview for Email → Password → Confirm focus, keyboard dismissal and action visibility, strength-meter motion, larger reading sizes, reduced motion, and synthetic loading, error, retry and confirmation-pending results. Done ended editing without submitting; explicit Create account started the preview request. Native autofill and password-manager behavior, Android, real registration and provider authentication remain unverified. This is not a completed VoiceOver/haptic/physical-device-matrix audit.

The live flow was stopped at its unanswered age confirmation. Automatic approval review did not permit an age assertion on the learner’s behalf. The development preview uses synthetic data and an inert auth adapter, requires both `__DEV__` and an explicit preview flag, and neither stores an age answer nor creates an account. Google’s hosted redirect allow-list and Apple provider/signing configuration still require completion; no successful live OAuth exchange or real account creation is claimed here.

### Historical C Bold rhythm, October 11

The setup now asks interests after purpose. Closed choices (food, travel, music, everyday) persist locally and accompany the actual first-practice brief. The six questions use full-width rows, followed by the plan and deliberate tutor choice. C uses bundled Outfit Black and layered local Rive illustrations. The later user instruction makes decorative artwork continuous while visible; reduced motion keeps static artwork, and backgrounding pauses it. Forms and milestone progress do not reset with the artwork. Email Next advances focus explicitly; typing no longer auto-advances.

This section supersedes the earlier first-run presentation timings and surfaces
above for the C journey: violet/sun/paper tokens, 12-point corners, 56-point primary
actions, 220 ms progress and 180/110 ms page motion. Press depth and accepted-action
haptics use the existing primitives. Each tutor card has its own core colour;
selection and sample playback remain separate, with no extra Voice preview block.
The user's soft sphere replaces the Figma ring/bar orb and uses real session state
and measured audio, with static fallbacks when motion is unavailable or reduced.

The plan editor commits interests, confidence and focus alongside reason, level
and duration. Resume offers an explicit continuation or fresh start. Home cancels
its delayed first-streak presentation on user interaction; the streak's optional
reminder uses the existing device permission/time sheet. Hidden retained onboarding
and unfocused Home artwork stop playing.

Both account forms retain the existing auth service and official provider assets.
Signup can resend confirmation. Native email confirmation/reset returns through
the separate `luvani://auth/email` PKCE callback, while browser OAuth retains
`luvani://auth/callback`. Failed email links use the shared recovery sheet without
clearing guest practice. Staging redirects and device acceptance remain necessary.
The earlier device/build verification record is historical and does not verify
these C changes; see the [current change plan](changes/bold-rhythm.md) and
[60-state map](changes/bold-rhythm-frames.md).

Tutor sample startup warms the six bundled clips while the chooser is visible;
native source loading runs alongside audio-mode setup and playback still waits
for readiness. Loading and error labels remain truthful. Media ticks update only
the progress leaf, which interpolates observed position through a native transform
and does no animation for unchanged or inactive rows. Leaving/backgrounding stops
playback and clears the bounded warm cache. Raised choices keep one release spring;
reduced-motion changes never replay an old choice nudge or animate a rejected
sheet swipe. First-practice voice errors expose the existing same-session typing
recovery only while eligible; terminal/settling sessions cannot reopen admission.
The isolated screen preview explains that it cannot start a real practice.
