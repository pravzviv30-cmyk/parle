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
 * The first-line invitation appears only before the first conversation. It
 * promises help, with no deadline: how long a beginner needs has not been timed.
 * Repeating it to someone with ten conversations would fail to notice their progress.
 */

import {
  FIRST_MISSION,
  earnedMissionIds,
  getMission,
  replayRung,
  suggestedMission,
  type Independence,
  type Mission,
  type MissionCompletion,
  type MissionProgress,
  type MissionState,
  type Rung,
} from '@luvani/core';

import type { ScenarioRecord } from './progressStore.ts';
import { LESSON_MINUTES } from '../copy/access.ts';

/** Shown before the first conversation, and never again. */
export const PROMISE = 'Your tutor will help you find your first useful French line.';

/** The just-in-time permission promise, beside the first scene rather than behind it. */
export const MICROPHONE_NOTICE = 'In a conversation, the microphone opens only when you tap the circle. You can type instead.';

export const CHOOSER_HEADLINE = 'What do you want to practise?';
export const CHOOSER_SUB = 'Choose a real situation. Your tutor plays the other person and helps when you need it.';

/**
 * What a situation costs, said before one is chosen (whole-app Stage 3A).
 *
 * Every card opens the live tutor, spoken or typed, and that is metered. The
 * line names the unit the rest of the app uses and no price or plan: which
 * plan buys how many minutes is the Plans screen's to say.
 */
export const CHOOSER_ACCESS = 'Each situation is a live conversation with your tutor, spoken or typed, and uses live minutes.';

/** The free path, kept as a peer rather than demoted to a footnote. */
export const TALK_FREELY = 'Talk freely about something else';

/** The caps line over the one situation already picked out. */
export const CHOOSER_START_HERE = 'Start here';

/** The caps line over the rest of them. */
export const CHOOSER_OTHER = 'Other situations';

/**
 * The scripted lesson, as a door at the foot of the chooser — F573.
 *
 * It lived on the Tutor tab, which was six doors deep and read as a contents
 * page. Here is where it belongs: the lesson is the narrow door, where every
 * line is given and the tutor can listen to how it was said, and a beginner
 * should meet the situations before a fixed script. Last on this screen is
 * exactly that position.
 *
 * It is not a seventh situation and it is drawn as an outline rather than a
 * row, because the script is known in advance, which is the only reason
 * pronunciation can be scored at all (docs/ARCHITECTURE.md, "Two paths, one
 * ladder"). A row among the six would lose the one thing that makes it
 * different.
 *
 * `title` names the kind of session and where it is set rather than repeating
 * the lesson's own French title: the scene's title is already on the hero card
 * above, and two French titles on one screen naming two different things is
 * how a learner taps the wrong one. `quiet` is the lesson's own typed way in,
 * deliberately not the conversation's "Unable to speak right now?": one screen
 * asking the same question twice and meaning two places is a screen that lies
 * to whoever answers it second.
 */
export const LESSON_DOOR = {
  title: 'Pronunciation lesson: Au café',
  quiet: 'Read and type this one instead',
  /**
   * What the lesson costs, said on both of its doors (Stage 4, 2026-09-25).
   * With a tutor connected the navigator opens the metered live lesson; offline
   * it runs the scripted one on this phone. The shared vocabulary says exactly
   * that condition.
   */
  minutes: LESSON_MINUTES,
} as const;

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
  /** That a situation uses live minutes, always, before any card. */
  access: string;
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

/**
 * What a card says under its title.
 *
 * Descriptive, never a verdict: no percentage, no count of attempts, no word
 * that could be read as a mark. An independently earned scene keeps that
 * evidence when its phrases come due for review.
 */
