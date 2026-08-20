# The live path

What happens between a learner tapping "start" and a tutor answering them, and
where every part of it can go wrong.

## The route

```
app  ──POST /session/start──►  token-server
                                 ├ resolves the user (Supabase JWT, or trusts the
                                 │   asserted id when neither key is configured)
                                 ├ refuses if the balance cannot cover a viable session
                                 └ signs a LiveKit join token whose metadata carries
                                     { lessonId, startRung, mode, snapshot, secondsRemaining }
app  ──joins the room──────►  LiveKit
                                 └ dispatches the job to the tutor-agent worker
agent  ─reads the metadata──►  builds ParleTutor or ParleConversation
       ◄──── audio ─────────►  Deepgram STT (fr) → Claude/Groq → ElevenLabs TTS
       ◄──── data channel ──►  the wire protocol below
agent  ──POST /session/end──►  token-server debits the metered seconds
```

The agent is **authoritative**. The app renders what it is sent and sends what the
learner did; it never decides a rung, a grade or an end card.

## The four modes

Signed into the join token, chosen at `/session/start`:

| mode | agent | speech | how the learner answers |
|---|---|---|---|
| `lesson` | `ParleTutor` | full pipeline | speaking, or tapping an option |
| `lesson-text` | `ParleTutor` voiceless | none at all | typing, or tapping an option |
| `convo` | `ParleConversation` | full pipeline | speaking |
| `convo-text` | `ParleConversation` voiceless | none at all | typing |

The `-text` modes are not a degraded fallback, they are the product working as
intended for someone who cannot speak aloud right now. In `lesson-text` there is
no TTS, no STT and no model call at all: the published turn already carries the
tutor's line, the target and the support view, and a model has nothing to add to
a script.

**When nothing speaks, nothing hands the floor back.** Both voiceless paths start
the silence clock when the turn *renders* instead of when speech stops.

## The wire

`packages/core/src/protocol/protocol.ts`. JSON over the LiveKit data channel,
topics `parle.server` and `parle.client`. `decodeServerMessage` never throws — a
malformed frame must not take down a live conversation.

**Agent → app**: `prompt` · `feedback` · `speaking` · `transcript` · `summary` ·
`convo` · `opening` · `recap` · `practice` · `drills` · `error`

**App → agent**: `ready` · `help` · `skip` · `choice` · `hear` ·
`slower` · `english` · `say` · `leave`

A free conversation opens on `opening`: the tutor asks, out loud and in
English, what the learner wants to talk about — no menu, no chips. Whatever
they say or type becomes the scene (the agent treats a pre-scene `say` as the
topic). After the recap, `practice` carries the session's curated leave-behind:
at most three topics, each with the few phrases worth keeping, chosen by the
brain's `curate` activity (model proposes, code caps and matches, a
deterministic fallback ships when the call fails). Drills are then authored
from that same keep-list, so the two artefacts describe one practice.

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
- **Sending that audio to Speechace is behind `PARLE_AUDIO_SCORING=1`.** Not
  because the capture is doubtful, but because the vendor's phone alphabet is: a
  mismatch fails silently to "no focus", which is exactly the shape of bug this is
  all here to stop shipping.
- **`services/shared/phoneMap.ts`** translates vendor symbols into the inventory's
  IPA and counts what it cannot place, so an alphabet change is one loud log line
  rather than a slow silence.
- **`SessionSummary.pronunciationStatus`** is `scored`, `clean` or `unavailable`.
  A session nobody listened to must never render the same card as a session that
  went well. `unavailable` says so in plain words.

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

`apps/mobile/src/live/failure.ts` enumerates eleven distinct failures, each with
its own words and its own way out; four carry `canType: true` and offer the typed
route instead. `LiveErrorView` hides a **What happened?** panel reporting whether
the token server answered, how long the room took, whether the agent joined and
whether it ever spoke — which is how you tell an environment problem from a bug
without reading LiveKit's logs.

The worker refuses to start at all if it cannot serve a turn:
`services/tutor-agent/src/preflight.ts` checks the keys and then live-probes every
vendor, because a tutor that joins and never speaks is indistinguishable from a
tutor that is thinking.
