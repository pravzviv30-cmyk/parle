# Luvani

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

First open: a recorded café example and a local choice task, followed by your
starting level, a concise editable plan and explicit age/AI/privacy information.
Name and goal entry are optional in Profile. Analytics and reminders begin off.
Create an account, then meet the first scene. Four tabs organise the app: **Home,
Speak, Practice and Progress**. Profile opens from the header; Friends is optional
shared practice inside Profile.

Home, Speak and an empty Practice share one next task: resume unfinished personal
practice, practise usable saved material, then the next authored scene. Offline,
a bundled café line offers real hear/say/compare practice with a temporary,
ungraded recording. The production navigator never opens simulated speech.
Local development authentication requires the explicit development switch; a
production build never falls back to mock accounts when configuration is missing.

When a live session cannot start, it says which of eleven things went wrong,
always offers a way out, and keeps a closed **Support details** panel, after
every recovery action, reporting whether
the token server answered, how long the room took to connect, whether the tutor
joined, and whether it ever said anything. That panel is how you tell an
environment problem from a bug without reading LiveKit's logs.

### On an iPhone — simulator and device

`npm run web` stays the quickest loop and the fallback. To run the real native app:

```bash
# one-off after a rename or a fresh clone: regenerate the gitignored native project
cd apps/mobile && LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios

npm run ios          # the iOS Simulator
npm run ios:device   # a physical iPhone
```

It is a custom **dev client**, not Expo Go — LiveKit and WebRTC are native modules.
The `ios/` directory is generated and gitignored, so `prebuild --clean` is how it
comes back, carrying `com.luvani.app` from `app.json`. The first build takes a while;
after that Metro reloads JS on save.

**The Simulator** reaches the token server at `localhost:8787` unchanged, so
`npm run dev` in another terminal is all it needs. It has no microphone, so speech
never reaches the STT: the picker, onboarding and the tutor's spoken replies (TTS) all
work, but a real spoken exchange is a device-only test.

**A physical iPhone** cannot reach the Mac's `localhost`. Point it at the Mac instead —
in `apps/mobile/.env` set `EXPO_PUBLIC_TOKEN_SERVER_URL=http://<mac-lan-ip>:8787`
(`ipconfig getifaddr en0`), rebuild, and let the macOS firewall accept inbound 8787;
the run scripts already send the local-development flag, so plain HTTP is allowed. First
build needs a signing team on the Luvani target in Xcode — a free Apple ID gives a
7-day dev certificate, which is enough to test. The full device checklist is
[docs/DEVICE_VERIFICATION.md](docs/DEVICE_VERIFICATION.md).

### Accounts

Local scripts explicitly enable on-device mock accounts. Any deployed build requires a
Supabase project: in
`apps/mobile/.env` set `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). Email/password works
immediately. For Google sign-in, enable the Google provider in the Supabase
dashboard and allow-list the redirect URLs you use: your web origin
(`http://localhost:8090`), `luvani://auth/callback` for a dev/store build, and
the `exp://…/--/auth/callback` URL Expo Go prints. The production token server requires
HTTPS `SUPABASE_URL`, a server-only service-role key, and asymmetric JWKS verification;
the legacy shared JWT secret is a local compatibility fallback only.

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
| `OPENAI_API_KEY` | platform.openai.com | `TUTOR_LLM=openai` uses GPT-6 Luna for live turns and scene design, GPT-5.6 Luna for curated phrases and written checks, and GPT-5.6 Terra for memory extraction and drill authoring through strict Responses API schemas. `OPENAI_LIVE_MODEL`, `OPENAI_TURN_MODEL` and `OPENAI_ANALYST_MODEL` are optional overrides; there is no separate Luna key. |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Alternative production brain: `TUTOR_LLM=anthropic` routes Claude by activity through the same provider-neutral contracts. |
| `GROQ_API_KEY` | console.groq.com | The $0 fallback brain (`TUTOR_LLM=groq`). Useful for plumbing work; model availability and free-tier limits change, so the worker probes it before accepting learners. |
| *(no key)* | your Claude subscription | `TUTOR_LLM=claude-cli` runs the brain through the `claude` command instead of the API, so the coaching can be judged before buying a key. It splits by who is waiting: post-session memory, curation and drill authoring go to Claude, and realtime turns stay on Groq, because one command-line call measures about 8 to 12 seconds against a sub-second turn budget. Needs `claude` on PATH and `GROQ_API_KEY`. Moving to the API later is `TUTOR_LLM=anthropic` plus a key, and nothing else. |
| *(no key)* | your Claude subscription | `TUTOR_LLM=claude-cli-all` sends **every** call to the `claude` command, realtime turns included, while scripted SDK lessons still use Groq and require `GROQ_API_KEY`. Development only: each turn costs the same 8 to 12 seconds, so the learner waits through it, and the scene builder is given 30 seconds instead of 10 so a slow call does not lose the race and open a fixture scene. Reach for it when Groq's free tier is rate limiting you, or to judge coaching quality with no spend at all. Needs `claude` on PATH and `GROQ_API_KEY`. |
| `DEEPGRAM_API_KEY` | console.deepgram.com | French STT ($200 signup credit) |
| `ELEVEN_API_KEY` + `ELEVEN_VOICE_ID` | elevenlabs.io | The tutor's French voice (free tier) |
| `TONEPERFECT_API_KEY` | toneperfect.app (optional, token server) | Pronunciation scoring for speak drills and sound checks via the token server's `/drill/score`, and the default scorer whenever it is set. Absent, drills fall back to honest self-report. Live-scene scoring is built but off (`LUVANI_AUDIO_SCORING`, see F623 in `docs/KNOWN_ISSUES.md`). |
| `SPEECHACE_API_KEY` | speechace.com (optional) | The alternative scorer for the same `/drill/score`, used with `LUVANI_SCORING_VENDOR=speechace` or when it is the only scoring key set. Absent, drills fall back to honest self-report. |
| `TYPESAFE_API_KEY` | typesafe.ai (optional, token server) | Jev reads own-words drill attempts before the brain on `/drill/judge`. A clean pass is settled by Jev alone and skips the model call; everything else goes to the brain as before. See `packages/brain/src/llm/jevJudge.ts`. |

