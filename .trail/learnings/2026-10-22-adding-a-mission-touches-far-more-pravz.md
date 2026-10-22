---
title: Adding a mission touches far more than the catalogue
author: Pravz
date: 2026-10-22
branch: claude/mission-spine-a2
cost: { minutes: 1, tokens: 1367 }
touches:
  - DECISIONS.md
  - DESIGN.md
  - PRODUCT.md
  - apps/mobile/src/art/flat/index.ts
  - apps/mobile/src/art/flat/scenes.test.ts
  - apps/mobile/src/art/flat/scenes.ts
  - apps/mobile/src/art/registry.test.ts
  - apps/mobile/src/drill/merge.ts
  - apps/mobile/src/drill/store.ts
  - apps/mobile/src/game/sources.ts
---

## Decided
- 2026-10-22 founder: missions may reach A2 (`Mission.cefr` is `CefrLevel`; `SpineView.level` reaches A2 once every A0 and A1 scene is earned). Learner surfaces say Everyday through `MISSION_LEVELS` and `stageOf` in apps/mobile/src/scenes/scenePreview.ts.
- Missions share the six drawn `MissionPlace`s, following the daily pool. Uniqueness is per drawing (`scenes.test.ts`), not per place.
- Each new scene gets its own `place-*` drawing authored in docs/design-assets/ILLUSTRATIONS.md and generated with `node scripts/illustrations.mjs docs/design-assets/ILLUSTRATIONS.md`. Postcards may borrow for now (F865).

## Watch out
- A new mission needs: the MissionId union and a MISSIONS entry, SCENE_SPINE, an AUTHORED_PATH unit, two DRILL_FIXTURES per phraseKey (repeat-this needs a noMicTwin), a frame in MISSION_FRAMES and a 5-narration, 3-line MISSION_OPENING_DECKS entry, MISSION_TOPICS in exploreCatalogue.ts, and SCENE_ILLUSTRATION and POSTCARD in apps/mobile. Approved can-do rows live verbatim in missions.test.ts.
- Exact counts are pinned in missions.test, spine.test, scenes.test, registry.test and surfaceContract.test. KNOWN_ISSUES F570 and F599 name the registry test by a title that carries the drawing count: rename both or the gate fails on the ledger.
- `copyViolations` treats "wrong" as a scold word, so can-do and beat English cannot say "what is wrong".
- Reference phrases need at least four vowel groups, frWritten null, and no names, numbers, ordinals or cities.
- Fixtures are the floor above `MAX_DRILL_EXERCISES`; fixturesMissing.test.ts fails when fixtures plus 48 exceed it. Raise the cap with the content.
- Ship the tutor agent before the app: an agent that does not know a mission id opens the ordinary topic question.
- verifyDataBoundaries.mjs's per-minute write-quota proof can flake when a run crosses a minute boundary. Rerun before suspecting your change.

## Tried and ruled out
- A new MissionPlace per scene: each needs a new icon, daily scenarios and goal words. Reusing the six was chosen instead.
