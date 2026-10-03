/**
 * The first scene's microphone primer, decided (notebook Phase 5).
 *
 * One button raises the OS prompt, and only that button: a learner reads what
 * is about to happen, taps, and the phone asks. A refusal leads with typing,
 * because typing cannot fail, and offers the phone's settings second where the
 * build has any (revamp B, F601; `LiveErrorView`'s microphone refusal already
 * reads that way). "Type instead" is on screen in every state, exactly once.
 * Nothing here touches the live session; a granted microphone simply opens the
 * ordinary conversation route.
 */

import { MEET_MIC } from './disclosure.ts';

export type PrimerPhase = 'ask' | 'asking' | 'refused';
export type PrimerAct = 'ask' | 'settings' | 'type';

export interface PrimerAction {
  label: string;
  act: PrimerAct;
}

export interface PrimerView {
  /** The refusal's own title, or null on the brief, where the scene is the title. */
  title: string | null;
  note: string;
  /** How to turn the microphone back on, where there is a Settings to say it about. */
  how: string | null;
  primary: PrimerAction;
  secondary: PrimerAction | null;
  /** True while the OS is asking, so the pill cannot be tapped twice. */
  busy: boolean;
}

export const PRIMER_LABEL = 'Your first scene';
/**
 * The meta line over the scene's title, naming the learner's own tutor. A
 * function of the persona's name, so it is checked per voice in the test rather
 * than sitting on the fixed copy list with one name baked in.
 */
export const PRIMER_META = (name: string): string => `${PRIMER_LABEL}, with ${name}`;
/**
 * Over the brief's white card of lines, counted honestly: the brief shows up to
 * three, and two scenes in the catalogue have only two. French only, because
 * the catalogue has no English for these lines.
 */
export function PRIMER_LINES(count: number): string {
  if (count <= 1) return "The line you'll say";
  return `The ${count === 2 ? 'two' : 'three'} lines you'll say`;
}
export const PRIMER_ACTION = 'Start speaking';
export const TYPE_INSTEAD = 'Type instead';
export const OPEN_SETTINGS = 'Open Settings';
/** A phone with a Settings app said no: what happened, what to do, and how. */
export const PRIMER_REFUSED_TITLE = 'The microphone is off for Luvani';
export const PRIMER_REFUSED = 'You can turn it on in Settings, or type your answers.';
export const PRIMER_REFUSED_HOW = 'In Settings, allow Luvani to use the microphone, then come back here.';
/** A browser said no: the address bar is its settings, so there is no how. */
export const PRIMER_REFUSED_WEB_TITLE = 'Your browser is not sharing the microphone';
export const PRIMER_REFUSED_WEB = 'You can allow it from the address bar, or type your answers.';
export const PRIMER_SETTINGS_FAILED = 'Settings did not open. You can type your answers instead.';

export const PRIMER_COPY: readonly string[] = [
  PRIMER_LABEL,
  PRIMER_LINES(1),
  PRIMER_LINES(2),
  PRIMER_LINES(3),
  PRIMER_ACTION,
  TYPE_INSTEAD,
  OPEN_SETTINGS,
  PRIMER_REFUSED_TITLE,
  PRIMER_REFUSED,
  PRIMER_REFUSED_HOW,
  PRIMER_REFUSED_WEB_TITLE,
  PRIMER_REFUSED_WEB,
  PRIMER_SETTINGS_FAILED,
  MEET_MIC,
];

const TYPE: PrimerAction = { label: TYPE_INSTEAD, act: 'type' };

export function primerView(phase: PrimerPhase, settingsAvailable: boolean): PrimerView {
  if (phase === 'refused') {
    // Typing leads either way: it is the one way on that cannot fail, and the
    // phone's settings may not open at all.
    return settingsAvailable
      ? {
          title: PRIMER_REFUSED_TITLE,
          note: PRIMER_REFUSED,
          how: PRIMER_REFUSED_HOW,
          primary: TYPE,
          secondary: { label: OPEN_SETTINGS, act: 'settings' },
          busy: false,
        }
      : { title: PRIMER_REFUSED_WEB_TITLE, note: PRIMER_REFUSED_WEB, how: null, primary: TYPE, secondary: null, busy: false };
  }
  return {
    title: null,
    note: MEET_MIC,
    how: null,
    primary: { label: PRIMER_ACTION, act: 'ask' },
    secondary: TYPE,
    busy: phase === 'asking',
  };
}

/** What the OS's answer means for the screen. */
export function afterPermission(granted: boolean): 'start' | 'refused' {
  return granted ? 'start' : 'refused';
}
