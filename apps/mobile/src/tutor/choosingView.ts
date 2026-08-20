/**
 * The choosing moment, decided.
 *
 * The opening screen of a free conversation used to hardcode its circle to
 * `listening` and render nothing else, which meant two untrue things at once:
 * the circle said "Speak" while the tutor was still asking the question out
 * loud, and a learner who typed a topic watched three to ten seconds in which
 * the only pixel that moved was the input emptying. Both were decisions living
 * inside a `.tsx`, and apps/mobile has no renderer, so neither was checkable.
 * This is the same move `tutor/gate.ts` and `practice/statusLine.ts` made.
 *
 * The circle is a control now. The founder chose it: the tutor asks out loud,
 * and the microphone opens when the learner taps, not when the room connects.
 * One tap opens it for the whole session.
 */

import type { TurnLine } from '../live/turns.ts';

/**
 * Deliberately four of VoiceOrb's five states, and a subset of its union so it
 * assigns straight across. `error` belongs to a session that has already
 * failed, and this screen is never on the screen when that is true.
 */
export type ChoosingOrb = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface ChoosingState {
  /** The quiet twin: this session opened voiceless and stays that way. */
  textMode: boolean;
  /** The learner has tapped the circle, so the microphone is published. */
  micOpen: boolean;
  /** Said, and not yet answered. Outranks everything the circle can say. */
  thinking: boolean;
  /** The tutor holds the floor. */
  tutorSpeaking: boolean;
  /**
   * The thread so far. It already holds the tutor's question, because the hook
   * appends it the moment the opening arrives.
   */
  turns: readonly TurnLine[];
}

export interface ChoosingView {
  /**
   * Whether the tutor's question is the headline of this screen.
   *
   * Only until the thread opens. The thread's first bubble IS that question,
   * so drawing both would be the same sentence twice in English and twice in
   * French on one screen. The circle stays exactly where it is across the
   * change, which is what keeps the eye from losing its place.
   */
  showQuestion: boolean;
  orb: ChoosingOrb;
  /**
   * Whether the circle is a control. True only while the spoken session has a
   * closed microphone, because tapping it a second time has nothing to do.
   */
  orbIsButton: boolean;
  /**
   * What assistive tech is told about the circle. The circle draws its own
   * label, so the screen hides that one and speaks this instead: two labels on
   * one control read as two controls.
   */
  orbLabel: string;
  /**
   * Whether to draw the thread.
   *
   * Not until there are two voices in it. The tutor's question is already the
   * headline of this screen in full, so a bubble repeating it word for word
   * would be the same sentence twice, which is the look the founder called
   * cheap. The instant the learner answers, the thread is the only place their
   * own words exist.
   */
  showTranscript: boolean;
  /** The typed row: the box and its Send. */
  showInput: boolean;
  /** "Unable to speak right now?", offered here and not only before the session. */
  showQuietDoor: boolean;
  /** One line, and only ever one. Null where the input placeholder says it. */
  helper: string | null;
}

/** The four session shapes the live hook knows. */
export type LiveMode = 'lesson' | 'convo' | 'convo-text' | 'lesson-text';

/**
 * Does connecting publish the microphone, or does the learner?
 *
 * This used to be `mode !== 'convo-text'` inside the hook, which opened the
 * microphone before the choosing screen had painted a single pixel. Two costs:
 * the learner was live without having agreed to be, and the open microphone
 * heard the tutor asking its own question out loud.
 *
 * The lesson surface keeps its hot microphone on purpose. A lesson has already
 * been started deliberately, from a screen that says so, and its first beat is
 * the learner's line.
 */
export function micOpensAtConnect(mode: LiveMode | undefined): boolean {
  // Nothing to publish: the quiet twin carries no audio in either direction.
  if (mode === 'convo-text') return false;
  // Tap to talk. The circle is the agreement.
  if (mode === 'convo') return false;
  return true;
}

/** The one instruction the voice-first screen gives. */
export const TAP_TO_TALK = 'Tap the circle when you are ready to talk.';

/** What the learner may talk about, which is anything. */
export const ANYTHING_GOES = 'Anything goes. Say it in English or French, and your tutor takes it from there.';

/** The quiet twin, worded exactly as the tutor tab words it. */
export const QUIET_DOOR = 'Unable to speak right now?';

export function choosingView(state: ChoosingState): ChoosingView {
  const { textMode, micOpen, thinking, tutorSpeaking, turns } = state;

  // Thinking outranks everything: the learner has just spoken or typed and
  // nothing has come back yet, and that is the one thing worth saying.
  const orb: ChoosingOrb = thinking
    ? 'thinking'
    : tutorSpeaking
      ? 'speaking'
      : textMode || !micOpen
        ? 'idle'
        : 'listening';

  // A closed microphone is the only thing a tap can change. It stays tappable
  // while the tutor is still asking, because a learner who is ready before the
  // question ends should not be made to wait for it.
  const orbIsButton = !textMode && !micOpen;

  const orbLabel = orbIsButton
    ? 'Tap the circle when you are ready to talk'
    : orb === 'thinking'
      ? 'Your tutor is thinking'
      : orb === 'speaking'
        ? 'Your tutor is speaking'
        : orb === 'listening'
          ? 'Your turn to speak'
          : 'Your tutor is ready';

  // Two voices in the thread is the moment the thread becomes worth drawing.
  const answered = turns.some((t) => t.who === 'learner');

  return {
    showQuestion: !answered,
    orb,
    orbIsButton,
    orbLabel,
    showTranscript: answered,
    showInput: textMode,
    showQuietDoor: !textMode,
    helper: textMode ? null : orbIsButton ? TAP_TO_TALK : ANYTHING_GOES,
  };
}
