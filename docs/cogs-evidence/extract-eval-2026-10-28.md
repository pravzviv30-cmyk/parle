# Memory extraction eval: baseline, 2026-10-28 (COST-001, F898)

`npm run eval:extract -w @luvani/brain-playground` on branch `claude/phase-f-cost`. There are ten synthetic sessions (`services/brain-playground/src/eval/extractFixtures.ts`), each run 3 times, so every config made 30 calls. Each call uses the real `buildExtractionRequest` and `buildSystemBlocks()` with the default persona.

| Config | Recall | Sensitive leaks | Fiction leaks | Known repeats | Structured failures | Opener misses | Out tokens (reasoning) | Spend, 30 calls | p50 / p95 |
|---|---|---|---|---|---|---|---|---|---|
| **Production**: gpt-5.6-terra, effort high, full transcript | 1.000 | 0 | 0 | 0 | 0 | 0 | 4,375 (1,954) | $0.0833 | 2.9 s / 5.1 s |
| gpt-6-luna, effort medium, full transcript | 1.000 | 0 | 0 | 0 | 0 | 0 | 5,605 (3,108) | $0.0043 | 3.6 s / 4.9 s |
| gpt-6-luna, effort medium, `--trim` | 1.000 | 0 | 0 | 0 | 0 | 0 | 5,768 (3,334) | $0.0044 | 3.4 s / 5.4 s |

**Pass rule:** zero leaks, zero repeats, zero failures, every opener rule held, and mean recall at least the baseline's. Both luna configurations print **PASS against the baseline**.

**Unlabelled facts:** 2, 2 and 1 per run. Every one is a version of "wants to be pushed or challenged" from the `delf-goal` session. That is a real preference the fixture does not label, so it is not a leak.

## Read these numbers carefully

**The spend above is warm-cache.** All 30 calls repeated the same prompts within minutes, so OpenAI served almost all input from its prompt cache: 3 uncached tokens per call, about 5,100 cached. A production extraction arrives once per session, and the learner's persona changes the system prefix, so most real calls will be cold. Cold-cache estimates from the same token counts:
- terra: about 5,100 × $2/MTok + 146 out × $12/MTok ≈ **$0.012 per session**
- luna: about 5,100 × $0.10/MTok + 187 out × $0.50/MTok ≈ **$0.0006 per session**

That is a 20 times difference. This is an estimate, not a measured saving. The real number comes from `session_cost` lines (`eval:cost-numbers`) after any switch.

**Trimming does not pay.** `--trim` drops the `(noted…)`, `(taught…)` and `(beat…)` lines. That removes only 50 to 220 characters per request, about 1% of a prompt that is mostly the 5,500-token system prefix. It is safe on these fixtures but not worth a product change.

**Small sample.** Ten sessions, labelled by one person with keyword matchers. A leak worded without any listed keyword is missed. The persona is the default, while production uses the learner's chosen one. The second baseline run counts `happensAround` toward a fact, because the prompt asks for the when there. The first run did not, and it marked one luna answer ("job interview", happensAround "Tuesday") as a miss.

**Phase D will change this prompt.** It adds a fact `source` and a sensitive screen. Re-run this eval on the changed prompt before deciding anything.

## Decision

**No model was switched.** Moving `extract` to gpt-6-luna would set `OPENAI_ANALYST_MODEL=gpt-6-luna` or add an extract-specific knob. That needs the founder's OK, and this eval re-run green on the Phase D prompt.

## Spend for this run

Total about **$0.21**:
- the first pass: $0.106 terra, $0.0058 luna, $0.0054 trim
- the re-run after the `happensAround` scorer fix: $0.0833, $0.0043 and $0.0044

All on the local `OPENAI_API_KEY`.
