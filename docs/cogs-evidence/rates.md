# Vendor rates behind the cost model, read 2026-10-22

These are list prices read on 22 October 2026, plus what the accounts themselves report. None is a negotiated quote.

## Text to speech: ElevenLabs
- **Pay-as-you-go API list prices** (elevenlabs.io/pricing/api, read in the browser):
  - v2 Multilingual (`eleven_multilingual_v2`, the live tutor's model): $0.08 per 1k characters.
  - Flash / Turbo (`eleven_flash_v2_5`): $0.04 per 1k characters.
  - v3 Conversational and v4 Turbo are also listed at $0.04, but were not tested here.
- **The account today:** `GET /v1/user/subscription` reports `tier: starter`, with a next invoice of $6.00 before tax. The credit limit is 37,277 including rollover, 1,622 used, and it cannot extend.
  - On this plan a credit costs about $0.20 per 1k.
  - v2 spends 1 credit per character. Flash spends 0.5.
  - Starter cannot carry a beta's volume. The cost model therefore uses the pay-as-you-go list price.
- **Voice multipliers:** two of the six tutor voices, `emilie` and `sarah`, bill twice per character, as measured in `scripts/compare-daily-voices.mjs`. The default voice, `alexandre`, bills once.

## Speech to text: Deepgram (deepgram.com/pricing, read in the browser)
Streaming, pay as you go:

| Model | Promo price per min | Regular price per min |
|---|---|---|
| Nova-3 Monolingual (lessons and in-scene, `fr`) | $0.0048 | $0.0077 |
| Nova-3 Multilingual (topic choice, `multi`) | $0.0058 | $0.0092 |

- **Promo end date:** the page says "Limited-time promotional rates on streaming" and gives no end date. The cost model uses the regular price.
- **Keyterm Prompting** is a billed add-on, and the direct conversation path sends keyterms (`agent.ts` `setSttPhrases`). The pricing page did not render its rate as text. A third-party comparison (soniox.com) puts it at about $0.0013 per minute. That figure is unverified.
- **Audio is billed by duration, silence included.** Deepgram hears every second the learner's mic is published, including while the tutor speaks.

## LLM: OpenAI (`packages/brain/src/llm/pricing.ts`, standard tier)
Per million tokens:

| Model | Input | Output | Cache read | Cache write |
|---|---|---|---|---|
| gpt-6-luna | $0.10 | $0.50 | $0.01 | $0.125 |
| gpt-5.6-luna | $0.20 | $1.20 | — | — |
| gpt-5.6-terra | $2 | $12 | — | — |

Priority tier, if the founder turns it on, bills more.

## Pronunciation scoring
- `assessmentPerUtterance` ($0.002) is the cost model's own figure, not a vendor quote. `docs/LIVE_VOICE.md` already lists confirming Speechace's billing unit and rate as an activation step. No public per-call price was found.
- **Live scoring is off by default** (`LUVANI_AUDIO_SCORING`). It scores lessons only, and only answers matching the reference line.
