---
title: Calendar-minute quota buckets make PGlite proofs flaky
author: Pravz
date: 2026-10-25
branch: claude/quota-minute-flake
touches:
  - scripts/verifyDataBoundaries.mjs
  - supabase/migrations/20261003234853_privacy_maintenance_workflows.sql
---

## Decided
- `luvani_private.consume_data_write_quota` is a fixed calendar-minute (and UTC-day) bucket on `clock_timestamp()`. That is correct product behaviour, not a bug.
- `scripts/verifyDataBoundaries.mjs` calls `freshMinute()` before each counted burst (48 writes, the 240/min and day block, 60 events). If less than 5 s of the database minute is left, it waits for the next minute. The assertions keep their exact values.
- To compute "remaining" from a stored bucket, count a row stamped in an earlier minute as 0, because the next write zeroes it.

## Tried and ruled out
- Faking or overriding `clock_timestamp()`: the functions run with `search_path=''`, so pg_catalog resolves first, and a fake clock would prove different code from production.
- Loosening the 48/240/60 assertions to ranges.

## Watch out
- A proof that reads a counter and then writes to a limit races the minute boundary twice: once mid-burst, and once when a wait moves it into a new minute while the row still holds the old bucket.
- To reproduce, launch the proof so a minute boundary falls inside the burst (about 2.2 to 2.7 s after launch for the 48 burst). A plain loop fails only about 1 run in 50.
