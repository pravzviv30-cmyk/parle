---
title: Learner-facing error copy seam
author: Pravz
date: 2026-11-06
branch: claude/error-copy-ff7a03
cost: { minutes: 78, tokens: 331242 }
touches:
  - ".playwright-mcp/page-2026-11-06T20-33-38-884Z.yml"
  - ".playwright-mcp/page-2026-11-06T20-33-53-947Z.yml"
  - ".playwright-mcp/page-2026-11-06T20-33-56-520Z.yml"
  - ".playwright-mcp/page-2026-11-06T20-34-13-108Z.yml"
  - ".playwright-mcp/page-2026-11-06T20-35-11-140Z.yml"
  - ".playwright-mcp/page-2026-11-06T20-35-18-894Z.yml"
  - ".playwright-mcp/page-2026-11-06T20-35-23-922Z.yml"
  - ".playwright-mcp/page-2026-11-06T20-35-27-289Z.yml"
  - ".playwright-mcp/page-2026-11-06T20-35-28-442Z.yml"
  - ".playwright-mcp/page-2026-11-06T20-35-35-903Z.yml"
---

## Decided
- A caught error never reaches the screen as `e.message`. Catch blocks call `errorCopy(cause, fallback)` from apps/mobile/src/copy/errorCopy.ts. A sentence written for the learner is thrown as `LearnerError` and kept; a network or timeout failure gets the auth CONNECTION line; anything else gets the site's own fallback.
- The live failure screen's Support details show only a "Reference" failure code. URLs and timings stay in the `[luvani:live] failed` trace.
- Guard: copy/errorLeak.test.ts refuses `instanceof Error ? x.message` and `setX(e.message)` in non-test source.
## Tried and ruled out
- Treating every TypeError as a dropped connection: code bugs are TypeErrors too.
- Replacing a live `error` frame with no `kind`: every one is a literal learner sentence from services/tutor-agent (time limit, message too long, tutor busy), so hiding it told a learner to carry on after the session ended.
## Watch out
- A new own sentence thrown as plain `Error` gets swallowed into the fallback. Throw `LearnerError`.
- The live failure screen can't be reached on the web build without a backend; check it on a device.
