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

In a scripted lesson, a rescue can still render the known target line, and the
tutor says that line for the learner to repeat straight from the script (see
`services/tutor-agent/src/scriptedSpeech.ts`), with no model call in between. In
free conversation, the first rescue renders only the English intent hint and is
quiet: nothing is spoken over a learner who may still be composing, and no model
call is made. A second rescue on the same exchange may reveal the French line,
and that one asks the tutor to step in. The tutor itself rephrases its own side
of the scene and never speaks the learner's answer over the card.

A rescue never advances past the thing the learner could not say. Scripted lessons
re-attempt the same turn; conversation refuses to complete the beat on the model's
`beatDone` after a rescue, exactly as it already refused after a reach for
English. Both are bounded by an attempt cap, so nothing can loop.

Asking for help is never scored against the learner. Neither is hesitating, and
the tutor is instructed at every rung never to mention it.

**Time to think (VOICE-009).** A pause mid-sentence is not the end of a turn.
At rungs 1-2 the session waits 1,200 ms of silence before it decides the learner
has finished, against 400 ms at rungs 3-4. Each time a learner is cut off (they
carry on within 1,500 ms, before the tutor has answered) the wait grows by
400 ms, up to 2,000 ms. Details and measured costs are in `LIVE_VOICE.md`.

**"Give me a moment"** is presence, not failure. It holds the rescue for
`MOMENT_GRACE_MS` (20 s), and while it is held the end of the turn waits 2,500 ms.
A stray sound does not spend the grace. Taps can push the rescue back by at most
`MOMENT_HOLD_CAP_MS` (60 s) per exchange, counted from the first tap. After that
a tap only restarts the ordinary four seconds, like a keystroke, so nobody is
stranded by a button. "Aide-moi" during a hold rescues at once, and the first
conversation rescue after a hold is still the quiet on-screen hint.

A sound that never becomes a turn (a cough, a word started and dropped) does not
switch the rescue off. The four seconds restart when the learner's sound ends.

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

In a live lesson the two axes are now also separate in time (VOICE-004). The
turn is graded and answered on its words alone, at once. Pronunciation is scored
in the background, only when the learner said the lesson's reference line, and
lands as evidence for the end card through `addPronunciation`, which never moves
the ladder. `grade`'s pronunciation rule still applies to callers that hand
`submitTurn` phonemes directly.

## One focus, one drill

`buildReport` in `packages/core/src/phonemes/scoring.ts` names **one** sound,
however many went badly, and always with a drill attached. Ranking is
wrongness × difficulty × confidence, with a 1.4× weight for phonemes that change
meaning, and a minimum of three samples before anything is flagged.

A phoneme with no drill is skipped and the next candidate is taken. Naming a
problem with no way to fix it is worse than silence — but so is falling silent
about a problem that *does* have a drill because a different one did not.

## Practice answer disclosure

The drill ramp is separate from the live support ladder. It now has five
stages across successful review sittings: options, tokens, typed retrieval,
spoken repetition, and own words. Reps 0 through 4 select those stages, so the
fifth sitting asks for meaning in the learner's own French. A missing format
falls back to the nearest easier one. Existing scheduling and the two-miss
limit stay in force; a miss earns no new rung. Own words checks the existing
semantic judgment, offers editable transcription or typing, and claims no
pronunciation or changed-situation transfer evidence.

An incorrect answer gets one retry without an answer or translation. Only the
second incorrect attempt on that exercise reveals it. The drill engine hides
the answer in both feedback copy and feedback data; conversation matching and
listen/read-and-choose use the same two-miss limit with separate counts per item.
Changing items starts a fresh count. A correct answer completes immediately.
French choice exercises do not display English glosses that solve the question.
Translation prompts and pronunciation references remain visible where they are
the task's input, not its answer. Guided introductions and explicitly revealed
flashcards remain distinct from graded retrieval.

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
| recalled | they produced it with the answer hidden, or reviewed it at all before this shipped |
| used | they used it correctly in a real conversation, at least once |
| transferred | they got it right when the situation changed |

Conversation outranks the flashcard on purpose. Nobody asked for the phrase; it
came out because the moment needed it. And knowing a line is not the same as
knowing when to use it, so the phrase that survives a changed situation sits
highest.

Recall means the answer was hidden first. A drill with the French among the
options is worth having and is not proof the learner could produce the phrase
unaided, so it does not earn this.

One deliberate exception, and it is worth naming rather than hiding. Any review
a card has ever had counts as recall, even one where the answer was showing.
Without that, everybody who had been reviewing before this shipped would open
their phrasebook and find it empty, and telling a learner they have shown
nothing is a worse untruth than counting a review that was easier than the ones
we ask for now. It reaches past the upgrade in two smaller ways too: a card's
first sitting is a scaffolded introduction, and a sound is always an
introduction, so neither is ever asked to produce anything. From here on the
count is the honest one, because a due card cannot be graded until an attempt
has been made.

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

Which scene is suggested next is `nextScene` in `missions/spine.ts`: the
learner's goal orders the suggestion, never gates a scene and never changes the
level, which still comes only from earned scenes (`spineFrom`). Until the
learner has earned a scene it is the spine's opener whatever the goal.

Journey's Your French counts only rise with evidence; the one way one goes down
is the learner deleting a phrase themselves.

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
