# The pedagogy

The rules a beginner meets. All of them live in `packages/core` and are shared by
the scripted lesson and free conversation — `packages/brain` imports the ladder
rather than reimplementing it.

## The four rungs

`packages/core/src/ladder/ladder.ts`. Lower means **more** support.

| rung | name | what the learner sees |
|---|---|---|
| 1 | Echo | the whole French line, with its English meaning |
| 2 | Cued | two or three French options, said aloud, never tapped silently |
| 3 | Prompted | an English hint. No French words |
| 4 | Free | nothing |

Movement: two consecutive good turns promote. A `poor` turn drops one. A
`partial` turn **holds** — dropping there punishes normal beginner performance. A
skip drops silently. A pause under four seconds does precisely nothing; the state
is returned unchanged.

## The rescue

Four seconds of silence (`STUCK_SILENCE_MS`) or an explicit "aide-moi" are the
same event: the rung drops, `rescues` increments, and `rescued` is set.

**A rescue always renders the full line, whatever the rung.** The drop is for the
*next* attempt; the turn they just froze on is answered with the answer. A freeze
at Free that landed on Prompted used to hand back an English hint — asking the
person who could not compose French a moment ago to compose French again, while
`RESCUE_PREFIX` simultaneously told the model to give them the line.

A rescue never advances past the thing the learner could not say. Scripted lessons
re-attempt the same turn; conversation refuses to complete the beat on the model's
`beatDone` after a rescue, exactly as it already refused after a reach for
English. Both are bounded by an attempt cap, so nothing can loop.

Asking for help is never scored against the learner. Neither is hesitating, and
the tutor is instructed at every rung never to mention it.

## What counts as a right answer

`matchAcceptable` in `packages/core/src/lessons/types.ts`. Four routes, each
looser than the last, tried against the target, the turn's `accepts`, and its
acceptable options:

1. **exact** — after `normalise` (case, accents, apostrophes, punctuation).
2. **filler** — the same line with hesitation stripped (`euh`, `bah`, `alors`…),
   and only when the candidate does not itself contain that word.
3. **typo** — one Damerau-Levenshtein edit across the line, the same window the
   typed drills use (`packages/core/src/text/distance.ts` — one implementation,
   shared, because forgiving a typed answer and failing the identical spoken one
   is indefensible).
4. **content** — every meaning-bearing word present, small words loose, one edit
   per word, and no more than two extra words. The cap is what stops containment
   accepting anything with the right word in it somewhere.

Anything else that produced at least half the line's content words is `near`,
which grades `partial` — it holds the rung. Below that is `poor`.

The pressure runs both ways and both directions are failures. Too strict and a
beginner who said the right thing with an "euh" in front is told "Not quite" and
dropped a rung. Too loose and the feedback stops being worth anything — which is
the criticism levelled at every competitor. The tests hold both ends: `euh un café
sil vous plait` must pass, and a different real French sentence must fail.

## Two independent axes

Words and pronunciation are graded separately (`grade` in `session.ts`). Wrong
words are `poor` no matter how beautifully said. Right words are `good` at any
accent a listener would have understood (`INTELLIGIBLE = 50`) — gating promotion
on accent would trap every learner with a strong English accent at Echo forever.

A null pronunciation score never invents a penalty.

## One focus, one drill

`buildReport` in `packages/core/src/phonemes/scoring.ts` names **one** sound,
however many went badly, and always with a drill attached. Ranking is
wrongness × difficulty × confidence, with a 1.4× weight for phonemes that change
meaning, and a minimum of three samples before anything is flagged.

A phoneme with no drill is skipped and the next candidate is taken. Naming a
problem with no way to fix it is worse than silence — but so is falling silent
about a problem that *does* have a drill because a different one did not.

## Where the next session opens

`openingRung` in `ladder.ts`, one function for both engines. One rung below where
the learner finished. Once there is a `lastRung` it decides alone and the CEFR
band steps aside: what someone actually did last session is better evidence than
what they told an onboarding screen.

## The invariants

A change that breaks one of these is a bug, however green the tests are.

- A learner who hesitates is **never** remarked on.
- A learner is **never** forced to speak aloud. Every spoken path has a quiet twin.
- A pronunciation score is **never** invented, implied or displayed unless it came
  from audio measured against a known reference. An unscored session says so.
- A learner is **never** stranded mid-scene. Every failure has a way forward.
- A freeze is answered with **the line**, not with a smaller hint.
- No score is ever shown mid-session. Numbers belong on the end card, where they
  can be given context.
