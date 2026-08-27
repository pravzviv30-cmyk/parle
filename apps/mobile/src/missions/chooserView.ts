/**
 * The chooser, decided.
 *
 * `MissionsScreen` renders six cards and one quiet door. Which card is first,
 * which one carries the screen's single solid action, what each card says
 * underneath its title, and whether the promise line is on screen at all are
 * decisions, so they live here rather than in the `.tsx` where nothing could
 * reach them. Same move as `tutor/choosingView.ts` and `practice/statusLine.ts`.
 *
 * What this file deliberately does NOT do is work out mission state. Core owns
 * that: `missionStates` projects it from completion records and the review
 * deck, `suggestedMission` says which one is next, `FIRST_MISSION` names the
 * one a learner who has never spoken opens on. Re-deciding any of it here would
 * be a second answer to a question core already answers, and the two would part
 * company on a Tuesday.
 *
 * The promise line is the one piece of copy in the app with an expiry. "You'll
 * say your first useful French line in the next two minutes" is true exactly
 * once, and repeating it to somebody who has already had ten conversations is
 * the app failing to notice them.
 */

import {
  FIRST_MISSION,
  getMission,
  suggestedMission,
  type Independence,
  type Mission,
  type MissionCompletion,
  type MissionProgress,
  type MissionState,
  type Rung,
} from '@parle/core';

/** Shown before the first conversation, and never again. */
export const PROMISE = "You'll say your first useful French line in the next two minutes.";

/** The just-in-time permission promise, beside the first scene rather than behind it. */
export const MICROPHONE_NOTICE = 'The microphone opens only when you tap the circle. You can type instead.';

export const CHOOSER_HEADLINE = 'What do you want to be able to do?';
export const CHOOSER_SUB = 'Pick a situation. Your tutor plays the other person.';

/** The free path, kept as a peer rather than demoted to a footnote. */
export const TALK_FREELY = 'Talk freely about something else';

export interface MissionRoute {
  screen: 'Convo';
  params: { missionId: string };
}

export interface ChooserCard {
  id: string;
  mission: Mission;
  state: MissionState;
  independence: Independence;
  /** The one line under the title. Never a count, never a score. */
  status: string;
  /**
   * Whether this card carries the screen's solid pill. Exactly one does, and
   * for a learner who has never spoken it is always the café, because a first
   * screen with six equal choices is a decision handed to somebody who has no
   * way to make it yet.
   */
  primary: boolean;
  route: MissionRoute;
}

export interface ChooserView {
  headline: string;
  sub: string;
  /** Null once the learner has had a conversation. */
  promise: string | null;
  /** Null once the learner has already crossed the speaking door. */
  microphoneNotice: string | null;
  cards: ChooserCard[];
  talkFreely: string;
}

export interface ChooserInput {
  /** Straight from core's `missionStates`. */
  progress: readonly MissionProgress[];
  /** Has this learner ever had a conversation? */
  spokenBefore: boolean;
  /**
   * A mission the learner was already promised by name, if they arrived through
   * a door that named one.
   *
   * The Tutor tab's "Continue" door glosses itself with a mission title and then
   * opens this screen, and without this the screen led with whatever
   * `suggestedMission` liked instead. Two orderings, one learner, and the thing
   * they tapped was not the thing they were offered. A door that names something
   * has to open onto it.
   */
  focus?: string | null;
}

const FINISHED_LINE: Record<Independence, string> = {
  new: 'Ready when you are',
  'with-help': 'You did this one with help',
  'getting-there': 'You did this one with a little help',
  'mostly-yours': 'You did this one mostly on your own',
  'on-your-own': 'You did this one on your own',
};

/**
 * What a card says under its title.
 *
 * Descriptive, never a verdict: no percentage, no count of attempts, no word
 * that could be read as a mark. A mission the scheduler wants back says so
 * first, because a phrase slipping away matters more than a finished scene.
 */
export function missionStatus(state: MissionState, independence: Independence): string {
  switch (state) {
    case 'needs-review':
      return 'Ready to come back to';
    case 'complete':
      return FINISHED_LINE[independence];
    case 'in-progress':
      return 'Started';
    default:
      return 'Ready when you are';
  }
}

/**
 * The mission to put first.
 *
 * A learner who has never spoken gets the café, whatever the catalogue happens
 * to be sorted by, because the café is the shortest walk from no French at all
 * to a French sentence that worked. Everyone else gets core's suggestion.
 */
export function headMissionId(input: ChooserInput): string {
  // A promise made on the previous screen outranks anything computed here.
  const promised = input.progress.find((p) => p.mission.id === input.focus);
  if (promised) return promised.mission.id;
  if (!input.spokenBefore) return FIRST_MISSION;
  return suggestedMission(input.progress)?.mission.id ?? input.progress[0]?.mission.id ?? FIRST_MISSION;
}

export function chooserView(input: ChooserInput): ChooserView {
  const head = headMissionId(input);
  const ordered = [
    ...input.progress.filter((p) => p.mission.id === head),
    ...input.progress.filter((p) => p.mission.id !== head),
  ];

  return {
    headline: CHOOSER_HEADLINE,
    sub: CHOOSER_SUB,
    promise: input.spokenBefore ? null : PROMISE,
    microphoneNotice: input.spokenBefore ? null : MICROPHONE_NOTICE,
    cards: ordered.map((p, i) => ({
      id: p.mission.id,
      mission: p.mission,
      state: p.state,
      independence: p.independence,
      status: missionStatus(p.state, p.independence),
      primary: i === 0,
      route: { screen: 'Convo', params: { missionId: p.mission.id } },
    })),
    talkFreely: TALK_FREELY,
  };
}

/**
 * Has this learner ever had a conversation?
 *
 * Read off the activity log rather than off mission completions, because a
 * learner who talked for ten minutes and never finished a mission's beats has
 * still had their first line, and telling them it is still coming would be the
 * app not paying attention. Takes the entries rather than reading the store, so
 * the rule is testable and the disk stays in the screen.
 */
export function hasSpokenBefore(activity: readonly { kind: string }[]): boolean {
  return activity.some((entry) => entry.kind === 'convo' || entry.kind === 'lesson');
}

/**
 * The mission the Tutor tab offers to continue, or null when there is nothing
 * to continue. Started but unfinished comes before finished, because that is
 * the one the learner walked away from.
 */
export function resumableMission(progress: readonly MissionProgress[]): MissionProgress | null {
  const started = progress.filter((p) => p.state !== 'new');
  return (
    started.find((p) => p.state === 'in-progress') ??
    started.find((p) => p.state === 'needs-review') ??
    started[0] ??
    null
  );
}

/**
 * The stored completion records, as core will read them.
 *
 * `missions/store.ts` keeps `id` and `rung` as plain string and number on
 * purpose, so it never needs migrating when the catalogue changes. That makes
 * this the boundary where they are checked, and it is a real check rather than
 * a cast: a record written by a later build naming a mission this one has never
 * heard of is dropped, quietly, and the mission simply reads as new. A crash
 * here would be a learner locked out of the chooser by a file they cannot see.
 */
export function missionCompletionsFrom(
  stored: readonly { id: string; at: number; rung: number }[],
): MissionCompletion[] {
  const out: MissionCompletion[] = [];
  for (const record of stored) {
    const mission = getMission(record.id);
    if (!mission) continue;
    if (!Number.isInteger(record.rung) || record.rung < 1 || record.rung > 4) continue;
    out.push({ id: mission.id, at: record.at, rung: record.rung as Rung });
  }
  return out;
}
