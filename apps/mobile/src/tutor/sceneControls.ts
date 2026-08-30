/**
 * Which controls a live scene offers, and what they send.
 *
 * Two bugs put this file here and both of them were rules living in JSX.
 *
 * **Hear it did nothing.** ConvoScreen handed `onHearLine` to every support
 * view, so the SAY THIS card drew its Hear it button whenever the learner held
 * the floor, including on the turns where support is a hint, a set of options,
 * or nothing at all. Agent-side, `hear` speaks the support line and there is no
 * support line on those turns, so the button was pressable and silent. The
 * tempting fix is to make it fall back to the tutor's own last line; that is
 * rejected on purpose, because handing back the scene's line from the card that
 * says "say this" hands back exactly what the support ladder withheld and
 * muddles whose line it is. So the honest fix is the button not being there.
 * A control that is present and does nothing is worse than one that is absent,
 * because the learner concludes the app is broken rather than that the offer is
 * not on the table this turn.
 *
 * **There was no way to type mid-scene.** Text mode is a property of the
 * session: switching it rebuilds the room, and the agent opens voiceless. That
 * is right for a learner who knows before they start that they cannot speak,
 * and wrong for one who finds out halfway through a scene, because it costs
 * them the scene. `say` has always been a full typed turn on the agent's side,
 * so opening the box mid-scene needs no wire change, no mode and no rebuild:
 * the microphone stays live, the tutor stays where they are, and one turn
 * arrives as text. That makes this the quiet twin for the voice path, which is
 * the invariant that says every spoken path has one.
 *
 * Neither rule can be tested where it was, so neither rule stays there.
 */

import type { ClientMessage, ConvoSupportView } from '@parle/core';
import { TAP_TO_TALK } from './choosingView.ts';

/**
 * Is there a line on the card that the tutor would actually say if asked?
 *
 * Only the full-line support view carries one. Options each have their own
 * replay, a hint is deliberately not a line to repeat back, and `none` is the
 * turn where the learner is on their own by design.
 */
export function hasSayableSupportLine(support: ConvoSupportView): boolean {
  return support.kind === 'full-line' && support.line.trim().length > 0;
}

export interface SceneControls {
  /** Replay the line on the SAY THIS card. Absent when there is no line. */
  showHearIt: boolean;
  /** The quiet twin, offered inside the scene rather than two screens back. */
  showTypeInstead: boolean;
  /** The text box and its Send. */
  showInput: boolean;
  /**
   * The scene's orb is the circle that opens the microphone.
   *
   * A mission runs in `convo`, which does not publish a microphone at connect,
   * and until F274 the only control that opened one lived in the choosing
   * block — which a mission's own scene unmounts within a frame of arriving.
   * The learner got an orb drawn `listening` above no microphone at all.
   */
  showOpenMic: boolean;
}

/**
 * The words on the scene's circle.
 *
 * Re-exported from the chooser rather than retyped: it is the same promise in
 * the same session, and a second copy is how a promise and its button drift
 * apart. See F274.
 */
export const OPEN_MIC_LABEL = TAP_TO_TALK;

export function sceneControls(input: {
  supportView: ConvoSupportView;
  /** The session was started voiceless. The box is always open and never a choice. */
  textMode: boolean;
  /** The learner has the floor. A replay must never talk over the tutor. */
  listening: boolean;
  /** The learner tapped Type instead during this scene. */
  typingOpen: boolean;
  /** A microphone is already published for this session. */
  micOpen: boolean;
}): SceneControls {
  return {
    // Three conditions, and the third is the new one: something to replay.
    showHearIt: input.listening && !input.textMode && hasSayableSupportLine(input.supportView),
    // Offered until it is taken. Once the box is open the offer is the box.
    showTypeInstead: !input.textMode && !input.typingOpen,
    showInput: input.textMode || input.typingOpen,
    // Two conditions and no third. `listening` is deliberately not one of them:
    // it gates the replay button because a replay would talk over the tutor,
    // and opening a microphone makes no sound — a learner who wants to answer
    // early should not be told to wait. `typingOpen` is not one either, because
    // typing mid-scene is a detour and not a decision about the microphone.
    showOpenMic: !input.textMode && !input.micOpen,
  };
}

/**
 * What a typed draft becomes.
 *
 * The ordinary path, deliberately: the same `say` a text-mode session sends, so
 * a typed turn mid-scene is graded, transcribed and answered exactly as any
 * other turn. Nothing here switches a mode or restarts a session.
 *
 * Null for a draft with nothing in it. Trimmed, because a trailing space is not
 * a thing the learner meant to say.
 */
export function typedTurn(draft: string): Extract<ClientMessage, { t: 'say' }> | null {
  const text = draft.trim();
  return text.length === 0 ? null : { t: 'say', text };
}

/**
 * Which line a replay request asks for.
 *
 * `'support'` is the line being offered to the learner; `'scene'` is the
 * tutor's own last line, which is how tapping their bubble replays it without a
 * second control competing for row space. Absent means support, which is what
 * `hear` has always meant, so an agent that predates the field speaks rather
 * than falling silent.
 */
export type ReplayLine = 'support' | 'scene';