**Warm the voice cache first** (one-off, costs about 10% of one month's free
ElevenLabs credits, ever): every scripted lesson line is synthesized once and
saved to `services/tutor-agent/.tts-cache/`. After this, lesson audio replays
from disk at no cost and with no synthesis delay. Only the tutor's free-form
replies use live synthesis. Rerun after changing lesson text or the voice.
Lines are cached one sentence at a time, matching how the voice pipeline
requests them at runtime — a whole-line cache entry would never be hit.

```bash
npm run warm-cache --workspace=@luvani/tutor-agent
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
running on a service port it will reuse it when it recognises it and refuse
when it does not, naming the port and how to find out what has it. An existing
web preview is always refused: its HTML cannot prove which checkout it serves.
Stop that preview first, then run this command from the checkout you want.
The supervisor prints its checkout and Git revision and clears Metro's cache
when it starts the app.

For a fresh app-only preview without voice services, run this from the current
checkout and use the URL Expo prints:

```bash
npm run web --workspace=@luvani/mobile -- --clear --localhost --port 0
```

An old browser tab, exported `dist`, or server on another branch keeps serving
that version until you reload the correct URL, rebuild the export, or restart
from the current checkout. See [the cleanup audit](docs/DELETION_LEDGER.md#main-and-preview-audit-3-october-2026).

Starting them by hand still works if you want one process on its own:

```bash
~/.local/bin/livekit-server --dev
npm run dev --workspace=@luvani/token-server
npm run dev --workspace=@luvani/tutor-agent
npm run web
```

The token server's `dev` script is the one to use, not `start`. `start` sets
`NODE_ENV=production`, and a production boot refuses a laptop on purpose: the
local `LIVEKIT_URL` is `ws://` rather than `wss://`, and `LUVANI_AGENT_SECRET`
and `LUVANI_ALLOWED_ORIGINS` are deliberately unset in local development. It does
not warn, it exits.

**If the token server dies with `EMFILE: too many open files`,** that is
`node --watch` walking the whole workspace, not a shell limit — `ulimit -n` is
already in the millions on macOS and raising it changes nothing. Run the same
server without the watcher and it starts:

```bash
cd services/token-server
LUVANI_LOCAL_DEVELOPMENT=1 node --experimental-strip-types src/server.ts
```

You lose reload-on-save and nothing else. `npm run dev` from the repo root goes
through the watch script, so this is the fallback when the one-command boot
stops at the token server.

Forgetting one of those is exactly how the app comes to report that there is no
server available. Nothing is broken when it says that: the token server is not
running, the app's health probe fails, and the Tutor tab falls back to Demo.

In explicit local development, the home screen runs **Live** when the token server is
reachable and otherwise offers the mock pipeline. A deployed build fails closed instead
of silently crossing into demo identity or billing. The agent is authoritative: it owns the
ladder and lesson state and the app renders what it is sent over the data
channel (`packages/core/src/protocol/`). Metering is enforced at token
issuance — an out-of-minutes learner gets a 402 and the out-of-minutes screen,
and consumed seconds are debited by the agent when the room closes, so killing
the app does not dodge the meter.

---

## What is and isn't wired

**Working and covered locally by automated tests:**
the scaffolding ladder and its silence rescue · phoneme scoring and single-focus
selection · minimal-pair drill matching · the café lesson · session summary and
vocabulary · metering, entitlements and cost modelling · **drill mode**
(fill-blank, best-sentence, appropriate-reply, tap-translate, listen-type,
repeat-this, with typo-tolerant grading, re-queue-until-correct, the
recognition→production ramp over the review deck, and the "can't speak now"
mic swap). Public web onboarding/auth surfaces have browser evidence; authenticated,
native microphone, device and live-provider journeys still require release QA.

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


## Current UX implementation review

The PDF and 100-app review source changes landed on main on 3 October.
See [the 44-item implementation record](docs/UX_REPORT_IMPLEMENTATION.md) for
source evidence and [the acceptance worksheet](docs/UX_ACCEPTANCE_REVIEW.md)
for the remaining physical-device, French-review and sandbox/hosted checks.
The 3 October source gate passes 4,232 tests; this does not replace those release
checks. The founder's preview feedback can guide the next refinements.

The subsequent [main and preview cleanup audit](docs/DELETION_LEDGER.md#main-and-preview-audit-3-october-2026)
passes 4,237 tests and a fresh web export. It removes unused presentation and generic
audio, preserves active app/data/billing code, and prevents the dev supervisor from
silently reusing an older preview checkout.
