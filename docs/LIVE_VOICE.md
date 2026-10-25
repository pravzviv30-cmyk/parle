# The live path

## Recognition confidence (Report 2, item 35)

Both live agents wrap the public default `sttNode` event stream. Each provider
`FINAL_TRANSCRIPT` contributes the first alternative's confidence only when it
is a finite number from zero through one. Missing or invalid values contribute
to an unavailable count, never a zero. Numeric-only `[luvani:recognition]` lines
report final segment counts and the last value; counts reset per STT stream.
Segments can be parts of one utterance and are not completed learner turns.
No words, audio or identity are retained for this observation. Sink exceptions
cannot interrupt the event stream. No confidence grade or threshold is applied.
These numbers do not prove correct French recognition. The founder approved automatic TTS language detection after Alexandre time/money
A/B listening, then heard all six refreshed bilingual chooser clips. Live requests
omit `language_code`; live/saved cache identities change. Frozen French-only daily
and onboarding batches retain `fr`. This does not prove all voices normalize every
English number correctly.

Mixed-language recognition remains a review candidate. Normal Nova-3 behavior is
unchanged: multilingual conversation opening, French scenes and lessons.
`LUVANI_CONVO_ASR_EXPERIMENT=1` selects Flux Multilingual with French/English hints
only for conversations; it is OFF by default and has not been enabled in the
running/canonical configuration. Lessons and typing retain their existing path.
It does not enable eager model generation. Synthetic prerecorded and actual SDK
streaming probes found high-confidence errors in both candidates; this option
requires consenting beginner, interruption, room and end-to-end timing QA before
activation. It adds no grade, confidence threshold, saved transcript or recipient.

Current-scene recognition repair uses only the current support line and reply
options. Conservative sound-fold matches and the observed “sur place” confusion family
can replace a recognizer spelling error; an
ambiguous match, changed negation/quantity, unrelated speech, typed answer or
pre-scene topic remains untouched. The same interpreted text reaches the brain
and final transcript, whose caption says “Interpreted from your speech”. This is
an interpretation, never an audio pronunciation score or automatic lesson pass.
Nova-3 phase changes restart the active recognizer through the public Agent API;
a failed update reports a typing recovery message. The direct conversation path also receives a bounded current-turn keyterm
list through the active session’s public update seam. Experimental recognition and quote-bound paid proxy settings are unchanged;
repair still runs after recognition without another model request.

What happens between a learner tapping "start" and a tutor answering them, and
where every part of it can go wrong.

Four processes have to be running for any of this to happen. `npm run dev`
starts them in dependency order and stops them together; `scripts/dev.mjs` is
the supervisor and `services/shared/devPlan.ts` holds the decisions it makes.
The most common live-path failure by far is not in this document: it is that the
token server is not running, which surfaces as `server-unreachable` and a Demo
label on the Tutor tab.

## The route

```
app  ──POST /session/start──►  token-server
                                 ├ resolves the user (Supabase JWT, or trusts the
                                 │   asserted id when neither key is configured)
                                 ├ refuses if the balance cannot cover a viable session
                                 └ signs a LiveKit join token whose metadata carries
                                     { lessonId, startRung, mode, snapshot, seedTopic,
                                       secondsRemaining }
app  ──joins the room──────►  LiveKit
                                 └ dispatches the job to the tutor-agent worker
agent  ─reads the metadata──►  builds LuvaniTutor or LuvaniConversation
       ◄──── audio ─────────►  Deepgram STT (multi, then fr) → selected brain → ElevenLabs TTS
       ◄──── data channel ──►  the wire protocol below
agent  ──POST /session/end──►  token-server debits the metered seconds
```

The agent is **authoritative**. The app renders what it is sent and sends what the
learner did; it never decides a rung, a grade or an end card.

On a learner exit, live scene/turn requests and queued speech are cancelled.
The saved recap and practice pack still finish in the background, by the founder's
2 October 2026 decision. Completion is shared by repeated finish calls, so room
teardown can await the same enrichment. A safety stop instead skips post-session
model work and saves no practice pack; its safety message finishes before disconnect.

## The four modes

Signed into the join token, chosen at `/session/start`:

| mode | agent | speech | how the learner answers |
|---|---|---|---|
| `lesson` | `LuvaniTutor` | full pipeline | speaking, or tapping an option |
| `lesson-text` | `LuvaniTutor` voiceless | none at all | typing, or tapping an option |
| `convo` | `LuvaniConversation` | full pipeline | speaking |
| `convo-text` | `LuvaniConversation` voiceless | none at all | typing |

The `-text` modes are not a degraded fallback, they are the product working as
intended for someone who cannot speak aloud right now. In `lesson-text` there is
no TTS, no STT and no model call at all: the published turn already carries the
tutor's line, the target and the support view, and a model has nothing to add to
a script.

**When nothing speaks, nothing hands the floor back.** Both voiceless paths start
the silence clock when the turn *renders* instead of when speech stops.

## C2 room presentation

The shared Home/Speak scene start uses one synchronous launch ticket while its
health check runs. Leaving and returning, changing the scene or account, and
unmounting invalidate that visit's result. A failed check retains the requested
speaking/typing mode for retry; a late result cannot open a room in a different
visit. HTTP health still proves only that the token API answered, not that a
worker joined or audio was heard.

If the tutor leaves while the learner's connection remains open, the shared
session owner closes the microphone and presents the existing dropped-session
failure; an empty room cannot recover through its composer. That decision is
deferred until LiveKit's current event stack settles so a reconnect's temporary
roster rebuild keeps its existing room. Transport cleanup retains an already
delivered authoritative recap and its saveable text, clears unfinished text,
and cannot release a newer room's audio. Explicit leave still discards the
in-memory recorder.

The recap's conversation sentence requires a positive whole measured learner
turn count. A room with zero turns, or an invalid count, says “You made time for
your French.” Positive counts keep the existing unaided/help wording, without
showing a score or count. This copy does not decide XP, streaks or settlement.

