/**
 * Whether the start button starts anything.
 *
 * The tab has always probed /health at the moment of tapping, and has always
 * thrown the answer away. A learner with no token server was told "Demo mode"
 * on one line and walked into a live screen on the next, where the fetch fails
 * and the only control left is Back. This is that answer, honoured.
 *
 * It lives here rather than inside TutorTab for the reason docs/TESTING.md
 * gives for every rule that used to hide in a component: apps/mobile has no
 * renderer, so a decision inside a `.tsx` is a decision nothing can check.
 * `practice/statusLine.ts` is the same move.
 *
 * The copy is here too, and it is used twice: once by the tab, which stays put
 * and points at its own Demo mode card, and once by the navigator's Convo
 * guard, which catches the narrow race where the server dies between the probe
 * and the mount. Two screens saying different things about one fault is how a
 * learner stops believing either of them.
 */

import type { MissionPlace } from '@luvani/core';

export interface TutorOfflineCopy {
  /** The micro-label above the card. Matches the one the tab already draws. */
  label: string;
  /** What the tab's card has always said, kept so nothing moves under them. */
  headline: string;
  /** The line the learner gets for asking, once the answer is in. */
  body: string;
  /** Re-probes. The server may simply not have finished booting. */
  retry: string;
  /** While the probe is in flight, so the button is never a dead press. */
  checking: string;
  /** The way out, always offered. */
  back: string;
}

export const TUTOR_OFFLINE: TutorOfflineCopy = {
  label: 'Connection unavailable',
  headline: 'Your tutor cannot connect right now.',
  body: 'Try again, or practise a bundled line offline.',
  retry: 'Check again',
  checking: 'Checking',
  back: 'Back',
};

/**
 * `heldBack` is the start that did not happen, kept so the card's retry can be
 * the same start. Without it the retry has to guess, and the guess it made was
 * "spoken", which is the one answer a learner who tapped the quiet door cannot
 * be handed: they may be on a train.
 */
export type TutorGate =
  | { go: true; screen: 'Convo'; params: { textMode: boolean } }
  | { go: false; offline: TutorOfflineCopy; heldBack: { textMode: boolean } };

/**
 * `serversAnswered` is exactly what `recheck()` resolves to.
 *
 * `textMode` rides through rather than around: typing needs the same token
 * server the voice does, so offering it as an escape from a dead one would be
 * an exit that fails in precisely the same place. It rides back out too, on
 * both answers, because the route a learner chose survives a server being down.
 */
export function tutorGate(serversAnswered: boolean, textMode = false): TutorGate {
  if (!serversAnswered) return { go: false, offline: TUTOR_OFFLINE, heldBack: { textMode } };
  return { go: true, screen: 'Convo', params: { textMode } };
}

/**
 * The three ways into a conversation.
 *
 * There were six doors here and the tab was a contents page: a scene to pick
 * back up, three entry modes, a fold that opened onto every situation, and the
 * scripted lesson. Revamp A takes the list back to what the founder's brief
 * asked for (F547) and nothing else: a real situation, an open chat, and
 * rehearsing something of the learner's own.
 *
 * The three that left did not go missing. The scene to pick back up is Home's
 * hero and the remembers row above these; every situation lives on the chooser,
 * which the everyday row opens; and the scripted lesson is a door at the foot
 * of that chooser (`missions/chooserView.ts`, LESSON_DOOR), beside the
 * situations a beginner should meet before a fixed script.
 *
 * The open chat is second and is still a door. Second because a beginner
 * staring at "say anything" is a beginner who says nothing, and still a door
 * because the learner who knows exactly what they want to talk about must not
 * have to walk through a mission to get there.
 */

/**
 * The three ways in the founder's brief names (F547): an everyday mission, an
 * open chat, and rehearsing something of the learner's own. They are rows
 * under one heading rather than cards with a button each, because a beginner
 * choosing between three doors should read three lines, not three screens.
 */
export const ENTRY_MODE_KEYS = ['everyday', 'free', 'rehearse'] as const;
export type EntryModeKey = (typeof ENTRY_MODE_KEYS)[number];
export const ENTRY_MODES_LABEL = 'Practice together';

export function isEntryMode(key: string): key is EntryModeKey {
  return (ENTRY_MODE_KEYS as readonly string[]).includes(key);
}

