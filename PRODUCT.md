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
open question in French, they freeze. Every existing AI tutor treats that freeze as
"still thinking" and waits.

## Product Purpose

Take someone who speaks no French and have them holding a real spoken exchange
inside one five-minute session — with pronunciation feedback they can trust, and
visible evidence they are improving.

Success is a beginner completing their first session without getting stuck or
asking a human for help, and coming back because they can feel and see progress.

## Positioning

Two things competitors structurally cannot copy without changing shape:

1. **Pronunciation feedback that is actually trustworthy.** Accuracy scoring
   requires a known reference text. Speak and Issen both lead with open-ended
   conversation, which is exactly why users of both describe their speech
   recognition as "too forgiving". Beginners spend most of a session on scripted
   and cued turns, so scoring is reliable precisely where our audience lives.

2. **French only, in depth.** A hand-built French phoneme inventory weighted for
   English-L1 error patterns, mapped to minimal-pair drills. Issen's founders
   publicly conceded their quality collapses in untested languages.

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
- **Metered minutes, enforced from v1.** Trial is a finite 30 minutes total (not a
  daily allowance). Paid: ~$19/180min, ~$39/450min. Unlimited pricing is rejected
  on modelled unit economics.
- Premium French TTS voices — the dominant cost line, and the most immediately
  felt quality signal for a beginner.
- Latency target: <800ms from end-of-learner-speech to first tutor audio.
- Learner-accented French breaks ordinary STT. Treated as the hardest technical
  risk in the build.

## Brand Commitments

Working name **Parle**. Not confirmed as final — treat as a placeholder the user
may replace.

Two hard behavioural commitments, both derived from confirmed research:

- **No streak guilt.** Streaks are a guilt mechanic implicated in intermediate-
  plateau churn. Progress is framed forward ("three sounds from unlocking the café
  scenario"), never as a loss to protect. Reaffirmed when the five-tab redesign
  asked for a days-active streak: the streak was dropped and a level ladder
  shipped instead.

- **The ladder displays evidence; it is not a new incentive.** Six levels
  (Beginner → Rookie → General → Captain → Master → Veteran) over XP that can
  only be earned by producing French — words said, turns composed unaided,
  phrases resolved, cards recalled. Never minutes elapsed, sessions started, or
  app opens, and capped per day so a marathon cannot buy a level. It measures
  returning, not bingeing, and it cannot be ground.
- **The learner is never stranded and never scolded.** No mid-session scores, no
  "wrong", no commenting on hesitation. The tutor steps in and carries the
  conversation the way a good human tutor does.

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
