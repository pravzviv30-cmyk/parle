# TTS Caching

> 18 nodes · cohesion 0.18

## Key Concepts

- **CachedTTS** (11 connections) — `services/tutor-agent/src/ttsCache.ts`
- **CachedChunkedStream** (8 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.#missViaStream()** (6 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.#passthrough()** (5 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.run()** (5 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.#replay()** (4 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.#reportFirstAudio()** (4 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.#writeWav()** (4 connections) — `services/tutor-agent/src/ttsCache.ts`
- **normaliseLine()** (4 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.cachePath()** (2 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.close()** (2 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.constructor()** (2 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.stream()** (2 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.synthesize()** (2 connections) — `services/tutor-agent/src/ttsCache.ts`
- **defaultMissTransport()** (2 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.constructor()** (1 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.model()** (1 connections) — `services/tutor-agent/src/ttsCache.ts`
- **.provider()** (1 connections) — `services/tutor-agent/src/ttsCache.ts`

## Relationships

- [TTS Cache & Voice Config](TTS_Cache_&_Voice_Config.md) (5 shared connections)
- [Voice Sample Encoding](Voice_Sample_Encoding.md) (2 shared connections)
- [TTS Cache Test Fakes](TTS_Cache_Test_Fakes.md) (2 shared connections)
- [Fish TTS Test Fakes](Fish_TTS_Test_Fakes.md) (1 shared connections)

## Source Files

- `services/tutor-agent/src/ttsCache.ts`

## Audit Trail

- EXTRACTED: 38 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*