Guest live admission is distinct from authenticated admission. Production
`/onboarding/start` with `live: true` stays closed for the guest conversation;
only `scene: 'guest-cafe'` can open, behind `LUVANI_GUEST_SCENE=1` and its own
Redis budget (UI-011, runbook "Guest first scene"). When speaking is supported
but anonymous admission is disabled, `guest-live-unavailable` lets the existing
account flow preserve the plan and later reach the normal `FirstScene` entry.
An already authenticated unfinished setup uses its profile-completion owner.
Unsupported `convo` is checked first and returns `voice-unavailable` with actual
supported modes, without claiming an account can restore voice. The guest page
keeps truthful unavailable-speaking copy and retry; the existing authenticated
room recovery can offer its supported typed path. See
[onboarding handoff](ONBOARDING.md#account-handoff-when-guest-live-is-unavailable).

On the tutor worker, a production guest room runs only as the signed guest
scene (`scene: 'guest-cafe'`, mode `lesson` or `lesson-text`) and only with
`LUVANI_GUEST_SCENE=1`; the guest convo stays refused. A scene runs
`LuvaniTutor` with `scriptOnly`: no LLM client, no scoring, and a missed answer
gets the scripted rescue. Its voice proxy uses `guestSceneGate.ts` instead of
paid admission: Deepgram streaming and ElevenLabs only, at most 2 STT sockets
and 180 s of audio in total, at most 48 TTS calls, and only the signed voice,
the pinned model and the scene's allow-listed sentences (all in the warm
corpus). The room disconnects at its 180 s ceiling even if settlement fails.
See [the change contract](changes/guest-first-scene.md).

`live/C2LiveRoom.tsx` is the shared presentation used by first practice,
conversation and scripted lesson sessions. The existing session owners supply
every action and real state. A soft blue/lavender sphere sits above the thread;
tutor bubbles align left and learner bubbles right. Speaking and typing share
the same turns and transcript-visibility toggle. Hiding the thread keeps it
mounted, so history and scroll position survive. The toggle is session-local;
it introduces no transcript storage or transmission.

Typing places the composer at the bottom of the safe-area-aware room. Focusing
it or opening the keyboard hides Speaking/Typing and End session; closing the
keyboard, dismissing focus or sending restores them. Send and Enter use the
existing submission owner with a synchronous lock. In
`live/c2TranscriptPolicy.ts`, tapping the composer anchors the latest sent
learner message; before any learner message exists, it uses the latest tutor
message instead. Draft and partial recognition text do not count as sent turns.
Every relevant viewport/bubble layout retains that selected message fully above
the composer when it fits; an over-height bubble aligns its beginning for
reading. Only an actual composer focus starts a new reveal revision. Repeated
keyboard-show signals cannot reclaim the thread after the learner scrolls up;
a new deliberate focus can request the latest sent message again.

Incoming lines follow automatically while the reader is within 64 points of
the transcript end. A user scroll up cancels the focus anchor and automatic
follow; new lines expose “Latest message ↓” without pulling the reader down.
That action returns to the end and restores following. The same policy applies
in both reply modes and respects reduced motion.

Practice support starts collapsed and opens only through its explicit control.
New replies, updated hints and reply-mode changes never expand it automatically.
Keyboard editing temporarily hides the panel with the bottom controls while
retaining the learner's open/closed choice; dismissing the keyboard restores
that choice. Its accessible expanded state and the current room's support and
tools remain available through the same toggle.

The compact Speaking/Typing control changes presentation within the current
room and retains its history. A session started with a voiced `lesson` or
`convo` grant can pause and resume its existing microphone. A `lesson-text` or
`convo-text` grant has no speech pipeline: Speaking remains unavailable and
the room explains that it started in typing mode. Opening a mic cannot upgrade
that grant. Server admission, service recovery, safety-stop behavior, replay
eligibility, settlement and audio-focus rules remain unchanged.

**Listen only** is the voiced grant with the microphone kept closed, not a fifth
mode. The Tutor tab's Speak / Listen / Type choice and the Scenes screen's
"Listen only" lesson tile open a `convo` or `lesson` room with `listenOnly`:
`useLiveSession` skips the connect-time microphone publish (a lesson otherwise
connects hot), still calls `startAudio()`, and the screen opens the typing box.
Nothing new goes to the token server or the agent, so the tutor speaks as usual
and the learner answers by typing or tapping a choice. Speaking stays one tap
away; the in-room Type control already does the same thing mid-session
(`pauseMic`). The typed grants stay fully silent, as above.

C2's orb uses
measured room audio where available and the activity/reduced-motion-aware
decorative fallback otherwise; it adds no pronunciation claim.

## The wire

`packages/core/src/protocol/protocol.ts`. JSON over the LiveKit data channel,
topics `luvani.server` and `luvani.client`. `decodeServerMessage` never throws — a
malformed frame must not take down a live conversation.

**Agent → app**: `prompt` · `feedback` · `speaking` · `transcript` · `summary` ·
`convo` · `opening` · `recap` · `practice` · `drills` · `error` · `wrap-up` ·
`held-turn`

**App → agent**: `ready` · `help` · `skip` · `choice` · `hear` ·
`slower` · `english` · `say` · `typing` · `moment` · `mode` · `tap-to-send` ·
`send` · `leave`

A free conversation opens on `opening`: the tutor asks, out loud and in
English, what the learner wants to talk about — no menu, no chips. Whatever
they say or type becomes the scene (the agent treats a pre-scene `say` as the
topic).

Choosing `convo-text` never starts an AI suggestion timer on this screen. The
box stays blank until the learner supplies their own topic. Inside a scene,
ordinary turns likewise carry no suggested reply. One genuine rescue reveals
an English hint card, silently and without a model call; repeated help may
reveal a French line, and that rescue asks the brain for the tutor's step-in.

A scripted lesson speaks its expected paths from the script itself: the opening
line, every good or partial answer, every rescue and every skip go straight to
`session.say` through `scriptedSpeech.ts`, whose sentences are all in the TTS
warm list. Only a missed answer, which can be anything, goes to the pipeline LLM.
When `LUVANI_AUDIO_SCORING=1`, a spoken lesson answer is scored beside the
reply, never in front of it (VOICE-004): only an answer that matches the
reference line is sent, the paid route gets 16 kHz mono WAV converted in process
(`services/shared/liveScoringAudio.ts`), and a finishing lesson waits at most
`SCORE_SETTLE_MS` for scores in flight before writing the end card.
A mission (free conversation) is scored the same way, against the one line it
knows: the full line handed over on the second rescue. A spoken scene turn is
sent only while that line is shown and only when the raw transcript matches it
(exact, fillers or one slip), never a typed answer. The finishing conversation
settles scores with the same bound and the same skips (a safety stop, or under
five seconds left before the hard limit), and the recap carries `focusSound`
(one IPA symbol and the word it was heard in), which the app shows on the
recap's sound page. Each recogniser stream gets its own capture, because a
language switch restarts the recogniser's clock, every final segment of one
turn is kept, not just the last, and a final that arrives after its turn was
taken is dropped rather than carried into the next clip (F866). The line is read
from the published card, so a line no longer on screen is never the reference.
In production the score goes through the paid gate, so the bound lesson quote
must carry the reviewed scoring component (`services/shared/lessonScoringQuote.ts`)
and its binding must declare `kinds` including `scoring`; startup refuses the flag
otherwise (F863). Activation acceptance before the flag goes on for anyone: one
hosted lesson shows a Speechace 200 and a `scored` end card. Also confirm
Speechace's billing unit and rate: if it bills per second, recompute `microUsd`
as max(per-call × 48, per-second × 900) before the flag goes on. Follow the
activation order in `deployment/PAID_ADMISSION.md`.
A speech-dataset seam (`services/tutor-agent/src/speechClips.ts`) sits after a
scored reference line, and it does nothing unless `LUVANI_SPEECH_DATASET=1` and
the learner's consent bit are both on. Nothing sets that consent bit today, so no
audio is kept or sent; see [docs/changes/speech-dataset.md](changes/speech-dataset.md).
The app measures the learner's wait on the device: from the confirmed final
transcript to the worker's `speaking` frame, logged as
`[luvani:live] reply-latency` and kept in `LiveDiagnostics.replyLatencyMs`
(`apps/mobile/src/live/replyLatency.ts`).

