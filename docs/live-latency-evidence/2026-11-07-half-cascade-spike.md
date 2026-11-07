# Half-cascade spike: gpt-realtime-2.1 hearing the learner, answering in text (2026-11-07)

Lane D's last item (VOICE-022, F967): would a realtime audio model as the conversation brain,
with ElevenLabs still speaking every line, answer sooner than the tuned text cascade? This is a
measurement on synthetic clips, not an integration. Branch `claude/half-cascade-spike`, script
`scripts/measureHalfCascade.mjs`, report `2026-11-07-half-cascade-spike.json`.

## Method

- Model `gpt-realtime-2.1` over the Realtime WebSocket API, `output_modalities: ['text']`,
  `turn_detection: null`, one fresh session per clip. Instructions are exactly what the live
  turn sends (`persona + pack + contract`, as `openaiResponses.ts` `instructionsFor` builds
  them) plus one sentence saying the learner is heard as audio and the JSON contract applies.
  The scene history goes in as text items; the learner's own words are NOT given as text, only
  as audio.
- Clips: the 16 synthetic English-accented clips of `artifacts/multi-stt-2026-11-06/` (8 French
  scene replies, 8 English answers; 1 to 2.1 s each), resampled 22,050 to 24,000 Hz. Two reps,
  32 calls, $1.18 at list prices.
- Clock: from `input_audio_buffer.commit` (end of the learner's audio) to the first text delta,
  to `sceneReply.fr` closing, and to `response.done`.
- Reference, the tuned cascade from end of speech: Flux end of turn p50 699 ms
  (`2026-11-07-1530-flux-stt.md`) plus brain spoken fields p50 937 ms on the priority tier with
  reply-first (`2026-11-07-lane-d.md`), about 1,636 ms.

## Numbers

| kind | n | first text p50 | first text p95 | `sceneReply.fr` closed p50 (strict JSON only) | done p50 |
|---|---|---|---|---|---|
| French scene reply | 16 | 3,016 ms | 6,399 ms | 2,840 ms (n=4) | 5,406 ms |
| English answer | 16 | 2,831 ms | 5,425 ms | 5,047 ms (n=5) | 6,787 ms |
| tuned cascade reference | | | | **1,636 ms** | |

The first text delta is a hard lower bound on when the spoken reply could start, and it alone
is about 1.4 s slower than the cascade's whole path to the spoken fields.

## What it answered

- **The contract is not honoured.** With text output the Realtime API has no JSON-schema
  output format; the model wrote pseudo-JSON in 27 of 32 calls (unquoted keys such as
  `sceneReply: {`, a `text` field where the contract says `fr`, two calls wrapped in a prose
  preamble, three in a ```json fence). Only 9 of 32 would have parsed as the turn. The live path
  depends on that JSON for the assessment, the coach line, the guard and the checkpoint.
- **English answers are understood but not handed back.** "A coffee, please" got "Très bien.
  Sur place ou à emporter ?", which is the right scene move; but none of the 16 English calls
  produced the English coach line the contract requires at rungs 1-2 (`handedBackInFrench`
  false in every row), and "What does that mean?" and "Sorry, I didn't understand" were treated
  as orders ("Bonjour. Je peux prendre votre commande."). The cascade's Flux replay of the same
  clips hands back in character (`2026-11-07-live-turn-flux-english.json`).
- **Hearing is not better than Flux on these clips.** "Je prends un thé" was answered
  "Bonjour. Vous voulez un café ?" once (a tea heard as a coffee), and "Merci, bonne journée" as
  "Je vous écoute pour la commande" twice (the goodbye not heard as one).

## Verdict

Does not win. Slower by about 1.4 s at p50 before any audio is produced, and it drops the turn
contract and the English hand-back the product is built on. The data-path question (learner
audio to OpenAI) therefore does not need the founder's answer for this shape. Nothing lands;
the branch keeps the script and this record. A future retry would need structured text output
on the Realtime API or a different division of labour (the realtime model only transcribing
with tone, the text brain still writing the turn), which is a different spike.

Synthetic voices, not learners; one clip per turn with no prior audio in the session; list
prices for the spend estimate only.
