---
title: Tab-bar drag haptics and the live hold on haptics
author: Pravz
date: 2026-11-06
branch: claude/tab-drag-haptics-da4049
cost: { minutes: 4, tokens: 141423 }
touches:
  - DESIGN.md
---

## Decided
- 2026-11-06 founder: the tab-bar drag (nav/LuvaniTabBar.tsx PanResponder) claims a sideways move over 8 px from ANY tab, not only the open one. A still press stays the cell's tap; a still long press is never claimed (F947 Large Content Viewer). The detached bar (no selected tab) never claims. The grant sets `over` from the finger so a short drag lands on the cell under it. Ledger F961.
- Every haptic is gated by hapticsEnabled = enabled && !micLive() && !liveRoom() (motion/hapticPreference.ts). The live hold comes from ensureAudioSession and goes in releaseAudioSession (live/globals.native.ts).

## Tried and ruled out
- "Haptics stay off app-wide until relaunch after a live session": the trace shows leave(), unmount, abandoned(), ParticipantDisconnected (via teardownRoom) and the recap's releaseLiveHold all release. ensureAudioSession replaces its hold rather than stacking it. The only gaps were the start catch block (failed connect) and RoomEvent.Disconnected (dropped). Both kept the hold while the error view showed, and both now release.
- An Apple Developer account is not needed for haptics: there is no entitlement.

## Watch out
- tabBar.test.ts pinned the selected-tab-only gate on purpose (push-check fix 3, 2026-11-02). Change those regexes deliberately, not by accident.
- Haptics cannot be felt on web or in the simulator. Only a device check proves them. Also check that iOS Settings > Sounds & Haptics > System Haptics is on.
- In the catch path a disconnect that throws keeps the hold on purpose, because the room may still be up.