A conversation started from a practice topic card skips the question. The join
token carries a `seedTopic`, the opening names the topic instead of asking for
one, and the scene is built from it straight away. Everything downstream is the
same code path, including the request-grounded recovery scene when the frame
call fails.

### One spoken answer, not a lecture

On an ordinary free-conversation turn, the learner hears the French character
reply and, only for a genuine scene shift, one short English scene-setting line.
Routine correction cards remain visible and feed the recap, but are not read
aloud over every exchange. Once per voiced scene, an eligible inline finding
about the learner's actual confirmed words can be echoed briefly inside the
character's French reply. No recast is invented for a clean turn; deferred
findings, narration shifts and English-help turns keep their existing policy.
The correction and combined line must fit short speech budgets (120 characters
and twenty words on the low rungs; 240 and forty above them), or only the card
remains. The original character, display meaning and one speech handle remain.
The augmented line passes the existing output guard before display and speech,
and the actual guarded dialogue replaces the corresponding assistant history
entry for later turns and post-session work. The typed twin stays unchanged.
This does not broaden the output guard's categories or validate model-generated
French/voice fluency; native TTS still needs testing.
When the learner reaches for English, the one
short English-to-French hand-back takes that single support slot before the
French reply. This keeps the tutor responsive without making every answer sound
like narration, correction, and roleplay glued together.

The conversation-only memory brief now supplies the same last five repaired
saved notes to the frame and every turn, labelled as editable tutor memory
rather than an exact past utterance or an invented conversation/date source.
Paused memory supplies no brief. A session signed `memoryLocked: true` (free or lapsed
learner) also supplies no brief, skips the remembered opener and extraction, and
returns the received profile memory unchanged in the recap. Relevance and at most one natural sourced
recall are prompt guidance; a real model test is still required before claiming
reliable adherence. No extra model call or new decision threshold was added.

If the scenario-builder call times out, fails, or returns an invalid frame, the
agent opens a small request-grounded frame instead. The learner's words remain
the scene setting and ride every later turn; a provider failure must never turn
an arbitrary request into the café fixture.

After the recap, `practice` carries the session's curated leave-behind: at most
three topics, each with the few phrases worth keeping. The curator may add at
most two closely related, one-step-harder extension phrases so practice tests
transfer instead of replaying the transcript verbatim. Code caps extensions,
drops duplicates and matches every claimed session phrase back to the real
turn. Drills are authored from that same list across six supported formats, so
the topic cards and exercises describe one practice.

The selected brain is controlled by `TUTOR_LLM`. `openai` uses the Responses
API with strict schemas, Luna for live turns and scene design, Terra for
memory extraction and, since 2026-10-23, GPT-6 Luna for post-session drills
(`OPENAI_DRILLS_MODEL`; VOICE-008 in `DECISIONS.md`) and for curated phrases
(`OPENAI_CURATION_MODEL`; VOICE-012);
`anthropic` uses the Claude API; `groq` remains the free-tier plumbing option.
Every successful call contributes its tokens to the session's `[luvani:brain]`
log, and every call abandoned at its deadline is named there too. That per-call
line is a running trace, not the number to quote: the source of truth for what a
session cost is the single `[luvani:brain:summary]` line emitted once the analyst
calls have joined, which prices each activity from the model that actually
answered it. Input tokens are normalised per vendor before they are counted, so
uncached input, cache reads and cache writes are three disjoint buckets whoever
served the call, and reasoning tokens are reported inside output, never beside
it.

When the room disconnects the agent also prints one `[luvani:cost]` line for
cost per minute. It holds numbers only: the same 8-hex session prefix,
`ttsCharsBilled` (characters sent to the voice vendor), `ttsCharsCached`
(characters served from the authored disk cache), `ttsCharsReplayed`
(characters served from the session's replay memo) and `sttSec` (seconds of
learner audio Deepgram reported receiving). A field the session could not
measure is left out, never printed as zero.

Each session's `CachedTTS` also keeps a small replay memo in memory. It holds
the audio of the last 8 non-authored lines it synthesized, up to 4 MB, and
evicts the least recently used line first. So when a learner taps "hear",
"english" or "slower" on a free-conversation line, they hear the same frames
again without a second vendor call. Only a line that finished cleanly is kept.
An interrupted, cancelled or failed line is never stored. The key is the disk
cache's own fingerprint, so another voice, model, setting or speed never
matches. Lines over 220 characters bypass it, as they bypass the disk. The
memo is never written anywhere and is cleared when the session ends. Authored
lines stay on disk and no longer expire, because their key already binds
voice, model, settings and text.

`LUVANI_CONVERSATION_TTS_MODEL` is an opt-in switch for the free-conversation
voice, and it is off by default. When it is unset, every line uses the pinned
`eleven_multilingual_v2` exactly as before. When it is set to
`eleven_flash_v2_5` (the only accepted value; anything else stops the worker at
startup), the live agent's `CachedTTS` gets a second ElevenLabs voice with the
same voice id, settings, output format and streaming latency, and only
non-authored lines go to it. Flash bills half per character ($0.04 against
$0.08 per 1,000). Scripted lines never move: every authored line, and the disk
cache, stay on `eleven_multilingual_v2`, and the warm-cache and voice-sample
scripts never build the Flash voice. The replay memo is keyed by the voice key
of the model that made the audio, so Flash audio never replays as the other
model. With the switch on, `[luvani:cost]` adds `ttsCharsBilledConversation`,
the part of `ttsCharsBilled` sent to Flash. Under the fish vendor the switch is
ignored with a startup warning. In production the TTS quote must include an
`eleven_flash_v2_5` component before the switch is turned on
(`deployment/PAID_ADMISSION.md`).

