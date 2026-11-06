---
title: Today greeting copy and NextTaskCard billing refocus
author: Pravz
date: 2026-11-06
branch: claude/today-resume-greeting-67fd7d
cost: { minutes: 3, tokens: 127710 }
touches:
  - apps/mobile/src/home/greeting.ts
  - apps/mobile/src/home/skyView.ts
  - apps/mobile/src/practice/nextTask.test.ts
---

## Decided
- 2026-11-06 founder: Today's greeting has no trailing full stop ("Bonjour, Praveen", "Bonsoir").
- NextTaskCard's billing read keeps its held answer for the same scopeGeneration() on refocus (F961), the same rule F768 set for the data read. Only a scope change clears it, so a cold load still shows 'loading'.

## Tried and ruled out
- A todayLead-only test for the flash: todayLead was already correct with answered=true. The bug was the component resetting state on focus, so the test reads NextTaskCard source.

## Watch out
- The visible greeting is drawn by skyView.ts greetingText (SkyBand). homeGreeting().title is only the screen-reader label. Change both, plus pins in greeting, todayView, todaySkyParts, skyView and dev/todayPreview tests.
