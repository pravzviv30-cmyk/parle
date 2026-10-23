# Post-session drills: gpt-5.6-terra vs gpt-6-luna (2026-10-22)

**Founder decision, 2026-10-23:** "Yes, switch to luna (Recommended)". Drills only; memory extraction stays on terra.

Both runs used the same café mission and the same 9 learner turns (`scripts/measureSessionLlm.mjs`), and the same drills route (effort and token limits). Only the model changed.

## Cost

| | gpt-5.6-terra | gpt-6-luna |
|---|---|---|
| Drills for one session | $0.0860 (6,013 output tokens, 10 exercises) | $0.0050 (8,623 output tokens, 14 exercises) |
| `eval:drills`, profile "first session" | 12/12 clean | 11/11 clean |
| `eval:drills`, profile "returning learner" | 11/11 clean | 14/14 clean |
| `eval:drills`, cost for the run | $0.129 | about $0.008 (1) |

1. The eval printed $0.182 because it priced luna at terra rates. That is fixed on this branch.

"Clean" means every exercise passes core's deterministic `validateExercise`. Every batch was also varied: at least three formats, with both recognition and production. The raw output is in `drill-eval-2026-10-22.txt`, and every exercise from both sessions is in `session-llm-*.json`.

## Three side by side samples (same session phrases)

**1. Recognition, "what can I get you"**
- **Terra:** best-sentence, "You are the barista. A customer is ready to order. What do you say?" The answer is « Qu'est-ce que je vous sers ? ».
- **Luna:** best-sentence, "At a café counter, which line asks what you would like?" The answer is « Qu'est-ce que vous souhaitez ? ». The distractors are « Vous souhaitez payer ? » and others.

**2. Transfer, "sur place"**
- **Terra:** best-sentence, "At a food market, you will eat at the counter rather than take your order away." The answer is « Sur place, merci. ».
- **Luna:** fill-blank, "À la pâtisserie, la vendeuse vous propose de manger votre tarte ici. Vous répondez : « ___ »". It accepts « Sur place, merci. », « Ici, merci. » and « Je reste ici, merci. ».

**3. Production, ordering**
- **Terra:** fill-blank, "À la boulangerie, vous dites : « Je vais prendre ___, s'il vous plaît. »". It accepts « un café » and four variants.
- **Luna:** tap-translate, "At a station café, say: Hello, I would like a coffee, please." The tokens include the distractors « thé, » and « merci. ».

## Reading
- Both models produce natural, level-appropriate French that changes the setting for transfer.
- Luna's accepted lists are slightly looser: « Ici, merci. » counts as "for here". That is acceptable for A1, and the own-words judge still grades free answers.
- No sample from either model failed the validator.
- **Not measured:** how learners do on the two sets. Beta drill accuracy should be compared before and after.
