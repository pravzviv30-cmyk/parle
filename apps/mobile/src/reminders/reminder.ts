/**
 * The daily reminder: what it says, when it says it, and what it may know.
 *
 * ## The rule this module exists to hold (founder decision D2, 2026-10-04)
 *
 * **One warm reminder a day, never on a day already practised.** The founder
 * chose a full daily streak with "a warm evening reminder", which reverses the
 * old rule here (F226, F227, F230: a fixed line that could not know whether the
 * learner practised). The reversal is done in the open and kept small:
 *
 * - **At most one a day.** One dated slot per local day, keyed `practice:{day}`
 *   (`plan.ts`), so a second plan for the same day replaces the first.
 * - **Skipped on a day already practised.** The planner reads the practice
 *   days, and a finished practice re-plans before the evening comes. A learner
 *   who practised at 7:55 is not reminded at 8:00.
 * - **No shame.** Every line here states only the learner's own counts (their
 *   streak, their days practised) and names the tutor they chose. Nothing
 *   threatens, counts down or pleads: every line passes `guiltIn` and
 *   `streakGuiltIn` (copy/guilt.ts), and nothing reads yesterday or a loss.
 * - **No badge.** The count never goes on the app icon (`schedule.native.ts`).
 * - **It pauses itself.** After four reminders in a row go unanswered (no
 *   practice, no tap, no visit to the app after it arrived), the fifth slot is
 *   a kind note that says so, and then nothing, until the learner turns it back
 *   on in Settings.
 * - **It leaves with the account.** Signing out cancels every pending line, so
 *   a shared phone never shows one learner's streak for another.
 *
 * ## Shape
 *
 * Constants and pure functions, no expo import, no store, no clock: the same
 * split `progress/saveFile.ts` uses. The words live here so the guilt scans can
 * read them as a list (`REMINDER_COPY`); the decisions about which day gets
 * which line live in `plan.ts`; only `ReminderPlanner.tsx` reads what the
 * learner has done, and only `schedule.native.ts` talks to the OS.
 *
 * The one thing it still reads from outside is the default tutor's name, and
 * only to render every line once for the scans: a real reminder always names
 * the tutor the learner chose (`tutorNameOf`, or the first run's choice).
 */

import { TUTOR_NAME } from '../tutor/tutorName.ts';

/**
 * What the OS says about whether we may post a notification.
 *
 * Deliberately the same three words expo-notifications uses, without importing
 * it: a second vocabulary for the same three states is how the native module
 * and the screen start disagreeing about what "off" means. Nothing here can ask
 * for the value; the caller passes what the platform told it.
 */
export type ReminderPermission = 'undetermined' | 'granted' | 'denied';

/** The presets, named by the moment rather than by the hour. */
export type ReminderTimeId = 'morning' | 'lunch' | 'evening' | 'night';

/**
 * When the reminder comes: one of the presets, or `smart`, which follows the
 * learner's own rhythm (`plan.ts` `smartTime`). Smart is a mode, not a fifth
 * preset: the preset list below stays four times on the hour.
 */
export type ReminderMode = ReminderTimeId | 'smart';

export interface ReminderTime {
  value: ReminderTimeId;
  /** The moment, in the words a learner would use for it. */
  label: string;
  /** The clock, for the row and under the option. */
  gloss: string;
  /** Local hour, handed to the planner. */
  hour: number;
  /** Always zero, for the reason the preset list gives. */
  minute: number;
}

/** A local time of day. */
export interface ClockTime {
  hour: number;
  minute: number;
}

/**
 * Early evening, when the day's obligations are done and sleep is not close.
 *
 * The fallback preset, and the time `smart` uses until the learner's rhythm
 * shows. Deliberately not the morning, where a reminder competes with getting
 * out of the door and is dismissed unread.
 */
const EARLY_EVENING: ReminderTime = { value: 'evening', label: 'Early evening', gloss: '6:00 pm', hour: 18, minute: 0 };

/**
 * Four presets rather than a time picker.
 *
 * The interesting choice is which part of the day, not whether the reminder
 * lands at 18:00 or 18:07. These four are the moments an adult with a job has
 * ten free minutes: before the day starts, the middle of it, the gap after
 * work, and the wind-down. Always on the hour, because a preset at 18:07 is a
 * time picker that has been hidden rather than removed. The learner who wants
 * the reminder to follow their own rhythm picks `smart` instead.
 */
export const REMINDER_TIMES: readonly ReminderTime[] = [
  { value: 'morning', label: 'Morning', gloss: '8:00 am', hour: 8, minute: 0 },
  { value: 'lunch', label: 'Lunchtime', gloss: '1:00 pm', hour: 13, minute: 0 },
  EARLY_EVENING,
  { value: 'night', label: 'Before bed', gloss: '9:00 pm', hour: 21, minute: 0 },
];

