# Cost per live minute: before and after (2026-10-23)

**Basis:** list prices from `rates.md`, measured usage from this folder, and a 5-minute session. The six-voice roster's mean credit multiplier is 1.33. Every figure is in USD per minute of session.

## A mission minute (all generated speech, the worst case)

| Component | Old model | Measured, before | After (this branch) | Founder option: Flash for conversation lines | Quality impact |
|---|---|---|---|---|---|
| STT, Deepgram Nova-3 | 0.0043 | 0.0090 (1) | 0.0090 | 0.0090 | none |
| LLM, live turns (gpt-6-luna) | 0.025 (2) | 0.0014 | 0.0014 | 0.0014 | none |
| LLM, after the session (curate, extract, drills) | in the line above | 0.0205 | 0.0043 | 0.0043 | drills on luna: eval 25/25 clean against 23/23 on terra (`analyst-samples.md`) |
| TTS, ElevenLabs | 0.0225 (3) | 0.0273 (4) | 0.0273 (5) | 0.0136 | Flash is the founder's blind check (`listening/`) |
| Scoring (model's own rate, 3 per minute) | 0.0060 | 0.0060 (6) | 0.0060 | 0.0060 | none |
| **Total** | **0.0578** | **0.0642** | **0.0480** | **0.0343** | |
| Total without scoring | 0.0518 | 0.0582 | 0.0420 | 0.0283 | |

1. Nova-3 Monolingual streaming at the regular $0.0077, plus about $0.0013 for Keyterm Prompting. The add-on figure is unverified. The current promo rate of $0.0048 would bring STT to $0.0061.
2. This priced a Claude talker. Live turns have run on gpt-6-luna since VOICE-003 and VOICE-005.
3. Calculated as $0.045 × 0.5 speaking share.
4. Calculated as $0.109 per tutor-speaking minute (v2 at $0.08 per 1k characters, 1,020 characters a minute, ×1.33 for the voice mix) × a 0.25 share. A mission measures 0.22: about 4 turns a minute at about 56 spoken characters each.
5. The replay memo makes "hear" and "english" taps free. That saving is not modelled, because we have no tap-rate data yet. The `[luvani:cost]` line will measure it in beta.
6. Live scoring is off by default (`LUVANI_AUDIO_SCORING`). The vendor rate behind it is still unverified.

## A lesson minute (authored, scripted speech)

| Component | Before | After (this branch) | Quality impact |
|---|---|---|---|
| STT | 0.0077 | 0.0077 | none |
| LLM (missed answers only, gpt-6-luna) | about 0.0003 | about 0.0003 | none |
| TTS | up to 0.054 on a cold container (7) | about 0 once the volume is warm (8) | none: same audio |
| Scoring (when the flag is on, reference-line matches only) | 0.004 to 0.006 | 0.004 to 0.006 | none |
| **Total** | **up to 0.068 cold** | **about 0.012 to 0.014** | |

7. Every line the tutor speaks is billed until that container has heard it. Production containers start empty in `/tmp`, and entries expired after 7 days.
8. Authored entries no longer expire. A Railway volume (a founder step in `docs/changes/beta-launch.md`) keeps them across deploys. Warming the cache once costs up to 17,700 characters for all six voices.

## What it takes to get under $0.02 for a mission minute
These figures are computed from the rates above, not measured.

| Stack | Cost per minute (no scoring) |
|---|---|
| This branch, plus Flash and the Deepgram promo, on the default 1× voice | about 0.022 |
| A cheaper vendor for conversation lines, such as Fish Audio at about $0.016 per 1k characters | about 0.017 |

Fish was not put in the blind check, because none of its voices match the six tutors. Scripted lines would then sound like a different person from conversation lines.

The next lever after that is STT, which hears the room the whole time the mic is open. Pausing it while the tutor speaks would break barge-in (`turnHandling.ts`), so it was not built.