export function missionStatus(state: MissionState, independence: Independence, earned = false): string {
  if (earned || independence === 'on-your-own') return state === 'needs-review' ? 'Independently used, ready to review' : 'Independently used';
  switch (state) {
    case 'needs-review':
      return independence === 'new' ? 'Available scene, ready to review' : 'Practised with support, ready to review';
    case 'complete':
      return independence === 'new' ? 'Available scene' : 'Practised with support';
    case 'in-progress':
      return 'Practised with support';
    default:
      return 'Available scene';
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
  const earned = earnedMissionIds(input.progress);
  const ordered = [
    ...input.progress.filter((p) => p.mission.id === head),
    ...input.progress.filter((p) => p.mission.id !== head),
  ];

  return {
    headline: CHOOSER_HEADLINE,
    sub: CHOOSER_SUB,
    promise: input.spokenBefore ? null : PROMISE,
    microphoneNotice: input.spokenBefore ? null : MICROPHONE_NOTICE,
    access: CHOOSER_ACCESS,
    cards: ordered.map((p, i) => ({
      id: p.mission.id,
      mission: p.mission,
      state: p.state,
      independence: p.independence,
      status: p.state === 'new' ? i === 0 ? 'Next scene' : 'Available scene' : missionStatus(p.state, p.independence, earned.has(p.mission.id)),
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
 * Has this learner done any practice or review, spoken or not?
 *
 * The companion to `hasSpokenBefore`, and deliberately not folded into it: the
 * promise line and the café-first rule are about a first CONVERSATION, which
 * typed practice does not change. What it does change is the wording. Home
 * calls the café "Your first French" only for somebody who has done nothing
 * yet; after a drill or a review it is their first conversation.
 */
export function hasPractisedBefore(activity: readonly { kind: string }[]): boolean {
  return activity.some((entry) => entry.kind === 'drill' || entry.kind === 'review');
}

/**
 * The mission carrying the newest record the learner has not since finished, or
 * null when there is no such record.
 *
 * "Not since finished" is the same rule `missions/resume.ts` applies to the
 * minutes line, stated here for the same reason: a record left behind by a race
 * with `clearScenarioProgress` describes a scene the learner has already walked
 * out of, and offering to resume it would send them back into a room they
 * finished. A tie on `at` keeps the first record in the list, which the store
 * orders deterministically, so the same set always chooses the same mission.
 */
function newestLeftMission(
  progress: readonly MissionProgress[],
  records: readonly ScenarioRecord[],
): MissionProgress | null {
  let best: { at: number; progress: MissionProgress } | null = null;
  for (const record of records) {
    const mine = progress.find((p) => p.mission.id === record.missionId);
    if (mine === undefined) continue;
    if (mine.lastFinishedAt !== null && record.at <= mine.lastFinishedAt) continue;
    if (best === null || record.at > best.at) best = { at: record.at, progress: mine };
  }
  return best === null ? null : best.progress;
}

/**
 * The mission the Tutor tab offers to continue, or null when there is nothing
 * to continue. Started but unfinished comes before finished, because that is
 * the one the learner walked away from.
 *
 * `records` is where the learner actually left a scene part way, from
 * `missions/progressStore.ts`, and it wins when it says anything: a projected
 * state is what the completion log implies, and a record is the learner walking
 * out of a room mid-sentence. Offering them anything else is the app not paying
 * attention.
 *
 * It stays optional, and the one-argument answer stays exactly what it was.
 * Two screens still call it that way, and a screen that has not learned to read
 * the store yet must keep getting the door it has always got rather than a
 * quietly different one.
 */
export function resumableMission(
  progress: readonly MissionProgress[],
  records?: readonly ScenarioRecord[],
): MissionProgress | null {
  const left = records === undefined ? null : newestLeftMission(progress, records);
  if (left !== null) return left;

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

/**
 * What a replay says about itself, and nothing else.
 *
 * No number, no scale, no comparison with anybody. "Less help this time" is the
 * whole of what changed: the scene opens a rung higher, so the support that was
 * there last time is not. A learner who reads nothing still gets the thing
 * itself, because the rung is doing the work and this only names it.
 */
export const LESS_HELP = 'Less help this time.';

/**
 * A scene this learner has finished before, and where a fresh attempt at it
 * opens.
 *
 * Two rungs, kept together on purpose. `startRung` is what the session ASKS
 * for; `lastRung` is what actually happened last time, and it is the only thing
 * the note below can honestly be measured against. Split them across two props
 * and the screen ends up comparing the session it got with the session it
 * requested, which always agrees with itself.
 */
export interface MissionReplay {
  /** The rung this mission last finished on. */
  lastRung: Rung;
  /** One rung up from it, clamped at the top by core. */
  startRung: Rung;
}

/**
 * The replay a mission route is, or null when it is not one.
 *
 * The most recent finish of THIS mission, not the best ever — `missionStates`
 * reads `lastRung` the same way, off the latest record by `at`, and the two
 * have to agree because they are answering the same question. It is read
 * straight from the stored records rather than through the projection because
 * the projection also needs the review deck and a clock to say what STATE a
 * mission is in, and none of that is being asked here.
 *
 * The raise itself is core's `replayRung` and is never recomputed: the ladder
 * has four rungs and does not grow a fifth in a screen. Records are laundered
 * through `missionCompletionsFrom` first, so a row naming a mission this build
 * has never heard of, or a rung outside the ladder, simply is not a replay.
 */
export function missionReplay(
  missionId: string | undefined,
  stored: readonly { id: string; at: number; rung: number }[],
): MissionReplay | null {
  if (missionId === undefined) return null;
  const mine = missionCompletionsFrom(stored).filter((done) => done.id === missionId);
  if (mine.length === 0) return null;
  const lastRung = mine.reduce((latest, done) => (done.at >= latest.at ? done : latest)).rung;
  const startRung = replayRung(lastRung);
  return startRung === null ? null : { lastRung, startRung };
}

/**
 * The one line a replay is allowed to say about itself, or null.
 *
 * Null is the important answer. A learner who last finished on rung 4 has no
 * help left to withdraw, so `replayRung` hands back 4 again and the scene opens
 * exactly where it did before: telling them there is less help this time would
 * be a straightforward lie, and this app does not ship those.
 *
 * `openedRung` is the rung the OPENING VIEW published, not the rung the app
 * asked the token server for. Those are different facts. The engine clamps what
 * it is given and can refuse it outright and open where it always opens, in
 * which case nothing rose and there is nothing to say. Reading our own request
 * back would be the app believing itself instead of looking, and it would be
 * right up until the first time it mattered.
 *
 * Said once. The learner's first turn retires it, because by then the note is
 * describing a moment that has passed, and a line that lingers reads as a
 * running commentary on how much help somebody is getting.
 */
export function replayNote(input: {
  replay: MissionReplay | null;
  /** Off the opening publish. Null until the scene has actually opened. */
  openedRung: Rung | null;
  spokenThisSession: boolean;
}): string | null {
  if (input.replay === null || input.openedRung === null) return null;
  if (input.spokenThisSession) return null;
  return input.openedRung > input.replay.lastRung ? LESS_HELP : null;
}
