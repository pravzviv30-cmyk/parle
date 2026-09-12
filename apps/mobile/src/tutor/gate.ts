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
  label: 'Demo mode',
  headline: 'The live tutor needs its servers up. Practice still works.',
  body: 'Your tutor is not answering yet. Practice is ready whenever you are.',
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
 * The four doors the tab opens onto.
 *
 * The intro used to stand in front of all of them: a four-page explainer that
 * every learner had to walk through before the tab would show them anything.
 * A manual read before the thing it describes is a leaflet, and this one sat
 * between a new account and the first French sentence, which is the one place
 * nothing is allowed to sit.
 *
 * So the doors open immediately, and the intro is demoted rather than deleted:
 * it is still the only place that teaches the circle's three colours, and it is
 * one quiet link away from here and from Profile. Deleting it would have taken
 * that lesson with it.
 *
 * The open conversation is last and is still a door. Last because a beginner
 * staring at "say anything" is a beginner who says nothing, and still a door
 * because the learner who knows exactly what they want to talk about must not
 * have to walk through a mission to get there.
 */
export type TutorDoorKey = 'resume' | 'everyday' | 'free' | 'rehearse' | 'missions' | 'lesson';

/**
 * The three ways in the founder's brief names (F547): an everyday mission, an
 * open chat, and rehearsing something of the learner's own. They are rows
 * under one heading rather than cards with a button each, because a beginner
 * choosing between three doors should read three lines, not three screens.
 */
export const ENTRY_MODE_KEYS = ['everyday', 'free', 'rehearse'] as const;
export type EntryModeKey = (typeof ENTRY_MODE_KEYS)[number];
export const ENTRY_MODES_LABEL = 'Practice together';

export function isEntryMode(key: TutorDoorKey): key is EntryModeKey {
  return (ENTRY_MODE_KEYS as readonly string[]).includes(key);
}

/** The guided list folds away behind one quiet word, and unfolds behind another. */
export const SHOW_SITUATIONS = 'See all situations';
export const HIDE_SITUATIONS = 'Fewer situations';

/**
 * What a door shows of the place behind it: one situation's drawing, every
 * situation's drawing as a teaser, or nothing. The tab draws the art; this
 * file only says which.
 */
export type TutorDoorArt = { kind: 'place'; place: MissionPlace } | { kind: 'every-place' } | { kind: 'none' };

/**
 * One door, and everything the tab needs to draw it.
 *
 * Two fields are numbers rather than sentences, and that is the point of them.
 * The founder's screenshot puts a scenario count beside a heading and an
 * estimate of what is left of a scene under it, and both of those used to be
 * the sort of thing a screen spells into a string. A numeral inside prose is a
 * numeral nothing can round, pluralise or withhold, so the counts travel as
 * `number | null` and `scenarioCountLine` and `minutesRemainingLine` are the
 * only two places in the app that turn one into words.
 */
export interface TutorDoor {
  key: TutorDoorKey;
  /** The caps heading above the door. The screenshot's section name. */
  label: string;
  /** The French title of the mission behind the door, in the serif, or null. */
  title: string | null;
  /** One short line under the heading. Never a count, never a score. */
  gloss: string;
  /** The word on the door's button. Sentence case, never a count. */
  action: string;
  /**
   * This door is drawn as a pill. It used to mean "the tab's one pill"; the
   * founder's screenshot gives the resume card and the open conversation a
   * button each and turns the missions door into a list of rows, so the rule
   * is one pill per door now and the missions door has none.
   */
  primary: boolean;
  /** How many situations sit behind this door, or null when it is not a count. */
  /**
   * Where the learner stands, as a number rather than a sentence.
   *
   * This replaced a `detail` slot carrying the status line ("Started") that the
   * founder's screenshot drew as an orange pill. The pill went with the
   * screenshot's own correction and the line went with it: what the resume card
   * says now is how long is left, which is a measurement. A measurement travels
   * as a number so `minutesRemainingLine` can own the words and every prose
   * field on every door can stay digit-free.
   */
  count: number | null;
  /**
   * Minutes left of the scene behind this door, or null when nothing has
   * measured it. Null for every learner until `missions/resume.ts` lands: an
   * authored constant dressed as a measurement is the one thing this field
   * must never carry.
   */
  minutesRemaining: number | null;
  art: TutorDoorArt;
}

/** The quiet way back to the explainer, worded the same in both places. */
export const TUTOR_INTRO_LINK = 'How the voice circle works';

/**
 * The scripted lesson's own quiet way in.
 *
 * Deliberately not the footer's "Unable to speak right now?". That control
 * belongs to the conversation and is worded as a question; a second copy of the
 * same question on the same screen, leading somewhere else, is a screen that
 * asks one thing and means two. This one names its own door instead.
 *
 * It exists because the lesson is the one live screen with no typed door of its
 * own. `ConvoScreen` offers the quiet door mid-session; `LiveSessionScreen`
 * offers it only on a failure, so without a link here a learner who cannot
 * speak can reach the typed lesson only by first having the session break.
 */
export const TUTOR_LESSON_QUIET_LINK = 'Read and type this one instead';

