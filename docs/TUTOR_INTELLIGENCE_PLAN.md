# Tutor intelligence and availability — 20 September 2026

## Implementation update

The owner approved publishing the reviewed session changes to GitHub on 20 September.
Publication is separate from application deployment. With explicit owner
permission, Parle was restored and the Conversation Packs prerequisite plus three
practice-recovery migrations were applied for testing. No hosted application services
have been created. Render signup and the `pravzviv30-cmyk/parle` repository connection
are complete; the web service form is not a deployed backend.

### This follow-up: durability and isolated voice evaluation

- Atomic receipt stores ready practice and a recovery job together. After that
  commit, another worker can recover drill generation following a crash. Claims
  have three-minute leases, stale completion fencing and at most five attempts.
  A late failed analyst cannot erase successful recovery. A delete leaves only a
  content-free UUID tombstone so delayed work cannot recreate the deleted pack.
- The separate practice worker validates and grounds exercises against the saved
  pack, logs only operational outcomes and performs no raw-audio/transcript storage.
  This does **not** recover a live process that dies before the initial receipt,
  nor rerun all curation/personal-memory extraction. Baseline practice remains usable.
- PostgreSQL/WASM tests executed the actual migration functions for idempotency,
  abandoned leases, stale fencing, retry exhaustion, deletion, restricted-role
  account deletion and permissions. Hosted checks confirmed RLS and service-only
  queue access. This is not a concurrent multi-worker load test.