/** The preset a learner who has never chosen falls back to. */
export const DEFAULT_REMINDER_TIME: ReminderTimeId = EARLY_EVENING.value;

/** What a new reminder is set to when nobody has chosen: the learner's own rhythm. */
export const DEFAULT_REMINDER_MODE: ReminderMode = 'smart';

/** The time `smart` uses until there are enough days to read a rhythm from. */
export const SMART_FALLBACK: ClockTime = { hour: EARLY_EVENING.hour, minute: EARLY_EVENING.minute };

/**
 * What the learner chose, kept on this phone by `reminders/store.ts`.
 *
 * `mentionStreak` and `paused` are written down only when they differ from the
 * default (the streak is mentioned; the reminder is not paused), so a choice
 * that never touched them reads back exactly as it was written.
 */
export interface StoredReminder {
  days?: number[];
  enabled: boolean;
  time: ReminderMode;
  /** False when the learner asked for lock-screen lines without their streak. */
  mentionStreak?: boolean;
  /** True once the pause note has gone out; cleared by turning the reminder on again. */
  paused?: boolean;
}

/** The notification itself, in the shape the platform scheduler wants. */
export interface ReminderContent {
  title: string;
  body: string;
}

/** Where a tap on a reminder lands (`openTarget.ts`). */
export type ReminderOpen = 'home' | 'daily-phrase' | 'settings';

// ───────────────────────────────────────────────────────────── the words

/** "1 day", "2 days": a count written the way a person says it. */
function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/**
 * The numbers a line may carry, every one a fact on disk.
 *
 * `n` is the streak as it will stand on the day the line arrives if nothing
 * else happens before then (a practice in between re-plans, so it is never
 * stale for long); `lifetime` is the days practised in all; `tutor` is the
 * chosen tutor's name.
 */
export interface LineFacts {
  n: number;
  lifetime: number;
  tutor: string;
}

export interface ReminderLine {
  id: string;
  open: ReminderOpen;
  title: (facts: LineFacts) => string;
  body: (facts: LineFacts) => string;
}

/**
 * The streak set, for a day whose run is alive (n of at least 1). Rotated so
 * that two days in a row never say the same thing (`plan.ts`). Nothing here
 * says "in a row": a covered day bridges a run without adding to it (F741).
 */
export const STREAK_LINES: readonly ReminderLine[] = [
  {
    id: 'streak-waiting',
    open: 'home',
    title: ({ n }) => `Your ${n}-day streak is waiting`,
    body: ({ tutor }) => `${tutor} has a short practice ready whenever you are.`,
  },
  {
    id: 'streak-counting',
    open: 'home',
    title: ({ n }) => `${days(n)} of French and counting`,
    body: ({ n, tutor }) => `One short practice with ${tutor} today makes it ${n + 1}.`,
  },
  {
    id: 'streak-phrase',
    open: 'daily-phrase',
    title: () => "Today's phrase is ready",
    body: ({ n, tutor }) => `Practise it with ${tutor} and your streak reaches ${n + 1} days.`,
  },
  {
    id: 'streak-seat',
    open: 'home',
    title: ({ tutor }) => `${tutor} saved you a seat`,
    body: ({ n }) => `A quick practice adds day ${n + 1} to your streak.`,
  },
  {
    id: 'streak-ready',
    open: 'home',
    title: () => 'Ready when you are',
    body: ({ n, tutor }) => `Your ${n}-day streak is waiting, and so is ${tutor}.`,
  },
  {
    id: 'streak-one-phrase',
    open: 'daily-phrase',
    title: ({ n }) => `Day ${n + 1} starts with one phrase`,
    body: ({ tutor }) => `Hear it, say it, done. ${tutor} is here.`,
  },
  {
    id: 'streak-habit',
    open: 'home',
    title: () => 'Your French habit',
    body: ({ n, tutor }) => `${days(n)} so far. ${tutor} is here, and a short review counts too.`,
  },
];

/** The eve of a milestone (7, 30, 100, 365 and every year after): it takes the place of the set above. */
export const MILESTONE_EVE_LINE: ReminderLine = {
  id: 'milestone-eve',
  open: 'home',
  title: ({ n }) => `One practice from your ${n + 1}-day milestone`,
  body: ({ tutor }) => `${tutor} is here when you are.`,
};

/**
 * The routine set, for a day with no run to mention (or a learner who asked
 * for lines without their streak). The third is offered only once there is a
 * practice day to count, and states that count and nothing about a run.
 */
