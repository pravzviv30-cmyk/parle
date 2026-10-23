# Vendor comparison: one method, run only with founder approval

- Status: method written, tool built (`eval:replay`); not run, because it spends money
- Updated: 2026-10-23
- Existing programme / contract: market report section 7 "Next" (settle on one model vendor);
  [session-eval.md](session-eval.md)

## The question

Which brain should answer live turns for the beta? Pick the one with the lowest
**cost per accepted turn**, provided its acceptance rate is not worse than the baseline's.
Production today is `TUTOR_LLM=openai`, with live turns on gpt-6-luna (VOICE-008).

## Method

1. **The same sessions for every candidate.** Use every synthetic record, plus up to five dev
   sessions the founder records with `npm run chat -- --record`. Freeze the set before the first
   run, and note its git commit in the result.
2. **Replay, not re-chat.** `eval:replay --provider <name>` feeds each record's learner inputs
   (spoken text, silences, help) through the brain's own loop, in order. That loop is
   `createConversation`, `applyNonSpokenInput`, `prepareTurn`, `client.turn`, `integrateTurn`.
   Every candidate therefore sees the same learner and the same scene. The tutor lines that come
   back are new and are scored by the session eval's checks.
3. **Candidates.** `openai` (the baseline, the live model `openAiModelFor('turn')` resolves to),
   `anthropic` (the routed talker in `llm/routing.ts`), and `groq` (`defaultModel()`). Add a
   candidate only by adding a provider the brain already supports.
4. **Accepted turn.** A replayed turn the brain answered that passes every applicable check:
   rescue, no read-back, gentle, level fit and safety. This counts what a learner would be shown
   or hear, so a fast cheap answer that reads the card back costs a rejected turn, not a saving.
   A quiet first rescue and a safety answer make no model call in the live tutor, and replay does
   the same, so those turns are counted on their own. They would otherwise lift every vendor's
   acceptance by the same amount.
5. **Measures per candidate.**
   - acceptance rate, and failures by check;
   - cost per accepted turn: total measured spend divided by accepted turns, priced by
     `evalCostUsd` from the usage each call reports;
   - p50 and p95 brain latency per turn.
6. **Repeat three times.** Model answers vary, so report the median of three runs and their range.
   A difference smaller than the range is no difference.
7. **Decision rule.** Prefer the lowest cost per accepted turn among candidates whose acceptance
   is within 2 points of the baseline and whose p95 latency is not worse by more than 300 ms.
   If none qualifies, stay on the baseline. Write the result into
   [IMPLEMENTATION_EVIDENCE.md](../IMPLEMENTATION_EVIDENCE.md) "Vendor cost record".
8. **What the method cannot see.** Voice quality, speech recognition and pronunciation scoring are
   unchanged by the brain. Synthetic learners are tidier than real ones, so a switch also needs a
   short founder listening pass on dev sessions before it reaches the beta.

## Spend, for approval

- **Pilot first.** Replay one synthetic record on each candidate (a few cents in total). The tool
  prints the measured cost, so the full estimate comes from it rather than from a price table.
- **Full run.** About 40 synthetic turns plus up to 100 dev turns, on 3 candidates, 3 times each:
  roughly 1,300 turn calls. At the pilot's measured cost per call this is expected to stay under
  a few dollars. The founder approves the pilot's figure before the full run.
- Keys come from `services/brain-playground/.env`. Nothing here reads learner data, and no learner
  text goes to any vendor.