/**
 * Where the scripted lesson opens, and why the probe cannot stop it.
 *
 * `tutorGate` holds a learner back from a conversation because there is no
 * conversation without a server. The lesson has a second half: with no token
 * server the navigator mounts the mock session, which runs the whole ladder
 * locally against fabricated speech. Holding the learner back here would refuse
 * them the exact thing the offline card promises them one card higher up the
 * page, which is that practice still works.
 *
 * So this decides only the route and its parameter, and the tab still probes
 * before calling it. The probe is not wasted: it is what picks up a server that
 * came up after launch, and what stops a tap looking dead for a second and a
 * half. It simply is not allowed to be a refusal.
 */
export type LessonStart = { screen: 'Lesson'; params: { textMode: true } | undefined };

export function lessonStart(textMode: boolean): LessonStart {
  return { screen: 'Lesson', params: textMode ? { textMode: true } : undefined };
}

/**
 * How many situations are behind the missions door, in words.
 *
 * Here rather than on the tab because it is the only place a numeral and a noun
 * meet, and a noun that does not agree with its number is the sort of thing
 * nobody notices until there is exactly one of something.
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
 * The mission worth offering again, as the tab reads it off the catalogue: the
 * French title, the English line that says what the scene is, the place its
 * drawing belongs to, and the pace estimate if there is one. Null when the
 * learner has never started one. Plain fields rather than a mission record, so
 * this file stays free of the catalogue and a test can build one in a line.
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

/**
 * Each door is a card that says what is behind it (F364, F404).
 *
 * The resume door shows the scene's drawing, its French title and its English
 * line, and carries a pill. The missions door is a heading with a count and a
 * list of rows, so it carries no button of its own; it keeps an `action` only
 * so the four doors stay one shape. The scripted lesson is third and carries an
 * outline rather than a pill. The open conversation is last, still a door, and
 * carries the second pill: a learner who knows what they want to say should not
 * have to walk through a mission to say it.
 *
 * `missionCount` and `lessonTitle` arrive as arguments rather than being read
 * off the catalogue here, so this file can still be reasoned about on its own.
 * The title travels for the reason the resume door's does: a French title
 * spelled in two files is a door that lies the day core renames the scene.
 */
export function tutorDoors(resume: ResumableDoor | null, missionCount: number, lessonTitle: string): TutorDoor[] {
  const doors: TutorDoor[] = [];
  if (resume !== null) {
    doors.push({
      key: 'resume',
      label: 'Resume',
      title: resume.title,
      gloss: resume.goalEn,
      action: 'Resume',
      primary: true,
      count: null,
      minutesRemaining: resume.minutesRemaining,
      art: { kind: 'place', place: resume.place },
    });
  }
  // The three entry modes (F547), as rows. None carries a pill: the circle at
  // the top of the tab is the way into an open chat, the chooser confirms a
  // mission before a session spends anything, and the real moment has a screen
  // of its own. A row that opens a screen says so with a chevron, not a button.
  doors.push({
    key: 'everyday',
    label: 'Everyday mission',
    title: null,
    gloss: 'A real situation, with your tutor playing the other person.',
    action: 'Choose a situation',
    primary: false,
    count: null,
    minutesRemaining: null,
    art: { kind: 'every-place' },
  });
  doors.push({
    key: 'free',
    label: 'Open chat',
    title: 'Talk about your day',
    gloss: 'Share whatever made you smile today or a curious thought. No grammar score, just finding your rhythm.',
    action: 'Open chat',
    primary: false,
    count: null,
    minutesRemaining: null,
    art: { kind: 'none' },
  });
  doors.push({
    key: 'rehearse',
    label: 'Rehearse something',
    title: null,
    gloss: 'An interview, a call, a dinner: bring a real moment and run it in French first.',
    action: 'Bring a real moment',
    primary: false,
    count: null,
    minutesRemaining: null,
    art: { kind: 'none' },
  });
  // The guided list is still every situation as its own row, folded away
  // behind one quiet word so the three ways in above it read first. It keeps
  // an `action` so the six doors stay one shape, and the word is the fold.
  doors.push({
    key: 'missions',
    label: 'All situations',
    title: null,
    gloss: 'Order a coffee, ask the way, check into a hotel.',
    action: SHOW_SITUATIONS,
    primary: false,
    count: missionCount,
    minutesRemaining: null,
    art: { kind: 'every-place' },
  });
  // Last, and the position is the argument. The lesson is the narrow door,
  // where every line is given and the tutor can score how it sounded; a
  // beginner should meet the guided situations before a fixed script, which is
  // the rule `chooserView.test.ts` holds from the other side. No pill:
  // `surfaceContract.test.ts` pins this tab at exactly one, and it is the
  // resume card's.
  doors.push({
    key: 'lesson',
    label: 'Pronunciation lesson',
    title: lessonTitle,
    gloss: 'Every line is written out for you, and the tutor listens to how you say it.',
    action: 'Start the lesson',
    primary: false,
    count: null,
    minutesRemaining: null,
    art: { kind: 'place', place: 'cafe' },
  });
  return doors;
}