export const ROUTINE_LINES: readonly ReminderLine[] = [
  {
    id: 'routine-moment',
    open: 'home',
    title: () => 'A moment of French',
    body: ({ tutor }) => `${tutor} is here whenever you want to talk.`,
  },
  {
    id: 'routine-phrase',
    open: 'daily-phrase',
    title: () => "Today's phrase is ready",
    body: ({ tutor }) => `Hear it and say it with ${tutor}. It takes a minute.`,
  },
  {
    id: 'routine-so-far',
    open: 'home',
    title: () => 'Your French so far',
    body: ({ lifetime, tutor }) => `You have practised on ${days(lifetime)}. ${tutor} is ready when you are.`,
  },
];

/** The kind note in the fifth unanswered slot, and then nothing. Opens Settings, where it can be turned back on. */
export const PAUSE_LINE: ReminderLine = {
  id: 'pause',
  open: 'settings',
  title: ({ tutor }) => `Pausing reminders from ${tutor}`,
  body: () => "They haven't been landing at a good time, so we'll stop for now. Turn them back on in Settings whenever you like.",
};

/**
 * The pause note for a guest, who has no Settings yet: the same note, without
 * a door that is not there. It opens the app.
 */
export const GUEST_PAUSE_LINE: ReminderLine = {
  id: 'pause-guest',
  open: 'home',
  title: PAUSE_LINE.title,
  body: () => "They haven't been landing at a good time, so we'll stop for now.",
};

/** Every line a reminder can be, for the scans. */
export const REMINDER_LINES: readonly ReminderLine[] = [...STREAK_LINES, MILESTONE_EVE_LINE, ...ROUTINE_LINES, PAUSE_LINE, GUEST_PAUSE_LINE];

/** A line with its facts filled in. */
export function reminderMessage(line: ReminderLine, facts: LineFacts): ReminderContent {
  return { title: line.title(facts), body: line.body(facts) };
}

/**
 * The title of the routine line, rendered for the default tutor. Kept for the
 * scans and for anything that needs the one fixed line; a real reminder names
 * the chosen tutor through `reminderMessage`.
 */
export const REMINDER_TITLE = 'A moment of French';
export const REMINDER_BODY = `${TUTOR_NAME} is here whenever you want to talk.`;

/** The Settings row's label. */
export const REMINDER_ROW = 'Daily reminder';

/** The row's value when nothing will arrive. One word, no explanation needed. */
export const REMINDER_OFF = 'Off';

/** The row's value once the reminder has paused itself. */
export const REMINDER_PAUSED_VALUE = 'Paused';

/** Said beside the switch once the reminder has paused itself. */
export const REMINDER_PAUSED = 'Paused after a few quiet days. Turn it back on whenever you like.';

/**
 * Said above the switch, before any system dialog.
 *
 * It stops at the ask instead of making a promise the code has not kept: that
 * a dialog is coming, that it is at most one a day, around the learner's own
 * time, and that a day already practised is skipped. Each of those is held by
 * `plan.test.ts`.
 */
export const REMINDER_EXPLAIN =
  'Your phone will ask to allow notifications. Luvani sends at most one a day, around when you usually practise, and skips days you have already practised.';

/**
 * What the row says when the OS will not deliver.
 *
 * Names the real state, names where it can be changed, and stops. No apology,
 * no second ask, and nothing about what the learner is missing.
 */
export const REMINDER_REFUSED =
  'Notifications are turned off for Luvani in your phone settings. You can turn them on there whenever you like.';

/** The sheet that picks the time. */
export const REMINDER_TIME_TITLE = 'When to remind you';
export const REMINDER_TIME_SUB = 'Pick a time that suits you. You can change it whenever you like.';

/** The smart mode, as the sheet and the row name it. */
export const REMINDER_SMART_LABEL = 'When I usually practise';

/** The row's value for the smart mode: no clock, because the clock moves with the learner. */
export const REMINDER_SMART_VALUE = 'Around when you usually practise';

/** The smart option's gloss while there are not yet enough days to read a rhythm from. */
export const REMINDER_SMART_LEARNING = `${EARLY_EVENING.gloss} until your rhythm shows`;

/** "6:30 pm": a local time, the way the presets write theirs. */
export function clockGloss(time: ClockTime): string {
  const hour = ((time.hour % 24) + 24) % 24;
  const minute = Math.max(0, Math.min(59, Math.floor(time.minute)));
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}

/** The smart option's gloss: "About 6:30 pm" once the rhythm shows, the evening until then. */
export function smartGloss(time: ClockTime | null): string {
  return time === null ? REMINDER_SMART_LEARNING : `About ${clockGloss(time)}`;
}

