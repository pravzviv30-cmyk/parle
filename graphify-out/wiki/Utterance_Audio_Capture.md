# Utterance Audio Capture

> 21 nodes · cohesion 0.17

## Key Concepts

- **utterance.test.ts** (10 connections) — `services/tutor-agent/src/utterance.test.ts`
- **utterance.ts** (9 connections) — `services/tutor-agent/src/utterance.ts`
- **UtteranceTap** (9 connections) — `services/tutor-agent/src/utterance.ts`
- **wav.ts** (7 connections) — `services/tutor-agent/src/wav.ts`
- **encodeWav()** (6 connections) — `services/tutor-agent/src/wav.ts`
- **observeEvents()** (5 connections) — `services/tutor-agent/src/utterance.ts`
- **observeFrames()** (5 connections) — `services/tutor-agent/src/utterance.ts`
- **decodeWav()** (5 connections) — `services/tutor-agent/src/wav.ts`
- **audioScoringEnabled()** (4 connections) — `services/tutor-agent/src/utterance.ts`
- **.capture()** (4 connections) — `services/tutor-agent/src/utterance.ts`
- **.sttNode()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **feed()** (3 connections) — `services/tutor-agent/src/utterance.test.ts`
- **.observe()** (3 connections) — `services/tutor-agent/src/utterance.ts`
- **.push()** (3 connections) — `services/tutor-agent/src/utterance.ts`
- **frame()** (2 connections) — `services/tutor-agent/src/utterance.test.ts`
- **.#framesBetween()** (2 connections) — `services/tutor-agent/src/utterance.ts`
- **CapturedUtterance** (1 connections) — `services/tutor-agent/src/utterance.ts`
- **finalTranscript()** (1 connections) — `services/tutor-agent/src/utterance.test.ts`
- **.elapsedSec()** (1 connections) — `services/tutor-agent/src/utterance.ts`
- **.take()** (1 connections) — `services/tutor-agent/src/utterance.ts`
- **WavData** (1 connections) — `services/tutor-agent/src/wav.ts`

## Relationships

- [Prompt and Turn Queue](Prompt_and_Turn_Queue.md) (5 shared connections)
- [TTS Cache](TTS_Cache.md) (3 shared connections)
- [TTS Cache Tests](TTS_Cache_Tests.md) (3 shared connections)
- [LiveKit Tutor Agent](LiveKit_Tutor_Agent.md) (2 shared connections)
- [Cached Audio Stream](Cached_Audio_Stream.md) (2 shared connections)

## Source Files

- `services/tutor-agent/src/tutor.ts`
- `services/tutor-agent/src/utterance.test.ts`
- `services/tutor-agent/src/utterance.ts`
- `services/tutor-agent/src/wav.ts`

## Audit Trail

- EXTRACTED: 49 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*