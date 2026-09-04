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
 * The three doors the tab opens onto.
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
 * Talk freely is last and is still a door. Last because a beginner staring at
 * "say anything" is a beginner who says nothing, and still a door because the
 * learner who knows exactly what they want to talk about must not have to walk
 * through a mission to get there.
 */
export type TutorDoorKey = 'resume' | 'missions' | 'free';

/**
 * What a door shows of the place behind it: one situation's drawing, every
 * situation's drawing as a teaser, or nothing. The tab draws the art; this
 * file only says which.
 */
export type TutorDoorArt = { kind: 'place'; place: MissionPlace } | { kind: 'every-place' } | { kind: 'none' };

export interface TutorDoor {
  key: TutorDoorKey;
  label: string;
  /** The French title of the mission behind the door, in the serif, or null. */
  title: string | null;
  /** One short line under the label. Never a count, never a score. */
  gloss: string;
  /** Lines under the gloss, in order: where the learner stands with it. */
  detail: readonly string[];
  /** The word on the door's button. Sentence case, never a count. */
  action: string;
  /** Exactly one door carries the screen's solid action. */
  primary: boolean;
  art: TutorDoorArt;
}

/** The quiet way back to the explainer, worded the same in both places. */
export const TUTOR_INTRO_LINK = 'How the circle works';

/**
 * The mission worth offering again, as the tab reads it off the catalogue: the
 * titles, the place its drawing belongs to, and the status line chooserView.ts
 * already decides. Null when the learner has never started one. Plain fields
 * rather than a mission record, so this file stays free of the catalogue and a
 * test can build one in a line.
 */
export interface ResumableDoor {
  title: string;
  titleEn: string;
  place: MissionPlace;
  status: string;
}

/**
 * Each door is a card that says what is behind it (F364). The resume door
 * shows the mission's drawing, both titles and where the learner stands with
 * it, and carries the pill. The practical-mission door shows every situation's
 * drawing as a teaser and carries the pill only when there is nothing to
 * resume. Talk freely is last, still a door, and never the pill: a beginner
 * staring at "say anything" is a beginner who says nothing.
 */
export function tutorDoors(resume: ResumableDoor | null): TutorDoor[] {
  const doors: TutorDoor[] = [];
  if (resume !== null) {
    doors.push({
      key: 'resume',
      label: 'Continue a recent mission',
      title: resume.title,
      gloss: resume.titleEn,
      detail: [resume.status],
      action: 'Continue',
      primary: true,
      art: { kind: 'place', place: resume.place },
    });
  }
  doors.push({
    key: 'missions',
    label: 'Start a practical mission',
    title: null,
    gloss: 'Order a coffee, ask the way, check into a hotel.',
    detail: [],
    action: 'Choose a situation',
    primary: resume === null,
    art: { kind: 'every-place' },
  });
  doors.push({
    key: 'free',
    label: 'Talk freely about something else',
    title: null,
    gloss: 'Anything at all. Your tutor follows you.',
    detail: [],
    action: 'Start talking',
    primary: false,
    art: { kind: 'none' },
  });
  return doors;
}
