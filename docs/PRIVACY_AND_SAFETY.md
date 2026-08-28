# Privacy and safety

This is the policy for what Parle collects, why it collects it, how long it keeps
it, who can read it, and what the tutor does when a learner says something the
product must not answer.

Read it as two things at once. Most of it **describes code that exists today** and
exists so the behaviour cannot drift without someone deciding to change it. A
smaller part **states what must become true before real learners arrive**, and
every one of those is collected in [Not true yet](#not-true-yet) rather than
scattered through the prose where it could be mistaken for a promise already kept.

Nothing in this file is a substitute for a reviewed privacy policy and terms.
Neither exists. The app says so in plain words in the Profile footer, and inventing
them would be worse than their absence.

`docs/STATE_AND_STORAGE.md` says where the learner's data *lives*. This file says
what we are allowed to do with it.

## What Parle holds

Every durable store, with the retention that governs it. A row whose retention says
"not true yet" is honest about a gap and appears again at the bottom of this file.

| What | Where it lives | Why | Retention | Removed by |
|---|---|---|---|---|
| Email, name, sign-in provider | Supabase `auth.users` | There is no account without them | Life of the account | Account deletion |
| Age confirmation, and a date of birth for learners who joined when Parle asked | Device, `parle.u.<uid>.profile` | The 13+ gate, which is a gate and not a field | Life of the account on that device | Reset progress, account deletion |
| The moment a session stopped because the learner said they are under thirteen | Device, `parle.u.<uid>.profile`, field `ageStopAt` | Keep the tutor doors shut until the age gate is answered again | Life of the account on that device, cleared the moment they pass the gate | Passing the age gate, reset progress, reinstall, account deletion |
| Learning state: history, review deck, journal phrases, missions, topics, drills, sound-check evidence | Device, `parle.u.<uid>.*`, and `public.learner_state` once sync ships | It is the product | Life of the account | Reset progress, account deletion, cascade |
| Five content-free product events | `public.product_events` | Product decisions | 13 months from `occurred_at` | Scheduled delete, cascade |
| Seconds of voice per session | `public.session_usage` | Bill each session at most once | 24 months from `reported_at` | Scheduled delete, cascade |
| Plan and seconds used | `public.entitlements` | The allowance | Life of the account | Cascade |
| Two salted antifraud HMACs | `public.trial_installations` | One free trial per installation | 24 months from `claimed_at` | Scheduled delete only, never account deletion |
| Rate-limit counters and session leases | Upstash, `parle:*` | Abuse and cost limits | The window TTL, 60 seconds to 24 hours | Key expiry |
| A random installation id | Device, `parle.installation.v1` | The input the antifraud HMAC is made from | Until app data is cleared | Clearing app data, uninstall |
| One content-free line per safety decision | Agent host logs, worker stdout | Know how often the boundary fires, and on which rule | Not true yet: whatever the host keeps, and nothing here sets it | Nothing in this repo |
| Synthesised tutor lines as WAV | Agent host disk, TTS cache | A voice vendor should be paid once per line | Indefinite, tutor speech only | Deleting the cache directory |
| Learner utterance audio | Never written anywhere | See the next section | Never written anywhere | Nothing to remove |

Two things are deliberately absent from that table. There is no advertising or
attribution identifier of any kind, and there is no third-party analytics SDK in
the app. Adding either is an escalation to the founder, not an engineering choice.

## Raw speech is never stored

**Raw learner audio is never stored.** No file, no bucket, no table, no log line,
no vendor archive we opt into. The bytes exist while they are in flight and then
they are gone.

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
  `missionId`, `reference`, `at`, `kind` and one learner-safe `focus` sentence.
  Never audio, and deliberately never a numeric score.
- Transcripts are the same rule. Deepgram returns text so the tutor can answer; the
  session engine grades it and drops it. What survives a session is the journal's
  kept phrases and the learner model, both on the device, both the learner's own.

Audio does leave the device to four vendors while a session is live: LiveKit
carries it, Deepgram transcribes it, ElevenLabs speaks the tutor's side, and
Speechace scores a pronunciation attempt. What each vendor retains on its own
side is a vendor question and is **not verified** by this repo. Naming their
retention in the learner-facing privacy text is a launch blocker, listed below.

The rule for anyone extending this: a feature that needs to keep a recording is a
new consent, a new retention period and a new disclosure, and it is an escalation
before it is a branch.

### Disclosure at first run

What a learner is told, before they say anything out loud, lives in
`apps/mobile/src/onboarding/disclosure.ts` as exported constants, and
`disclosure.test.ts` holds them. It is one module because it feeds three surfaces
in the order a learner meets them: the welcome subline before an account exists,
the Meet Luc page immediately before the first scene, and TutorIntro's persona page
at the door of the tutor. Before it, the first run said nothing about AI at all and
introduced Luc with a biography. `FIRST_RUN_SURFACES` names the three, and the test
`every first-run screen reads its AI disclosure from one module` fails if a screen
stops reading from here and starts writing its own version.

Four rules, each with a test behind it:

- **AI is said plainly**, in the word itself, in the first sentence a learner reads.
  The persona stays and is introduced as a persona. A character is not a lie;
  presenting one as a biography to somebody who does not know they are talking to
  software is.
- **No person hears you**, said out loud rather than left to be inferred, because it
  is the same position this file takes in [Escalation and what Parle is
  not](#escalation-and-what-parle-is-not) and a learner decides what to say before
  the scene, not after it.
- **One vendor vocabulary.** The line about where speech goes is the Profile
  footer's words, character for character, and the test reads both files. Two
  sentences about one pipeline is how a document and a screen start disagreeing.
- **No policy that does not exist.** Terms and a privacy policy are not written, so
  nothing in the first run implies a document, a certification or a guarantee behind
  it. The microphone line stops at the ask and makes no claim about what happens to
  the audio, because the attempt recordings in [Not true yet](#not-true-yet) mean
  this repo cannot honestly make that one yet.

The antifraud identifier is still not disclosed anywhere, including here. When that
text is written, this module is where it goes.

## Analytics: consent, opt-out and retention

Parle records five events. They exist so product decisions are made on evidence
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
removed in TypeScript is not a property removed from Parle: the compiler holds only the
client's half of this, so the parser, the trigger and this table are a manual step every
time.

**What is true today:** the five events fire from seven call sites in the app with
no consent gate, no opt-out anywhere in the UI, and `public.product_events` rows
are kept forever.

**What must be true before real learners arrive:**

1. **Disclosure before collection.** The Profile legal text names the five events
   in plain words, says they carry no learner content, and says how long they are
   kept. It says the same thing this file says.
2. **A real opt-out.** One switch in Profile. When it is off, `trackProductEvent`
   returns before the network call, so an opted-out learner emits nothing rather
   than emitting something the server discards. The switch is per account and is
   readable back, so a learner can check what it says.
3. **Analytics is never a condition of use.** Nothing in the product degrades
   because a learner opted out. `trackProductEvent` is already fire-and-forget and
   already swallows its own failures; that stays.
4. **13 months, then gone.** A scheduled delete removes `product_events` rows older
   than 13 months. Thirteen rather than twelve so one year-over-year comparison is
   possible, and no longer.
5. **Opting out is not retroactive deletion.** A learner who wants the past removed
   as well deletes their account, which cascades. If we ever offer erase-events
   without account deletion, it goes in this file first.

## Antifraud identifiers: purpose, retention and disclosure

`public.trial_installations` holds two values per claimed trial:
`installation_hash` and `first_user_hash`. Both are 43-character base64url
HMAC-SHA256 digests computed by the token server with the deployment secret
`PARLE_RATE_LIMIT_SALT`, through `privateSignal` in
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

**Salt rotation is deletion.** Rotating `PARLE_RATE_LIMIT_SALT` makes every stored
hash unmatchable. Rows made under a retired salt are dead weight and must be
dropped in the same change that rotates it, not left behind.

**Disclosure.** This identifier is **not disclosed to learners today**, and that is
the gap this section exists to close. Before launch the privacy text says, in the
learner's words: Parle keeps a scrambled marker for the device the free trial was
claimed on, so the trial cannot be claimed twice; it is not linked to any advert,
it is not shared, and it is kept for two years.

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
`learner_state`, `product_events`, `entitlements` and `session_usage`. On the
device, `clearActiveUserData` erases every per-account key in `USER_KEY_SUFFIXES`,
and `App.tsx` deliberately holds the local session open until that finishes so the
namespace can still be resolved. If the local erase fails the learner is told
plainly that the online account is gone but this device still holds a copy.

**What deliberately survives.** `public.trial_installations`, for the reason above.
On the device, `parle.installation.v1` and the legacy-migration marker survive,
because the installation signal is exactly the thing a fresh account must not be
able to reset. Neither carries learning, content or identity.

**What is not proven.** The cascade has never been executed against a live
database, and the device wipe has never been run on a real iOS or Android build.
Both are open ledger work (F63, F71), and neither may be described to a learner as
verified until it is.

**Export.** There is no export today beyond the words file the Summary screen
writes. A learner asking for a copy of their data is answered by hand until an
export route exists. That route, when it is built, returns the learner's own rows
and never another account's, and it is not a place to invent new retention.

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
| `under-13` | `stop` | Parle is not available for anyone under 13. Please stop here and ask a parent or guardian for help. |
| `minor-sexual` | `stop` | I cannot help with sexual content involving anyone under 18. |
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

> Parle is made for learners thirteen and up. Everything you have learned is still here.

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

## Escalation and what Parle is not

**Parle is not an emergency service.** It is not a crisis line, not a counselling
service, not a safeguarding service, and not monitored. Nobody is watching a
session. Nobody is on call. No message a learner sends reaches a human, at any hour,
by any route.

Saying that clearly is the policy, because the alternative — implying that
something is watching — is the failure that gets somebody hurt. The tutor's own
stop message models the tone we hold ourselves to: it says what Parle cannot do,
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
   still model work paid for on a session that ended. That is ledger F189, and it
   is a founder decision rather than an engineering one.

Point 7 is the honest tension in this document. Retaining nothing is the
strongest privacy position available and it is the one we take, and it also means
Parle has nothing to escalate *with*. We accept that trade knowingly: a language
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
[parle] SAFETY_DECISION session=7f3c1a20 category=minor-sexual action=stop rule=R2 mode=convo voiceless=false
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
  last clause needed no child at all, so two adults making plans were told Parle
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

Not a certification, not sign-off that Parle is safe, and not clinical advice
routed to learners. We are asking whether the boundary, the copy and the stated
position are defensible for a consumer language app with no human in the loop, and
what we should change.

## Not true yet

Every gap this document depends on, in one place, so none of it can be read as a
promise already kept.

| Gap | Consequence | Where it is tracked |
|---|---|---|
| No consent gate and no analytics opt-out in the UI | The five events fire for every signed-in learner | This file, section above |
| `product_events` and `session_usage` have no scheduled delete | The 13-month and 24-month retentions are policy, not mechanism | This file, table above |
| `trial_installations` has no scheduled delete | The 24-month antifraud retention is not enforced by anything | This file, section above |
| The antifraud identifier is not disclosed to learners | Undisclosed pseudonymous identifier at launch | Risk register, P0 before users |
| Vendor-side retention for LiveKit, Deepgram, ElevenLabs and Speechace is unverified | The privacy text cannot yet describe what they keep | Not filed |
| Attempt recordings are deleted in code, but that has never been watched happen on a device | The discard and the reset sweep are proven by test only; a phone has never been checked | Ledger F115 (closed), device proof owed by F114 |
| The deletion cascade has never run against a live database | "Deletion removes everything" is unproven | Ledger F63 |
| Device deletion and token hygiene are unproven on a real build | The device half of deletion is unproven | Ledger F71 |
| No professional review has been obtained | The safety position is unreviewed | Ledger F70 |
| An under-13 stop is remembered on the device that saw it, not on the account | A reinstall clears it, and a second phone never learns about it | This file, section above; founder accepted |
| Worker logs have no stated retention | The safety record is kept for as long as the host keeps logs, which nothing here sets | This file, section above |
| A stop does not stop the worker's post-session model work | Extract, curate and drills still run and publish into a room that is closing | Ledger F189 |
| The scripted lesson agent's own lines pass no output guard | `outputGuard` covers the conversation agent only | Not filed |
| No reviewed privacy policy or terms exist | The app says so honestly and must keep saying so | Deletion ledger |
