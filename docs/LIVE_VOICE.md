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

## The wire

`packages/core/src/protocol/protocol.ts`. JSON over the LiveKit data channel,
topics `luvani.server` and `luvani.client`. `decodeServerMessage` never throws — a
malformed frame must not take down a live conversation.

**Agent → app**: `prompt` · `feedback` · `speaking` · `transcript` · `summary` ·
`convo` · `opening` · `recap` · `practice` · `drills` · `error`

**App → agent**: `ready` · `help` · `skip` · `choice` · `hear` ·
`slower` · `english` · `say` · `leave`

A free conversation opens on `opening`: the tutor asks, out loud and in
English, what the learner wants to talk about — no menu, no chips. Whatever
they say or type becomes the scene (the agent treats a pre-scene `say` as the
topic).

Choosing `convo-text` never starts an AI suggestion timer on this screen. The
box stays blank until the learner supplies their own topic. Inside a scene,
ordinary turns likewise carry no suggested reply. One genuine rescue reveals
an English hint card; repeated help may reveal a French line.

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
Paused memory supplies no brief. Relevance and at most one natural sourced
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
API with strict schemas, Luna for live turns and scene design and Terra for
post-session practice work;
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
  scorer is behind `LUVANI_AUDIO_SCORING=1`, and by the founder's decision of
  2026-09-29 that stays unset until scoring runs off the reply path (F623 in
  `docs/KNOWN_ISSUES.md`). The score is awaited before the brain replies, and the
  one TonePerfect call took 3.4 s for a 1.7 s clip, on top of a 4.5 to 5.4 s
  brain. Until F623 lands, a live end card reads `unavailable`. Drills and sound
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
- An envelope per 40 ms step: attack 0.6, release 0.15. Falling towards zero,
  anything under 0.01 is written as exactly zero, so a still ring is still.
- **The zero trap.** LiveKit's native volume hook only ever writes a reading
  that is not zero, so when the audio stops the last loud value stays put. A
  level with no new reading for 120 ms is silence and falls to rest. The meter
  runs its own timer while anything is above rest, because after the audio
  stops there are no readings to drive it, and stops the timer at rest.
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

These constants are the spec's starting values and **have not yet been tuned
on a device**. Tuned values replace them here. The target is under 2 ms of JS
work per 40 ms sample on an iPhone 12 class phone, measured with the Hermes
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
2. When LiveKit confirms the close, `micClosedAtRecap` is set. A close that
   fails is never reported closed, and neither is one confirmed after the
   learner left or another start took the session (the room and the start
   generation are checked again when it resolves).
3. An effect asks `live/recapAudio.ts`: the recap has arrived, the close is
   confirmed, the tutor is not speaking, and the session was not stopped for
   safety. Only then does `releaseLiveHold()` give back the room's hold on the
   audio focus (`sound/audioFocus.ts`), so sound effects and haptics are allowed
   again and the recap may play its moment. A stop keeps the hold: it gets no
   moment, and its message may still be playing.

What this does not do: LiveKit's audio session stays up until `leave()` runs
`releaseAudioSession`, as before (on a phone the release also marks the audio
mode unknown, so the next sound sets a full mode). A finished room is never
started again: the next room comes after `leave()`, and that is when
`ensureAudioSession` takes a fresh hold. `setMicrophoneEnabled(false)`
mutes the published track, as the quiet door does: no audio is sent, but the
capture device itself is released only when the room is left. And the
celebration queue does not start over the recap: `RecapScreen` holds it while it
is mounted, as every end card does, so the takeovers play after the learner
leaves. Device check outstanding: expo-audio setting the sound-effect mode while
LiveKit's audio unit is still running on iOS. If that reroutes or ducks audio on
the founder's phone, recap sounds wait for `leave()` instead (core loop risk 2).

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

The brain still returns a complete structured turn. Integration, safety, coaching,
recast and text/speech agreement all run before the guarded line is spoken. No
partial JSON field is released as speech. An SSE transport experiment that still
waits for final validation would not establish earlier sound; it is not enabled
or claimed as the report's streaming improvement.
