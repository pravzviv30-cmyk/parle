# The free-form tutor brain

This is the operating contract for the rebuilt free tutor and the provider
decision behind it. Prices were checked on 21 August 2026; verify the linked
vendor pages again before publishing.

## Product contract

- One tutor, two input modes. `convo` speaks and listens; `convo-text` uses the
  same scene, transcript, correction engine, learner profile and practice
  pipeline with audio disabled.
- The learner chooses the situation in English or French. The current request
  is binding; account memory can personalize it but cannot replace it.
- The character speaks first. The learner may answer in French, mixed language
  or English. Feedback responds to their meaning rather than an exact target.
- No ordinary turn shows a suggested answer. First help reveals one English
  intent hint. Repeated help on that exchange may reveal a possible French
  line. A real reply resets assistance.
- A French attempt that does not quite work gets a brief natural recast and the
  scene continues. Not on every attempt. An uninvited correction keeps a
  cooldown of 2 turns, because at A0 almost every sentence a learner produces
  has something worth saying about it, and a tutor who says all of it is running
  a drill rather than a conversation. What misses the slot is not dropped: it
  joins the recap. Two findings never wait, at any setting. A blocking error
  means the scene did not understand them, and holding it back to keep the
  rhythm pleasant strands them mid-conversation. The other is the answer to a
  question they asked, which is not an interruption at all.
- How much else surfaces mid-scene is the learner's setting, not a constant.
  Flow, balanced and strict move only *when* a finding lands, never whether it
  lands, and a new learner starts on balanced. Correct-but-textbook phrasing
  surfaces mid-scene at every setting, because telling people what locals
  actually say is the product.
- An English attempt gets the natural French for that meaning after the attempt.
- Each turn gets one verdict, and it is the code's. The spoken coach line has to
  describe the finding the tutor surfaced, the end card never celebrates a
  phrase the session corrected, and a learner who was right is never told they
  were not.
- Post-session practice is grouped by discussed topic. It keeps a small number
  of useful phrases, may add at most two closely related transfer phrases, and
  authors exercises across the six formats the practice engine supports.

The model proposes language. Code owns disclosure, support depth, caps,
deduplication, topic storage, exercise validation and scene progress. That
division is what prevents a prompt regression from turning support back into a
cheat sheet.

## Provider decision

Recommended first production configuration:

```dotenv
TUTOR_LLM=openai
OPENAI_API_KEY=your_standard_openai_api_key
# Optional overrides:
OPENAI_LIVE_MODEL=gpt-6-luna
# OPENAI_TURN_MODEL=gpt-5.6-luna
# OPENAI_ANALYST_MODEL=gpt-5.6-terra
# OPENAI_DRILLS_MODEL=gpt-6-luna
# OPENAI_CURATION_MODEL=gpt-6-luna
```

