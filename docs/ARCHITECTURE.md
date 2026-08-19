# Architecture

Six workspaces. The line that matters runs through all of them: **the pedagogy has
exactly one implementation**, it lives in `packages/core`, and everything else
imports it. Two copies of "four seconds of silence means stuck, not thinking"
drift apart within a month, and then the app and the tutor disagree in front of a
learner.

```
packages/core/      Pure TypeScript. No network, no mic, no keys.
  phonemes/         The 36-phoneme French inventory, the drills, and scoring
  ladder/           The four-rung scaffolding state machine
  lessons/          "Commander un café", and what counts as a right answer
  session/          Scripted-lesson state: turns, attempts, the end card
  drill/            Typed practice and its grading
  text/             normalise + edit distance, shared by spoken and typed paths
  protocol/         The wire format between app and agent
  progress/ review/ metering/  History, the review deck, the unit economics

packages/brain/     The conversational tutor: prompts, engine, learner model
apps/mobile/        Expo → iOS, Android and web from one codebase
services/tutor-agent/    LiveKit Agents worker. The live voice pipeline
services/token-server/   Credentials, the metering gate, drill scoring
services/brain-playground/  Terminal chat and the AI-quality evals
services/shared/         Vendor adapters (Speechace). Not a workspace
```

## Who owns what

| Decision | Owner | Not |
|---|---|---|
| Whether an answer was right | `core/lessons/types.ts` `matchAcceptable` | the agent, the app |
| Which rung, and when to rescue | `core/ladder/ladder.ts` | anywhere else, ever |
| What the end card may claim | `core/session/session.ts` `summarise` | the screen rendering it |
| What the tutor says next | `brain/` (conversation) or `tutor-agent/prompt.ts` (lesson) | core |
| Whether a session may start | `token-server` at token issuance | the app |
| How anything looks | `apps/mobile` + DESIGN.md | core |

Metered minutes are enforced **at token issuance**, not in the app. Enforced in
the client they are a suggestion; without a token there is no room to join.

## Two paths, one ladder

**Scripted lesson** — `ParleTutor` (`services/tutor-agent/src/tutor.ts`) drives
core's `submitTurn` directly. The script is known in advance, which is exactly why
pronunciation scoring is possible here at all: accuracy scoring needs a reference
text, and this is where one exists.

**Free conversation** — `ParleConversation` (`services/tutor-agent/src/convo.ts`)
drives `packages/brain`'s engine, which imports core's ladder unmodified. The
pipeline LLM is never used for generation here; the brain generates out of band
and `session.say()` speaks the result.

## Mock or live

The app decides once, by probing the token server's `/health`
(`apps/mobile/src/app/LiveContext.tsx`), and swaps whole screens at
`apps/mobile/src/nav/RootNavigator.tsx`:

- **live** → `LiveSessionScreen` — a real room, a real agent, real STT.
- **demo** → `SessionScreen` — `mockSpeech.ts` fabricates a genuine anglophone
  error pattern so the full loop (ladder, rescue, scoring, drill selection) is
  real with no keys at all.

The demo is honest about being a demo, and it is the reason the whole pedagogy can
be developed and reviewed without a cent of vendor spend. It is also why a bug can
hide in the live path while the demo looks perfect — see LIVE_VOICE.md.

## No build step

Everything runs through `node --experimental-strip-types`. Packages point `main`
and `types` straight at `./src/index.ts`. Two consequences worth knowing before
you write code: **TypeScript parameter properties are rejected** (they emit
runtime code), and imports carry explicit `.ts` extensions.
