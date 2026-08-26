# Environment Preflight Checks

> 24 nodes · cohesion 0.14

## Key Concepts

- **preflight.ts** (26 connections) — `services/tutor-agent/src/preflight.ts`
- **preflight.test.ts** (15 connections) — `services/tutor-agent/src/preflight.test.ts`
- **selectedBrain()** (14 connections) — `services/tutor-agent/src/preflight.ts`
- **preflight()** (6 connections) — `services/tutor-agent/src/preflight.ts`
- **verifyVendors()** (6 connections) — `services/tutor-agent/src/preflight.ts`
- **missingRequired()** (5 connections) — `services/tutor-agent/src/preflight.ts`
- **warnings()** (4 connections) — `services/tutor-agent/src/preflight.ts`
- **tutorLLM()** (3 connections) — `services/tutor-agent/src/agent.ts`
- **frameDeadlineMs()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **probeSynthesis()** (3 connections) — `services/tutor-agent/src/preflight.ts`
- **reportVendors()** (3 connections) — `services/tutor-agent/src/preflight.ts`
- **synthesisProbeRequest()** (3 connections) — `services/tutor-agent/src/voice.ts`
- **turnDeadlineMs()** (2 connections) — `services/tutor-agent/src/convo.ts`
- **NEAR_MISS_KEYS** (2 connections) — `services/tutor-agent/src/preflight.ts`
- **probe()** (2 connections) — `services/tutor-agent/src/preflight.ts`
- **REAL_KEY_NAMES** (2 connections) — `services/tutor-agent/src/preflight.ts`
- **Brain** (1 connections) — `services/tutor-agent/src/preflight.ts`
- **BRAIN_KEY** (1 connections) — `services/tutor-agent/src/preflight.ts`
- **Env** (1 connections) — `services/tutor-agent/src/preflight.ts`
- **FetchLike** (1 connections) — `services/tutor-agent/src/preflight.ts`
- **fakeFetch()** (1 connections) — `services/tutor-agent/src/preflight.test.ts`
- **FULL** (1 connections) — `services/tutor-agent/src/preflight.test.ts`
- **routedFetch()** (1 connections) — `services/tutor-agent/src/preflight.test.ts`
- **VendorCheck** (1 connections) — `services/tutor-agent/src/preflight.ts`

## Relationships

- [Agent Voice Config](Agent_Voice_Config.md) (7 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (6 shared connections)
- [Brain Client Activity Metering](Brain_Client_Activity_Metering.md) (6 shared connections)
- [Dev Boot Plan](Dev_Boot_Plan.md) (3 shared connections)
- [LLM Usage Pricing](LLM_Usage_Pricing.md) (2 shared connections)
- [OpenAI Responses Brain Client](OpenAI_Responses_Brain_Client.md) (1 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (1 shared connections)
- [Conversation Orchestration](Conversation_Orchestration.md) (1 shared connections)

## Source Files

- `services/tutor-agent/src/agent.ts`
- `services/tutor-agent/src/convo.ts`
- `services/tutor-agent/src/preflight.test.ts`
- `services/tutor-agent/src/preflight.ts`
- `services/tutor-agent/src/voice.ts`

## Audit Trail

- EXTRACTED: 67 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*