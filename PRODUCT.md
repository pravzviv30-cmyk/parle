# Product

<!-- impeccable:product-schema 1 -->

<!--
Product truth here was confirmed by the user across two structured question rounds
and an approved build plan (~/.claude/plans/so-claude-what-i-ticklish-dolphin.md),
not inferred. Nothing below is an assumption unless explicitly labelled.
-->

## Platform

ios

Ships from one Expo/React Native codebase to iOS (primary, first store release),
then Android, then web. One shared design language across all three — this is not
a per-OS adaptive design. Web is a real target, not a fallback.

## Stack

Expo (React Native) + TypeScript, npm workspaces monorepo. Shared pure-TS logic in
`packages/core`; the tutor runs as a LiveKit Agents worker in `services/tutor-agent`.
Chosen by the assistant and confirmed by the user's "target all three effectively".

## Users

English-speaking **absolute beginners** in French — CEFR A0–A2. People who have
decided to learn French and have either never started or bounced off Duolingo. They
practise alone, usually on a phone, in short sessions: a commute, a lunch break, ten
minutes before bed. They are adults with no French vocabulary, not children.

The defining trait: they cannot yet compose a French sentence unaided. Asked an
open question in French, they freeze. Most AI tutors leave that freeze to the model's
prompt, and many simply wait. Some now aim at it too: Duolingo's guided Falstaff calls
(January 2026) and Babbel Speak (September 2025). Luvani's answer is that the rescue is
enforced in code: silence or a call for help always gets support, and support is
withdrawn only once the learner shows they can manage.

## Product Purpose

Take someone who speaks no French and have them holding a real spoken exchange
inside one five-minute session — with pronunciation feedback they can trust, and
visible evidence they are improving.

Success is a beginner completing their first session without getting stuck or
asking a human for help, and coming back because they can feel and see progress.

## Positioning

Two things Luvani is built around. They are a wedge, not yet a moat: each can be
copied by a well-funded competitor. What makes them hard to copy is what they produce
with use, a growing set of consented, human-rated beginner French recordings that
calibrates scoring and recognition, plus independent evidence that learners improve.
Market review of 2026-10-22: https://claude.ai/artifact/1TLMTEHTGdToCv8WDCqVAe

1. **Pronunciation feedback that is actually trustworthy.** Accuracy scoring
   requires a known reference text. Beginners practise scripted and cued turns,
   which give a scorer a known line to assess. Show pronunciation feedback only
   when an assessment returned evidence; an unavailable assessment stays
   unscored. Open conversation is practice, with no promise of reference-based
   scoring on a line that has no reference. The one exception is a line the
   tutor handed over: when the learner says that line, it is a known reference
   and is scored like a lesson turn.

2. **French only, in depth.** A hand-built French phoneme inventory weighted for
   English-L1 error patterns, mapped to minimal-pair drills. The inventory and
   its examples are authored for French, rather than inferred from an English
   pronunciation model.

## Operating Context

- Phone in hand or in pocket, headphones in, often in public. Speaking aloud in
  public is socially costly — the product must never require the learner to look
  foolish or repeat themselves loudly.
- Sessions are short and interruptible. A commute ends mid-lesson.
- Learners are frequently alone with no one to correct them, which is why
  trustworthy feedback matters more than volume of practice.

## Capabilities and Constraints

- Realtime voice: cascaded STT → LLM → TTS via LiveKit Agents. Not a
  speech-to-speech model — cost and French-quality control both demand cascaded.
- Pronunciation assessment needs a reference text; free conversation yields
  fluency signals only. This constraint shapes the whole scaffolding design.
- **Metered minutes, enforced from v1.** The app is free to use (D24, 2026-10-20,
  the Headspace model): free learners get a weekly taste of live time, 5 minutes on a
  rolling 7 days from first use, claimed once per device, and a lapsed plan falls back
  to it. The 7-day trial and the paid plans unlock the rest. Paid: Core 180 minutes,
  Max 300 minutes. Prices come from the store. Unlimited pricing is rejected
  on modelled unit economics.
- Premium French TTS voices — the dominant cost line, and the most immediately
  felt quality signal for a beginner.
- Latency target: <800ms from end-of-learner-speech to first tutor audio.
- Learner-accented French breaks ordinary STT. Treated as the hardest technical
  risk in the build.

## Brand Commitments

Working name **Luvani**. Not confirmed as final — treat as a placeholder the user
may replace.

Two hard behavioural commitments, both derived from confirmed research:

- **No streak guilt.** Luvani counts a daily streak, and it is built so that it
  never shames or threatens. The product refused a streak twice, as a guilt
  mechanic implicated in intermediate-plateau churn. The founder reversed that
  refusal on 2026-10-04 (decision D2 in `docs/come-alive/README.md`), and the
  streak keeps the promise this bullet is named for. The streak, the XP display,
  quests and badges are being built in that programme; until each one ships,
  these are the rules it is built to.

  A streak day is any finished practice on the learner's local calendar day: a
  live conversation, a guided lesson, a practice set, a review, today's phrase,
  or free offline practice. Running out of live minutes never breaks a streak,
  because the free practices count too. A safety stop earns no day. The number
  is the practice days in the current run.

  A free learner holds one freeze and a paid plan holds two, plus repair (D23,
  2026-10-20). A freeze is applied automatically, a covered day keeps the run
  without adding to it, and a used freeze comes back a week later. For a free
  learner a missed day the freeze cannot cover starts a new run. Just after a run ends, a free learner sees one
  calm line on the Streak screen and a way to see plans:
  "Subscribers can repair a streak within 2 days." There is no notification
  about it, no countdown, and never "save your streak".

  Streak copy states facts ("Your 12-day streak is waiting") and never threatens:
  no loss, no "at risk", no "last chance", no countdowns, no sad faces. Every
  streak and reminder line passes `BANNED_IN_STREAK_COPY` in
  `apps/mobile/src/copy/guilt.ts`, which is the shared ban list plus the
  countdown, the plea and the sad face in words. The word "streak" itself left
  the shared list by the same decision, and `RETIRED_FROM_BAN` records it there.

  A reset never shows a nought on its own. The lifetime count of practice days
  sits beside the streak wherever the streak appears, and it keeps every
  property of the **Days active** tile that came before it. History: Home
  carried that tile from 2026-09-05 until the notebook redesign of 2026-09-27,
  and it was not the streak refused twice. A streak is a chain: it reads
  yesterday, and it can end. The tile counted the distinct days that have an
  entry. So it only ever rises, and a quiet day costs nothing. For the tile,
  yesterday is never read, and there is no state a loss could be written into.
  It was present from the first day and worded as a start: where the count would
  be nought no numeral was drawn, and the line beside it pointed forward. Those
  properties now belong to the lifetime count, and they are still held by name
  in `apps/mobile/src/progress/momentum.ts` and its suite.

