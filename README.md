# Parle

**Speak French from your first session — and know exactly which sounds you're getting wrong.**

An AI speaking tutor for English-speaking absolute beginners in French. Positioning,
market research and the reasoning behind every decision live in [PRODUCT.md](PRODUCT.md).

---

## Why this exists

Duolingo teaches recognition, not speech. The AI voice tutors that fixed that — Speak
($1B valuation) and Issen (YC F24) — have two structural gaps their own users name:

1. **Beginners get stranded.** Issen's founders conceded it publicly: *"we need to
   improve the beginner experience."* A learner who cannot compose a French sentence
   freezes, and the app reads the silence as thinking.
2. **Pronunciation feedback can't be trusted.** Both are described by users as "too
   forgiving". This is not laziness — accuracy scoring needs a **known reference
   text**, and both products lead with open-ended conversation, where none exists.

Beginners spend most of a session on scripted turns. So the audience nobody serves
well is the one audience where trustworthy pronunciation scoring is actually
possible. That alignment is the whole thesis.

---

## Layout

```
packages/core/       Pure TypeScript. No network, no mic, no keys. 338 tests.
  phonemes/          36-phoneme French inventory + 16 drills + scoring
  ladder/            The 4-rung scaffolding state machine
  lessons/           "Commander un café" (A0, 12 turns)
  session/           Ties the above together
  metering/          Usage limits and the unit-economic model
packages/brain/      The tutor brain: prompts, engine, routing, learner model
apps/mobile/         Expo app → iOS, Android, web from one codebase
services/tutor-agent/    LiveKit Agents worker (Node) — voice pipeline
services/token-server/   Session credentials, metering gate, drill scoring
services/brain-playground/  Terminal chat + the AI-quality eval suites
```

`packages/core` is deliberately platform-free so the app **and** the tutor agent run
the same tested pedagogy. There is one implementation of the ladder, not two.

---

## Running it

Everything below works with **no API keys**. The app drives a mock speech pipeline
that produces a genuine anglophone error pattern, so the full loop — ladder, rescue,
scoring, drill selection — is real.

```bash
npm install
```

```bash
npm run web
```

First open: a moving welcome, then create an account (with no Supabase
configured, accounts live in a local on-device store — any email works, and the
Google button signs into a dev account instantly), answer the four onboarding
questions, and land on five tabs along the bottom — Home, Tutor, Practice,
Leaderboard, Profile.

Go to **Practice** and tap **Start the lesson** — and, this is the point, *say
nothing for four seconds*. The tutor steps in, drops a rung, and offers you the
line. It never comments on the pause.

**Tutor** is free conversation, and it is reachable from a brand-new account.
It used to be gated behind one finished lesson, which was a deadlock: session
history is scoped per account, so every account after the first on a device
started at zero and the only way to earn the tutor was the very lesson that had
to work first. The mic-free typed route was behind the same gate — the door a
learner who cannot speak needs most.

When a live session cannot start, it says which of eleven things went wrong,
always offers a way out, and hides a **What happened?** panel reporting whether
the token server answered, how long the room took to connect, whether the tutor
joined, and whether it ever said anything. That panel is how you tell an
environment problem from a bug without reading LiveKit's logs.

### Accounts (optional Supabase)

Real accounts are one env file away. Create a Supabase project, then in
`apps/mobile/.env` set `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). Email/password works
immediately. For Google sign-in, enable the Google provider in the Supabase
dashboard and allow-list the redirect URLs you use: your web origin
(`http://localhost:8090`), `parle://auth/callback` for a dev/store build, and
the `exp://…/--/auth/callback` URL Expo Go prints. To make the token server
*verify* users instead of trusting the client, set `SUPABASE_URL` (or the
legacy `SUPABASE_JWT_SECRET`) in `services/token-server/.env`.

Run the test suite:

```bash
npm test --workspaces
```

### The voice pipeline — the $0 stack

Transport is **self-hosted open-source LiveKit** (built from source into
`~/.local/bin/livekit-server`), so no LiveKit Cloud account is needed. Both `.env`
files already point at it (`ws://localhost:7880`, dev credentials — localhost only,
never expose them).

The keys go into `services/tutor-agent/.env`:

| Key | Where | Powers |
|---|---|---|
| `OPENAI_API_KEY` | platform.openai.com | Recommended first production path: `TUTOR_LLM=openai` uses GPT-5.6 Luna for low-latency turns and scene design, and GPT-5.6 Terra for memory and varied practice through strict Responses API schemas. `OPENAI_TURN_MODEL` and `OPENAI_ANALYST_MODEL` are optional overrides; there is no separate Luna key. |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Alternative production brain: `TUTOR_LLM=anthropic` routes Claude by activity through the same provider-neutral contracts. |
| `GROQ_API_KEY` | console.groq.com | The $0 fallback brain (`TUTOR_LLM=groq`). Useful for plumbing work; model availability and free-tier limits change, so the worker probes it before accepting learners. |
| *(no key)* | your Claude subscription | `TUTOR_LLM=claude-cli` runs the brain through the `claude` command instead of the API, so the coaching can be judged before buying a key. It splits by who is waiting: post-session memory, curation and drill authoring go to Claude, and realtime turns stay on Groq, because one command-line call measures about 8 to 12 seconds against a sub-second turn budget. Needs `claude` on PATH and `GROQ_API_KEY`. Moving to the API later is `TUTOR_LLM=anthropic` plus a key, and nothing else. |
| *(no key)* | your Claude subscription | `TUTOR_LLM=claude-cli-all` sends **every** call to the `claude` command, realtime turns included, and needs no vendor key of any kind. Development only: each turn costs the same 8 to 12 seconds, so the learner waits through it, and the scene builder is given 30 seconds instead of 10 so a slow call does not lose the race and open a fixture scene. Reach for it when Groq's free tier is rate limiting you, or to judge coaching quality with no spend at all. Needs `claude` on PATH. |
| `DEEPGRAM_API_KEY` | console.deepgram.com | French STT ($200 signup credit) |
| `ELEVEN_API_KEY` + `ELEVEN_VOICE_ID` | elevenlabs.io | The tutor's French voice (free tier) |
| `SPEECHACE_API_KEY` | speechace.com (optional) | Pronunciation scoring for speak drills via the token server's `/drill/score`. Absent, drills fall back to honest self-report. |

**Warm the voice cache first** (one-off, costs about 10% of one month's free
ElevenLabs credits, ever): every scripted lesson line is synthesized once and
saved to `services/tutor-agent/.tts-cache/`. After this, lesson audio replays
from disk at no cost and with no synthesis delay. Only the tutor's free-form
replies use live synthesis. Rerun after changing lesson text or the voice.
Lines are cached one sentence at a time, matching how the voice pipeline
requests them at runtime — a whole-line cache entry would never be hit.

```bash
npm run warm-cache --workspace=@parle/tutor-agent
```

Then start everything with one command:

```bash
npm run dev
```

That brings up LiveKit, the token server, the tutor agent and the app together,
in that order, because each one depends on the one before it. Every line is
labelled with the process it came from, and Ctrl-C stops all of them.

Two things it does that are worth knowing. It checks both `.env` files *before*
starting anything, so a missing key is one line on your terminal rather than a
room that opens and a tutor that never speaks. And if something is already
running on one of the ports it will reuse it when it recognises it and refuse
when it does not, naming the port and how to find out what has it.

Starting them by hand still works if you want one process on its own:

```bash
~/.local/bin/livekit-server --dev
npm run start --workspace=@parle/token-server
npm run dev --workspace=@parle/tutor-agent
npm run web
```

Forgetting one of those is exactly how the app comes to report that there is no
server available. Nothing is broken when it says that: the token server is not
running, the app's health probe fails, and the Tutor tab falls back to Demo.

The home screen runs **Live** when the token server is reachable and the
session runs over LiveKit; otherwise it shows a small **Demo** label and falls
back to the mock pipeline automatically. The agent is authoritative: it owns the
ladder and lesson state and the app renders what it is sent over the data
channel (`packages/core/src/protocol/`). Metering is enforced at token
issuance — an out-of-minutes learner gets a 402 and the out-of-minutes screen,
and consumed seconds are debited by the agent when the room closes, so killing
the app does not dodge the meter.

---

## What is and isn't wired

**Working, tested, verified in a browser:**
the scaffolding ladder and its silence rescue · phoneme scoring and single-focus
selection · minimal-pair drill matching · the café lesson · session summary and
vocabulary · metering, entitlements and cost modelling · **drill mode**
(fill-blank, best-sentence, appropriate-reply, tap-translate, listen-type,
repeat-this, with typo-tolerant grading, re-queue-until-correct, the
recognition→production ramp over the review deck, and the "can't speak now"
mic swap) · the full UI on iOS, Android and web.

**Built and tested, needs keys to feel:** the free conversation tutor. It asks
what the learner wants to practise, builds that situation, speaks first and
then waits for the learner's own French, mixed or English reply. Ordinary turns
never show a suggested answer; the first help reveals only an English hint and
repeated help may reveal a French line. English attempts receive a natural
French recast after the attempt. Account memory informs later scenes without
overriding the current request. After the recap, practice is grouped by the
topics actually discussed, adds at most two related transfer phrases, and uses
the six drill formats already implemented. Text mode is the same tutor and
transcript with only the audio pipeline turned off.

**Built but unverified without a mic + key:** per-utterance audio capture on
speak drills, scored against the reference text through the token server's
`/drill/score`. `scoreUtterance` returns nothing without audio or key, and every
layer treats a missing score as "don't invent a penalty" — the drill falls back
to honest self-report.

---

## The two things to check before building further

**1. STT on real learner French.** Issen ran four transcription models in parallel
and still shipped complaints. Measure word error rate on genuinely bad beginner
audio — not your own — before trusting any of the pronunciation output.

**2. Cost per session.** Premium voice is ~60% of the per-minute cost. The model in
`packages/core/src/metering/meter.ts` is instrumented and tested; reconcile it
against real vendor bills in week one, not month three.