`spoke` and `silence` are **not** wire tags. They are engine inputs
(`core/session/session.ts`). Audio is the media track; silence is timed agent-side.

`choice` and `say` both arrive as answers and are graded exactly as a spoken turn
would be — with `phonemes: []`, so neither ever counts as an utterance that was
listened to. That distinction is load-bearing; see below.

## Audio, and what may be claimed about it

The product's second promise is pronunciation feedback that came from audio
measured against a known sentence. Getting that wrong quietly is the worst
failure available here, so the machinery is deliberately explicit:

- **`services/tutor-agent/src/utterance.ts`** sits in front of recognition via the
  `sttNode` hook, keeps a bounded (30 s) copy of the frames passing through, and
  cuts each utterance out on the recogniser's own word timings. Public API only:
  `session._subscribeAudioStream()` would also work and the underscore is not
  decorative, and reading `session.input.audio.stream` directly *steals* frames
  from the pipeline rather than copying them.
- The window is counted in **samples, not seconds**. 0.1 is not representable in
  binary, and after twenty frames the drift pulls a neighbouring frame into the cut.
- **`durationSec`** comes from the same place and is always used. It was hard-coded
  to `0`, which is why speaking share and longest turn read as nothing on every
  live session ever run.
- **Live scoring is built, and switched off.** Sending a live utterance to the
  scorer is behind `LUVANI_AUDIO_SCORING=1`, which stays unset until the
  activation checks above pass. Scoring runs beside the reply, never in front of
  it (VOICE-004, which closed F623): the brain answers without waiting, and a
  finishing lesson waits at most `SCORE_SETTLE_MS` for scores in flight. Missions
  are scored the same way on the handed-over full line (F866). With the
  flag off, a live end card reads `unavailable` and a recap shows no live sound. Drills and sound
  checks are scored today, by the token server's `/drill/score`, which does not
  read the flag. Their recordings are .m4a on a phone and WebM on the web, so
  each upload is labelled from its own first bytes rather than assumed to be WAV.
- **`services/shared/pronunciation.ts`** is the scoring seam. It picks the vendor
  by `LUVANI_SCORING_VENDOR`: TonePerfect by default whenever
  `TONEPERFECT_API_KEY` is set, Speechace when named or when its key is the only
  one. A vendor named without its key scores nothing, and the audio is never sent
  to the other one. Each utterance gets one deadline (5 s live, 10 s for a drill)
  shared by the single retry, and one random Idempotency-Key, so a retry cannot
  bill twice. A timeout, a refusal, an outage or an unassessable answer is no
  score, never a low one, and a session where no turn was scored is
  `unavailable`.
- **The alphabet is verified for 18 of the 36 sounds.** The one real TonePerfect
  response is committed as `services/tutor-agent/src/fixtures/toneperfect-fr.json`,
  and every symbol it returned is plain IPA that maps with no alias. The other 18
  have not been seen yet. The vendor marks the model experimental and its scale
  uncalibrated; the first success in a process logs the model id, and every
  success logs how long it took.
- **`services/shared/phoneMap.ts`** translates vendor symbols into the inventory's
  IPA and counts what it cannot place, so an alphabet change is one loud log line
  rather than a slow silence.
- **`SessionSummary.pronunciationStatus`** is `scored`, `clean` or `unavailable`.
  A session nobody listened to must never render the same card as a session that
  went well. `unavailable` says so in plain words.

## Audio levels in the room, and the microphone at the recap

Come alive (core loop 3.1 to 3.7, ledger F763 and F764) gives the conversation
orb the room's real audio. This is the plumbing; the orb's drawing reads it.

**Where the levels come from.** `useLiveSession` hands over the room's two audio
tracks as `audioTracks: { mic, tutor }`: the learner's microphone when it is
published (`RoomEvent.LocalTrackPublished`) and the tutor's voice when it is
subscribed (`TrackSubscribed`, before the web-only attach). Each is taken back
when it goes, by identity, so an abandoned room cannot clear the live one. That
state changes a handful of times a session and never per audio frame.
`live/RoomLevels` measures them, one file per platform:

| | Phone (`RoomLevels.native.tsx`) | Browser (`RoomLevels.tsx`) |
|---|---|---|
| Learner | `useTrackVolume(mic)`, an RMS every 40 ms | `createAudioAnalyser`, the RMS of `getFloatTimeDomainData` |
| Tutor | `useMultibandTrackVolume(tutor)`, 7 bands, 150 Hz to 4 kHz, every 40 ms | the same analyser, 7 log bands out of `getByteFrequencyData` |
| Pace | the native renderer's 40 ms | animation frames, at most one sample per 40 ms |

LiveKit's hooks set React state on every reading, so each lives in a leaf that
renders nothing; only the leaf re-renders. Every reading goes through
`live/levels.ts`, which is pure and tested, and the result is written into
shared values (`live/OrbAudio.tsx`, `OrbAudioContext`) the orb reads on the UI
thread. The web analyser is opened once its track exists, which is after the
learner's start tap, and a context the browser keeps suspended reads silence.

**The rules** (`live/levels.ts`):

- The learner's RMS becomes a level by `((rms - 0.01) / 0.20) ** 0.6`,
  clamped; room noise under 0.01 draws nothing. A recorder's dBFS uses
  `((db + 50) / 40) ** 0.8`.
- An envelope: it rises by 0.6 of the way per reading, and falls **by the
  clock**, the whole scale in 160 ms, so the same time falls the same distance
  however often it is looked at (F777). Falling towards zero, anything under
  0.01 is written as exactly zero, so a still ring is still.
- **The zero trap.** LiveKit's native volume hook only ever writes a reading
  that is not zero, so when the audio stops the last loud value stays put. A
  level with no new reading for 80 ms is silence (one reading may go missing
  without the ring moving). It is believed then but dated from the first
  reading that did not come, 40 ms after the last one that did, and falls from
  there, so a quiet level (a quarter of the scale or less) rests the moment
  the silence is believed. That is the ring; "Hearing you" keeps its own,
  longer wait (below). A reading with nothing in it (room noise under the floor, which the
  web analyser and a quiet phone keep sending) is no news either, so both
  platforms rest the same way. The meter runs its own timer while anything is
  above rest, because after the audio stops there may be no readings to drive
  it, and stops the timer at rest. A timer that fires late does not slow the
  fall, because the fall is counted from the clock.
- **Rest within 300 ms of silence** (acceptance check 7, F777). The ring's
  worst case is a full level: 40 ms to the first missed reading, 160 ms of
  release, and up to one more 40 ms tick before the meter looks again, so
  240 ms. "Hearing you" goes 260 ms after the learner's last voiced reading,
  300 ms if its timer runs one sample late. Before 7 October 2026 the release
  was 15 % a step after a 120 ms wait, which took over a second, and longer on
  a busy thread.
