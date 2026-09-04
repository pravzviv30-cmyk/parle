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
export type ChoosingOrb = 'ready' | 'idle' | 'listening' | 'thinking' | 'speaking';

export interface ChoosingState {
  /** The quiet twin: this session opened voiceless and stays that way. */
  textMode: boolean;
  /** The learner has tapped the circle, so the microphone is published. */
  micOpen: boolean;
  /**
   * The reply box is showing, without the session having gone quiet.
   *
   * Deliberately a second input rather than a widening of `textMode`. A learner
   * who prefers typing (F370), or who taps Type instead mid-scene, is in a
   * session that still carries audio: the tutor speaks, the circle is still the
   * control that opens the microphone, and the quiet door is still worth
   * offering. `textMode` is the quiet twin and means none of those are true.
   * Folding the two would have taken the voice away from somebody who only
   * asked for a keyboard.
   */
  typingOpen: boolean;
  /** Said, and not yet answered. Outranks everything the circle can say. */
  thinking: boolean;
  /** The tutor holds the floor. */
  tutorSpeaking: boolean;
  /**
   * The thread so far. It already holds the tutor's question, because the hook
   * appends it the moment the opening arrives.
   */
  turns: readonly TurnLine[];
  /**
   * Who this learner is talking to, from `tutorPersonaOf`.
   *
   * Passed in rather than read here for the reason waitingView states: the
   * tutor is whoever the learner chose, and three of the five things the
   * circle can say name that person out loud. A constant would have this
   * module tell a learner who picked Celine that Luc is thinking.
   */
  tutorName: string;
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

/** What a session mode does with a microphone and a speaker. */
export interface ModeCaps {
  /**
   * Whether this session carries audio at all, in either direction. False is
   * the quiet twin: no microphone to request, and nothing the tutor will ever
   * speak.
   */
  carriesAudio: boolean;
  /** Whether connecting publishes the microphone, or the learner does. */
  micAtConnect: boolean;
}

/**
 * Every mode, and what each one may do.
 *
 * A table rather than a chain of `if`s, and `Record<LiveMode, …>` rather than a
 * partial one, because the chain it replaces ended in `return true`. That
 * fall-through is how `lesson-text` came to publish a microphone the quiet door
 * had just promised not to open: the typed lesson was added to `LiveMode`, was
 * never named in the chain, and inherited the lesson's hot microphone in
 * silence. With this shape the next mode does not compile until it says what it
 * is, which is the only kind of reminder that cannot be forgotten.
 *
 * The lesson keeps its hot microphone on purpose. A lesson has already been
 * started deliberately, from a screen that says so, and its first beat is the
 * learner's line. A free conversation opens closed: the tutor asks out loud and
 * the circle is where the learner agrees to be heard.
 */
export const MODE_CAPS: Record<LiveMode, ModeCaps> = {
  lesson: { carriesAudio: true, micAtConnect: true },
  convo: { carriesAudio: true, micAtConnect: false },
  'convo-text': { carriesAudio: false, micAtConnect: false },
  'lesson-text': { carriesAudio: false, micAtConnect: false },
};

/** No mode named is the lesson path, which is what the hook has always done. */
const UNNAMED: LiveMode = 'lesson';

const capsFor = (mode: LiveMode | undefined): ModeCaps => MODE_CAPS[mode ?? UNNAMED];

/**
 * Does connecting publish the microphone, or does the learner?
 *
 * This used to be `mode !== 'convo-text'` inside the hook, which opened the
 * microphone before the choosing screen had painted a single pixel. Two costs:
 * the learner was live without having agreed to be, and the open microphone
 * heard the tutor asking its own question out loud.
 */
export function micOpensAtConnect(mode: LiveMode | undefined): boolean {
  return capsFor(mode).micAtConnect;
}

/**
 * Is there any audio in this session, in either direction?
 *
 * The question the hook has to ask three times over: whether to look for a
 * microphone API at all, whether to take the audio session, and whether to
 * start playback. Asking it as `mode !== 'convo-text'` refused the typed lesson
 * outright on a device with no microphone, which is precisely the learner that
 * mode exists for.
 */
export function modeCarriesAudio(mode: LiveMode | undefined): boolean {
  return capsFor(mode).carriesAudio;
}

/** The one instruction the voice-first screen gives. */
export const TAP_TO_TALK = 'Tap the circle when you are ready to talk.';

/**
 * What the learner may talk about, which is anything.
 *
 * A function of the name rather than a constant, because the sentence names
 * the person who will be listening.
 */
export function anythingGoes(tutorName: string): string {
  return `Anything goes. Say it in English or French, and ${tutorName} takes it from there.`;
}

/** The quiet twin, worded exactly as the tutor tab words it. */
export const QUIET_DOOR = 'Unable to speak right now?';

export function choosingView(state: ChoosingState): ChoosingView {
  const { textMode, micOpen, thinking, tutorSpeaking, turns, tutorName, typingOpen } = state;

  // A closed microphone is the only thing a tap can change. It stays tappable
  // while the tutor is still asking, because a learner who is ready before the
  // question ends should not be made to wait for it.
  const orbIsButton = !textMode && !micOpen;

  // Thinking outranks everything: the learner has just spoken or typed and
  // nothing has come back yet, and that is the one thing worth saying.
  //
  // Below that, a circle waiting to be pressed is `ready`, not `idle`. The two
  // used to be one state, so the primary control of the entire product was
  // drawn in the hairline colour and captioned in the faintest ink there is.
  // `idle` now means only what it says: nothing to press, nothing happening.
  const orb: ChoosingOrb = thinking
    ? 'thinking'
    : tutorSpeaking
      ? 'speaking'
      : orbIsButton
        ? 'ready'
        : textMode || !micOpen
          ? 'idle'
          : 'listening';

  const orbLabel = orbIsButton
    ? 'Tap the circle when you are ready to talk'
    : orb === 'thinking'
      ? `${tutorName} is thinking`
      : orb === 'speaking'
        ? `${tutorName} is speaking`
        : orb === 'listening'
          ? 'Your turn to speak'
          : `${tutorName} is ready`;

  // Two voices in the thread is the moment the thread becomes worth drawing.
  const answered = turns.some((t) => t.who === 'learner');

  return {
    showQuestion: !answered,
    orb,
    orbIsButton,
    orbLabel,
    showTranscript: answered,
    // The box, either because the session is the quiet twin or because the
    // learner asked for a keyboard. Only this line reads `typingOpen`: the
    // circle, the quiet door and the helper are all unchanged by it, which is
    // the whole difference between opening with a keyboard and going quiet.
    showInput: textMode || typingOpen,
    showQuietDoor: !textMode,
    helper: textMode ? null : orbIsButton ? TAP_TO_TALK : anythingGoes(tutorName),
  };
}
