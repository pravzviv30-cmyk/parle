/**
 * A kept guest practice becomes the account's first practice day, once
 * (Come alive, Phase 1, F744; README Part 6 "Guest day 1").
 *
 * The flame already lit on the first-run screen, in memory, for the guest. So
 * the hand-off writes each guest day's `streak:{day}` into the synced `seen`
 * list FIRST, then records the days, then settles one `guest` sitting with the
 * fixed +5 for practising. The streak is real and persisted from here on, and
 * the account never lights day one a second time, however many times the
 * hand-off runs.
 *
 * Only finish instants the guest record holds count (`guestPracticeDays`).
 * Until the first run persists them (F751, Phase 2) there are none, and then
 * this lights nothing and records nothing: a day nobody recorded is not one
 * this phone can vouch for.
 */

import { localDayKey, type DayKey } from '@luvani/core';

import { celebrationKey } from '../celebrate/events.ts';
import { guestPracticeDays, type GuestPractice } from '../onboarding/guestModel.ts';
import { recordActiveDay } from '../progress/activity.ts';
import type { PersistAck } from '../storage/ack.ts';
import { INTRO_SEEN_KEY } from './catchUp.ts';
import type { GameDelta } from './delta.ts';
import { beginSettle, finishSettle, gameEnvironment, releaseSettle } from './settle.ts';
import { markSeen } from './store.ts';

/** One finish instant per guest day, the latest on each, oldest day first. */
export function guestFinishes(practice: GuestPractice | null, dayOf: (at: number) => DayKey = localDayKey): { day: DayKey; at: number }[] {
  const days = guestPracticeDays(practice, dayOf);
  const latest = new Map<DayKey, number>();
  for (const at of practice?.finishedAt ?? []) {
    if (!Number.isSafeInteger(at) || at <= 0) continue;
    const day = dayOf(at);
    if (days.includes(day) && at > (latest.get(day) ?? 0)) latest.set(day, at);
  }
  return days.flatMap((day) => {
    const at = latest.get(day);
    return at === undefined ? [] : [{ day, at }];
  });
}

/**
 * Record a kept guest practice on the account and settle it. `failed` when a
 * day or its seen mark did not land, so the hand-off can say so and be tried
 * again; `durable` when every day is on disk (or there was none to record).
 */
export async function settleGuestHandoff(practice: GuestPractice | null): Promise<{ ack: PersistAck; delta: GameDelta | null }> {
  const finishes = guestFinishes(practice);
  if (finishes.length === 0) return { ack: 'durable', delta: null };
  const token = await beginSettle();
  const now = gameEnvironment().now();
  // Seen before the day exists, so no settle can ever find the day new and
  // unseen. The account is introduced here too: its practice is the one the
  // learner just kept, not practice saved before this layer, so the one-time
  // intro sheet has nothing to tell them.
  const marks = [INTRO_SEEN_KEY, ...finishes.map((finish) => celebrationKey.streak(finish.day))];
  if ((await markSeen(marks.map((key) => ({ key, at: now })))) !== 'durable') {
    releaseSettle(token);
    return { ack: 'failed', delta: null };
  }
  for (const finish of finishes) {
    if ((await recordActiveDay(finish.at)) !== 'durable') {
      releaseSettle(token);
      return { ack: 'failed', delta: null };
    }
  }
  const last = finishes[finishes.length - 1]!;
  const delta = await finishSettle(token, { source: 'guest', at: last.at, xpEarned: 0 });
  return { ack: 'durable', delta };
}