/**
 * One way in, and everything the tab needs to draw its row.
 *
 * Three fields, and that is the whole of it. The door model used to carry a
 * French title, a piece of art, a count, an estimate and a flag saying which
 * door took the pill, because each door was a card with a button on it. A row
 * is a tinted strip with a mark, a line and a chevron, so the model is a name
 * and a line: anything else on it would be a field nothing draws, which is how
 * the old model grew a `detail` slot that outlived the pill it was written for.
 */
export interface TutorDoor {
  key: EntryModeKey;
  /** The row's own line, in the heading weight. Never a count, never a score. */
  label: string;
  /** One short line under it, saying what is behind the row. */
  gloss: string;
}

/**
 * The three rows, in the order a beginner should meet them.
 *
 * It takes no arguments now, and that is the point of the change rather than a
 * side effect of it. The old signature asked for a resumable scene, a mission
 * count and a lesson title, and every one of those was a fact about something
 * that is no longer on this tab. A model that needs the catalogue to describe
 * three fixed rows is a model with a reason to change that has nothing to do
 * with the rows.
 */
export function tutorDoors(): TutorDoor[] {
  return [
    { key: 'everyday', label: 'Explore everyday missions', gloss: 'Practise French for everyday situations.' },
    { key: 'free', label: 'Open conversation', gloss: 'Bring a topic, or choose one together.' },
    { key: 'rehearse', label: 'Prepare for a real moment', gloss: 'Rehearse something coming up in your life.' },
  ];
}

/** The quiet way back to the explainer, worded the same everywhere it appears. */
export const TUTOR_INTRO_LINK = 'How the voice circle works';

/**
 * Where the scripted lesson opens, and why the probe cannot stop it.
 *
 * `tutorGate` holds a learner back from a conversation because there is no
 * conversation without a server. The lesson has a second half: with no token
 * server the navigator mounts the mock session, which runs the whole ladder
 * locally against fabricated speech. Holding the learner back here would refuse
 * them the exact thing the offline card promises them, which is that practice
 * still works.
 *
 * So this decides only the route and its parameter, and the chooser still
 * probes before calling it. The probe is not wasted: it is what picks up a
 * server that came up after launch, and what stops a tap looking dead for a
 * second and a half. It simply is not allowed to be a refusal.
 */
export type LessonStart = { screen: 'Lesson'; params: { textMode: true } | { listenOnly: true } | undefined };

/**
 * `how` is the learner's answer mode. Listen only is the spoken lesson with the
 * microphone kept closed, so it rides as its own flag rather than as a typed
 * lesson: the tutor still speaks.
 */
export function lessonStart(how: 'speak' | 'listen' | 'type'): LessonStart {
  if (how === 'type') return { screen: 'Lesson', params: { textMode: true } };
  if (how === 'listen') return { screen: 'Lesson', params: { listenOnly: true } };
  return { screen: 'Lesson', params: undefined };
}

/**
 * How many situations are behind a door, in words.
 *
 * Here rather than on a screen because it is the only place a numeral and a
 * noun meet, and a noun that does not agree with its number is the sort of
 * thing nobody notices until there is exactly one of something.
 */
export function scenarioCountLine(n: number): string {
  return n === 1 ? '1 scenario' : `${n} scenarios`;
}

/**
 * What is left of a scene, in words.
 *
 * "About" is load-bearing rather than polite. The number behind it is
 * extrapolated from the learner's own pace through the beats they have already
 * done, so it is an estimate and the sentence has to say so. A bare "3 min
 * remaining" is a claim about the future that nothing in this app can support.
 */
export function minutesRemainingLine(n: number): string {
  return n === 1 ? 'About 1 min remaining' : `About ${n} min remaining`;
}

/**
 * The mission worth offering again: the French title, the English line that
 * says what the scene is, the place its drawing belongs to, and the pace
 * estimate if there is one. Null when the learner has never started one.
 *
 * It stays here, and it is Home's now: `home/homeMission.ts` builds the hero
 * from exactly these four fields and words the estimate with the formatter
 * above. Plain fields rather than a mission record, so this file stays free of
 * the catalogue and a test can build one in a line.
 */
export interface ResumableDoor {
  /** The scene's French title, set in the serif. */
  title: string;
  /** The one English line that says what the scene is. */
  goalEn: string;
  place: MissionPlace;
  /** Minutes left at the learner's own pace, or null when nothing measured it. */
  minutesRemaining: number | null;
}
