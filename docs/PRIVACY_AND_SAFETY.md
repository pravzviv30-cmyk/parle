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
| The first-run draft before an account: the legacy age compatibility flag and declared eligibility, tutor voice, usage-data answer, the plan's answers including interests, speaking confidence, practice focus and deliberate tutor selection, the page reached, completed and skipped steps, the onboarding variant, an optional account email, the sign-in or sign-up form and its return page, and an optional first name. Passwords are never saved | Device, `@luvani/pre-account-onboarding/v1` | Carry the first-run answers through account creation, and resume where the learner left off; declared eligibility is not verified age | Until explicit adoption or discard, or a known refusal | Explicit adoption or discard, a known refusal, clearing app data |
| Unfinished signed-in setup or profile repair: the current page, completed steps, onboarding variant and unconfirmed setup answers | Device, account-scoped `onboarding-setup-draft` and `onboarding-repair-draft`; excluded from cloud sync | Resume interrupted setup on this device without replacing confirmed profile data | Until completion, discard or account-data deletion | Completion, discard, account-data deletion, clearing app data |
| Age confirmation, and a date of birth for learners who joined when Luvani asked | Device, `luvani.u.<uid>.profile` | The 13+ gate, which is a gate and not a field | Life of the account on that device | Account deletion |
| The moment a session stopped because the learner said they are under thirteen | Device, `luvani.u.<uid>.profile`, field `ageStopAt` | Keep the tutor doors shut until the age gate is answered again | Life of the account on that device, cleared the moment they pass the gate | Passing the age gate, reinstall, account deletion |
| Learning state: history, review deck, journal phrases, missions, topics, drills, sound-check evidence | Device, `luvani.u.<uid>.*`, and `public.learner_state` once sync ships | It is the product | Life of the account | Account deletion, cascade |
| Conversation Pack: curated phrases, corrections, short summary and exercises | `public.conversation_packs`, with a device cache | Recover post-session practice if the app closes | Life of the account | Account deletion, cascade; delete one/all Packs in My French |
| Saved conversation text, only after the learner chooses Save on the recap | `public.saved_conversation_text`; memory-only while the room is open, no device disk cache | Read the received conversation thread later | Until per-text deletion or account deletion | Delete each text in Progress, Your conversations, Saved conversation text; a word-free retry fence remains until account deletion |
| Fifteen content-free product events | `public.product_events` | Product decisions | 13 months from `occurred_at` | Scheduled delete, cascade |
| Session seconds, actual capped charge, allowance epoch and content-free failure/refund proof | `public.session_usage` | Bill each session at most once | 24 months from `reported_at` | Scheduled delete, cascade |
| Plan and seconds used (during a store trial `seconds_used` also counts the part of the month the trial does not grant, recorded as `withheld_seconds`; real usage is `seconds_used - withheld_seconds`, or `session_usage.charged_seconds` per session) | `public.entitlements` | The allowance | Life of the account | Cascade |
| One row per purchase delivery already seen: vendor event id, account, event type | `public.billing_events` | A retried webhook grants an entitlement once | Life of the account | Cascade |
| The account id a purchase is filed under, and what that account bought | RevenueCat, as `appUserID` | Take the payment and tell the app what was bought | Vendor-side retention remains unverified | Account deletion requests queued subscriber erasure; store subscriptions are cancelled in the store |
| Issued session id and allowance epoch | `public.session_grants` | Keep late session settlement in its original allowance; verify owned refunds | Account lifetime, until account deletion; no automatic cleanup implemented | Account cascade; included in bounded account export |
| Two salted antifraud HMACs | `public.trial_installations` | One free trial per installation | 24 months from `claimed_at` | Scheduled delete only, never account deletion |
| Rate-limit counters, session leases, guest records and metric counters | Upstash, `luvani:*` | Abuse and cost limits; bounded guest starter | Per-key TTL: rate windows 60 seconds to 24 hours, guest records 30 days, guest budget and scene day counters 2 days, aggregate starter metric counters 90 days | Key expiry |
| Guest scene record, `luvani:guest:<sha256 of guest token>`: installation HMAC, plan answers (plus the brief for a convo guest), scene session id, seconds, learner turn count, outcome, and `sceneTurns` (fixed scripted turn ids, never learner text) | Upstash | Admit one bounded scripted scene and let the learner save it after registration | 30 days | Key expiry; not in the account export (see below) |
| Claimed guest link: `{id, owner (Supabase user id), installation hash, expiresAt, scene, sceneTurns, analyticsAllowed}` | Upstash, same key after a successful claim | Make the claim idempotent and carry the guest analytics choice into trial-claim evidence (previously hard-coded false) | TTL at most 48 hours | Key expiry only; account deletion does not touch Upstash, the link expires on its own |
| One-scene-per-installation marker, `luvani:guest-scene:installation:<hash>` | Upstash | One guest scene per installation | 30 days | Key expiry |
| Scene day counters, `luvani:guest-scene:day:<UTC day>` and `luvani:guest-scene:fence:<day>:<hash>` | Upstash | Daily cost cap on guest scenes | 2 days | Key expiry |
| Guest scene turn ids and plan | Device, AsyncStorage `@luvani/guest-practice/v2` | Save the scene after registration; matching French lines go into the account phrasebook | Until save, discard or app-data clearing | Save, discard, clearing app data |
| A random installation id | Device, `luvani.installation.v1` | The input the antifraud HMAC is made from | Until app data is cleared | Clearing app data, uninstall |
| One content-free line per safety decision | Agent host logs, worker stdout | Know how often the boundary fires, and on which rule | Not true yet: whatever the host keeps, and nothing here sets it | Nothing in this repo |
| Numeric recognition confidence and known/unavailable final-segment counts | Agent host logs, worker stdout; counters only in memory per STT stream | Diagnose recognition during voice QA; no grading or learner-facing confidence | Host log retention remains unset; counters reset with the stream | No new deletion mechanism; no words, audio or identity added |
| Synthesised tutor lines as WAV | Agent host disk, TTS cache | A voice vendor should be paid once per line | Indefinite, tutor speech only | Deleting the cache directory |
| Optional kept-phrase tutor WAVs and word-free last-used timestamps | App-private phone cache; web memory URLs | Replay in the selected tutor voice | At most twenty WAVs / 8 MiB, OS cache lifetime; LRU eviction | Account change starts removal, deletion awaits it; interrupted files recovered on next cache use/clear |
| Kept-phrase audio spend counters and paid accounting-period start | `public.phrase_audio_budgets` | Bound extra synthesis spend without changing minutes | Account lifetime; trial counter never renews, paid counter uses anchored thirty-day periods | Account cascade; included in account export |
| Learner utterance audio | Never written anywhere | See the next section | Never written anywhere | Nothing to remove |

