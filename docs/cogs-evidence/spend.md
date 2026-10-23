# Real-call spend for the cost-per-minute work (budget $2, hard stop $1.50)

| When | What | Cost |
|---|---|---|
| 2026-10-22 | `measureSessionLlm.mjs` on the current models: 9 turns, then curate, extract and drills | $0.1054 |
| 2026-10-22 | `measureSessionLlm.mjs` with extract and drills on gpt-6-luna | $0.0090 |
| 2026-10-22 | brain-playground `eval:drills` on gpt-5.6-terra (2 batches) | $0.129 |
| 2026-10-22 | `eval:drills` with `OPENAI_ANALYST_MODEL=gpt-6-luna` (2 batches) | about $0.008 (1) |
| 2026-10-22 | `ttsBlindCheck.mjs --generate`: 72 clips | 1,392 ElevenLabs credits, about $0.28 (2) |
| | **Total** | **about $0.53** |

1. The eval printed $0.182 because it priced gpt-6-luna at terra rates. That is the bug fixed on this branch (`openaiEval.ts`). The real cost is the same tokens at luna's $0.10/$0.50, about $0.008.
2. The account went from 1,622 to 3,014 credits used, which matches the per-clip `character-cost` headers (928 for v2, 464 for Flash). At the Starter plan's $6 for 30,000 credits, that is $0.0002 a credit.

Free calls, not counted: the ElevenLabs subscription reads, and the pricing pages read in the browser. VOICE-005's latency evidence was reused rather than re-run.