/**
 * Every learner-facing string here, flattened, the way `FIRST_RUN_COPY` is.
 *
 * The guilt scans read this list rather than the exports one by one, so a new
 * sentence is covered the moment it is added. Each reminder line is rendered
 * with the default tutor and a spread of counts, the milestone eves among them.
 */
export const REMINDER_COPY: readonly string[] = [
  REMINDER_TITLE,
  REMINDER_BODY,
  REMINDER_ROW,
  REMINDER_OFF,
  REMINDER_PAUSED_VALUE,
  REMINDER_PAUSED,
  REMINDER_EXPLAIN,
  REMINDER_REFUSED,
  REMINDER_TIME_TITLE,
  REMINDER_TIME_SUB,
  REMINDER_SMART_LABEL,
  REMINDER_SMART_VALUE,
  REMINDER_SMART_LEARNING,
  smartGloss({ hour: 18, minute: 30 }),
  ...REMINDER_TIMES.flatMap((time) => [time.label, time.gloss]),
  ...REMINDER_LINES.flatMap((line) =>
    [1, 2, 6, 29, 99, 364].flatMap((n) => {
      const message = reminderMessage(line, { n, lifetime: n, tutor: TUTOR_NAME });
      return [message.title, message.body];
    }),
  ),
];

/**
 * The preset for a stored id, and the default for anything else.
 *
 * Sceptical on purpose, the way `strictnessOf` is: this value has been through
 * a JSON blob, a version chain and possibly another device's disk, and a
 * reminder that throws on a mangled byte is a reminder that stops arriving
 * without ever saying why. `smart` is not a preset, so it resolves to the
 * evening here; ask `reminderChoice` for the mode.
 */
export function reminderTime(id: unknown): ReminderTime {
  return REMINDER_TIMES.find((time) => time.value === id) ?? EARLY_EVENING;
}

/** A stored mode, or the new-setup default (`smart`) for anything this build does not know. */
export function reminderMode(id: unknown): ReminderMode {
  if (id === 'smart') return 'smart';
  const preset = REMINDER_TIMES.find((time) => time.value === id);
  return preset === undefined ? DEFAULT_REMINDER_MODE : preset.value;
}

/** What the row and the sheet draw for a mode. */
export interface ReminderChoice {
  value: ReminderMode;
  label: string;
}

/** The mode behind a stored id, with its label: a preset's, or the smart mode's. */
export function reminderChoice(id: unknown): ReminderChoice {
  const mode = reminderMode(id);
  if (mode === 'smart') return { value: 'smart', label: REMINDER_SMART_LABEL };
  const preset = reminderTime(mode);
  return { value: preset.value, label: preset.label };
}

/** Everything the Settings row needs to render honestly. */
export interface ReminderRow {
  /** What the switch shows. Never on unless a notification would really arrive. */
  on: boolean;
  /** The row's value: the chosen clock time, the smart mode, Paused, or `REMINDER_OFF`. */
  value: string;
  /** The one line shown beside the switch, or '' when there is nothing to say. */
  note: string;
  /** True when flipping the switch on will raise the system dialog. */
  asks: boolean;
}

/**
 * What the learner asked for, crossed with what the OS will allow.
 *
 * The stored flag alone is not enough to draw a switch. Permission is per
 * install and can be revoked in Settings months later without the app hearing
 * a word about it, so a refusal wins over the stored value, and it wins whether
 * the switch was on or off. An undecided permission reads as off too, and
 * carries the explaining sentence: that is the only state in which flipping the
 * switch raises a dialog. A reminder that paused itself reads as off, says
 * Paused, and says how to bring it back.
 */
export function reminderRow(
  stored: StoredReminder | null | undefined,
  permission: ReminderPermission,
): ReminderRow {
  if (permission === 'denied') {
    return { on: false, value: REMINDER_OFF, note: REMINDER_REFUSED, asks: false };
  }
  if (permission === 'undetermined') {
    return { on: false, value: REMINDER_OFF, note: REMINDER_EXPLAIN, asks: true };
  }
  if (stored?.enabled !== true) {
    return { on: false, value: REMINDER_OFF, note: '', asks: false };
  }
  if (stored.paused === true) {
    return { on: false, value: REMINDER_PAUSED_VALUE, note: REMINDER_PAUSED, asks: false };
  }
  if (stored.time === 'smart') {
    return { on: true, value: REMINDER_SMART_VALUE, note: '', asks: false };
  }
  return { on: true, value: reminderTime(stored.time).gloss, note: '', asks: false };
}
