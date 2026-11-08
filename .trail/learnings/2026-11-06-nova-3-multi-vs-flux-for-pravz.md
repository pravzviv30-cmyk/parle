---
title: "nova-3 multi vs Flux for English answers: measured"
author: Pravz
date: 2026-11-06
branch: claude/tutor-hear-stay-8c1081
cost: { minutes: 30, tokens: 197237 }
touches:
  - DECISIONS.md
  - deployment/PAID_ADMISSION.md
  - docs/KNOWN_ISSUES.md
  - docs/LIVE_VOICE.md
  - packages/brain/src/prompt/prompt.test.ts
  - packages/brain/src/prompt/system.ts
  - scripts/measureKeyterms.mjs
  - scripts/measureKeyterms.test.mjs
  - scripts/paidQuotes.mjs
  - scripts/paidQuotes.test.mjs
---

## Decided
- 2026-11-06 founder: "Land fixes now, Flux next". STT stays nova-3 `fr` for lessons, guest scene and mission scene; Flux `flux-general-multi` with languageHint fr,en is the follow-up for every kind (F964).
- Measured with `scripts/measureKeyterms.mjs --conditions fr,multi,multi-ep25,flux --run --force` (synthetic English-accented ElevenLabs voice, clips in artifacts/multi-stt-2026-11-06/). Mean word accuracy lesson/scene/English: fr 0.958/1.000/0.169; nova multi ep100 0.917/0.861/0.929; nova multi ep25 0.958/0.840/0.929; Flux 0.958/1.000/0.950.

## Tried and ruled out
- nova-3 `multi` (with or without endpointing 100): loses scene French in both runs ("Sur place, merci" -> "Surplasmercy"/"Surplus. Merci"). Past the 2-point bar.

## Watch out
- Flux needs the paid proxy (paidVoiceProxy.ts) to speak /v2/listen and a Flux quote shape in scripts/paidQuotes.mjs (it throws 'flux is not quoted' today); F695 still holds real-learner end-of-turn and interruption checks.
- `--generate` rewrites artifacts/keyterms-2026-10-25/manifest.json's balance block even when no lesson clip is regenerated; revert it.
- The ledger's verified-by must be the exact full test title, including any "session exit:" style prefix.
