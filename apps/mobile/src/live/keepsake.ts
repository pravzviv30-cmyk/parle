/**
 * The recap as a keepsake, decided — notebook Phase 4 (B1), report change 19.
 *
 * The end of a conversation is where a learner decides whether to come back, so
 * it is something kept rather than something scored: the lines they said, one
 * phrase kept, one sound, and "Next time" naming the spine's next scene. After
 * all of that, and only then, the recap offers a daily reminder at the time the
 * learner chooses on the offer or previously chose in Settings. The offer is
 * drawn by the one shared ask, `reminders/ReminderAsk.tsx` (Come alive, README
 * Part 6), and accepting it plans through `reminders/ReminderPlanner.tsx`.
 *
 * ## When the phone is asked
 *
 * Never on the way in. `reminderOffer` is a pure answer from facts the screen has
 * already read (`reminderPermission()` reads; it raises nothing), so drawing the
 * offer cannot put a system dialog in front of anybody. The dialog is raised in
 * exactly one place, `acceptReminderOffer`, which a screen calls from the accept
 * control. A learner who has not had a win yet is not offered anything at all.
 *
 * ## What a reminder is
 *
 * Not decided here. `reminders/reminder.ts` owns the presets, the words, and
 * what a stored flag means over a revoked permission (`reminderRow`), and this
 * module asks it rather than holding a second opinion. The accept flow is the
 * same shape Settings has used since F576: ask or read, decide with
 * `reminderRow`, write, schedule, and put the store back if the phone refuses,
 * so the app never believes in a reminder the phone will not deliver.
 *
 * The platform calls come in as arguments so the whole flow runs on node; the
 * screen hands in `reminders/schedule.ts` and `reminders/store.ts`.
 */

import { getMission, nextScene, type LearnerGoal, type MissionProgress } from '@luvani/core';

import type { PersistAck } from '../storage/ack.ts';
import {
  DEFAULT_REMINDER_MODE,
  REMINDER_REFUSED,
  reminderMode,
  reminderRow,
  reminderTime,
  type ReminderMode,
  type ReminderPermission,
  type ReminderTime,
  type StoredReminder,
} from '../reminders/reminder.ts';
import type { ScheduleOutcome } from '../reminders/schedule.ts';
import type { TurnLine } from './turns.ts';

/** Enough to be a keepsake, few enough to read at a glance. */
export const MAX_KEEPSAKE_LINES = 3;

/** The keepsake's own labels, in the order the recap draws them. */
export const KEEPSAKE_COPY = {
  lines: 'Your lines',
  kept: 'One phrase kept',
  sound: 'One sound',
} as const;

/**
 * The lines the learner said, as they said them: their own French, the last few
 * of the conversation, once each, in the order they came. Nothing the tutor or
 * the narrator said is theirs to keep.
 */
export function keepsakeLines(turns: readonly Pick<TurnLine, 'who' | 'fr'>[]): string[] {
  const said: string[] = [];
  for (const turn of turns) {
    if (turn.who !== 'learner') continue;
    const line = turn.fr.trim();
    if (line.length === 0) continue;
    const at = said.indexOf(line);
    if (at !== -1) said.splice(at, 1);
    said.push(line);
  }
  return said.slice(-MAX_KEEPSAKE_LINES);
}

/**
 * "Next time: <the next scene>", or null once there is none.
 *
 * Core's `nextScene(progress, goal)`, the same call behind Speak's Start and
 * Today's hero, so the end card never names a different scene from the one
 * the learner is offered next. It leans towards the onboarding goal; with no
 * goal it is the spine's next scene.
 */
export function nextTimeLine(progress: readonly MissionProgress[], goal: LearnerGoal | null = null): string | null {
  const next = nextScene(progress, goal);
  if (next === null) return null;
  const mission = getMission(next.mission.id);
  return mission === undefined ? null : `Next time: ${mission.titleEn}`;
}

/**
 * The next scene as a can-do, for the Celebration's "Next:" pill
 * (2026-10-21 UI-008, artboard B-Celebrate). The same `nextScene(progress, goal)`
 * as `nextTimeLine`, so the two can never name different scenes.
 */