- **XP, levels, quests and badges are shown, and stay honest.** The level path
  still displays evidence: a CEFR level (A0, then A1, then A2) and one can-do line per
  scene. Before a scene is earned the line says what they will be able to do
  ("Order a coffee at the counter"). Once it is earned the line says what they
  can do ("You can order a coffee"). A scene is earned only on independence
  evidence: a finish with nothing handed over, read from the best-ever attempt,
  so a replay with more help never takes it back (`isEarned` in
  `packages/core/src/missions/missions.ts`, `spineFrom` in
  `packages/core/src/missions/spine.ts`).

  Beside it the learner sees XP and numbered levels (Level 1, 2, 3 and on),
  never a rank name. XP counts French the learner produced: words said, turns
  composed unaided, phrases resolved, cards recalled. A finished practice that
  nothing grades (today's phrase, a review where nothing was recalled, the
  guest's first reply once an account keeps it) earns a fixed 5 XP for
  practising, so every win counts and none is inflated. Three daily quests add
  fixed bonuses, and each is completed only by finished practice. Milestone
  badges mark real counts and are awarded once. XP never comes from minutes
  elapsed, sessions started or app opens, and practice XP is capped per day, so
  a marathon buys nothing. XP is shown on the end card of a finished practice,
  as the XP the saved sitting actually credited, and never during one. Every
  celebration names a persisted event, and a safety
  stop earns and celebrates nothing. There are no leagues or leaderboards, no
  paid currency, and no random rewards.
- **The learner is never stranded and never scolded.** No mid-session scores, no
  "wrong", no commenting on hesitation. The tutor steps in and carries the
  conversation the way a good human tutor does.

One visual commitment sits beside them:

- **Chartreuse is a highlighter, never paint.** It marks the one thing on a
  screen that is the learner's own: a French line they have made theirs, or
  "you are here" on their path. It appears at most once per screen, and it is
  never the ground of a panel, card, tab or button. The brand mark, Hum, carries
  none: it is sun and coral on the brand blue. The colour and its rule live in
  `apps/mobile/src/palette.ts` (`highlight`).

## Evidence on Hand

Real, in-repo, already built and tested. The Phase 3 landing floor is 1,791 passing
tests across all six workspaces, including 507 in core:

- 36-phoneme French inventory with English-L1 difficulty weighting — `packages/core/src/phonemes/inventory.ts`
- 15 minimal-pair and articulation drills — `packages/core/src/phonemes/drills.ts`
- Scoring that returns exactly one focus point — `packages/core/src/phonemes/scoring.ts`
- Four-rung scaffolding ladder — `packages/core/src/ladder/ladder.ts`
- Full 12-turn "Commander un café" A0 lesson — `packages/core/src/lessons/cafe.ts`
- Session engine and summary — `packages/core/src/session/session.ts`
- Metering and cost model — `packages/core/src/metering/meter.ts`
- Versioned cross-device state reconciliation with per-domain conflict policies —
  `apps/mobile/src/sync/`
- One account-aware onboarding path with AI, privacy and microphone disclosure —
  `apps/mobile/src/onboarding/`
- Mission, review and generated-drill practice paths — `packages/core/src/missions/`,
  `packages/core/src/review/`, `apps/mobile/src/missions/`, `apps/mobile/src/DrillScreen.tsx`
- The scene spine: thirty-one scenes in order from A0 to B1, each earned only on
  independence evidence, with the learner's level read off what is earned, in
  `packages/core/src/missions/spine.ts`

Absent, and must not be fabricated: any user testimonials, learner counts,
retention figures for this product, App Store presence, press, or funding.
Competitor figures cited in the plan are researched and sourced; our own are zero.

## Product Principles

1. **Never let the learner be stuck.** Support is present by default and withdrawn
   as they improve — not absent and granted on request.
2. **Say one thing, not everything.** The end of a session names a single sound to
   work on. Eleven red bars teaches a beginner they are bad at French.
3. **Words-right and sounds-right are separate questions.** Never collapse them
   into one verdict.
4. **Competence over compulsion.** Retention comes from visible improvement, not
   from streak anxiety.
5. **Depth in one language beats breadth across fifty.**

## Accessibility & Inclusion

- Spoken-language app: everything spoken must also be readable on screen. The
  learner may be in a quiet carriage, hard of hearing, or simply unsure what they
  heard.
- Touch targets sized for one-handed phone use while walking.
- Never require the learner to speak loudly or repeatedly in public to progress.
- Text must survive OS-level dynamic type scaling.