There is no separate GPT Luna credential. Luna and Terra use the normal OpenAI
API key. The implementation uses the Responses API with strict JSON schemas:
GPT-6 Luna handles live turns and scene design. GPT-5.6 Luna retains written
checks; GPT-5.6 Terra retains memory extraction. Since
23 October 2026, drill authoring runs on GPT-6 Luna (`OPENAI_DRILLS_MODEL`; drill eval
25/25 clean, about $0.005 instead of $0.086 a session; VOICE-008 in `DECISIONS.md`,
evidence in `docs/cogs-evidence/`). `OPENAI_ANALYST_MODEL` moves extraction only, not
drills. `OPENAI_LIVE_MODEL` changes only live turns and scenes. For compatibility,
an explicit `OPENAI_TURN_MODEL` also controls those calls when no live override is
set; it always controls the written-check judge. Since 24 October 2026, curated
phrases run on GPT-6 Luna through their own `OPENAI_CURATION_MODEL` (VOICE-012 in
`DECISIONS.md`), which `OPENAI_TURN_MODEL` no longer moves.
GPT-6 Luna is the founder-selected live brain as of
2 October 2026; API account access was verified, while comparative French
teaching and phone-audible latency remain unverified. Its Responses/structured
output support and standard short-context rates are documented on the
[official model page](https://developers.openai.com/api/docs/models/gpt-6-luna).
Default GPT-6 Luna live turns and scene frames use `reasoning.effort: none` to
reduce waiting. Explicit routing and valid `BRAIN_EFFORT` overrides still win;
background activities retain their routed effort. The 11 October synthetic paired
check returned schema-valid responses in 4.70 seconds at low and 2.78 seconds at
none. This small sample does not establish phone-audible latency or comparative
teaching quality. Full structured validation and output guards still precede TTS.

Ordinary turns on the exact `gpt-6-luna` route also set `text.verbosity: low`.
This prefers concise generated detail while retaining the complete strict turn
schema, support, translations, corrections, teaching instructions and output
ceiling. Other models, scene generation and background activities keep their
existing options. In a bounded 16 October comparison, three replies reached the
local LiveKit test client in 4.95–5.66 seconds before this change and 3.39–4.80
seconds with it. Output tokens fell from 329/428/361 to 306/404/271. These were
sequential synthetic scene runs, not a randomized quality study or phone-audible
latency guarantee. See [the change record](changes/bold-rhythm.md#live-reply-latency-follow-up--16-october)
for stage boundaries, voice checks and remaining limits. The official
[response-detail guidance](https://developers.openai.com/api/docs/guides/latest-model)
describes this preference; it does not replace required task content.
The paid-execution configuration hash includes this option. Regenerate and review
the affected production LLM quote/component bindings before opening admission,
as required by the [existing paid-admission contract](../deployment/PAID_ADMISSION.md).
An old configuration must fail closed; local staging latency checks do not
certify production quoted execution.

If tutor evals show a material live-turn quality gap,
change only `OPENAI_LIVE_MODEL` to Terra and compare again.

Anthropic remains a fully supported A/B route:

```dotenv
TUTOR_LLM=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Claude Sonnet 5 is a credible quality-first alternative. It costs more than the
Luna live route at the current list prices, and the existing Anthropic routing
also uses Opus for some background work. Keep it as the comparison arm rather
than making model preference part of the pedagogy. Groq remains useful for
zero-cost plumbing tests, but rate limits and model churn make it a poor
place to judge the tutor's intelligence.

Direct OpenAI Realtime audio is not the chosen migration yet. The current
cascade produces a trusted transcript plus one structured turn object used by
corrections, account memory and practice. Replacing STT and TTS together would
change several variables while the behavior is being repaired. Re-evaluate it
only after the new brain passes real learner sessions.

Official references:

- [OpenAI model comparison and token prices](https://developers.openai.com/api/docs/models/compare)
- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Anthropic model overview](https://docs.anthropic.com/en/docs/about-claude/models/overview)
- [Anthropic API pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
- [Deepgram pricing](https://deepgram.com/pricing)
- [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)

### Jev in front of the own-words judge

`TYPESAFE_API_KEY` on the token server puts TypeSafe's Jev in front of
whichever brain `TUTOR_LLM` chose, for `/drill/judge` only. Jev writes no text.
It answers four typed questions about an attempt in one request, at $0.042 per
million input tokens with output free. When the attempt kept its meaning, was
understood, is French and sounds natural, all above conservative thresholds,
Jev's verdict stands and the brain call is skipped: there is no better line to
write, and the app never shows the note on a pass. Everything else goes to the
brain, unchanged, including a confident "meaning lost", because the retry note
is written help and a learner who was right must never be told otherwise. If
Jev errors or takes longer than 2.5 seconds, the brain answers instead.

Two things before relying on it. Jev's strongest language is English, so the
thresholds in `jevJudge.ts` need checking against real learner attempts before
anyone lowers them. And the attempt now reaches TypeSafe, so the privacy policy
must name it before the key is set in production.

## Cost envelope

Current list prices used for planning:

| route | input / million tokens | output / million tokens |
|---|---:|---:|
| GPT-6 Luna (live turns/scenes, drills, curation) | $0.10 | $0.50 |
| GPT-5.6 Luna (written checks) | $0.20 | $1.20 |
| GPT-5.6 Terra | $2.00 | $12.00 |
| Claude Haiku 4.5 | $1.00 | $5.00 |
| Claude Sonnet 5 | $2.00 | $10.00 |
| Claude Opus 5 | $5.00 | $25.00 |

An illustrative twelve-turn OpenAI session with 90k Luna input / 10k Luna
output and 15k Terra input / 8k Terra output is about **$0.14 for the brain**
before cache discounts and separate curation/written-check calls (curation now at the GPT-6 Luna rate). This is a
planning example, not a billing promise. The
worker now logs actual input, output and cached tokens for every successful call
under `[luvani:brain]`; collect those lines from real sessions and replace the
example with measured p50 and p95 usage.

The rest of a ten-minute voice session is roughly:

- Deepgram Nova-3 streaming: about $0.0048 per audio minute at the promotional
  pay-as-you-go price, or about $0.05 if the whole ten minutes are billed.
- ElevenLabs Turbo: approximately $0.05 per minute of generated tutor speech.
  If the tutor speaks for four of ten minutes, that is about $0.20.
- Self-hosted local LiveKit: no vendor usage charge, excluding the server you
  eventually host it on.

That makes a useful early planning envelope around **$0.40 per ten-minute voice
session** for OpenAI brain + current STT + four minutes of Turbo TTS, before tax,
hosting, pronunciation scoring and vendor-plan effects. Text mode avoids STT and
TTS, so it is essentially the brain cost. Treat the measured token logs and
actual tutor speech characters as the publishing forecast.

## Acceptance checks

Do not judge this rebuild only by whether the API returns a response. A release
candidate should pass recorded scenarios for at least:

- teacher and school topic, café, friends, travel and an unexpected topic steer;
- correct French, imperfect-but-understandable French, English and mixed input;
- ordinary turn with no card, first help with hint, repeated help with line;
- voice and text producing the same correction and topic memory;
- a finished session producing categorized practice, a transfer phrase and at
  least three exercise formats across the generated bank;
- provider timeout, invalid structured output and unavailable post-session work
  all degrading without stranding the learner.
