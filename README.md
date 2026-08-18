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

First open: create an account (with no Supabase configured, accounts live in a
local on-device store — any email works, and the Google button signs into a dev
account instantly), answer the four onboarding questions, then on the **Speak**
tab tap **Start the lesson** — and, this is the point, *say nothing for four
seconds*. The tutor steps in, drops a rung, and offers you the line. It never
comments on the pause.

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
| `ANTHROPIC_API_KEY` | console.anthropic.com | The tutor brain, routed per activity (`packages/brain/src/llm/routing.ts`): Claude Sonnet 5 answers realtime turns and designs scenes, Claude Opus 5 does the post-session work (learner memory, drill authoring). The default — coaching quality is the product. |
| `GROQ_API_KEY` | console.groq.com | The $0 fallback brain (`TUTOR_LLM=groq`, Llama 3.3 free tier). Visibly weaker coaching; fine for plumbing work. |
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

Then run the four processes:

```bash
~/.local/bin/livekit-server --dev
```

```bash
npm run start --workspace=@parle/token-server
```

```bash
npm run dev --workspace=@parle/tutor-agent
```

```bash
npm run web
```

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

**Built and tested, needs keys to feel:** the conversation upgrade. The session
opens on "Alors, de quoi on parle aujourd'hui ?" with topic chips; a spoken or
tapped topic runs the scenario builder (fixture scenes are the fallback, never a
failure); scenes open with narration ("Imagine the scene…"); English answers get
the French handed back and the beat re-invited; "plus lent" makes the tutor slow
and KEEPS it slow; corrections render as quote → better on screen; after the
recap the analyst extracts what it learned about the learner (next session opens
with it) and authors tomorrow's drills from today's phrases. Text-mode
conversation (`sans micro`) is the same brain with the voice pipeline dark.

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

---

## A note on the path

This repo lives at a path containing a space (`Language Speaker`). Web and EAS cloud
builds handle it, but local native tooling historically does not. Renaming to a
space-free directory before the first local iOS build is cheap insurance.