Two things are deliberately absent from that table. There is no advertising or
attribution identifier of any kind, and there is no third-party analytics SDK in
the app. Adding either is an escalation to the founder, not an engineering choice.

## Daily offline practice and Friends (review branch)

### Optional kept-phrase tutor audio

Explicit Hear can send the curated French to ElevenLabs in the exact selected
catalogue voice. Phone-edited words cannot authorize a paid call: the server-only
RPC resolves an owned ready/completed pack source and permanently reserves account
plus global budget in one transaction. This route makes one direct uncached call,
without shared worker WAV storage, retries, refunds, phrase logs or phrase events.
Rate revision, exact source/completion/entitlement, caps and reserved periods are
rechecked before dispatch. An in-flight vendor request cannot be revoked by a
deletion or policy change after that final check. Vendor-side retention for this
generated phrase is unverified; no enterprise zero-retention or deletion claim is
made. Public prices do not verify actual account/voice billing upper bounds.

Both generation and phone exposure remain off by default. The migration seeds
disabled zero caps and no verified voice rates; caps remain a founder choice.
Native cache/file/voice playback, vendor billing timing and hosted concurrency
remain unverified. Temporary tutor playback audio is excluded from the text export;
account spend metadata is included. Global spend retains no learner/source identity.
The native queue fences owner/voice changes and awaits disk work on deletion;
failed cleanup is reported on that deletion path. It is separate from learner
recordings and is never used as learning or pronunciation evidence.

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
- Own-words practice may instead record a temporary take, bounded to 20 seconds
  on the device. `/drill/transcribe` authenticates and rate-limits the upload,
  reads at most 2 MiB into memory, and forwards it once to Deepgram for French
  transcription. No audio, transcript or account identity is stored or logged
  by this path; the vendor receives audio, language and our service key, without
  a learner identifier. The device removes the take after upload settles, even
  on refusal. The returned words remain editable and reach `/drill/judge` only
  when the learner chooses Check. Typing and an ungraded retry remain available.
  A missing transcription key is unavailable transcription, never a score.
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
fourth scores a pronunciation attempt. In production that is Speechace, which is the
scorer the in-app notice names: the token server refuses to start with a
`TONEPERFECT_API_KEY` or any scoring vendor but Speechace (`services/token-server/src/config.ts`),
and the tutor refuses live scoring unless `LUVANI_SCORING_VENDOR=speechace` has its key
(`services/tutor-agent/src/preflight.ts`). Locally, TonePerfect is the default:
`selectScoringVendor` in `services/shared/pronunciation.ts` picks it whenever
`TONEPERFECT_API_KEY` is set and nothing says otherwise. Speechace scores instead only when
`LUVANI_SCORING_VENDOR=speechace` names it, or when its key is the only scoring key
the server holds. A vendor named without its key scores nothing, so an attempt is
never sent to a scorer nobody chose. Moving from Speechace to TonePerfect was the
founder's decision on 29 September 2026 (ledger F616), but production has not followed it:
TonePerfect is not a supported production adapter, so hosted scoring stays on Speechace
until that changes and this file and the notice change with it. That decision is the founder's half of
the new-vendor escalation in [Escalation and what Luvani is
not](#escalation-and-what-luvani-is-not); the legal half waits on the same review as
the rest of this file.

**The scorer hears drills, sound checks, and, only with a flag on, single live lines.** The app uploads one
attempt to `/drill/score` on the token server (`scoreRecordedAttempt` in
`apps/mobile/src/speech/scoreAttempt.ts`, called by the drill and sound-check
screens), and the server, not the phone, calls the vendor. The live agents can hand
one turn's audio to the same router, but only when `LUVANI_AUDIO_SCORING=1`, which is
off by default (VOICE-004). A scripted lesson sends a turn only when the learner said
the lesson's reference line (`services/tutor-agent/src/tutor.ts`). A mission sends a
turn only when the learner said the full line the tutor had just handed them on the
help card (`services/tutor-agent/src/convo.ts`, F866); the rest of a conversation is
never sent to the scorer. With the flag off the agents send no live audio to it at all.

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

**The language model vendor, OpenAI in production, receives the words themselves, as text.** The language model
`brainClient` returns in `services/tutor-agent/src/convo.ts` (Anthropic, OpenAI or
Groq, chosen by `TUTOR_LLM`) is sent every learner turn by `runBrainTurn`, because
that is the call that writes the reply the tutor speaks. Production uses OpenAI only
(founder decision, 2026-10-19): `productionConfigurationProblems` in
`services/token-server/src/config.ts` and `preflight` in
`services/tutor-agent/src/preflight.ts` refuse any other brain when
`NODE_ENV=production`; Anthropic and Groq remain development options. It is the
recipient that *reads* what was said rather than only carrying or transcribing it,
and it is therefore the one a recipients list must not leave out: the learner-facing
text in `legal/policy.ts` names OpenAI beside that role, as it names LiveKit,
Deepgram, ElevenLabs and Speechace beside theirs.

What the turn call is sent is set by `prepareTurn` in
`packages/brain/src/engine/conversation.ts` and `buildTurnContext` in
`packages/brain/src/prompt/turnContext.ts`: the learner's turn as text, the turns
already taken in this session, the scene being practised, the learner's name where one
is set, and the CEFR estimate with the watch-for list, which is derived from the learner
profile the server keeps.

The turn is not the only call, and the scene call hands over more than a derived
estimate. `tutorMemoryBrief` in `services/tutor-agent/src/convo.ts` repairs the
profile and sends `repaired.memory.facts.filter(...).slice(-5)` to the same vendor, once
inside `buildFrame` and again in each turn request, as `SAVED TUTOR MEMORY`.
This happens only on a plan or trial: when the token server signs `memoryLocked: true`
(a free or lapsed learner), the worker sends no saved memory, skips the remembered opener,
makes no extraction call, and returns the stored memory unchanged in the recap.
Its opening question still varies (VOICE-014): one of five authored lines, picked by
`profile.stats.sessions`, a plain session count, or a hash of the signed session id when
the count is zero. Neither carries anything the learner said, so a varied opener is not
memory, and the in-session question guard reads only the tutor's own lines from the
current session's history and stores nothing.
The unmastered phrases and recent scene list remain beside it in the scene call.
Those are stored rows, and they are about the learner's
real life: `extractMemory` writes them after each session from what was volunteered
around the scene, interests, events coming up and goals
(`packages/brain/src/prompt/extractPrompt.ts`), and the profile carries up to twelve of
them from one session into the next (`docs/STATE_AND_STORAGE.md`). So a learner who
mentions a job interview on Monday has that sentence sent to the model vendor on
Wednesday to build the next scene. Since F562 the goals the learner writes in Profile ride
in the same slice, appended after the remembered facts by `snapshotFor` in
`apps/mobile/src/profile/memory.ts`, and the facts themselves can be seen and removed
there: a removed fact is kept as a normalised-wording tombstone. These markers
are no longer capped at forty or aged out by later forgets. Loading, recap
application and both sync merge orders filter the raw stored facts, not only
the outgoing snapshot; forgetting also clears the unsourced saved opener.
The markers themselves still contain the normalised wording, appear in the
account export and are deleted with the account. Exact matching does not
recognise every paraphrase; this is not semantic erasure, and it cannot recover
markers that an older build already pruned.

**Pause personal memory applies from the next conversation.** The profile's
optional `memory.control` carries a validated pause flag and change clock.
The next snapshot withholds personal facts, learner-written goals and the
saved opener; the conversation agent also enforces the flag before scene
construction and skips personal-memory extraction. Name, French progress,
ordinary replies, learning recaps and practice preparation continue. Held facts
remain manageable on the device. A late recap preserves the current privacy
choice. Sync selects the newest valid control independently of the busier
profile; equal clocks choose pause. Device clock skew can still misorder choices.
Memory changes acknowledge only a successful serialized storage write. A refusal
leaves the displayed choice unchanged and offers retry. Profile writes register
with account reset; reset awaits dispatched bridge writes, fences new writes
through cleanup, and invalidates work begun during that window before removing
the account keys. These orderings have local tests, not physical-device proof.
The founder approved the sensitive-topic personal-memory boundary on 2 October:
exclude personal health details, finances, sexuality/intimate relationships,
political/religious beliefs and identifying secrets. Ordinary French goals and
non-sensitive family/travel context remain eligible. Shared instructions now cover
all extraction fields and the greeting, and guide live replies back to non-sensitive
French practice without overriding crisis responses. This is a prompt policy, not
a validated semantic gate. Model output can miss the rule; schema-valid facts still
merge and sync through the existing path. Older notes and learner-authored goals
are not semantically purged. Early speech skips stored greetings without the exact
current extraction-policy marker; new extraction stamps that nested marker, repair
and merge preserve it without promoting old text, and old workers replacing an
opener lose it. This is a compatibility fence, not proof of non-sensitive text.
The ordinary name greeting speaks immediately when the marker is absent. Learning recaps/practice packs and explicitly saved
full conversation text are separate and are not covered by this memory-only rule.

**A previous correction is separate learning context.** Before the next
conversation, the app can attach one curated correction from the active learner's
latest cached ready pack: its original fragment, better form, English meaning,
reason, pack id and source title. It never falls back to an older error if the
latest cached session is clean, generating, failed or archived. The agent
allowlists and bounds this data, labels it untrusted in the teaching brief and
uses it in scene construction and each turn. It guides a later attempt without
pre-filling the next answer or asserting the learner repeated an error. It stays
out of the persisted brain profile and does not include the optional saved full
conversation. Personal-memory pause leaves this French-learning context active,
as it leaves learning recaps active. Explicitly revisiting a selected pack takes
precedence over this ordinary carryover. A local cache can lag server data; no
live two-device or native session proof is claimed.

The email and the sign-in identity are never handed
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

**Fix your line reads one correction retry, without retaining it.** The recap
opens an in-memory sheet; the original/corrected fragment and reason never enter
navigation parameters or web URLs. A temporary spoken take uses the existing
bounded Deepgram transcription path and is removed after upload settles,
including refusal/failure or a late response after exit. Its words remain editable;
only choosing Check sends the original/corrected fragment, reason, edited retry
and level to `/drill/fix-line`. That endpoint uses the same authentication,
4KiB body bound and scoring rate-limit buckets as other drills. It sends no
identity to the configured language model and no text to a log, event, table,
deck or grade. A timeout, malformed or uncertain answer stays unjudged.
The own-words Jev shortcut is bypassed: a correction-specific screen has not
been calibrated on real French attempts. The retry has no learner countdown;
its request deadlines remain bounded. Leaving, backgrounding or an account/scope change fences late results and cancels
the correction/transcription request. A cancelled take waiting for authentication
starts no later upload; the 12s transcription deadline also bounds stalled auth.
An upload already sent may have reached Deepgram despite cancellation. Vendor
retention remains unverified, as below. A transcript is not pronunciation proof.

**An own-words answer is read by the language model, and first by TypeSafe when it is on.**
The own-words drill asks a learner to type a phrase their own way, or check and edit
the transcript of a temporary spoken take before choosing Check. It opens from a session
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

The notice says this in two paragraphs of "Who else sees it", and TypeSafe was the first
recipient it named, because `CLAUDE.md` requires it before production; since 2026-10-19
every recipient is named beside its role. The route also
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
machine of ours. Railway hosts the token server (founder decision, 2026-10-19; a hosting
choice recorded here, not something the code can show), so it runs the process every
request above passes through. Since 2026-10-19 the notice names Railway, Supabase and
Upstash beside those roles; it makes no claim about what any of them keeps.

**Account deletion requests purchase-processor erasure.** After verified recent bearer
authentication and the existing account check, `POST /account/delete` calls RevenueCat's
`DELETE /v1/subscribers/{app_user_id}` with the verified caller's id and a server-only
secret. Only documented 200 (queued) or 404 (absent) permits Supabase identity deletion.
No GET is made, since its subscriber endpoint can create a missing customer. Missing
configuration, refusal or network failure leaves the Luvani identity available to retry.
If identity deletion fails after processor acceptance, retry can safely use 404.

The founder authorized this F499 policy on 2 October 2026. RevenueCat documents an
asynchronous queue, so neither code nor notice claims that every vendor record has
already gone. Vendor-side retention remains unverified, and store subscription
cancellation still happens in the store. No audio, learner words or learning data is
sent in the erasure request. No real customer was deleted during implementation.
Primary reference: https://www.revenuecat.com/docs/api-v1/customers#tag/customers/operation/delete-subscriber.

The rule for anyone extending this: a feature that needs to keep a recording is a
new consent, a new retention period and a new disclosure, and it is an escalation
before it is a branch.

**Session eval (2026-10-23, synthetic and dev text only).** The playground's session eval
(`services/brain-playground/src/eval/sessionEval.ts`) scores tutor conduct turn by turn. Its
record format accepts only `synthetic` records (hand-written fixtures) and `dev` records (the
founder's own playground chats, kept in a gitignored folder). The tutor agent records nothing for
it. Scoring real beta transcripts would mean keeping learner text for staff review, which no
current consent covers. The escalation and the shape it would take are in
[changes/session-eval.md](changes/session-eval.md). `eval:beta-numbers` reads only a local export
of the six content-free `live_session_finished` fields.

**Speech dataset groundwork (2026-10-22, inert).** The escalation for a consented,
teacher-rated set of lesson recordings is
[docs/changes/speech-dataset.md](changes/speech-dataset.md) (VOICE-007). Its
groundwork is in the repo and collects nothing:
- the tutor agent's clip seam offers nothing unless `LUVANI_SPEECH_DATASET=1` and
  the learner's consent bit are both on, and no production code sets that bit
  (a source-scan test fails if any does);
- the Settings switch is hidden behind `SPEECH_DATASET_ENABLED`, which is false;
- the metadata table (migration 42) is prepared and not applied;
- no storage bucket exists.

Every sentence above about live audio stays true until that doc's legal review
changes this section, the notice and their pinned tests together.

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

Luvani records sixteen events: fourteen device events and two authoritative server facts. They exist so product decisions are made on evidence
rather than on the loudest opinion in the room, and they are content-free by
construction, not by good intentions.

| Event | Properties | What it can never carry |
|---|---|---|
| `onboarding_completed` | `personalisedGreeting` alone, one boolean | The name itself, the date, why they are learning |
| `mission_started` | `missionId`, `entry` | Anything the learner said |
| `mission_completed` | `missionId`, `rung` | The words that earned the rung |
| `sound_check_completed` | `missionId`, `kind` | The audio, the focus sentence, any score |
| `my_french_opened` | `situationsDone`, `linesKept`, both counts | The phrases themselves |
| `wall_shown` | Closed `entry`, count `pages` | Learner content or prices |
| `wall_page_seen` | Closed `page`, count `index` | Learner content |
| `plan_selected`, `purchase_started` | Closed paid `plan` | Store account or price |
| `purchase_settled` | Closed paid `plan`, closed `outcome` | Receipt or store account |
| `restore_started` | Closed `entry` | Store account or a guessed paid plan |
| `restore_settled` | Closed `entry`, closed `outcome` | Receipt or store account |
| `wall_left` | Closed `entry`, `outcome`, `destination` | Learner content |
| `live_session_finished` | Closed `kind`, boolean `voice`, counts `turns`, `rescues`, `unassistedPct`, nullable count `replyLatencyMs` | Anything said or shown, why they are learning, the lesson or scene |
| `trial_started` | No properties, service-only | Antifraud markers or learner content |
| `minutes_refused` | Closed `plan`, `reason`, service-only | Utterances or exact balance |

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

**What is true today:** every device event passes `analyticsAllowed` in
`apps/mobile/src/analytics/consent.ts` before the network call, inside the `try` that
already swallows failures, and only a stored literal `true` counts. A learner who has
not answered emits nothing. Session starts read that same device-local choice afresh
and send only a literal permission boolean. The service-only trial RPC records only
its own newly inserted trial, never a later opt-in or an existing paid account.
Its analytics insert has a separate savepoint, so failure cannot undo the trial.
Minutes events are attempted only for consented `exhausted` or
`insufficient-for-session` refusals, not lapse or antifraud refusals; an outage can
lose optional evidence. The client parser and the database trigger refuse
client-written trial/minutes names. Restore evidence is bound to the requesting
account and scope. A pending or failed Off write masks the previous on-disk Yes in
this running app. An already dispatched request can finish after withdrawal;
withdrawal cannot recall it. No permission history or server consent table was
introduced. `public.product_events` rows are still kept forever: the
thirteen months below is stated in the published notice and no scheduled delete
enforces it.

**What must be true before real learners arrive:**

1. **Disclosure before collection.** The privacy notice in Settings names the fifteen
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
`learner_state`, `product_events`, `entitlements`, `session_usage`, `session_grants`, `billing_events`
and `conversation_packs`. On the
device, `clearActiveUserData` erases every per-account key in `USER_KEY_SUFFIXES`,
and `App.tsx` deliberately holds the local session open until that finishes so the
namespace can still be resolved. If the local erase fails the learner is told
plainly that the online account is gone but this device still holds a copy.

**What deliberately survives.** `public.trial_installations`, for the reason above.
On the device, `luvani.installation.v1` and the legacy-migration marker survive,
because the installation signal is exactly the thing a fresh account must not be
able to reset. Neither carries learning, content or identity.

**What stays outside our deletion guarantee.** The purchase processor accepts a queued
erasure request before Luvani removes the identity. Its completion and any vendor-side
retention are not verified. Store subscriptions and store-held payment records are
separate, so the notice directs the learner to cancel a subscription in the store.

**What is not proven.** The cascade has never been executed against a live
database, and the device wipe has never been run on a real iOS or Android build.
Both are open ledger work (F63, F71), and neither may be described to a learner as
verified until it is.

**Export.** Settings' **Download my data** writes a JSON file containing every
per-account device key and, for a Supabase account, the authenticated learner's
account metadata and rows from `learner_state`, `product_events`, `entitlements`,
`session_usage`, `session_grants`, `billing_events`, `conversation_packs` and opted-in `saved_conversation_text`, plus owned social records. `GET /account/export` takes no user id: it
resolves the bearer first, requires a real sign-in within five minutes, rate-limits
the request by IP and account, and filters
every table by that resolved id. It includes explicitly saved conversation text and word-free deletion markers. It
deliberately excludes raw learner audio (not stored), access tokens, and `trial_installations` (the antifraud HMAC is
pseudonymous: the server can recompute its keyed hashes to match an account or
installation, and the marker is retained separately after account deletion). A local-development account exports
its device data and says that it has no server copy.

The Upstash guest record (`luvani:guest:*`) is also not part of the account export. Before a claim it is keyed by a hash of a guest token, not by an account, so the export cannot find it by the resolved user id. After a claim it shrinks to a word-free link (ids, installation hash, scene turn ids, analytics choice) that lives at most 48 hours. What the learner kept from the scene, the French lines, is already in the exported phrasebook state. Exporting the transient link would add an antifraud hash to the file without giving the learner any of their own content.

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

Age remains an eligibility gate rather than a collected birth-date field. C2
uses the linked 13+ Terms declaration accepted by deliberate Start/Create or
repair Continue, without a separate age question. A known refusal cannot be
bypassed by that action. A learner who says mid-session that they are under 13
still hits the same `stop`; this UI change is not age verification.

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

### An under-13 answer before an account keeps nothing

The former first-run age-question controls are retired in C2. Its linked Terms
declaration precedes the deliberate action that starts processing or account
creation. Existing known underage/refusal paths still show the calm refusal
surface and prevent continuation. When that refusal occurs, nothing about the
learner is kept:

- **It clears the draft.** The first-run draft on the device goes, and with it
  the voice, the plan's answers, the page reached and any first name typed.
  `onRefuse` in `onboarding/PreAccountOnboarding.tsx` reaches
  `discardPreAccountDraft` in `App.tsx`, the same discard every link to sign in
  runs. After it, `keep` writes nothing for the rest of the launch, so moving
  between the pages cannot put the draft back.
- **It sends nothing.** There is no account yet, the first-run pages carry no
  analytics sender and no network call, and the refusal adds none.
- **It stores no marker.** The refusal lives in memory only. `Gate` in
  `App.tsx`, which stays mounted for the whole launch, holds it above the first
  run and the sign-in door, so leaving through "I have an account" and coming
  back opens on the refusal page again, and sign-in's "Create an account" leads there
  too. `PreAccountOnboardingDraft` has no field for it, and nothing writes it to
  the device. Signing in and out again does not end it; only closing the app
  does. On a shared phone, that means an adult who signs out later in the same
  launch meets the refusal page until the app is reopened.

**The ceiling, plainly.** Because nothing is stored, a relaunch starts at the
first page with nothing kept and presents C2's linked declaration again. That is
the same close-the-app escape retained for a mis-tap. Holding the refusal
past a relaunch would mean storing a note about a child on the device, with a
retention period of its own. The founder chose not to (2026-09-30, F637 and
F639), and changing that is a founder and legal decision, not an engineering
one. It is listed again in [Not true yet](#not-true-yet).

This differs from the stop above on purpose. That stop belongs to a signed-in
account and sits in its profile until the gate is passed. Before an account
there is no profile to hold it, and a store made only to remember a refusal
would itself be data about a child.

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

Both the conversation agent and scripted lesson agent now inspect their own output. The scripted agent buffers the whole reply before delivering any text or speech: at most 8 KiB, 1,024 SDK chunks and 10 seconds. Unsafe output, unexpected tool calls and oversized replies receive an authored continuation; timeout or stream failure ends the session as a service failure. Buffering adds latency that still requires physical voice acceptance. These deterministic checks are a containment measure, not proof that every unsafe reply can be detected.

## Escalation and what Luvani is not

**Luvani is not an emergency service.** It is not a crisis line, not a counselling
service, not a safeguarding service, and not monitored. Nobody is watching a
session. Nobody is on call. Nothing a learner says or types in a session reaches a
human, at any hour. The one way to a person is an email the learner chooses to
write (the beta report route below), and it is read in working hours, not watched.

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
9. The worker closes the usage ledger, cancels live frame and turn requests,
   and skips memory extraction, curation and drill generation. No practice pack
   is saved for a safety stop. The stop message still finishes playing before
   the room disconnects.

A learner choosing to leave an ordinary session is different. The founder chose
on 2 October 2026 to cancel live replies while the saved recap and practice pack
finish in the background. A deterministic baseline pack is saved before the
slower enrichment, and repeated finish calls await the same work. These bounded
calls can continue after the microphone and room close; a failed-session refund
rule remains a separate founder decision.

Point 7 is the honest tension in this document. Retaining nothing is the
strongest privacy position available and it is the one we take, and it also means
Luvani has nothing to escalate *with*. We accept that trade knowingly: a language
app that quietly builds a file on what its learners said in distress is a worse
product than one that admits it cannot help and gets out of the way.

**The beta reporting route (22 October 2026).** Three rules were set before any
code was written: it carries no transcript by default, it says on the screen that
it is not an emergency route and how long a reply takes, and it exists only once a
named human is accountable for reading it. What was built meets them like this:

- "Report this reply" sits on the live room (a small flag beside the scene title)
  and on both end cards ("Something felt off? Tell us"). It is never on the
  safety-stop surface, which keeps its one way out.
- The in-room flag never leaves the app. Its sheet says "Tell us when this session
  ends, so you keep your place", and "Report at the end" saves the report for the
  end card (the flag then shows as filled, "Report saved for the end of this
  session"; tapping it again offers "Cancel the report"). The reason is that
  opening Mail mid session drops the room: on web the `mailto:` link replaces the
  page and LiveKit disconnects on unload, and on iOS the app has no background-audio
  mode. When the session ends, the recap or lesson summary opens the mail sheet
  ("Tell us what felt off") by itself; the room's own sheet keeps the title
  "Report this reply".
- On the end cards the sheet opens the learner's own mail app to the support
  address in `apps/mobile/src/legal/company.ts`. Luvani sends nothing itself.
- The subject is a reference and nothing else: the session id and the app version
  (`apps/mobile/src/settings/reportMail.ts`). There is no body. Nothing the learner
  said is attached, because nothing is kept to attach. This is the one exception to
  `openMail`'s no-prefilled-text rule, and the reason is in its doc comment: without
  the session id a report cannot be matched to the usage ledger or the worker's log
  lines.
- The sheet says the founder's promise, "We read every report and reply within two
  working days", and "This is not an emergency line. If you are in danger, call
  your local emergency number."
- The accountable reader is the founder, who reads the support mailbox (decided by
  the founder on 22 October 2026). Anything a report raises that is on the list
  below goes to the founder or legal, not into code.

A staffed in-app workflow (one that sends without a mail app, or carries an
optional excerpt the learner chooses) is still owed before public launch, and it
would have to meet the same three rules.

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
safety analytics event remains out: the founder-authorized Report 45 funnel additions
carry no safety category, rule or disclosure. A server-side counter is out because it is new storage
for a question `grep` already answers.

**Nothing watches this line.** It is read after the fact, by whoever can read the
worker's logs, to answer how often the boundary fires and on which rule. Nobody
is alerted, nobody is on call, and no session is looked at because of it. It
changes nothing above: there is still no escalation route, the only reporting
route is the learner's own email, and a log line is not the start of either.

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
- Whether an under-13 answer before an account should outlast a relaunch, when
  holding it would mean storing a note about a child on the device.
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
  French. Its second section (VOICE-015) keeps sad news out of that path: a
  learner who says someone they love has died or is ill gets a short, kind
  answer, the choice to take a moment or keep going, and no goodbye. Code backs
  it: `sharesSadNews` in `packages/brain/src/engine/sadNews.ts` marks the turn,
  and a marked turn can never be the one that ends the session. It is not a
  safety category and never stops or logs. Grief lines are in the ORDINARY
  corpus in `safety.test.ts`, and grief that also says the learner wants to die
  still stops exactly as before. Before it existed this was design rather than code: grepping both
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
| Vendor-side retention for LiveKit, Deepgram, ElevenLabs and Speechace is unverified, and so is the language model vendor's (OpenAI in production), and so is the purchase processor's, and so is TonePerfect's, whose own statement (audio deleted once scored, the assessment kept at most 24 hours) nobody here has checked, and so is TypeSafe's, which reads own-words drill answers whenever `TYPESAFE_API_KEY` is set, and so are Railway's, Supabase's and Upstash's | The privacy text cannot yet describe what any of them keep, and a vendor's statement is not a substitute for checking it | Not filed |
| Purchase-processor erasure has not been observed against a real account | The queued request is implemented and tested with fixtures; its live completion and vendor-side retention remain unverified | Ledger F499 external verification |
| Attempt recordings are deleted in code, but that has never been watched happen on a device | The discard and the reset sweep are proven by test only; a phone has never been checked | Ledger F115 (closed), device proof owed by F114 |
| The deletion cascade has never run against a live database | "Deletion removes everything" is unproven | Ledger F63 |
| Device deletion and token hygiene are unproven on a real build | The device half of deletion is unproven | Ledger F71 |
| No professional review has been obtained | The safety position is unreviewed | Ledger F70 |
| An under-13 stop is remembered on the device that saw it, not on the account | A reinstall clears it, and a second phone never learns about it | This file, section above; founder accepted |
| A known under-13 refusal before an account lasts the launch and no longer | Relaunch retains no refusal note; C2 shows its linked declaration rather than restoring the retired age question. This is not verified age assurance | This file, section above; founder cleanup decision, 2026-09-30; C2 presentation, 2026-10-14 |
| Worker logs have no stated retention | The safety record is kept for as long as the host keeps logs, which nothing here sets | This file, section above |
| Buffered scripted speech latency has not been measured on a device | Both agents check output; scripted replies wait for a complete inspected utterance within 8 KiB and 10 seconds | Backend A19/A30 release acceptance |
| No reviewed privacy policy or terms exist | The app says professional review remains required before release; it must not present an unreviewed document as a legal promise | Release roadmap, Phase 8 |

## Explicitly saved conversation text (2 October review branch)

The founder authorized opt-in text with per-conversation deletion. The final recap
page offers Save conversation text; it sends nothing before that deliberate tap.
The client captures confirmed wire text in memory, including typed topics/replies and tutor coaching,
separately from the last forty displayed turns. Recognition can differ from speech.
The whole buffer becomes unavailable on overflow rather than silently truncating;
leaving, scope reset and safety stops discard it. No audio, new model request or
learning evidence is added by saving text. Losing the room before choosing Save
loses this ephemeral copy.

The authenticated caller owns every read, save and delete. Service-only SQL RPCs
require an owned session-usage row and an agent-owned ready practice pack; safety
stops retain only the last clean, database-acknowledged baseline, if one exists; later unacknowledged content is discarded. A recap can arrive before those reports: the save retries
three times at most while the owner still matches, then explains that preparation
is pending and offers another deliberate attempt. The first accepted payload is
immutable. Deletion blanks the payload and keeps a word-free session fence, so
a delayed or retried save cannot restore the words. That marker is included in
the account export and cascades with the account. Curated
practice deletion and text deletion are explicitly separate choices.

The library loads up to ten conversations per request with a timestamp/session cursor that keeps PostgreSQL microseconds intact. It uses exact range counts to expose older pages even when a database row cap returns fewer than requested. Account export reads all sixteen owned server tables in one service-only statement snapshot, separate from the Auth-admin account metadata. It checks row counts and bytes before building that snapshot and fails the whole preparation if a table exceeds ten thousand rows or the archive exceeds thirty-two megabytes. It has no partial-data fallback. Disposable SQL tests exercise ownership,
completion proof, immutable retry, delete-before-save, save-before-delete, role
permissions and cascade sequentially; concurrent live PostgreSQL and device QA
remain unverified. The new migration has not been applied to a hosted database.

### Confirmed service-failure settlement (3 October 2026, code only)

Founder-approved rule: return only the affected session's actual charged seconds
when a recognized terminal Luvani pipeline error ends a live session with its
learner present. Ordinary exits, learner-side disconnects, time limits and safety
stops retain their prior billing rules. Recoverable voice errors keep teaching.
Refund records contain a closed failure kind and seconds, never raw vendor errors,
learner words, recordings or a new transcript. Issued grants are separate from
completed-session proof. Current-period credit, historical reversal, no charge,
pending transport and legacy reconciliation have distinct acknowledgements.

Prepared migration 20261002233520 has not been deployed. Hosted operation, native
delivery and reconciliation of crashes before a failure report remain release
checks. There is no implemented scheduled grant cleanup or durable failed-refund
queue; do not promise automatic completion after a worker crash.

On 3 October the founder approved saved-phrase audio ceilings of $0.02 lifetime
trial, $0.20 paid-account per anchored thirty days and $10 app-wide per anchored
thirty days. Prepared migration 26 enforces maxima without resetting spends.
Generation remains disabled; these bounds do not verify actual vendor rates or
playback and do not cap all live tutoring charges.


### Default-off can-do and correction-repair TypeSafe purposes
The conditional public notice now covers two additional purposes, both dark.
The worker can-do reader sends only the authored can-do and at most eight exact
accepted-goal fragments with transient source IDs. No account, session, name,
profile or level goes to TypeSafe. Code selects the fixed outcome and projects
one exact source only after this session's first independent complete win and
strict pinned-model Choice distributions clear the report's 0.8 threshold. No
transcript or achievement is added. Room exit and safety/service failure cancel it.
The phone binds the result to the issued session, observed independent win and
exact current learner line. No French calibration artifact is approved.

The distinct Fix your line Noul sends only original, better and learner_retry,
without the reason, level, account or profile. A pinned jev-1.13.0 finite Noul at
least 0.9 can remove the correction brain call. Every uncertain/malformed/provider/
timeout result preserves the same correction brain request; departure starts no
fallback. Returned Jev usage is numeric/model-only and metered even if late.
A separate default-zero switch and real-French approved artifact are required;
approvedFixLineCalibration() returns null, so no normal request reaches TypeSafe.
The public notice says today's direct model routing and the future conditional
shortcut separately. No transcript, grade, recording or new table is written.
Real French/ASR calibration and both vendors' retention/use remain unverified.


### Default-off authored live correction reasons
A third additional TypeSafe purpose, also dark, receives only a confirmed attempt
fragment and its exact guarded correction. Closed authored reason IDs plus none
are compared with strict complete Choice distributions under pinned jev-1.13.0.
The report gives no threshold; an approved real-French artifact must supply it.
No artifact exists. No account/session/profile/level goes to TypeSafe, and no
new durable record is written. Issued-session, published view ID/index and exact
pair bind the optional wire to an existing learner recast on the phone. The live
Why? link appears only for accepted authored copy, never the generated why;
existing recap/drill why remains unchanged. At most three optional requests per
session, one active, with a 2.5-second bound. A newer input before the turn queue,
finish, safety/service failure or room departure cancels it. Late results cannot
publish, but returned usage is still metered. Cancelled TypeSafe retry waits
check cancellation before sending again. Vendor retention remains unverified.

### 4 October production-hardening supersession (repository only)

Current authoritative tutor lifecycle has durable clean learning checkpoints, completion receipts, refund reconciliation and a room-stop outbox. The earlier3October statement that no scheduled grant cleanup exists describes that dated baseline; the prepared maintenance role now performs reconciliation, but no hosted worker or schedule was verified. A safety stop saves no new unsafe pack or analyst data; an earlier clean acknowledged baseline can remain.

Current account export stages a coherent16-dataset snapshot with128MiB/2048-fragment ceilings and streams verified UTF8 fragments into private device files. Old32MiB/10000-row description above is historical. Excessive historical exports fail explicitly and require an operational complete-export path. Account-switch/failure/crash cleanup is tested locally; physical sharing/storage behavior remains unverified.

Current account deletion immediately fences identity and returns202pending while durable processor/identity/journal retries complete. The independently encrypted off-backup journal must survive restore and its key/coverage/replay must be exercised. A completed restored job cannot reuse old processor approval when identity/content reappears. No synchronous erasure or deployed durability claim is made.

All newly accepted conversation packs are≤512KiB. Library pages contain≤20entries and≤1MiB; exceptional historical entries appear explicitly as unavailable instead of blocking the page. Individual historical packs≤1MiB may remain readable; giant records require export/support. Cache contains≤200packs, so its derived summaries do not establish all-history totals.

Retention expiry remainsOFF until reviewed periods and activation. Financial/idempotency evidence survives speaking-detail expiry. Unknown legacy timestamps need operator remediation. Docker's proposed stdout rotation bounds file bytes, but neither deployed logging nor time-based log retention is established.

Production paid requests are guarded by immutable reviewed quotes, finite provider attempts and exact configuration/quantity ceilings; no tariff is inferred. ElevenLabs live and saved-phrase requests use enable_logging=false; Deepgram streaming uses mip_opt_out=true. These switches do not verify contracts, retention, model-training treatment or cancellation invoice behavior. Unbounded/experimental TypeSafe, TonePerfect, Fish, Flux and Eleven WS adapters cannot be enabled in this production artifact. Optional memory/curation may run for≤5s inside the active paid lease before completion; learner billing stops at finish, and unsafe/paused/expired sessions skip that work.

### October starter update

The modern first run uses `onboarding/disclosure.ts` for AI and bounded-starter processing facts before Start. Goal and routine questions make no network request. Speaking submits a short take to Deepgram for transcription, the recipient the start sheet already names before processing. In production it is offered only when the server's guest speech admission is switched on and has budget left (founder decision D13, F735); otherwise, and once any budget is full, the learner continues with typing. Production cuts a decoded take to the reserved twenty seconds before it is sent. Typing submits text for authored checks, not a free-form live tutor. Local capture is discarded after consumption and on interruption. Device cleanup and vendor retention are distinct; real-device cleanup and vendor configuration still require validation.

The guest capability/usage/ownership ledger contains hashed installation metadata and counters for thirty days, with online attempts expiring after twenty-four hours. It holds no replies or recordings. Guest speech budgets are seconds counters under a hashed capability, a hashed installation, a hashed network address and the UTC day; they expire after two days and hold no audio, text or raw address. Explicitly opted-in aggregate event counts contain closed event/variant/evidence enums and expire at ninety days; no answer, words, account or install ID enters them. Analytics and tutor learning memory start off independently. The local guest record retains bounded replies and feedback until explicit adoption/discard or app-data clearing. Authentication alone does not silently import it. See `docs/ONBOARDING.md` and `docs/STATE_AND_STORAGE.md` for ownership, metering and reinstall limits.

The C2 journey replaces the explicit age-question control with a linked Terms
and Privacy notice before first processing. Terms declare that Luvani is for
learners aged 13 and over. Only deliberate Start practice, Create account,
account provider actions or repair Continue accept that notice; reading a link,
arriving on a page or typing a field does not. This is a minimum-age declaration,
not age verification or professional legal review. Existing eligible-only server
admission and live underage safety stops remain in their current owners.

A known under-thirteen/refusal state still clears guest and draft writes, sends
nothing and stores no refusal marker. It holds through sign-in, sign-out and
new-account navigation for the remainder of the launch. Relaunch starts with
nothing kept; the old question is not reintroduced. The historical draft can
contain an optional first name; the modern journey asks for no name. The used-app
marker is written only after a completed account reaches the app, independently
of refusal. A daily reminder remains attached to its plan: known refusal,
“Start a new plan instead” and sign-in's “Create an account” retain the existing
device cancellation. Reviewed Terms/privacy and production release qualification
remain outstanding; this UI change establishes neither.


### First live practice candidate, 10 October 2026

The local implementation in [FIRST_LIVE_PRACTICE.md](FIRST_LIVE_PRACTICE.md) replaces the authored starter with the existing live room. LiveKit carries audio, Deepgram transcribes it, the configured AI provider receives the selected closed plan and conversation, and ElevenLabs provides the selected tutor voice. Confirmed contributions and the plan remain on-device. A bounded acknowledged learning summary is temporarily held in the guest capability store for at most thirty days, transferred by an idempotent account-owned Conversation Pack upsert, and removed from the guest record after successful transfer. Raw guest audio is not retained. Safety stops discard the guest learning summary and earn no completion or charge. Production guest live conversation remains disabled pending guest paid-admission and release/privacy qualification; this is not a claim that the hosted system has changed. This applies to the guest convo only. The guest first scene (UI-011) is a separate scripted path: five fixed turns, at most 180 seconds, no language model, no scoring and no memory. Audio streams to Deepgram, fixed lines are voiced by ElevenLabs (usually from cache) and LiveKit carries the room; no OpenAI, Anthropic or Speechace call is made and raw audio is not stored. Production turns it on only with `LUVANI_GUEST_SCENE=1` (see "Guest first scene" in `BACKEND_RELEASE_RUNBOOK.md`).