- Supabase skill guidance informed explicit role grants, locked claims and a
  narrowly scoped, empty-search-path deletion trigger. Security advisor: leaked
  [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled; enable it before release if the project
  plan supports it. RLS-without-policy notices on queue/tombstone tables are
  intentional: these are service-owned, not client-readable.
- OpenAI account access to `gpt-live-1` was confirmed with a read-only model lookup.
  The installed LiveKit 1.9.0 SDK supports it, so no SDK/lockfile upgrade was needed.
  An opt-in named worker implements client-delegated teaching, a five-minute
  application deadline and ten bounded backend calls. It is **not** wired into
  learner sessions and does not write memory, grading, practice or progress.
- The local comparison page caps admission at twenty five-minute reservations,
  persisted across restarts. Failed starts count; one reservation at a time. These
  limits are not a provider-wide £20 or £100 currency cap. The page follows the
  paper/lime visual language and discloses audio processing and its test-only role.
- Both current and experimental voice explicitly pass `record: false` to LiveKit,
  disabling SDK recording/upload defaults. Provider data-processing/retention terms
  still apply; disabling app recording does not change those terms.

Local commands (repo root, after stopping an older dev supervisor):

```sh
npm run dev:durable
# In separate terminals, only when running the paid voice comparison:
npm run native-eval -w @luvani/tutor-agent
npm run voice:lab
```

The real app is `http://localhost:8082/tutor`; the isolated lab is
`http://localhost:8890`. Use Chrome and personally grant microphone access. The
comparison uses a synthetic A1 café brief, not the signed-in learner's memory.
`scripts/verifyNativeVoice.mjs` is a separate paid synthetic-silence transport
smoke, not a human quality test. Initial no-input transport smoke connected to
GPT-Live but produced no audible output. The synthetic-silence retry was refused
with 429 while the browser lab was already in use. The owner then confirmed:
“I can hear it and respond.” This verifies a real audible back-and-forth in the
isolated lab, not teaching quality, accurate correction, interruption quality,
production mobile compatibility. In the publication recheck, the synthetic-silence
smoke passed: protected admission, named-agent dispatch and non-silent received
audio. No microphone was opened, and no conversational-quality score is implied.

Latest verification: `npm run gate` passed with 3,123 tests across six workspaces,
type checks and the repository's other checks. `git diff --check` passed. The code
graph was updated; SQL graph extraction lacks the optional `tree_sitter_sql`
parser, so SQL was tested separately using PostgreSQL/WASM. The lab layout was
visually inspected in the browser. The main Tutor's real-device microphone QA
and the hosted recovery-worker test remain outstanding.

### Language-following correction in the isolated lab

The owner reported French-first replies after requesting English, and a return to
French after asking to answer in French while the tutor speaks English. The lab
now keeps tutor and learner language as separate session-local state, sends that
agreement to every teaching request, and updates the voice instructions before
speaking the answer. Only explicit language requests change the agreement; a
French practice answer does not. Superseded backend requests are cancelled and
their results fenced so an older response cannot overwrite a newer preference.

The OpenAI Docs guidance informed the separation of short voice instructions and
backend teaching policy, and explicit application-owned language state. A paid,
synthetic six-turn regression using the actual backend model passed twice: English
repetition, split tutor/learner language, two French answers, a requested French
pronunciation example without a mode change, and explicit return to French.
This is text-backend evidence, not proof of spoken adherence. Start a fresh lab
session and repeat the owner's scenario aloud before promoting the prototype.
The owner subsequently reported that it works. The agreement currently lasts for
that session only; it is not learner memory. The automated spoken transport check
does not inspect the language of the delivered speech.

### Hosting handoff, not yet deployed

Verify that Render's selected GitHub commit contains this handoff before deploying.
Keep auto-deploy off during the first configuration and connectivity checks. The
owner approved GitHub publication, free testing infrastructure and no paid services
at this stage; approval for a later paid plan is still required.

#### Free-first testing decision

- Keep the API on Render's Free compute plan for private tests. Expect sleep after
  15 minutes of no inbound traffic and roughly a minute to wake. Do not use keepalive
  pings to simulate an always-on service or describe this as production availability.
- Render does not offer a Free Background Worker. Run practice recovery locally
  with `npm run dev:durable` while testing; queued work waits when the computer is
  off. The saved baseline remains available after a successful initial receipt.
- Keep the existing locally supervised voice worker for this stage. A free LiveKit
  account does not make the external model/speech providers free. Existing bounded
  voice-test controls remain in place; no new paid hosting is approved.
- No custom domain is needed yet. A free Render Static Site can supply an HTTPS
  `onrender.com` address for the web app, with the API on its own generated address.
  Neither address exists until those services are created. Configure the actual
  frontend origin in API CORS and the auth redirect allowlist before testing login.
- Before a reliable external beta, approve always-on API and recovery-worker compute,
  hosted voice-worker capacity and provider spend limits, then test startup, session
  expiry, reconnection and conversation-to-practice persistence end to end. Upgrading
  a Render workspace subscription alone does not upgrade a service's compute plan.

| Setting | Token API | Practice worker |
|---|---|---|
| Service type | Web Service | Background Worker |
| Name | `luvani-token-api` | `luvani-practice-worker` |
| Runtime | Node; `NODE_VERSION=24.16.0` pins the locally tested version | Same |
| Root directory | Blank (workspace root) | Blank |
| Build command | `npm ci --workspace=@luvani/token-server --include-workspace-root=false --ignore-scripts` | Same |
| Start command | `npm run start --workspace=@luvani/token-server` | `npm run practice-worker --workspace=@luvani/token-server` |
| Health path | `/health` (process liveness, not vendor readiness) | Process supervision; inspect failed/expired jobs |
| Region | Nearest available to Parle's eu-west-1, shared by both services | Same |

The exact workspace-only install above passed in a clean temporary copy without
development secrets (21 installed packages, zero audit vulnerabilities). The API
then booted in production mode and served `/health` using placeholder credentials.
This verifies local Node 24.16.0/macOS packaging and process startup, not a Linux
Render build or connectivity to real vendors. `scripts/verifyRenderBuild.mjs`
repeats the startup check from a clean installed copy.

The token API requires `NODE_ENV=production`, cloud `LIVEKIT_URL`
(WSS), LiveKit server keys, Supabase URL/service key, shared `LUVANI_AGENT_SECRET`,
an exact HTTPS `LUVANI_ALLOWED_ORIGINS`, Upstash URL/token and a deployment-unique
rate-limit salt (at least 32 random characters). The API's `/drill/judge` also
needs `TUTOR_LLM=openai` and server-only `OPENAI_API_KEY`; these are not worker-only.
Set `LUVANI_DURABLE_PRACTICE=1` only after the queue migrations.
The worker needs the same Supabase URL/service key and flag, `TUTOR_LLM=openai`,
and its server-only OpenAI key. Do not copy all development `.env` values blindly;
never deploy local-auth or unlimited-minute flags. Leave billing dark until its
separate configuration is complete.

Render supplies `PORT`; do not copy the local port. Required secret names and
their scope are documented in `services/token-server/.env.example`. Enter keys
in Render's environment settings, never in chat or an `EXPO_PUBLIC` variable.
The beta browser app needs a real HTTPS origin before production CORS can be
configured; the HTTP localhost lab is not that origin. Do not weaken CORS to
substitute for hosting. Review the exact paid API and background-worker plans
before confirming a charge. The Deploy Web Service button deploys only the API,
not the separate practice worker, voice agent or frontend.

Source checks: [Render Node deployment](https://render.com/docs/deploy-node-express-app),
[Node version selection](https://render.com/docs/node-version),
[free-service limitations](https://render.com/docs/free), and
[OpenAI Live prompting](https://developers.openai.com/api/docs/guides/live-prompting).

The existing cascaded Tutor worker belongs on the chosen LiveKit Cloud project,
using its normal production entrypoint, current provider keys and the hosted
`TOKEN_SERVER_URL`. The native comparison worker is not a production replacement.
Before deployment, verify regional availability, full monthly baseline cost,
provider usage alerts, TLS/CORS, shared lease storage, restart behaviour and real
microphone lifecycle. Render's currently selected free Web Service sleeps while
idle; it does not meet the always-on requirement. Its form displayed a $7/month
512 MB option on 20 September, excluding the separate worker and other vendors.

Earlier UI verification: `npm run gate` was green (3,107 passing tests across six workspaces,
type checks, secret/hygiene/issue-ledger checks). `npm run build:web` and
`git diff --check` pass. Browser walkthrough covered matching errors and completion,
listening-to-reading fallback, correct/incorrect meaning feedback and the recall
handoff screen, including a 390px phone-width layout. The development stack was
restarted successfully at `http://localhost:8082`; the real browser is awaiting
onboarding/sign-in. This is not a claim of a tested microphone session.

Latest UI follow-up: removed the onboarding chapter masthead/count, signup French
caption and redundant auth wordmark. Functional step dots, back controls and
consent remain. Conversation practice uses a short “Practice” header with the
specific conversation title below it. Matching and listening/reading reveal a
meaning only after two failed attempts on that item. First-miss drill feedback
also withholds its answer data, not merely its visible text. French-choice
questions no longer display solving English glosses. Correct answers complete
immediately; assisted matches are not labelled correct. Browser checks verified
both failures, independent next-question counts, recovery with a correct answer,
and no horizontal overflow at 390px.

## Agreed direction (not deployed settings)

- **Core promise:** talk about something useful, save the relevant language,
  practise it from memory, and use it in a different conversation. Keep one
  learning record across Tutor, Practice, Home and My French. Recognition is not
  spoken mastery, and revisiting a topic should change the situation rather than
  simply replay a script.
- **Teaching:** brief, warm responses; one correction worth making; an independent
  retry; later reuse. Keep listening/silent alternatives and optional explicit help.
  Describe the tutor honestly as AI. Emotional sensitivity should show up as
  attentive pacing and encouragement, not invented feelings or life experiences.
- **Voice:** prioritise natural turn-taking over retaining every current voice,
  but retain the chained engine as the baseline until a measured trial wins.
  GPT-Live with client delegation is my first candidate for evaluation: it owns
  spoken interaction while Luvani owns trusted teaching state, memory access,
  grading and budgets. This is a proposed exception to PRODUCT.md's existing
  cascaded-only decision, not a silent architecture replacement. Account access,
  SDK/mobile compatibility and French quality still need verification.
- **Availability:** use managed LiveKit agent hosting for the current worker and
  a supervised HTTPS token API on the chosen hosting account. Keep cloud staging
  separate from production; start within trial quotas where suitable, move to a
  paid tier only with approval. Managed availability does not imply zero cold-start
  delay or a guarantee of uninterrupted service. Idle worker availability and an
  active, billable conversation are different things.
- **Spend:** owner accepted a **£100/month private-beta ceiling**, including a **£20
  one-off voice comparison allowance within that first month**. These are approval
  thresholds, not a quote or a claim that billing caps already exist. Check all
  provider bills, currency/tax, alerts and admission controls before deploying;
  close idle rooms and prohibit new sessions when the app's trial budget is spent.
  Keep the free tier to the weekly taste (5 minutes a week, one claim per device,
  D24 2026-10-20, which replaced the 30-minute lifetime trial); do not introduce
  unlimited voice. Re-price paid allowances after measuring full-stack cost.
- **Memory:** keep selected summaries, phrases and corrections rather than raw
  audio by default; make personal facts visible/editable/forgettable. Keep private
  conversation topics out of social features. Before release, verify deletion
  reaches derived practice and implement durable post-session recovery.

OpenAI currently lists GPT-Live voice at $0.05 per session minute, with backend
models/tools separate: 200 comparison minutes would therefore be $10 for that
voice component alone, not the complete trial. LiveKit lists Build at $0/month
and Ship starting at $50/month; quotas and model charges must also be considered.
Sources: [GPT-Live model](https://developers.openai.com/api/docs/models/gpt-live-1),
[delegation ownership](https://developers.openai.com/api/docs/guides/live-delegation),
[LiveKit pricing](https://livekit.com/pricing). Checked 20 September 2026 using
the OpenAI Docs skill and the existing same-day Firecrawl source capture.

Remaining release work: real-device microphone/interruption quality tests,
human-reviewed native-audio comparison, hosted queue-worker verification and
deployment/billing setup. The UI walkthrough is not evidence for those items.

### Existing implementation details

- Both teaching prompts now identify an AI French tutor. They invite concise
  explanations, independent attempts and later reuse, without fabricated human
  biography or claims of human emotions. First-run copy follows that identity.
- Open conversation, guided missions, rehearsal and conversation revision have
  different teaching briefs. Existing audio-scored pronunciation remains separate:
  a cleaned-up transcript cannot establish how a sound was pronounced.
- Continuation sends a pack ID, not client-authored memory. The authenticated
  server looks up only that learner's ready pack, bounds the learning context,
  signs it into the join token and supplies it to scene creation and turn prompts.
  Missing/foreign references fail explicitly rather than silently starting generic.
- The current shared review deck supplies at most three due/struggled-with phrases
  to the next conversation. These are optional teaching opportunities, not new
  CEFR or speaking-mastery evidence; they are not stored as personal memory.
- Saved conversations open matching pairs and listen-and-choose, with slow replay,
  corrective feedback, a reading alternative and a skippable warm-up. The next
  stage uses the existing review/drill scheduler, including correction phrases.
  Warm-ups do not independently award mastery or reschedule cards.
- Practice audio currently uses the device's French synthesizer, not a recording
  of the live tutor. This is disclosed on the screen. No live minutes are used.
- A successful initial post-session write now stores ready, deterministic practice
  before slower AI enrichment. A crash during enrichment leaves that baseline.
  Pack sync also restores missing phrase cards, not just exercises, preserving the
  existing card identity/schedule and adding no invented successful-speaking uses.
- Added bounded-context, ownership, token handoff, agent prompt, matching,
  listening-choice and recovery tests. The browser story is available in development
  at `/conversation-practice/preview`, labelled sample data and never written into
  learner stores. Production does not enable the sample-data branch.

### Deliberately not claimed complete

- The chained voice pipeline has not been replaced by native audio. Prompt changes
  alone cannot establish ChatGPT-like timing, emotional sensitivity or teaching
  quality. A paid, human-listened comparison and real-device interruption tests
  remain necessary. Existing model/voice routing was preserved.
- No hosted always-on infrastructure has been purchased or deployed. Local services
  stop when the computer/process stops. Always-on hosting may have an idle baseline
  charge; AI/STT/TTS use is a separate cost. Keeping a learner room connected is not
  the same as keeping the worker available.
- Initial-write failure still has bounded retries, not an externally durable queue.
  Saving ready fallback practice protects the period *after a successful write*;
  it does not guarantee recovery if the worker dies before that write succeeds.
  Older packs already stuck in generating are not retroactively rewritten.
- No live microphone conversation was validated in this implementation pass.
  Browser checks exercise the UI with explicitly labelled synthetic data, and
  automated tests use mocked providers. Neither proves real spoken quality.

### What is needed from the owner

1. Complete service configuration using the existing free LiveKit account and the
   newly connected Render account. Review exact service charges before creating
   paid resources, supply secrets through provider secret settings, and confirm
   region/retention and the app's HTTPS origin. The spend envelope is approved;
   provider-wide spend caps and always-on services are not yet configured.
2. Run the prepared native-voice comparison against the existing voice, keeping
   it isolated until French teaching quality and interruption handling are reviewed.
   Model access is confirmed; a model lookup is not a conversational quality test.
3. Several representative learner scenarios and the desired balance of correction
   versus conversation. Have a French-speaking reviewer assess accuracy, warmth,
   inappropriate corrections, learner pause handling and bilingual speech. Use the
   existing timing/spend instrumentation to compare end-of-speech to useful audio.
4. Sign into the real local app and personally grant microphone access for a spoken
   session. Do not paste API keys into chat; use existing environment/secret storage.
5. Explicit consent before any push to main, separately from hosting approval.

### Relevant official guidance

- [OpenAI voice agents](https://developers.openai.com/api/docs/guides/voice-agents)
- [GPT-Live delegation](https://developers.openai.com/api/docs/guides/live-delegation)
- [Securing the Supabase API](https://supabase.com/docs/guides/api/securing-your-api)

## Earlier orb and availability pass (historical)

- Centred the waveform by removing the fixed 12px vertical offset.
- Centred every orb layer and replaced muddy offset washes with a paper collar
  and restrained halo. Existing state colours and reduced-motion behaviour remain.
- Started the existing development stack using `npm run dev`. LiveKit, the token
  server and the tutor worker were running; provider preflight passed and the
  worker registered. The real app is at `http://localhost:8082/tutor`.
- The real app requires onboarding/sign-in in this browser origin. No learner
  microphone permission was granted and no actual conversation was claimed tested.
- Mobile suite: 1,397 passing tests. Mobile TypeScript and `git diff --check` pass.

## Baseline audit before the implementation above

| Area | Evidence | Implication |
| --- | --- | --- |
| Voice | `services/tutor-agent/src/agent.ts`, `voice.ts`, `convo.ts` | LiveKit carries a Deepgram → selected text brain → ElevenLabs pipeline. This is not native speech-to-speech. |
| Brain selection | Agent environment selects `openai`; `packages/brain/src/llm/openaiResponses.ts` | Defaults are GPT-5.6 Luna for turns and Terra for post-session work; no model overrides were configured. |
| Turn delay | `convo.ts` awaits a validated structured turn before speaking | The complete teaching payload is on the response's critical path. Measure before changing models. |
| Turn-taking | `services/tutor-agent/src/turnHandling.ts` | Silence-based detection, 400ms minimum endpoint delay and a 1,200ms/two-word interruption threshold. These protect against echo but can make interruption feel less responsive. |
| Persona | `packages/brain/src/prompt/system.ts` | Explicitly says “You are not a teacher”; warm conversation is prioritised over an explicit teaching identity. |
| Learner model | `packages/brain/src/profile/profile.ts` | CEFR evidence, recurring errors, phrases, preferences and up to 12 personal facts already exist. This is bounded memory, not exhaustive conversation recall. |
| Generated practice | `packages/brain/src/drill/generate.ts` | Six generated formats exist: fill blank, best sentence, appropriate reply, word assembly, listen/type and repeat. Matching-pairs and audio-choice screens from the supplied references are not equivalent existing formats. |
| Session artefacts | `convo.ts`, `services/token-server/src/conversationPacks.ts` | Curated topics, phrases, corrections and exercises are saved server-side by session ID; the agent can finish after the app closes. This is not yet evidence of durable recovery after a worker crash. |
| Privacy | `packages/core/src/conversationPacks.ts` | Packs intentionally exclude raw audio and full transcripts. Retain that boundary unless a separate opt-in feature is designed. |
| Continuation | `apps/mobile/src/conversationPacks/ConversationsScreen.tsx` | Library continuation passes topic titles, not the full pack or its correction focus. This path needs richer, server-authorised context. |

## Original implementation sequence (see current status above)

### 1. Establish a measured live baseline

Use the current tutor for repeatable French-learning conversations. Test long
beginner pauses, mixed English/French, accents, topic changes, interruptions,
incorrect-but-understandable answers and emotional frustration. Record end-of-
speech → first useful audio, p50/p95 latency, cut-offs, incorrect corrections,
learning outcomes, session completion and total per-session cost. Reuse existing
brain-playground evaluations; add human listening rather than relying on unit tests.

### 2. Separate conversation delivery from teaching decisions

Prototype an expressive native-audio frontend backed by Luvani's existing learner
model and teaching tools, alongside an optimised version of the current pipeline.
Official OpenAI documentation describes GPT-Live with a separately delegated
backend and Realtime speech-to-speech as distinct options. Compare both appropriate
paths against the baseline; do not promise ChatGPT parity or migrate by branding.

Keep verified teaching state authoritative outside the voice model. Preserve
chosen tutor identity where supported; native-audio adoption may change available
voices. Avoid serialising a large lesson-analysis object before every spoken
response. Only offload work that is not necessary for the correctness of that reply.

Replace the “not a teacher” identity with an explicitly AI language tutor who
reacts naturally, explains clearly, admits uncertainty and adapts support. Warmth
should mean attentive behaviour, not claims of human feelings or invented memories.

### 3. Give each entry point a teaching brief

Everyday mission: a real-world outcome and one or two target skills.
Open conversation: follow the learner's interest, then choose teachable moments.
Rehearsal: collect roles, context and desired outcome; run it, debrief it, try again.
Pronunciation: known reference audio/text and honest audio-based feedback.
Revision conversation: retrieve the selected conversation's useful language and
weaknesses, then test them in a related but changed situation.

Briefs should include level, goals, useful remembered facts, recent mistakes,
due phrases, correction preference and selected session context. Do not send the
entire history or assume recognition of a word proves independent production.

### 4. Make each conversation visibly become practice

Extend the existing Conversation Pack rather than creating a parallel system.
Show a topic card with provenance (“From your café conversation”), key language,
one correction, generation status and two actions: Review this conversation and
Talk about this again. Clearly distinguish lines actually used from extension
material generated later.

Add matching pairs, listen-and-choose, and a contextual response exercise in the
existing paper/ink/chartreuse design. Combine them with existing word assembly,
typing, speaking and own-words work. Supply replay/slow audio and a quiet twin.
Validate answer ambiguity, grammar, translation, level and connection to the source
material before publishing. Cache approved content and audio rather than generating
new material on every tap. Allow multiple valid French answers.

Replace title-only continuation with a server-authorised pack lookup carrying the
topic summary, key phrases, correction focus and prior review evidence. Do not place
raw transcript archives in join tokens. Audit continuation access consistently
across Tutor, Practice and the conversation library before changing plan rules.

Add a durable post-session job/outbox with retry and idempotency for worker crashes,
building on the existing server-side pack writes. Surface preparing/ready/failed
states. Deletion and forgetting must also cover derived learning artefacts where
the user expects them to; do not silently retain personal context through drills.

### 5. Close the cross-app learning loop

Use one learner model and an evidence ledger across Home recommendations, Tutor
briefs, Practice scheduling, My French and progress. Track recognition, unaided
recall and spoken use separately. Feed revision results back into the next tutor
session. Keep social features separate from private conversation topics.

## Availability and cost

Development servers can wait locally without continuously calling AI models.
The computer must remain awake and the processes must remain running. Startup
probes, real conversations and post-session generation can still incur API usage;
development does not make paid APIs free. A dev “unlimited minutes” setting changes
the app's allowance, not provider billing.

For testers and production, use supervised cloud services with restart, health
checks, HTTPS/WSS, budget limits and managed agent capacity. The API, database and
agent worker have different hosting needs; a permanent worker needs infrastructure
designed for long-lived processes, not an ordinary short-lived HTTP function.

Cost = platform/hosting floor + connected-session transport + speech processing +
model tokens + generated speech + post-session work + storage/egress/observability.
An open connected room may cost money while the learner is silent. Stop idle rooms
and cap session length. Do not quote text-model cost as total voice cost.

LiveKit's public pricing currently lists a $0 Build plan and Ship starting at
$50/month; hosted agent-session allowances and metering are separate from model
inference and optional services. These are not a quote for Luvani's complete stack.
No cloud deployment, plan purchase or always-on system service was created here.

## Sources checked

- [LiveKit pricing](https://livekit.com/pricing)
- [OpenAI voice architecture comparison](https://developers.openai.com/api/docs/guides/voice-agents)
- [OpenAI Realtime](https://developers.openai.com/api/docs/guides/realtime)
- [OpenAI semantic turn detection](https://developers.openai.com/api/docs/guides/realtime-vad)
- [ISSEN's published product description](https://issen.com/)

ISSEN describes adaptive, personalised conversational tutoring. Its marketing
does not establish its private model stack or prove comparative quality.