- The learner's level counts only on their turn: microphone open and the tutor
  not speaking. Otherwise it falls to rest; the tutor's voice coming back
  through the speaker is not the learner speaking.
- The tutor's seven bands are drawn against one running peak (decay 0.995 a
  step, floor 0.05), so the shape of the voice survives.
- **Fallback.** A track's level is `live` only once that track has produced a
  reading above zero. A processor that never starts, a browser whose audio
  context never runs, or a build without the native module leaves it false, and
  the orb keeps the loops it has always had. A new track has to prove itself
  again. Nothing is invented.

The constants as they stand (`live/levels.ts`):

| Constant | Value | What it does |
|---|---|---|
| `LEVEL_SAMPLE_MS` | 40 | The readings' pace, on both platforms |
| `STALE_AFTER_MS` | 80 | No reading this long is silence (two missed readings) |
| `ATTACK` | 0.6 | The share of the way a level rises per louder reading |
| `RELEASE_MS` | 160 | A full level falls to rest in this long, by the clock |
| `REST_WITHIN_MS` | 300 | The promise: at rest, and "Hearing you" gone, this soon after the last sound |
| `REST_BELOW` | 0.01 | Under this, on the way to silence, a level is exactly zero |
| `PEAK_DECAY`, `PEAK_FLOOR` | 0.995 a reading, 0.05 | The tutor's running peak |
| `HEARING_ABOVE` | 0.12 | The line for "Hearing you" |
| `HEARING_ON_AFTER_MS` | 250 | Above the line this long before the word shows |
| `HEARING_OFF_AFTER_MS` | 600 | Below the line with readings still coming (a murmur), this long before it goes |
| `HEARING_SILENCE_OFF_MS` | 260 | No voiced reading this long and it goes, whatever the level reads; a shorter pause keeps it |

The timing ones (`STALE_AFTER_MS`, `RELEASE_MS`, `REST_WITHIN_MS`,
`HEARING_SILENCE_OFF_MS`) were set on 7 October 2026 to keep acceptance check 7,
and are held there by the tests `a level rests within 300 ms of silence` and
`the hearing word holds through the pauses between words, through the real
meter`. None of them **has yet been tuned by eye on a device**; tuned values
replace them here. The target is under 2 ms of
JS work per 40 ms sample on an iPhone 12 class phone, measured with the Hermes
profiler; that has not been measured yet.

**Lifecycle.** The meters run only while the app is in front of the learner
(`AppState`) and the room is the focused screen (`ConvoScreen` passes
`useIsFocused()` in, so `RoomLevels` never reaches for the navigator itself);
unmounting a leaf deletes its native processor, and leaving the room stops the
meter and writes rest. `ConvoScreen` wraps both of its rooms, the choosing
moment and the scene, so the levels carry across from one to the other. Under Reduce Motion the orb's bars hold
still, so the tutor is not measured; the learner is, because the listening ring
keeps three opacity steps. A meter that throws (a missing native method, a
refused analyser) is caught by `LevelsGuard`, logs
`[luvani:live] levels-unavailable` once, and costs the orb its levels, never the
learner their conversation. Nothing is recorded, kept or sent: the levels are
numbers read on the device and dropped.

