---
title: Opening B1 missions and reviewing mission French
author: Pravz
date: 2026-10-23
branch: claude/mission-spine-b1
touches:
  - packages/core/src/missions/missions.ts
  - packages/core/src/missions/spine.ts
  - packages/core/src/drill/fixtures.ts
  - packages/brain/src/missions/frames.ts
  - apps/mobile/src/scenes/scenePreview.ts
  - apps/mobile/src/drill/merge.ts
---

## Decided
- 2026-10-23 founder: missions reach B1 through `MissionLevel = CefrLevel | 'B1'` in packages/core/src/missions/missions.ts. Core's lesson-scoped `CefrLevel` stays A0 to A2. `spineFrom` gives B1 once every A0, A1 and A2 scene is earned; `nextScene` reaches B1 from A2. Learners see B1 as "Chatting" through `MISSION_LEVELS` and `MISSION_STAGE` in apps/mobile/src/scenes/scenePreview.ts.
- One Quebec scene (mission:montreal): standard Quebec French with a few local words, vous by default, no joual; the learner lines work in France too.
- Two read-only French reviews per batch: tutor-behaviour-engineer for register and naturalness, learning-science-engineer for CEFR level and drill targets. They catch different things.
- `MAX_DRILL_EXERCISES` is 384 for 278 fixtures; a full bank is about 27% of the 512 KB drills envelope.

## Watch out
- listen-type drills are transcription: every extra accepted answer must keep the drill's target structure (the connector, the conditional, the tense). The level review found nine that did not.
- A setting that names a time or place can contradict one of the five deck narrations. Keep settings location-neutral or check every narration.
- The copy rules reject "percent" (score language) and "not bad" (scold) in English, not just "wrong".
- A spoken-form phrase (t'es, a dropped ne) can be a phraseKey but never a referencePhrase, which needs frWritten null.
- Background subagents die when the app restarts. Commit a WIP checkpoint after every verified step.
- Run `npm run jev` from the main checkout: worktrees have no TypeSafe key file.

## Tried and ruled out
- Widening core's `CefrLevel` to B1: it would change the scripted lesson type that brain's types.ts promises stays A0 to A2.
