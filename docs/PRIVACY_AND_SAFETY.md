# Privacy and safety

This is the policy for what Luvani collects, why it collects it, how long it keeps
it, who can read it, and what the tutor does when a learner says something the
product must not answer.

Read it as two things at once. Most of it **describes code that exists today** and
exists so the behaviour cannot drift without someone deciding to change it. A
smaller part **states what must become true before real learners arrive**, and
every one of those is collected in [Not true yet](#not-true-yet) rather than
scattered through the prose where it could be mistaken for a promise already kept.

Nothing in this file is a substitute for a *reviewed* privacy policy and terms.
The words now exist: `apps/mobile/src/legal/policy.ts` carries the learner-facing
notice, assembled from this file, and `legal/terms.ts` names Apple's standard
licence. Neither has been read by a lawyer, so both keep saying so in plain words,
through `LEGAL_REVIEW_PENDING` in `legal/company.ts`. Accurate words are not cleared
words, and implying otherwise would be worse than their absence.

`docs/STATE_AND_STORAGE.md` says where the learner's data *lives*. This file says
what we are allowed to do with it.

## What Luvani holds

Every durable store, with the retention that governs it. A row whose retention says
"not true yet" is honest about a gap and appears again at the bottom of this file.

| What | Where it lives | Why | Retention | Removed by |
|---|---|---|---|---|
| Email, name, sign-in provider | Supabase `auth.users` | There is no account without them | Life of the account | Account deletion |
| Pre-account age confirmation and selected Tutor voice | Device, `@luvani/pre-account-onboarding/v1` | Carry the minimum first-run choice through account creation | Until the signed-in profile is created | Cleared after profile creation, clearing app data |
| Age confirmation, and a date of birth for learners who joined when Luvani asked | Device, `luvani.u.<uid>.profile` | The 13+ gate, which is a gate and not a field | Life of the account on that device | Account deletion |
| The moment a session stopped because the learner said they are under thirteen | Device, `luvani.u.<uid>.profile`, field `ageStopAt` | Keep the tutor doors shut until the age gate is answered again | Life of the account on that device, cleared the moment they pass the gate | Passing the age gate, reinstall, account deletion |
| Learning state: history, review deck, journal phrases, missions, topics, drills, sound-check evidence | Device, `luvani.u.<uid>.*`, and `public.learner_state` once sync ships | It is the product | Life of the account | Account deletion, cascade |
| Conversation Pack: curated phrases, corrections, short summary and exercises | `public.conversation_packs`, with a device cache | Recover post-session practice if the app closes | Life of the account | Account deletion, cascade; delete one/all Packs in My French |
| Five content-free product events | `public.product_events` | Product decisions | 13 months from `occurred_at` | Scheduled delete, cascade |
| Seconds of voice per session | `public.session_usage` | Bill each session at most once | 24 months from `reported_at` | Scheduled delete, cascade |
| Plan and seconds used | `public.entitlements` | The allowance | Life of the account | Cascade |
| One row per purchase delivery already seen: vendor event id, account, event type | `public.billing_events` | A retried webhook grants an entitlement once | Life of the account | Cascade |
| The account id a purchase is filed under, and what that account bought | RevenueCat, as `appUserID` | Take the payment and tell the app what was bought | Not true yet: vendor-side, and nothing here sets it | Nothing in this repo, and not account deletion |
| Two salted antifraud HMACs | `public.trial_installations` | One free trial per installation | 24 months from `claimed_at` | Scheduled delete only, never account deletion |
| Rate-limit counters and session leases | Upstash, `luvani:*` | Abuse and cost limits | The window TTL, 60 seconds to 24 hours | Key expiry |
| A random installation id | Device, `luvani.installation.v1` | The input the antifraud HMAC is made from | Until app data is cleared | Clearing app data, uninstall |
| One content-free line per safety decision | Agent host logs, worker stdout | Know how often the boundary fires, and on which rule | Not true yet: whatever the host keeps, and nothing here sets it | Nothing in this repo |
| Synthesised tutor lines as WAV | Agent host disk, TTS cache | A voice vendor should be paid once per line | Indefinite, tutor speech only | Deleting the cache directory |
| Learner utterance audio | Never written anywhere | See the next section | Never written anywhere | Nothing to remove |

Two things are deliberately absent from that table. There is no advertising or
attribution identifier of any kind, and there is no third-party analytics SDK in
the app. Adding either is an escalation to the founder, not an engineering choice.

## Daily offline practice and Friends (review branch)

Daily "Record my take" is an explicit exception to the historic blanket "no file" wording below: a temporary local recording enables self-comparison. It is never uploaded; leaving/backgrounding/re-recording deletes it best-effort. A process kill may leave a cache file until OS cleanup. Update public legal pages from `legal/policy.ts` before release.

Friends is explicit opt-in, exact-username discovery, mutually accepted membership. Weekly points are capped aggregates of client-synced practice, not anti-cheat-certified ability scores. Milestone sharing defaults off. Challenge participation is separate consent to combined progress. No address-book upload, public leaderboard, messaging, location, transcripts or recordings are exposed. Blocks remove both directions of the relationship; reports are private to staff. Social tables cascade on account deletion and the account export includes owned records and participating edges/challenges. A staffed reporting workflow must be established before public launch; the review branch stores reports but does not claim anyone has reviewed them. Social badges respect in-app preferences; there is no remote-push delivery service in this change.

## Raw live speech is never stored

**Raw live-session learner audio is never stored.** No file, no bucket, no table, no log line,
no vendor archive we opt into. The bytes exist while they are in flight and then
they are gone. The separate offline daily record-and-compare tool uses a temporary
on-device recording, as described above; it never uploads that recording.

This is currently true by construction, and the point of writing it down is that it
stops being an accident:

- No LiveKit Egress or room recording is configured anywhere in the repo. The audio
  path is a live WebRTC track and nothing tees it to storage.
- `services/token-server/src/server.ts` reads drill audio into memory, forwards it
  to the pronunciation scorer, and returns observations. The bytes are never
  written to disk and the request body is capped at 2 MB.
- `apps/mobile/src/speech/scoreAttempt.ts` uploads one attempt against one known
  reference and keeps nothing.
- The TTS cache in `services/tutor-agent/src/ttsCache.ts` stores **tutor** speech
  only. A cached WAV is a line the product wrote, never a line a learner said.
- Sound-check evidence in `apps/mobile/src/soundcheck/store.ts` is
  `missionId`, `reference`, `at`, `kind`, one learner-safe `focus` sentence and
  the IPA symbol of the sound it was about (`phoneme`, null when none was named).
  Never audio, and deliberately never a numeric score. The symbol was added in
  F468 so a later screen can look the sound up in the authored inventory instead
  of only reprinting a sentence about it; it identifies a French phoneme, not a
  learner, and it carries no measurement.
- Transcripts are the same rule. Deepgram returns text so the tutor can answer; the
  session engine grades it and drops it. A Conversation Pack may retain a curated
  summary, selected learning phrases, corrections and exercises, but never the
  turn-by-turn transcript or uncurated text. The core contract rejects fields
  named `audio`, `recording`, `transcript` and `history` before either the server
  or device cache accepts a pack.

Audio does leave the device to four vendors. While a session is live, LiveKit
carries it, Deepgram transcribes it and ElevenLabs speaks the tutor's side. The
fourth scores a pronunciation attempt, and it is TonePerfect: `selectScoringVendor`
in `services/shared/pronunciation.ts` picks it whenever `TONEPERFECT_API_KEY` is set
and nothing says otherwise. Speechace scores instead only when
`LUVANI_SCORING_VENDOR=speechace` names it, or when its key is the only scoring key
the server holds. A vendor named without its key scores nothing, so an attempt is
never sent to a scorer nobody chose. Moving from Speechace to TonePerfect was the
founder's decision on 29 September 2026 (ledger F616). That is the founder's half of
the new-vendor escalation in [Escalation and what Luvani is
not](#escalation-and-what-luvani-is-not); the legal half waits on the same review as
the rest of this file.

**The scorer hears drills and sound checks, not conversations.** The app uploads one
attempt to `/drill/score` on the token server (`scoreRecordedAttempt` in
`apps/mobile/src/speech/scoreAttempt.ts`, called by the drill and sound-check
screens), and the server, not the phone, calls the vendor. The scripted lesson agent
can hand a live turn's audio to the same router from `services/tutor-agent/src/tutor.ts`,
but only when `LUVANI_AUDIO_SCORING=1`, and by the founder's decision of the same day
it stays off until scoring runs off the reply path (ledger F623). With the flag off
the agent passes the line alone, and an attempt with no audio is never sent anywhere.

**What TonePerfect is sent** is one multipart request to
`https://api.toneperfect.app/v1/assess`, made by `services/shared/toneperfect.ts`,
carrying four things: the attempt's audio, the line it was an attempt at, the language
code (`fr-FR`, because no caller asks for Quebec French), and an `Idempotency-Key` from
`crypto.randomUUID()`, made fresh for each attempt and reused only for that attempt's
one retry. Our key rides in the `Authorization` header and is ours, not the learner's.
No user id, session id, room id, name or email is in the request, and because the
server makes the call, the vendor sees the server's address rather than the learner's
phone. That is not the same as sending nothing personal. The audio is the learner's
voice. And the line is not always one we wrote: for a sound check it is an authored
mission line, but for a drill it can be a key phrase from the learner's own
conversation or the corrected version of something they said (`packExercisesFor` in
`apps/mobile/src/conversationPacks/packExercises.ts`). A timeout ends our wait, not the
upload, so an attempt the server gave up on may still have reached the vendor.

**What TonePerfect says it keeps**, and this is the vendor's own statement, not
something this repo has verified: it deletes the audio once the attempt is scored, and
keeps the assessment for at most 24 hours. The assessment it returned for the one call
made so far, committed as `services/tutor-agent/src/fixtures/toneperfect-fr.json`,
carries the line, the scores and a phonetic spelling of what it heard, so that is the
kind of record those 24 hours would cover. No account, session or room id is in it for
as long as the idempotency id stays random, which is why it is never derived from any
of them. The line is another matter: a drill line drawn from the learner's own
conversation carries whatever that line said. The learner-facing notice does not
repeat the figure, for the same reason it names no vendor's retention: a vendor's
account of what it keeps is not a fact we have checked.

**A fifth vendor receives the words themselves, as text.** The language model
`brainClient` returns in `services/tutor-agent/src/convo.ts` (Anthropic, OpenAI or
Groq, chosen by `TUTOR_LLM`) is sent every learner turn by `runBrainTurn`, because
that is the call that writes the reply the tutor speaks. It is the recipient that
*reads* what was said rather than only carrying or transcribing it, and it is
therefore the one a recipients list must not leave out: the learner-facing text in
`legal/policy.ts` names it among the services a live conversation needs, in the same
by-function words as the other four.

What the turn call is sent is set by `prepareTurn` in
`packages/brain/src/engine/conversation.ts` and `buildTurnContext` in
`packages/brain/src/prompt/turnContext.ts`: the learner's turn as text, the turns
already taken in this session, the scene being practised, the learner's name where one
is set, and the CEFR estimate with the watch-for list, which is derived from the learner
profile the server keeps.

The turn is not the only call, and the scene call hands over more than a derived
estimate. `buildFrame` in `services/tutor-agent/src/convo.ts` sends
`profile.memory.facts.slice(-5)` to the same vendor, as `REAL ACCOUNT MEMORY` in
`packages/brain/src/prompt/scenarioPrompt.ts`, with the unmastered phrases and the
recent scene list beside it. Those are stored rows, and they are about the learner's
real life: `extractMemory` writes them after each session from what was volunteered
around the scene, interests, events coming up and goals
(`packages/brain/src/prompt/extractPrompt.ts`), and the profile carries up to twelve of
them from one session into the next (`docs/STATE_AND_STORAGE.md`). So a learner who
mentions a job interview on Monday has that sentence sent to the model vendor on
Wednesday to build the next scene. Since F562 the goals the learner writes in Profile ride
in the same slice, appended after the remembered facts by `snapshotFor` in
`apps/mobile/src/profile/memory.ts`, and the facts themselves can be seen and removed
there: a removed fact is kept as a tombstone the snapshot filters, because the extraction
would otherwise write it back. The email and the sign-in identity are never handed
over, and no audio ever is.

**The recent scene list beside those facts is not learner words.**
`preferences.lastScenarios`, which `buildFrame` sends as `RECENT SCENARIOS, AVOID
REPETITION UNLESS REQUESTED`, holds `state.frame.title` values written by
`finishSession` in `packages/brain/src/profile/profile.ts`. Those titles are the
scenario builder's own text, so what goes back is the last few scenes the vendor wrote,
sent so that the next one is not a repeat of them. It is still a list of what a learner
has been practising lately, which "your level and the things to watch for" does not
cover, so the notice names it, and names it for what it is rather than as something the
learner said.

**The sending is not over when the session is.** `endSession` in
`services/tutor-agent/src/convo.ts` makes three more calls to the same vendor after the
learner has gone. `extractMemory` sends that session's turn-by-turn `history` together
with `knownFacts: profile.memory.facts`, every fact on file up to twelve, rendered as
`Already on file:` by `packages/brain/src/prompt/extractPrompt.ts`; `curatePractice` and
`generateDrills` send the session's phrases and topics with the CEFR estimate and the
top error tags. No category crosses there that has not already crossed during the
session, and no audio and no identity ever do. Two things follow for the notice all the
same. The memory facts go over twice, when a scene is set up and again once the session
has ended, so the notice says both rather than only the first. And "while a session is
running" was the wrong frame for the whole recipients section, because it tells a
learner the sending stops when they stop.

The notice says all of it in the learner's words: the turn, what the tutor remembers,
the recent scenes, and that the last of it happens after the session has ended. A
recipients section that names a recipient and hides what it receives, or that implies a
window narrower than the real one, has moved the omission rather than closed it.

What each of the five vendors retains on its own side is a vendor question and is
**not verified** by this repo. Naming their retention in the learner-facing privacy
text is a launch blocker, listed below.

**An own-words answer is read by the language model, and first by TypeSafe when it is on.**
The own-words drill asks a learner to type a phrase their own way. It opens from a session
recap (`RecapScreen.tsx` passes a kept phrase with that session's situation) or from a
Practice card (`MakePhraseCard.tsx`, whose `from` is the conversation the phrase came out
of). `judgeOwnWords` in `apps/mobile/src/speech/judgeAttempt.ts` posts one request to
`POST /drill/judge` carrying the answer, the phrase (`fr`), its meaning (`en`), the
situation, the must-keep meaning words, the CEFR estimate and the account id.

The account id stops at our server. `handleDrillJudge` in
`services/token-server/src/drillJudge.ts` uses it to authenticate and to rate limit, then
builds the vendor request from the answer, the phrase, the meaning, the situation, the
must-keep words and the level alone (`buildOwnWordsJudgeRequest` in
`packages/brain/src/llm/judge.ts`: an English grading brief, those fields, and the answer
fenced as data). No name, email, account id, session id or audio goes to either vendor, and
because the server makes the call, neither sees the learner's phone.

Who reads it is decided by `brainClientFromEnv` in `packages/brain/src/llm/factory.ts`,
the same factory the tutor uses, so the language model is whichever vendor `TUTOR_LLM`
picks. When `TYPESAFE_API_KEY` holds a value (`typeSafeFromEnv` in `typesafe.ts`; empty
reads as unset), that brain is wrapped in `JevFirstBrainClient` (`jevJudge.ts`), which
first sends TypeSafe's Jev model, at `https://api.typesafe.ai/v1/systemone`, the answer,
the phrase, the meaning, the situation and the must-keep words (`jevJudgeState`). Never the
level. Jev answers four typed questions and writes no text: meaning kept, comprehensible
and in French as yes/no probabilities, and natural as one of yes, awkward or no. Only when
every answer clears `JEV_PASS` is the brain skipped. A no, a doubt, an error or the 2.5 second
timeout sends the same request on to the brain unchanged. So an answer reaches TypeSafe
alone, or TypeSafe and then the language model, and with the key unset only the language
model. The verdict decides nothing on its own: core's `decideOwnWords` does.

**Nothing is stored.** The handler has no table, no event and no log line that carries the
answer. The server's one line per judged attempt is `judgeUsageLine`: the model that
answered, token counts and cost. The 503 path logs nothing from the body, and
`TypeSafeError` carries the HTTP status only, because a 422 body can quote the learner's
sentence. On the phone the answer lives only as long as the screen that shows it and is
never written to the deck or the summary. The OpenAI client sends `store: false`; the
Anthropic and Groq clients set no retention parameter.

**What the vendors keep is unverified.** TypeSafe's retention and use of what it is sent
has not been checked against its terms by anyone here, and the language model vendor's is
as unverified for this call as for the turn call. Both are in [Not true yet](#not-true-yet)
and on the vendor-terms item in `docs/RELEASE_GATE.md`.

The notice says this in two paragraphs of "Who else sees it", and TypeSafe is the one
recipient it names, because `CLAUDE.md` requires it before production. The route also
falsified the sentence that closed the post-session calls, "Nothing more about that
session reaches any of them after that", since the phrase and situation being judged come
from a finished session. It now ends "unless you practise a phrase from it", which is also
true of a drill line sent to the pronunciation scorer as described above (ledger F625).

**A purchase reaches a company that hears none of it.**
`apps/mobile/src/purchases/adapter.native.ts` calls
`Purchases.configure({ apiKey, appUserID: userId })` and `Purchases.logIn(userId)`, so the
Supabase user id *is* the purchase processor's `appUserID`, and `fetchSubscriber` in
`services/token-server/src/billing/revenuecat.ts` sends that same id to
`https://api.revenuecat.com/v1/subscribers/{userId}` every time the server re-projects an
entitlement. What crosses is the account id and the record of what that account bought.
No audio, no transcript, no learning state, no email and no sign-in identity: nothing in the
app calls `setAttributes` or `collectDeviceIdentifiers`, and the id is the only thing the
SDK is handed. It receives none of the things the five conversation vendors receive, and it
is a recipient all the same, so the notice names it for what it does: it takes the payment
and tells the app what was bought.

**Recipients are bounded by purpose, not by a count.** Three ledger entries in one change
were one defect. The recipients section ended in a number, and each recipient nobody had
counted falsified it: F481 was the language model, F484 the cross-session memory that rides
the scene call, and F488 the purchase processor, which "nothing goes to anyone beyond the
five services that make a conversation happen" denied existed while `adapter.native.ts` was
handing it an account id. A count is falsified by the next vendor and by every vendor the
writer did not think of, so `legal/policy.ts` now closes on the purposes named above it
rather than on how many companies there are: carrying a conversation, answering the learner,
keeping what they have learned, and taking a payment. A new vendor is still a new paragraph
in both files. What changed is that the closing sentence does not quietly become a lie while
nobody writes it.

**No learner-facing sentence says how many vendors there are.** The bound stopped counting in
F488 and the sentences around it did not. `legal/policy.ts` still read "A fifth is the language
model", "What you say reaches all five" and "Nothing about that session goes to any of the five
after that", and `onboarding/disclosure.ts` still ended the first-run line with "and nothing is
shared with anyone else". Each was defensible as a back-reference to the list immediately above
it on the day it was written, which is what makes the shape dangerous rather than safe:
`voiceVendorOf` in `services/shared/devPlan.ts` picks a voice supplier from `LUVANI_TTS_VENDOR`,
so a fallback voice, a second transcriber or a second model arrives as an environment variable
rather than as an edit to the notice, and every count in it would go stale with the suite still
green. F500 and F501 took the last two out. A recipient is named for what it does; a sentence
pointing back at the list points at the services rather than at how many of them there are; and
the first-run line in `MEET_PRIVACY` bounds what a learner says by the purposes it leaves for,
which are carrying a conversation, answering them and keeping what they have learned. Taking a
payment is deliberately not among those three, because no word of French reaches the company
that takes the payment. What is still a list of jobs rather than a count is the opening
enumeration: one service carries the audio, one transcribes, one speaks and one scores, and a
new vendor edits that sentence the way it edits this file. The counts in **this** document stay,
where they describe today's vendor set beside the code that proves it. What they may not do is
reach a sentence a learner reads.

**Our server is somebody else's computer.** The database behind every Supabase row in the
table above is run by Supabase, and the rate-limit counters and session leases are Upstash
keys. Upstash sees a 43-character HMAC of the account rather than the account itself
(`privateSignal` in `services/token-server/src/rateLimit.ts`, and `verify/upstashLive.ts`
checks every live `luvani:*` key against that shape); Supabase holds the email, the name and
the learning itself. "Our server" in learner-facing copy therefore covers two companies we
pay to hold things, and neither was named in the notice either. The notice says so now, in
the same by-function words as the rest, rather than letting a rented database read as a
machine of ours.

**Account deletion does not reach the purchase processor.** `POST /account/delete` deletes
the Supabase user and everything that cascades from it. Nothing in this repo calls the
vendor's delete API, so the subscriber record and its purchase history stay where they are.
That is a gap rather than a decision, and it is listed below.

The half of it that could be closed without server work is the disclosure, and it is closed.
The notice's "Your rights" section says, beside the two things we keep on purpose, that
the company that took the payment keeps its own record of what was bought, and that
deleting the Luvani account does not reach it. It is written as who holds it and what it is
rather than as a list, so the day the deletion path does call the vendor, one sentence
changes rather than a closed list being rediscovered. Saying it there rather than only among the recipients is the
point: a learner asking what survives deletion reads that section and stops. The bound holds
in the other direction too, because overclaiming a gap is the same defect as hiding one, and
what stays with the vendor is an account id and what that account bought, never audio, never
words, never learning. **Calling the vendor's delete API is still owed**, and is ledger F498.

The rule for anyone extending this: a feature that needs to keep a recording is a
new consent, a new retention period and a new disclosure, and it is an escalation
before it is a branch.

### Disclosure at first run

What a learner is told, before they say anything out loud, lives in
`apps/mobile/src/onboarding/disclosure.ts` as exported constants, and
`disclosure.test.ts` holds them. It is one module because it feeds three surfaces
in the order a learner meets them: the pre-account welcome, the recovery-flow Meet
page when an older profile needs it, and TutorIntro's persona page at the door of
the tutor. Before it, the first run said nothing about AI at all and
introduced Luc with a biography. `FIRST_RUN_SURFACES` names the three, and the test
`every first-run screen reads its AI disclosure from one module` fails if a screen
stops reading from here and starts writing its own version.

Four rules, each with a test behind it:

- **AI is said plainly**, in the word itself, in the first sentence a learner reads.
  The persona stays and is introduced as a persona. A character is not a lie;
  presenting one as a biography to somebody who does not know they are talking to
  software is.
- **No person hears you**, said out loud rather than left to be inferred, because it
  is the same position this file takes in [Escalation and what Luvani is
  not](#escalation-and-what-luvani-is-not) and a learner decides what to say before
  the scene, not after it.
- **One vendor vocabulary, bounded the way the footer is.** The line about where
  speech goes is the Profile footer's words, character for character, and the test
  reads both files. Two sentences about one pipeline is how a document and a screen
  start disagreeing. It ended "and nothing is shared with anyone else" until F500,
  which is the flat denial F481 struck out of the notice and F497 struck off the
  footer, left standing on the page every learner reads; it now bounds what a
  learner says by the purposes it leaves for, in the notice's own words, and
  `disclosure.test.ts` reads that list off `legal/policy.ts` rather than retyping
  it.
- **No policy that does not exist.** Terms and a privacy policy are not written, so
  nothing in the first run implies a document, a certification or a guarantee behind
  it. The microphone line stops at the ask and makes no claim about what happens to
  the audio, because the attempt recordings in [Not true yet](#not-true-yet) mean
  this repo cannot honestly make that one yet.

The antifraud identifier is disclosed now, and not here: it is a section of the
privacy notice in `apps/mobile/src/legal/policy.ts`, where it can carry the purpose,
the two-year limit and what the markers are not. The first run stays short and points
at Settings for the rest, which is what `MEET_MORE` says.

## Analytics: consent, opt-out and retention

Luvani records ten events. They exist so product decisions are made on evidence
rather than on the loudest opinion in the room, and they are content-free by
construction, not by good intentions.

| Event | Properties | What it can never carry |
|---|---|---|
| `onboarding_completed` | `personalisedGreeting` alone, one boolean | The name itself, the date, why they are learning |
| `mission_started` | `missionId`, `entry` | Anything the learner said |
| `mission_completed` | `missionId`, `rung` | The words that earned the rung |
| `sound_check_completed` | `missionId`, `kind` | The audio, the focus sentence, any score |
| `my_french_opened` | `situationsDone`, `linesKept`, both counts | The phrases themselves |

Two independent allowlists enforce that. `parseProductEvent` in the token server
rejects an unknown name, an unknown property, an extra property or a wrong type,
and the `validate_product_event` trigger in PostgreSQL re-checks the same shapes so
a modified client writing straight through PostgREST cannot store a transcript.
Neither list may grow a free-text property. Adding one is a change to the parser,
the trigger and this file, and it is an escalation.

**Removing one is the same three places.** `onboarding_completed` lost
`motivationAnswered` when the why page left the first run, because a property that
can only ever be `false` is noise dressed as evidence. All three layers now ask for
`personalisedGreeting` and nothing else: the client union in
`apps/mobile/src/analytics/track.ts`, `parseProductEvent` in the token server, and the
`validate_product_event` trigger, which
`supabase/migrations/202608270001_onboarding_event_property_fix.sql` brings into line.
Each of the three still requires the exact key set rather than a subset, so an event
still carrying the retired key is refused rather than quietly trimmed.

For a while they did not agree. Only the client changed, the parser and the trigger went
on demanding both keys, and every `onboarding_completed` was rejected rather than stored
while the funnel reported nothing and nobody saw an error (F116). Two things follow. A
deployed database keeps rejecting them until somebody pastes that migration by hand,
because there is no CLI here and DDL does not travel over PostgREST. And a property
removed in TypeScript is not a property removed from Luvani: the compiler holds only the
client's half of this, so the parser, the trigger and this table are a manual step every
time.

**What is true today:** every event passes `analyticsAllowed` in
`apps/mobile/src/analytics/consent.ts` before the network call, inside the `try` that
already swallows failures, and only a stored literal `true` counts. A learner who has
not answered emits nothing. `public.product_events` rows are still kept forever: the
thirteen months below is stated in the published notice and no scheduled delete
enforces it.

**What must be true before real learners arrive:**

1. **Disclosure before collection.** The privacy notice in Settings names the five
   events in plain words, says they carry no learner content, and says how long they
   are kept. It says the same thing this file says.
2. **A real opt-out.** One switch in Settings, and the same question asked once on the
   pre-account Ready page. When it is off, `trackProductEvent` returns before the
   network call, so an opted-out learner emits nothing rather than emitting something
   the server discards. The switch is per account and is readable back, so a learner
   can check what it says.
3. **Analytics is never a condition of use.** Nothing in the product degrades
   because a learner opted out. `trackProductEvent` is already fire-and-forget and
   already swallows its own failures; that stays.
4. **13 months, then gone.** A scheduled delete removes `product_events` rows older
   than 13 months. Thirteen rather than twelve so one year-over-year comparison is
   possible, and no longer.
5. **Opting out is not retroactive deletion.** A learner who wants the past removed
   as well deletes their account, which cascades. If we ever offer erase-events
   without account deletion, it goes in this file first.

Where they stand: 1, 2 and 3 are code. The disclosure is the "Usage data, and your
choice" section of `legal/policy.ts`, the gate is `analytics/consent.ts` read by
`analytics/track.ts`, and nothing in the product changes when the answer is no. 4 is
not: no scheduled delete exists, and the notice states the period anyway, which is
recorded in [Not true yet](#not-true-yet) rather than softened. 5 is unchanged.

## Antifraud identifiers: purpose, retention and disclosure

`public.trial_installations` holds two values per claimed trial:
`installation_hash` and `first_user_hash`. Both are 43-character base64url
HMAC-SHA256 digests computed by the token server with the deployment secret
`LUVANI_RATE_LIMIT_SALT`, through `privateSignal` in
`services/token-server/src/rateLimit.ts`. The table's own `check` constraints
refuse anything that is not that shape.

**What they are not.** Not an advertising identifier, not an IDFA or GAID, not a
device fingerprint, not an email, not a Supabase user id, and not the raw
installation id either. Nothing in the row can be reversed to a person without the
deployment salt, and with the salt it still only says "this installation already
had its free trial". No behaviour, no content and no profile is attached to it.

**Why the row survives account deletion.** The table has no foreign key to
`auth.users`, on purpose. A free trial that a learner can reset by deleting the
account and signing up again is not a free trial, it is a tap that mints roughly
$2.20 of vendor spend, unbounded. Cascading these rows would delete the only
evidence that the trial was already given, which is the whole control.

**Retention: 24 months from `claimed_at`, then deleted.** Twenty-four months is
chosen, not inherited. It is long enough that a farming loop is not simply a
waiting game, and short enough that it is bounded by roughly the life of a phone
rather than kept forever because nobody picked a number. A learner who genuinely
returns after two years and gets another trial costs us one trial; that is the
trade being made, deliberately.

**Salt rotation is deletion.** Rotating `LUVANI_RATE_LIMIT_SALT` makes every stored
hash unmatchable. Rows made under a retired salt are dead weight and must be
dropped in the same change that rotates it, not left behind.

**Disclosure.** The text this section asked for is written. It is the "Keeping one
free trial honest" section of `apps/mobile/src/legal/policy.ts`, and in the learner's
words it says: our server keeps two scrambled markers for the installation a free
trial was claimed on, so one installation cannot claim the same trial twice; they are
not an advertising identifier, not a device fingerprint, not an email and not an
account; they are kept for two years and then deleted; and they stay when an account
is deleted, because a trial that resets by signing up again is not a trial.
`policy.test.ts` holds every one of those clauses against this section.

**If a learner objects.** The honest answer is the purpose, the two-year limit, and
the fact that no profile hangs off it. Deleting a single row on request defeats the
only control that exists, so it is not an engineering decision: an individual
erasure that is granted is a founder and legal decision, and it gets recorded.

## Deletion and export

**Deletion, today, in code.** `POST /account/delete` in the token server deletes
only the verified caller, never a user id supplied by the client. Before it does,
`signedInRecently` reads Supabase's server-owned `last_sign_in_at` and refuses
unless the account really signed in within the last five minutes, because a
refreshed bearer is not reauthentication and a stolen session must not be able to
erase somebody. Deletion is rate limited to 3 per account and 20 per IP per day.

**What the delete removes.** The Supabase user, and by `on delete cascade`:
`learner_state`, `product_events`, `entitlements`, `session_usage`, `billing_events`
and `conversation_packs`. On the
device, `clearActiveUserData` erases every per-account key in `USER_KEY_SUFFIXES`,
and `App.tsx` deliberately holds the local session open until that finishes so the
namespace can still be resolved. If the local erase fails the learner is told
plainly that the online account is gone but this device still holds a copy.

**What deliberately survives.** `public.trial_installations`, for the reason above.
On the device, `luvani.installation.v1` and the legacy-migration marker survive,
because the installation signal is exactly the thing a fresh account must not be
able to reset. Neither carries learning, content or identity.

**What survives without anybody deciding it should.** The purchase processor's record of the
account and what it bought, because no code here asks the vendor to delete anything. That one
is a gap rather than a choice, it is described under "Account deletion does not reach the
purchase processor" above and listed in [Not true yet](#not-true-yet), and the notice tells a
learner about it in the same section that tells them what deletion does.

**What is not proven.** The cascade has never been executed against a live
database, and the device wipe has never been run on a real iOS or Android build.
Both are open ledger work (F63, F71), and neither may be described to a learner as
verified until it is.

**Export.** Settings' **Download my data** writes a JSON file containing every
per-account device key and, for a Supabase account, the authenticated learner's
account metadata and rows from `learner_state`, `product_events`, `entitlements`,
`session_usage`, `billing_events` and `conversation_packs`. `GET /account/export` takes no user id: it
resolves the bearer first, rate-limits the request by IP and account, and filters
every table by that resolved id. It deliberately excludes raw audio and transcripts
(neither is stored), access tokens, and `trial_installations` (the antifraud HMAC is
deliberately not linkable back to an account). A local-development account exports
its device data and says that it has no server copy.

## The safety boundary

Safety is a code boundary, not prompt advice. `safetyDecision` in
`services/tutor-agent/src/safety.ts` runs on the learner's words **before** they
reach the model, before grading, and before anything is counted. It is
deterministic: the same input gives the same decision, every time, with no model in
the loop. The model observes; code decides.

Two actions, and the difference matters. **`stop`** ends the session, so crisis
handling is never metered as more roleplay. **`redirect`** answers and leaves the
session open, so a learner is never stranded mid-scene for asking one wrong thing.

| Category | Action | What the learner hears |
|---|---|---|
| `under-13` | `stop` | Luvani is not available for anyone under thirteen. Please stop here and ask a parent or guardian for help. |
| `minor-sexual` | `stop` | I cannot help with sexual content involving anyone under eighteen. |
| `self-harm` | `stop` | I cannot provide crisis support. If you might act now, call your local emergency number. If you can, contact someone you trust and stay with them. |
| `dangerous-instructions` | `redirect` | I cannot help with instructions that could hurt someone. We can practise a different French situation. |
| `hate-or-harassment` | `redirect` | I cannot help create hateful, threatening, or harassing content. We can choose another situation. |
| `regulated-advice` | `redirect` | I can help you practise the French, but I cannot give medical, legal, or financial advice. Please ask a qualified professional. |
| `prompt-injection` | `redirect` | I cannot show or change hidden instructions. We can keep practising French. |
| `emotional-dependency` | `redirect` | I am your French practice tutor, not a romantic partner or a replacement for people in your life. |

The copy never quotes the learner back at themselves, never diagnoses, and never
scolds. `safetyPolicy.test.ts` holds this table against the running code, so the
words in this file and the words a learner hears cannot drift apart.

Age is a gate rather than a field. Onboarding asks once, in plain words, and a
learner who cannot say they are thirteen is refused without a retry dressed up as a
second chance. A learner who says mid-session that they are under 13 hits the same
`stop`.

### An under-13 stop is remembered on this device

That stop used to last exactly one session, so a child could tap start and be in
another scene seconds later. Now the account remembers it. The moment is stored
as `profile.ageStopAt`, and while it is set the tutor doors stay shut and the
app opens on the age gate instead. One tap on the gate reopens them.

Clearing the stop is a write of `null`, and nothing is kept in its place. There
is no "was once stopped" field, because a field nobody reads is a note about a
child kept for no reason.

The words on that gate are `AGE_RETURN_TITLE` and `AGE_RETURN_SUB` in
`apps/mobile/src/onboarding/answers.ts`:

> Luvani is made for learners thirteen and up. Everything you have learned is still here.

It does not say what the learner said, and it does not apologise. Telling a child
what they were caught at is not kindness, the boundary is sometimes wrong about
an adult, and the boundary is not a mistake to be sorry for.

**The ceiling, plainly, because it is smaller than it looks.** This is a fact
about a device and not about an account. `mergeStoredProfiles` drops the field
from every merge through `PROFILE_DEVICE_FIELDS`, so the account copy always
reads null, and `adoptProfile` keeps this device's own across a sync fold, so a
sync cycle cannot clear it either. **A reinstall clears it, and so does a second
phone.**

Dropping it rather than syncing it is the part that looks like a bug, so here is
the reasoning. Riding with the evidence-heavier side would let a child's busier
phone merge the door back open. Treating it as an answered question, where a
non-null value beats a null one, is worse in the other direction: clearing the
stop is a write of null, so once one device had synced a stop, no device could
ever clear it again and the only way back would be a reinstall. A stop that
cannot be lifted is a ban rather than a gate.

The strong shape is a server-side account flag. It needs durable server storage
and an authenticated write path from the agent to the server, and Supabase
deployment is still an unclaimed external check, so it could not be verified end
to end. The founder accepted this ceiling explicitly rather than wait for it. It
is listed again in [Not true yet](#not-true-yet).

### The tutor's own words are checked too

`safetyDecision` reads the learner. `outputGuard`, in the same file, reads the
tutor, on every line the conversation agent is about to publish: the scene
reply, the coach line, the narration, the scene opening, the scene opening
narration, and the remembered opener the analyst wrote last session and the
device handed back in the join token.

Its rules are deliberately not the input net's, and each thing left out is left
out to protect a learner:

- **No under-13 branch and no bare-number branch.** Those patterns are for a
  learner disclosing their own age. A scene character saying "j'ai douze ans" is
  a character, and every scene with a child in it would lose its lines.
- **No self-harm branch.** `SAFETY_CONDUCT` tells the tutor to step out of the
  scene and answer a crisis disclosure as itself. A self-harm rule pointed at
  the output would suppress exactly that answer and put a cheerful "let us keep
  going" where it should have been.
- **No regulated-advice branch.** A scene at the doctor is one of the most
  ordinary French lessons there is.
- **No standalone explicit-sexual branch.** Its French half carries a bare `nu`,
  so it would eat "les arbres sont nus en hiver". Explicit language still stops
  where it already works, inside the minor-sexual rules, which need a minor in
  the sentence beside it.

The consequence is a substitution and never a stop. A line that fails is
replaced with a neutral continuation and the scene carries on, so a learner is
never stranded because the model misbehaved, and **the learner is told nothing
about it.** They did nothing.

The scripted lesson agent has no guard of its own today. That gap is in
[Not true yet](#not-true-yet) rather than left to be discovered.

## Escalation and what Luvani is not

**Luvani is not an emergency service.** It is not a crisis line, not a counselling
service, not a safeguarding service, and not monitored. Nobody is watching a
session. Nobody is on call. No message a learner sends reaches a human, at any hour,
by any route.

Saying that clearly is the policy, because the alternative — implying that
something is watching — is the failure that gets somebody hurt. The tutor's own
stop message models the tone we hold ourselves to: it says what Luvani cannot do,
points at the local emergency number, and points at a person the learner trusts. It
does not promise help it cannot send.

**What happens after a `stop`, exactly:**

1. The rescue timer is cleared, so nothing coaxes the learner back into the scene.
2. The message goes out on its own `safety` frame, never on `error`, and in the
   two spoken modes it is said out loud, uninterruptible. `error` is the notice
   the app takes away after eight seconds, which is right for a voice outage and
   is how an emergency number used to erase itself.
3. It stays on the screen. `useLiveSession.ts` holds the decision in state with
   no timer near it, and nothing clears it: not the recap, not the summary, not
   the ended phase, not the disconnect that follows. The session watchdog stands
   down too, so a room torn down behind it cannot replace those words with "the
   tutor never started".
4. The surface is the whole screen, in all four modes. `tutor/safetyView.ts`
   turns a stop into a surface that takes the place of the recap and the
   summary, with one way out. The two typed modes get the same screen, and there
   it is the only delivery there is.
5. The session finishes. The words that triggered it never become model context,
   never reach the brain, never reach analytics, and are never graded.
6. Nothing congratulates the learner. The recap is not handed on (`onRecap`),
   the summary card never opens (`onFinish`), no experience points are awarded
   (`recordActivity`), and no mission is recorded (`recordMissionCompletion`).
7. Nothing is written down. The recap is not journalled (`journalRecap`) and no
   practice is banked (`bankPractice`), so a stopped session leaves nothing
   behind on the device. That includes the ordinary practice from before the
   disclosure. It is a real cost, it was put to the founder, and it was taken
   deliberately: one flag read by every screen is the only version of this
   simple enough to stay true. There is no incident record either, because there
   is no transcript to make one from.
8. The room closes. `closeAfterStop` waits for the message to land, waits for the
   speech to finish playing where there is speech, and then disconnects, so the
   microphone stops being published and the recogniser stops transcribing into a
   session that will neither hear nor answer.
9. The worker does not stop with it, and this is the part the list used to leave
   out. `closeAfterStop` starts `finish()` without waiting for it, so the seconds
   are still debited and extract, curate and drill generation still run and
   publish into a room that is closing. Whatever arrives in time is thrown away
   by the guards in points 6 and 7, so the learner sees none of it, and it is
   still model work paid for on a session that ended. That is ledger F208, and it
   is a founder decision rather than an engineering one.

Point 7 is the honest tension in this document. Retaining nothing is the
strongest privacy position available and it is the one we take, and it also means
Luvani has nothing to escalate *with*. We accept that trade knowingly: a language
app that quietly builds a file on what its learners said in distress is a worse
product than one that admits it cannot help and gets out of the way.

**If a reporting route is ever built**, three rules bind it before any code is
written. It carries no transcript by default. It says on the screen that it is not
an emergency route and how long a reply takes. And it exists only once a named
human is accountable for reading it.

**Escalate, do not decide in code:** anything involving a minor, any health or
safety report, any law-enforcement or legal request, any new vendor that would
receive learner speech or text, any new category of sensitive data, and any
retention period longer than the ones in this file. Those are founder and legal
decisions. An engineer who finds one of them in a ticket stops and asks.

### What a safety decision leaves behind

One line on the worker's stdout, beside `SESSION_NOT_CHARGED`, written by
`recordSafetyDecision` in `services/tutor-agent/src/safety.ts`:

```
[luvani] SAFETY_DECISION session=7f3c1a20 category=minor-sexual action=stop rule=R2 mode=convo voiceless=false
```

Six fields and no seventh: the first eight characters of the session id, the
category, the action, the id of the rule that fired, which of the two tutors
decided, and whether the session was typed rather than spoken. `action=suppress`
is the output guard replacing a line the tutor was about to say.

**The learner's words are not in it, and neither is a hash of them.** A hash is
not anonymity here. What a frightened person types into a language app is a
small enough space to enumerate, so a stored digest is the sentence with one
step in front of it. The record carries what a decision was made of and nothing
it was made about.

Two other shapes were considered and refused, and neither is coming back. A
sixth analytics event is out because this file allows exactly five and adding one
is a founder escalation. A server-side counter is out because it is new storage
for a question `grep` already answers.

**Nothing watches this line.** It is read after the fact, by whoever can read the
worker's logs, to answer how often the boundary fires and on which rule. Nobody
is alerted, nobody is on call, and no session is looked at because of it. It
changes nothing above: there is still no escalation route and no reporting
route, and a log line is not the start of one.

How long it is kept is the log host's answer and not ours. Nothing in this repo
sets a retention for worker logs, and that is in [Not true yet](#not-true-yet)
with the rest.

## Review package for an external professional

This section exists so the request can go out the day a reviewer is engaged, rather
than being written then. The review itself cannot be closed from inside this repo,
which is why the ledger carries it as **F70** at P2.

### Scope of the review

We are asking a qualified professional — a clinician or safeguarding specialist for
the crisis and minor categories, a lawyer for the regulated-advice and disclosure
positions — to review:

- The eight categories in the table above, and whether the set has a hole in it.
- The `stop` versus `redirect` split, and specifically whether ending the session on
  self-harm is right or whether it abandons someone at the worst moment.
- The exact wording of all eight messages, as a learner in distress would hear
  them, out loud, in a second language.
- The self-harm message's pointer to "your local emergency number" for a product
  with no country signal about its learner.
- The escalation position: retain nothing, report to nobody, say so plainly. We
  want this challenged, not confirmed.
- The 13+ age gate, the self-declaration that backs it, and what the product owes a
  learner who is plainly younger than they claimed.
- The disclosure text for the antifraud identifier and the five analytics events.

### The adversarial corpus

The corpus lives in `services/tutor-agent/src/safety.test.ts` as a table of
`[category, input, expected action]` rows, so a reviewer can read every phrase we
test against in one screen and add rows without touching the engine. It covers, per
category: direct English phrasing, indirect and euphemistic phrasing, French,
mixed French and English in one sentence, and obfuscation — zero-width characters,
inserted punctuation, spaced-out letters and accent stripping. The negative half
matters as much: ordinary French practice, including a learner saying they had a
bad day or made a mistake at work, must stay ordinary and reach the tutor untouched.

A reviewer should assume the corpus is incomplete and treat finding a phrase that
sails through as the most useful hour they spend on this.

### Known limits of a deterministic net

Stated plainly, because a review that starts from an inflated claim is worthless:

- **It is regex, and a wider net is still a net.** It catches the explicit and the
  high-risk. Novel phrasing, heavy indirection and sarcasm defeat it.
- **No semantic understanding.** "I do not want to be here any more" and "I want to
  die" are the same intent and different strings.
- **No multi-turn context.** Each utterance is judged alone. Harm assembled across
  five turns, none of them alarming, is invisible to it.
- **No signal from the audio.** Tone, crying, a shaking voice: the boundary sees
  text only, after transcription, and transcription errors reach it as text errors.
- **French coverage is thinner than English**, and the product is used by people
  whose French is by definition imperfect and whose phrasing is therefore unusual.
- **Input is truncated at 4,000 characters** and normalisation is lossy by design;
  both are deliberate and both are attack surface.
- **Every minor-sexual stop requires a minor now**, named or implied, and that is
  narrower than it was. The rule table in `safety.ts` is `R1` to `R4`, every one
  of the four needs a child in the sentence before any other signal counts, and
  the implication is narrow on purpose: somebody asked to keep this from their
  parents, or an approach arranged around their school day. So an approach with
  concealment and no child anywhere no longer stops. Measured, both of these
  stopped a session before and are ordinary French now:
  `Come to my place. Keep this between us.` and
  `Viens chez moi, garde ca pour toi`.
- **An everyday approach now needs concealment beside it.** A photo or an address
  asked of a named child, with nothing said about hiding it, no longer stops.
  Measured, these three stopped before and none of them does now:
  `come to my house, kid`, `send me a photo, kid` and
  `Send me a photo of your kids`. What still stops on its own is an approach that
  is about a child's body or their being alone: `meet me alone after school` is
  caught by `R2`, where the school day beside the approach is what implies the
  child.
- **Those five lines are recall this net gave up, deliberately.** The old rule was
  `(minor && sexual) || (minor && approach) || (approach && secrecy)`, and its
  last clause needed no child at all, so two adults making plans were told Luvani
  cannot help with sexual content involving anyone under 18. Those words accuse a
  person of one specific thing, and saying them to somebody who has not done it
  is its own harm. The judgement that clause was standing in for now sits in the
  prompt, which reads a conversation rather than a sentence.
- **There is no model classifier behind it, on purpose.** This repo does not put a
  model between a learner and a stop decision. Judgement lives in the prompt; policy
  lives in code. A reviewer may argue this is the wrong call, and that argument is
  in scope.
- **The prompt carries the rest, and it now says so out loud.** Everything the
  regex misses reaches a model that is told what to do with a disclosure. That
  block is `SAFETY_CONDUCT` in `packages/brain/src/prompt/safetyConduct.ts`,
  written once and rendered into both shipped prompts: the conversation persona
  in `buildSystemBlocks()`, and the scripted lesson's `baseInstructions()` in
  `services/tutor-agent/src/prompt.ts`. It tells the tutor to step out of the
  scene, answer in short plain English, take it seriously the first time, point
  at a local emergency number or one person they trust, say plainly that nobody
  is reading the conversation, and let dark vocabulary in a story stay ordinary
  French. Before it existed this was design rather than code: grepping both
  shipped prompts for self-harm, suicide, crisis, minor, sexual or harmful
  returned exactly one hit, and it was the word "minor" describing how heavily a
  coach finding counts. It is guidance to a model, so it is still not a
  guarantee.

### What we are not asking for

Not a certification, not sign-off that Luvani is safe, and not clinical advice
routed to learners. We are asking whether the boundary, the copy and the stated
position are defensible for a consumer language app with no human in the loop, and
what we should change.

## Not true yet

Every gap this document depends on, in one place, so none of it can be read as a
promise already kept.

| Gap | Consequence | Where it is tracked |
|---|---|---|
| `product_events` and `session_usage` have no scheduled delete | The 13-month and 24-month retentions are policy, not mechanism | This file, table above |
| `trial_installations` has no scheduled delete | The 24-month antifraud retention is not enforced by anything | This file, section above |
| The published notice commits to retention periods nothing enforces | Thirteen months for events and two years for usage and trial markers are a promise made in a learner-facing document with no scheduled delete behind it | This file, rows above; `legal/policy.ts` |
| Vendor-side retention for LiveKit, Deepgram, ElevenLabs and Speechace is unverified, and so is the language model vendor's, and so is the purchase processor's, and so is TonePerfect's, whose own statement (audio deleted once scored, the assessment kept at most 24 hours) nobody here has checked, and so is TypeSafe's, which reads own-words drill answers whenever `TYPESAFE_API_KEY` is set | The privacy text cannot yet describe what any of them keep, and a vendor's statement is not a substitute for checking it | Not filed |
| Account deletion does not reach the purchase processor | The subscriber record and the purchase history stay with the vendor after the Supabase user is gone; nothing here calls its delete API. Disclosed to learners in the notice; the call itself is still owed | Ledger F498 |
| Attempt recordings are deleted in code, but that has never been watched happen on a device | The discard and the reset sweep are proven by test only; a phone has never been checked | Ledger F115 (closed), device proof owed by F114 |
| The deletion cascade has never run against a live database | "Deletion removes everything" is unproven | Ledger F63 |
| Device deletion and token hygiene are unproven on a real build | The device half of deletion is unproven | Ledger F71 |
| No professional review has been obtained | The safety position is unreviewed | Ledger F70 |
| An under-13 stop is remembered on the device that saw it, not on the account | A reinstall clears it, and a second phone never learns about it | This file, section above; founder accepted |
| Worker logs have no stated retention | The safety record is kept for as long as the host keeps logs, which nothing here sets | This file, section above |
| A stop does not stop the worker's post-session model work | Extract, curate and drills still run and publish into a room that is closing | Ledger F208 |
| The scripted lesson agent's own lines pass no output guard | `outputGuard` covers the conversation agent only | Not filed |
| No reviewed privacy policy or terms exist | The app says professional review remains required before release; it must not present an unreviewed document as a legal promise | Release roadmap, Phase 8 |