**What the orb draws from them** (F764). The levels stay on the UI thread; the
orb branches on a few facts instead, which `createRoomFacts` in `live/levels.ts`
takes from every frame the meter writes and hands to `OrbAudio` as `room`:
whether each level is measured, whether the learner is being heard (their level
above 0.12 for 250 ms; back 260 ms after their last voiced reading, so within
300 ms of silence (F777), or after 600 ms below the line while readings keep
coming, a murmur or a noisy room), and whether the room is awake (`RoomLevels`
is focused and the app is active). The silence is counted from the reading,
never from the ring: a quiet voice's ring rests in the pauses between words,
and a word that followed it would go and come back several times a sentence.
A pause shorter than 260 ms keeps the word; a longer one is the end of a
phrase, and the next is heard after its own 250 ms. They change a few times a conversation, so the orb
re-renders a few times a conversation. `tutor/orbLayers.ts` decides the layers
from them: the listening ring from the learner's level, the live bars and the
core pulse from the tutor's bands (today's loop rests while they draw), the
thinking arc while `thinking` is true, the "Hearing you" word under the orb (its
accessible name stays the state's own), and one ripple on the goal tick that
completes a scene. A level that is not measured draws nothing new, and every
layer rests while the room is asleep, the caller pauses the orb, or movement is
reduced. `LiveSessionScreen` wraps the lesson in `RoomLevels` too, with the
microphone only, so its Speak circle wears the same level ring; nothing in a
lesson draws the tutor's voice, so it is not measured there.

**Silent in the room** (F765, decision D8). The goal ticks, the orb's ripple
and the scene's card move, and none of them plays a sound or a haptic: the
room's files import neither. A spoken room also holds the audio focus from the
moment it takes the session, and the microphone holds it while it is open, so
the sound gate and the haptic switch would refuse anyway; a typed room takes no
audio session and is silent because nothing in it asks. The recap is where the
conversation is heard: its result page starts its moment once nothing holds the
audio focus (`recap/useRecapMoment.ts`, after the release below), or after two
seconds, when a beat that still meets a held room is simply silent.

**An honest long wait.** `live/thinking.ts` `thinkingLine`: once the tutor has
really been thinking for 6 seconds (from the final transcript, see `thinking`),
the scene header reads "Still thinking. This can take a few seconds." when the
connection line has nothing to say. It goes with the answer. No artificial
minimum, no progress, no "analysing".

**The microphone at the recap (F763).** A conversation's recap renders inside
the room it ended in, because the enriched profile and the drills arrive over it
afterwards. The microphone used to stay published until the learner tapped Done.
Now, the moment the `recap` frame arrives and before the recap is set:

1. `closeMicForRecap` tells the circle (`micOpen` false, diagnostics
   `micPublished` false) and calls `setMicrophoneEnabled(false)`. A stopped
   session closes it too.
2. Once the mute lands, the microphone track is unpublished and stopped
   (`unpublishTrack(track, true)`, F777). A mute alone sends nothing but leaves
   the device recording, so the iPhone's microphone indicator stayed on over
   the recap. A session that never published a microphone has nothing to stop.
3. When the capture has stopped, `micClosedAtRecap` is set. A close that
   fails is never reported closed, and neither is one confirmed after the
   learner left or another start took the session (the room and the start
   generation are checked again when it resolves).
4. An effect asks `live/recapAudio.ts`: the recap has arrived, the close is
   confirmed, the tutor is not speaking, and the session was not stopped for
   safety. Only then does `releaseLiveHold()` give back the room's hold on the
   audio focus (`sound/audioFocus.ts`), so sound effects and haptics are allowed
   again and the recap may play its moment. A stop keeps the hold: it gets no
   moment, and its message may still be playing.

What this does not do: LiveKit's audio session stays up until `leave()` runs
`releaseAudioSession`, as before (on a phone the release also marks the audio
mode unknown, so the next sound sets a full mode). A start that comes after
the recap without `leave()` finds LiveKit's session still up: on a phone
`ensureAudioSession` takes the hold again and makes the session active again
(the recap's sound may have let the OS deactivate it), and on the web it takes
the hold again, so a live room is never left unheld (F777). The quiet door
(`switchToText`) still only mutes: it stays in the same room, and the circle
reopens the same track. And the
celebration queue does not start over the recap: `RecapScreen` holds it while it
is mounted, as every end card does, so the takeovers play after the learner
leaves. Device check outstanding: expo-audio setting the sound-effect mode while
LiveKit's audio unit is still running on iOS. If that reroutes or ducks audio on
the founder's phone, recap sounds wait for `leave()` instead (core loop risk 2).

## When the learner's turn ends (VOICE-010)

The session is VAD-driven. Silero (plugin defaults) reports the end of speech
550 ms after the last voiced frame, and in VAD mode the endpointing `minDelay`
acts as `max(VAD silence, minDelay)`. SDK 1.9 also builds its own audio turn
detector when `turnDetection` is unset: the local `turn-detector-v1-mini`
through `@livekit/local-inference` (French threshold 0.285). When it scores a
pause below the threshold, the wait becomes `maxDelay`. When the worker has no
native binding or no job inference executor, it scores every pause 1.0 and the
floor alone decides. Railway's logs say which (`local-inference native binding`).

The floor follows the learner (`services/tutor-agent/src/thinkingTime.ts`):

| Situation | `minDelay` | `maxDelay` |
|---|---|---|
| Rungs 1-2 (A0-A1), or no signed rung | 1,200 ms | 2,500 ms |
| Rungs 3-4 | 400 ms | 2,500 ms |
| Each cut-off this session | +400 ms, capped at 2,000 ms | 2,500 ms |
| "Give me a moment" held | 2,500 ms | 2,500 ms |

A cut-off is the learner starting to speak within 1,500 ms of a committed turn,
before the tutor began its reply. The session is built on the starting rung, and
`agent.ts` calls `session.updateOptions({ turnHandling: { endpointing } })` only
when the value changes. The tutors report rung changes, the hold and each
committed turn through the injected `thinkingTime` sink.

Measured on 23 October 2026 (`scripts/measurePauseEndpointing.mjs`,
`docs/live-latency-evidence/2026-10-23-pause-endpointing.md`). Six voices say one
French sentence, with a pause spliced in the middle, through the real Silero
VAD and the real local model. These are synthetic voices, not learners.

| Pause | Cut off today, model / no model | Cut off at 1,200 ms, model / no model |
|---|---|---|
| 0.5 s | 0 / 0 of 6 | 0 / 0 of 6 |
| 1.0 s | 2 / 6 of 6 | 0 / 0 of 6 |
| 1.5 s | 2 / 6 of 6 | 2 / 6 of 6 |
| 2.0 s | 2 / 6 of 6 | 2 / 6 of 6 |

A 2,000 ms floor (two cut-offs) protects 1.5 s pauses. Only a moment hold
protects 2.0 s pauses. The model's scores sat close to the threshold (0.15 to
0.39 mid-sentence, 0.29 to 0.60 at the real end), so the fallback column is the
one that has to hold.

What it costs, from the last voiced audio to the turn committing (p50, same
clips): today 466 ms. Rungs 1-2 now take 1,090 ms (+624 ms), 1,490 ms after one
cut-off (+1,024 ms) and 1,890 ms at the cap (+1,424 ms). A moment hold takes
2,390 ms. Rungs 3-4 are unchanged. When the audio model holds a turn, the wait is
2,500 ms either way. A lesson may run preemptive generation once more per held
pause; the framework caps that at three a turn.

## Speaking quietly (VOICE-011)

The live room has a "Quiet voice" switch beside "Show transcript", shown while
the learner is speaking to the tutor. It is client-only: the agent, Deepgram,
Silero and the VOICE-010 floors are unchanged. Turning it on opens the
transcript, shows one note ("Speak softly, close to your phone. {Tutor} can hear
a soft voice, but not a whisper.") and lowers the mic meter floor from 0.01 to
0.005 RMS. The value is stored on the device (`@luvani/quiet-voice/v1`) and is
off by default.

Why soft and not whispered (`docs/live-latency-evidence/2026-10-23-quiet-speech.md`):

- Soft speech about 20 dB under normal (around -36 dBFS) is heard. Its median
  word accuracy is 1.00, with the worst clip at 0.75 clean and 0.67 over a
  -50 dBFS noise bed. Silero fires at its default 0.5.
- A whisper is not. The Deepgram plugin passes every frame through
  `AudioEnergyFilter` from `@livekit/agents` 1.9, which stops sending audio
  whose 100 ms RMS stays at or under 0.004 (about -48 dBFS) after one second of
  quiet. A whisper held at a normal distance falls under that and never reaches
  Deepgram. Over noise, Silero also misses most real whispers at every
  threshold tried (0.5, 0.35, 0.25).
- That filter is the floor for any quiet speech. The meter's quiet floor of
  0.005 sits just above it, so the orb moves only for a voice the tutor can
  still receive.

All clips are synthetic (ElevenLabs). Founder recordings in
`artifacts/quiet-speech-2026-10-23/real/` and a device check are still owed.

## Nearly time to finish (VOICE-016)

A session used to end on the cap with no warning: the tutor said "Your session
has reached its time limit" as the room closed. Now the worker gives a heads-up
about a minute before and closes warmly after one more exchange
(`services/tutor-agent/src/sessionEnd.ts`, `SessionEndClock`).

- **When.** At the cap minus `HEADS_UP_LEAD_MS` (60 s), read from the same clock
  as the cap: `lifecycle.maxSeconds - lifecycle.elapsedSeconds()` on the
  lifecycle path, `maximumSessionSec` from the session start otherwise. A
  session that starts with under 90 s left gets neither the heads-up nor the
  close, and a guest scene keeps its own ceiling (`armSceneHardStop`).
- **How.** At the first gap (agent listening, learner silent, both queues idle)
  the tutor's `wrapUp()` publishes the payload-free `wrap-up` frame and says
  "We're nearly out of time. Let's finish this one together." The app shows
  "Nearly time to finish. {Tutor} will wrap up after this." with no number:
  the room never shows minutes left (UI-008, kept on 2026-10-25). A typed
  session gets the frame and the note only.
- **The close.** Once the learner has taken one more turn (help and skip count)
  and the tutor's reply has been spoken, `closeForTime()` stops in-flight
  replies, says "That's all for today. Thank you, à bientôt !", settles and
  closes the room through the tutor-owned path. While it closes, rescue stays
  dark and ordinary new turns are dropped, but safety still screens every one.
- **The backstop.** At the cap minus `CLOSE_BY_MARGIN_MS` (15 s), if nothing has
  closed, the learner is silent and no turn is held, the close runs at once.
  The close line's playout wait is bounded at `CLOSE_LINE_PLAYOUT_MS` (6 s).
  On the legacy path the close stands the timer down and arms a silent stop at
  the cap, so nobody hears "time limit" after "à bientôt". If they are
  speaking, the existing hard stop (lifecycle `onStop` or the legacy timer) and
  its copy still end the session at the cap. The signed cap is never extended.
- **Cost.** Metering is unchanged; an early close bills fewer seconds. Both lines
  are in `AUTHORED_SPEECH_LINES`, so `warm-cache` covers them once it is run.
- **Kill switch.** `LUVANI_SESSION_HEADS_UP=0` on the tutor role.

## Tap to send (VOICE-017)

An optional mode for anyone the pause floors still cut off. With it on, the
microphone stays open and the learner's turn ends only when they tap Send, or
when the recording cap is reached. Off by default; the learner turns it on in
Settings (Practice) or with the "Tap to send" switch in the room, and the choice
is stored on the device (`@luvani/tap-to-send/v1`).

- **Wire.** The app sends `{ t: 'tap-to-send', on }` after `ready`, after a
  reconnect, after returning from Type to voice, and when the switch changes.
  Send is `{ t: 'send' }`. The worker answers with `held-turn` frames: `open`
  (the learner started speaking), `closing` (it sends itself in about ten
  seconds) and `sent`.
- **Mechanism** (`services/tutor-agent/src/tapToSend.ts`). `agent.ts` intercepts
  both frames before the tutor, because the worker owns turn detection. On:
  `session.updateOptions({ turnHandling: { turnDetection: 'manual' } })`, applied
  only after `session.start()` has resolved (`markLive()`). Switching earlier
  overwrites the session's detector before the activity is built, and the
  session runs without it for good. Send: `session.commitUserTurn()`, which
  waits up to 500 ms for the final transcript and folds in the interim one.
  Send with nothing held is ignored. A Send or cap that lands while the tutor
  speaks waits until it stops, because the SDK drops a commit over
  uninterruptible speech; `sent` goes out only when the commit is made. An
  empty commit (a cough) re-arms the rescue.
- **Restoring is `null`, not the saved detector.** In `@livekit/agents` 1.9 the
  session's `turnDetection` holds the default audio detector object, and the
  recogniser keeps that object whatever the mode. Passing it back sets the
  recogniser's mode to an object, which switches VAD end-of-speech off for good.
  So switch-off restores `null` (how the session was built), or a saved string
  such as `'vad'` as itself. `tapToSendSdk.test.ts` proves it on a real
  `AgentSession`.
- **The cap.** `TAP_SEND_CAP_MS` (60 s) from the first speech of a held turn,
  with `closing` at `TAP_SEND_WARN_MS` (50 s). The SDK's own `userTurnLimit`
  fires only on transcripts, so the cap is our own timer.
- **Rescue.** While a turn is held, `armRescue` returns early in both tutors,
  so a pause mid-recording is never treated as being stuck. Before the learner
  says anything, the ordinary stuck clock runs. The cap bounds the dark time to
  60 s plus `STUCK_SILENCE_MS`. "Give me a moment" keeps working.
- **Modes.** A `mode` frame to Type turns it off (any held turn is sent first)
  and refuses it until voice returns; a session that starts typed starts there.
  Guest scenes never get it. `LUVANI_TAP_TO_SEND=0` on the tutor role makes the
  worker ignore both frames.
- **What it costs.** Barge-in by voice is off while it is on (the SDK sets
  `isDefaultInterruptionByAudioActivityEnabled` false for `'manual'`): words
  said over the tutor wait and land in the held turn. A lesson's preemptive
  generation does not fire during a held turn (0 model calls across several
  final transcripts and a 3 s pause in the SDK test), so a held turn costs no
  model calls. Recognition runs as it does for any open microphone.

## Serialisation

Two events can arrive at once — the rescue timer at four seconds, and the learner
starting to talk at four seconds and a bit. `services/tutor-agent/src/queue.ts`
serialises every state change, and a rescue captures a generation counter when it
is armed: if anything else was queued while it waited, or the learner has the
floor, it drops itself. Clearing a timeout cannot unschedule a callback that has
already fired.

"Every state change" means every one, and the way in matters as much as the
timer: a typed answer and an aide-moi tap take the queue exactly as speech does.
Both used to call the engine directly on the conversation path, which left the
moment unmarked — so a rescue already in flight still read as current and applied
on top of them. One moment of being stuck, two rescues.

## When it fails

`apps/mobile/src/live/failure.ts` enumerates twenty distinct failures, each with
its own words and its own way out; eight carry `canType: true` and offer the typed
route instead. `LiveErrorView` keeps a **Support details** panel, closed by
default and drawn after every recovery action, reporting whether
the token server answered, how long the room took, whether the agent joined and
whether it ever spoke — which is how you tell an environment problem from a bug
without reading LiveKit's logs.

The ordinary spoken worker checks the required keys and probes its selected
vendors before registration. A missing or deterministically rejected speech key
still refuses startup; it never silently offers a partly usable spoken session.

For a speech-credential outage, explicitly set `LUVANI_TYPED_ONLY=1` in **both**
`services/tutor-agent/.env` and `services/token-server/.env`, then restart both
processes. The supervisor checks the pair, pins the reviewed flag rather than an
inherited shell override, and refuses reuse of a token server advertising different
capabilities. Directly started/deployed services must use the same paired setting; there is
no cross-process capability handshake. A mismatched spoken grant is rejected by
the agent before audio construction and reported with zero usage to release its
lease. This cannot undo a trial already claimed by the mismatched token service,
and failed cleanup still needs the existing lease expiry/reconciliation. Checking
both deployed environments and real recovery is a release requirement.
This is operator-selected recovery, not automatic outage detection.

In that mode the agent skips speech-key requirements and speech-vendor probes,
skips VAD loading, and constructs no STT or TTS client for either typed mode.
LiveKit input and output audio are disabled and `vad: null` prevents the SDK's
implicit VAD. Transport credentials and the selected brain are still required. Both Claude CLI
options also require Groq for the scripted SDK lesson and a `claude --version`
check on direct worker startup; `claude-cli-all` never promises keyless lessons.
`GET /health` advertises only `lesson-text` and `convo-text`. The token API refuses
spoken starts before trial, lease or grant with a closed `voice-unavailable` code
and those two capabilities. The app offers “Continue by typing” for that reply;
a generic unavailable service still points at offline practice. The worker also
rejects spoken job metadata independently. To restore speech, set both flags to
`0` and restart after fixing the speech keys. No real credentials were altered
or live/native recovery session verified during this implementation.

## Scene reply dispatch timing

The worker's `[luvani:scene-latency]` summary measures the framework's detected
end of a confirmed spoken scene input to the guarded `say` dispatch. Each input
captures its own record before queueing. Typed input, choosing/opening speech,
bridges and recovery never become successful samples. A failed model reply is
counted as failed; a stopped pending reply or a switch to typing is cancelled.
Missing or non-monotonic marks are counted, not replaced with zero. The summary
uses nearest-rank p50 and p95 over the last 128 eligible dispatches and always
reports n and its failure/cancellation/missing counts. This is worker dispatch
latency, not recognition quality, TTS delivery or sound at the learner's phone.

The former untagged first-audio hook could attach an opening or an older cached
sentence to a newer record. Speaking-state transitions also included bridges
and recovery. They no longer contribute per-turn timings. Separate vendor
`[luvani:metrics]` lines still expose vendor first-byte and EOU metrics, without
being combined into scene latency. SDK 1.9's inspected public seam has no supported
first-frame callback carrying the returned speech handle ID. The summary therefore
states `first-audio=unmeasured phone-audible=unmeasured`. Actual correlated first
frames and phone audible p50/p95 require live/native proof.

On OpenAI a live conversation turn streams (VOICE-003). `TurnSchema` writes
every field the spoken line depends on first (assessment, coaching, coach line,
narration, then `sceneReply`, whose `speaker` and `fr` stream before its
display-only `frWritten` and `en`). The moment the string value of
`sceneReply.fr` closes, `llm/spokenFields.ts` closes the partial JSON,
validates it against `EarlySpokenTurnSchema` (whose reply is `{speaker, fr}`)
and hands it to the worker. A `fr` key anywhere else, such as the narration's,
never triggers it. `speakEarly` in `convo.ts` folds the fields into a
provisional turn (reply `frWritten: null`, `en: ''`) and runs the same
integration, coach-line policy and recast the full turn gets, plus the output
guard on exactly what is spoken (the reply's French, the coach line and the
narration), then speaks. The reply's English and written form are guarded with
the full turn, on French and English together, before anything is displayed or
stored; if that guard rejects the English after the French was heard, the
heard French is shown with an empty translation. No partial field is ever spoken,
and any surface the guard would touch means no early speech: the full-turn path
then guards and replaces it as before. State, profile, the durable checkpoint
and the published view still wait for the whole turn, which shows the same
words; if it ever disagreed, the spoken words win the screen, with the full
turn's guarded English. If the turn fails after its reply was heard, the heard
reply is kept as the turn instead of a recovery line, shown with no
translation because its English never arrived. Speech therefore now starts before the checkpoint ACK, which is
a deliberate change of order: the ACK is the learning and billing proof, and a
failed checkpoint still ends the session as before. Typed rooms and the
Anthropic brain do not stream. In `[luvani:reply-stages]`, `brain` on a
streamed turn is the time to its spoken fields, and `viewToSay` is omitted when
speech started before the view.

`OPENAI_LIVE_SERVICE_TIER` (opt-in, default off) sends OpenAI's `service_tier`
on the live turn and frame only, never on analyst work. Accepted values are
`priority`, `default`, `auto` and `flex`; anything else is ignored. Measured on
2026-10-22 on gpt-6-luna over 24 calls each, `priority` cut the time to the
spoken fields from p50 2035 / p95 2589 ms to p50 1249 / p95 1583 ms, and the
full turn from 3583 to 2111 ms p50. The API echoes `service_tier: "fast"` on
those responses. It is billed at OpenAI's higher priority rate, so the founder
decides whether to turn it on.

To measure the model side of this wait, run
`node --experimental-strip-types scripts/measureLiveTurn.mjs <env-file> <report.json> --reps 2`
from the repo root. It sends 12 synthetic café and hotel mission turns, built the
way the worker builds them, through the real client with `onSpokenFields`, and
reports p50/p95 for first token, coach closed, `sceneReply.fr` closed, spoken
fields and full turn, plus output tokens before `sceneReply` and the prompt cache
hit rate. Flags rewrite the request for A/B runs (`--model`, `--effort`,
`--verbosity`, `--service-tier`, `--instructions-patch`), and `--max-usd` caps
spend (a 24-call run costs under a cent on gpt-6-luna). The 2026-10-22 runs
behind VOICE-005 are in `docs/live-latency-evidence/`. It times the model only:
recogniser, TTS first audio and phone playout are not in it.

Set `LUVANI_REPLY_STAGE_TIMING=1` on the worker to investigate ordinary confirmed
typed and spoken scene inputs separately. The optional `[luvani:reply-stages]`
record reports queue, request preparation, model, integration, acknowledged
checkpoint and view dispatch durations. Spoken delivery also reports view-to-say
and input-to-say. Here “confirmed input” begins at the worker's accepted typed
message or completed speech hook, after recognition; it is not physical speech
end or a client send tap. “View dispatch” invokes the existing publication path,
not a phone receipt acknowledgement. The existing framework-EOU cohort is
unchanged, including its missing-boundary exclusions.

Each input owns its record before queueing. Typed and spoken summaries keep
separate last-128 windows and report missing, failed and cancelled work. The
active-record map is bounded to 128; overflow cannot become a fast sample.
Absent lifecycle ACKs, missing or non-monotonic marks and early exits never
produce successful duration samples. Opening, rescue, recovery and generated
topic setup do not enter this scene cohort. Logs contain fixed labels and
numeric durations, with no learner words or account identifiers. Both phone
receipt and phone-audible latency remain explicitly unmeasured by this recorder.

The shared OpenAI live-turn detail preference is documented in
[TUTOR_BRAIN.md](TUTOR_BRAIN.md). It applies to both input modes. Normal Typing
inside a spoken room still lets the tutor speak; the quiet door and `convo-text`
disable tutor audio. No endpointing, interruption, admission, voice selection
or checkpoint ordering changed for this optimization.