export function nextCanDo(progress: readonly MissionProgress[], goal: LearnerGoal | null = null): { canDoEn: string } | null {
  const next = nextScene(progress, goal);
  if (next === null) return null;
  const mission = getMission(next.mission.id);
  return mission === undefined ? null : { canDoEn: mission.canDoEn };
}

export interface ReminderOffer {
  /** The learner's chosen time, or their own rhythm (`smart`) when they never chose one. */
  choice: ReminderMode;
  /** The preset behind the choice, and the evening for `smart` until the rhythm shows. */
  time: ReminderTime;
  /**
   * True when accepting will raise the phone's notification dialog. The ask
   * says so in one line before it does (`ReminderAsk` `asks`); its other
   * words are the ask's own, so the offer carries none.
   */
  asks: boolean;
}

/**
 * The offer, or null when there is nothing honest to offer.
 *
 * `won` is the first-win gate: a recap with nothing in it (no line said, no
 * phrase kept) offers nothing. `permission` is null until the screen has read
 * it, and no offer is drawn on a guess. A refusal is not argued with, and a
 * reminder already on is not offered twice.
 */
export function reminderOffer(facts: {
  available: boolean;
  won: boolean;
  stored: StoredReminder | null;
  permission: ReminderPermission | null;
}): ReminderOffer | null {
  if (!facts.available || !facts.won || facts.permission === null) return null;
  if (facts.permission === 'denied') return null;
  if (reminderRow(facts.stored, facts.permission).on) return null;
  // A reminder that paused itself stays quiet here: it said it would stop,
  // and Settings is where it is turned back on.
  if (facts.stored?.paused === true) return null;
  const choice = facts.stored === null ? DEFAULT_REMINDER_MODE : reminderMode(facts.stored.time);
  const time = reminderTime(choice);
  const asks = facts.permission === 'undetermined';
  return { choice, time, asks };
}

export type ReminderAnswer = 'on' | 'refused' | 'failed';

export interface ReminderPhone {
  /** A pending permission or save cannot act for a different account. */
  owns?: () => boolean;
  /** Raises the system dialog. Called from here and nowhere on the way in. */
  ask: () => Promise<ReminderPermission>;
  /** Reads the permission without raising anything. */
  read: () => Promise<ReminderPermission>;
  save: (reminder: StoredReminder) => Promise<PersistAck>;
  /** Plans the reminder once the choice is on disk (`ReminderPlanner.tsx` `replanReminders`). */
  schedule: (time: ReminderMode) => Promise<ScheduleOutcome>;
}

/**
 * The learner said yes. Ask the phone (only when the offer says a dialog is the
 * honest next step), decide with `reminderRow`, write, plan, and put the store
 * back to off if the phone will not take it. The one ask, save and plan path
 * for an account: the shared ask reaches it through `turnOnReminder`.
 */
export async function acceptReminderOffer(offer: Pick<ReminderOffer, 'choice' | 'asks'>, phone: ReminderPhone): Promise<ReminderAnswer> {
  try {
    const owns = phone.owns ?? (() => true);
    if (!owns()) return 'failed';
    const permission = offer.asks ? await phone.ask() : await phone.read();
    if (!owns()) return 'failed';
    const time = offer.choice;
    if (!reminderRow({ enabled: true, time }, permission).on) return 'refused';
    if ((await phone.save({ enabled: true, time })) !== 'durable' || !owns()) return 'failed';
    if ((await phone.schedule(time)) !== 'done') {
      if (owns()) await phone.save({ enabled: false, time });
      return 'failed';
    }
    return owns() ? 'on' : 'failed';
  } catch {
    return 'failed';
  }
}

/** What the recap says once the learner has answered. */
export function reminderAnswerLine(answer: ReminderAnswer, offer: Pick<ReminderOffer, 'choice' | 'time'>): string {
  if (answer === 'on' && offer.choice === 'smart') return 'Your reminder is on, around when you usually practise. You can change it in Settings.';
  if (answer === 'on') return `Your reminder is on for ${offer.time.gloss}. You can change it in Settings.`;
  if (answer === 'refused') return REMINDER_REFUSED;
  return 'Your phone did not set the reminder just now. You can turn it on in Settings.';
}
