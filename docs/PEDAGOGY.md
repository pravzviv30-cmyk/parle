# The pedagogy

The rules a beginner meets. The scripted lesson and free tutor share one ladder
for pace, promotion and rescue counts. They deliberately do **not** share one
support-disclosure rule: a script may teach by showing its target, while a free
conversation must let the learner author their own reply first.

## The four rungs

`packages/core/src/ladder/ladder.ts`. Lower means **more** support.

| rung | name | scripted lesson support |
|---|---|---|
| 1 | Echo | the whole French line, with its English meaning |
| 2 | Cued | two or three French options, said aloud, never tapped silently |
| 3 | Prompted | an English hint. No French words |
| 4 | Free | nothing |

In a scripted lesson, whose line is on the card is **the learner's own next line** —
never the tutor's. Echo means repeat the line you are being handed, not the line
you just heard: a scene where the barista asks "vous désirez ?" and the card says
"vous désirez ?" has the learner playing the wrong role. A scripted lesson gets
this for free, because `LessonTurn` keeps `tutor` and `target` in separate fields.
Free conversation has one model call writing both, so `learnerSideSupport` in
`packages/brain/src/engine/conversation.ts` is what stands in for that split.

In free conversation every ordinary turn renders **no support at all**, whatever
the rung. The rung changes sentence length and pace only. `assistanceDepth` in
`packages/brain/src/engine/conversation.ts` owns the separate disclosure path:

| depth | when | free-tutor card |
|---|---|---|
| 0 | opening and every real learner attempt | nothing |
| 1 | first explicit help or genuine stuck interval | one English intent hint, no French |
| 2 | repeated help on the same exchange | the learner's possible French line |

Speaking or typing a real reply resets depth to zero immediately. This is a
code rule, not a suggestion to the model, so an easy learner level can never
turn the tutor into an answer prompt.

Movement: two consecutive good turns promote. A `poor` turn drops one. A
`partial` turn **holds** — dropping there punishes normal beginner performance. A
skip drops silently. A pause under four seconds does precisely nothing; the state
is returned unchanged.

## The rescue

Four seconds of silence (`STUCK_SILENCE_MS`) or an explicit "aide-moi" are the
same event: the rung drops, `rescues` increments, and `rescued` is set.

In a scripted lesson, a rescue can still render the known target line. In free
conversation, the first rescue renders only the English intent hint. A second
help request on the same exchange may reveal the French line. The tutor itself
rephrases its own side of the scene and never speaks the learner's answer over
the card.

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

## What counts as learned

`packages/core/src/review/evidence.ts`. Every phrase carries one record, and it
holds three counts: retrievals, uses in conversation, and correct answers to
drills that changed the situation. The counts only ever go up.

Four states, and a phrase sits at the highest one it has evidence for. These are
not the support ladder above. That one is about how much help a turn gets, this
one is about what the learner has shown.

| state | what earns it |
|---|---|
| introduced | the phrase exists in the deck. Nothing has been shown yet |
| recalled | they produced it with the answer hidden, at least once |
| used | they used it correctly in a real conversation, at least once |
| transferred | they got it right when the situation changed |

Conversation outranks the flashcard on purpose. Nobody asked for the phrase; it
came out because the moment needed it. And knowing a line is not the same as
knowing when to use it, so the phrase that survives a changed situation sits
highest.

Recall means the answer was hidden first. A card showing its own back and a
drill with the French among the options are both worth having, and neither is
proof the learner could produce the phrase unaided, so neither counts here.

`mastered` is no longer a state. It is a projection: three correct uses in
conversation, read off the same count, so a flag can never disagree with the
evidence that produced it.

Nothing here decays. What expires is the schedule, not the record, because a
thing that happened stays happened.

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
- Free conversation always gives the learner the first attempt; its first rescue
  is a hint, and only repeated help reveals a possible line.
- No score is ever shown mid-session. Numbers belong on the end card, where they
  can be given context.
