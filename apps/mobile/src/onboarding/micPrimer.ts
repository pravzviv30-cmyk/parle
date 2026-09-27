/**
 * The first scene's microphone primer, decided (notebook Phase 5).
 *
 * One button raises the OS prompt, and only that button: a learner reads what
 * is about to happen, taps, and the phone asks. A refusal offers the phone's
 * settings where the build has any, and typing either way. "Type instead" is on
 * screen in every state, exactly once. Nothing here touches the live session;
 * a granted microphone simply opens the ordinary conversation route.
 */

import { MEET_MIC } from './disclosure.ts';

export type PrimerPhase = 'ask' | 'asking' | 'refused';
export type PrimerAct = 'ask' | 'settings' | 'type';

export interface PrimerAction {
  label: string;
  act: PrimerAct;
}

export interface PrimerView {
  note: string;
  primary: PrimerAction;
  secondary: PrimerAction | null;
  /** True while the OS is asking, so the pill cannot be tapped twice. */
  busy: boolean;
}

export const PRIMER_LABEL = 'Your first scene';
export const PRIMER_ACTION = 'Start with the microphone';
export const TYPE_INSTEAD = 'Type instead';
export const OPEN_SETTINGS = 'Open Settings';
export const PRIMER_REFUSED = 'The microphone is off for Luvani. You can turn it on in Settings, or type your answers.';
export const PRIMER_REFUSED_WEB = 'Your browser is not sharing the microphone. You can allow it from the address bar, or type your answers.';
export const PRIMER_SETTINGS_FAILED = 'Settings did not open. You can type your answers instead.';

export const PRIMER_COPY: readonly string[] = [
  PRIMER_LABEL,
  PRIMER_ACTION,
  TYPE_INSTEAD,
  OPEN_SETTINGS,
  PRIMER_REFUSED,
  PRIMER_REFUSED_WEB,
  PRIMER_SETTINGS_FAILED,
  MEET_MIC,
];

const TYPE: PrimerAction = { label: TYPE_INSTEAD, act: 'type' };

export function primerView(phase: PrimerPhase, settingsAvailable: boolean): PrimerView {
  if (phase === 'refused') {
    return settingsAvailable
      ? { note: PRIMER_REFUSED, primary: { label: OPEN_SETTINGS, act: 'settings' }, secondary: TYPE, busy: false }
      : { note: PRIMER_REFUSED_WEB, primary: TYPE, secondary: null, busy: false };
  }
  return { note: MEET_MIC, primary: { label: PRIMER_ACTION, act: 'ask' }, secondary: TYPE, busy: phase === 'asking' };
}

/** What the OS's answer means for the screen. */
export function afterPermission(granted: boolean): 'start' | 'refused' {
  return granted ? 'start' : 'refused';
}
