/**
 * Which of the living orb's layers are drawn, decided apart from drawing them
 * (come alive, core loop 3.3; README Part 5.E "Living orb").
 *
 * The orb has always been two rings and a core in the state colour, breathing
 * on today's loops. Inside a conversation room it can now answer the room's
 * real audio, through layers that sit around the same drawing in the same
 * colours:
 *
 *   ring    `OrbLevelRing`, two rings swelling with the learner's microphone
 *           level, while it is their turn and that level is measured;
 *   bars    `LiveBars`, the seven bars following the tutor's voice band by
 *           band, while the tutor speaks and that voice is measured, with the
 *           core pulsing on the tutor's overall level (`OrbPulse`);
 *   arc     `OrbThinkingArc`, a segment of the outer ring going round while the
 *           tutor is really thinking (`live/thinking.ts`);
 *   ripple  `OrbRipple`, two ripples and a scatter of dots, once, on the goal
 *           tick that completes a scene, before its card arrives.
 *
 * Two rules hold every layer. A level is drawn only once it is measured: until
 * then, and whenever it stops being measured, the orb keeps the loops it has
 * always had, so it never invents a voice. And every layer rests (holds still,
 * or is not drawn) when the room is not in front of the learner, the app is in
 * the background, the caller pauses the orb, or movement is reduced.
 *
 * Outside a room (the Tutor tab, the intro, the waiting screens) there are no
 * levels and no layers: the orb is exactly what it was. Pure, so the Node suite
 * holds every branch; `VoiceOrb.tsx` asks it and draws what it says.
 */

import type { OrbRoom } from '../live/OrbAudio.tsx';

/** The orb's states, as `VoiceOrb.tsx` names them. Kept as a string union here so this file loads anywhere. */
export type OrbLayerState = 'ready' | 'idle' | 'connecting' | 'speaking' | 'listening' | 'thinking' | 'error';

/** The visual word under the orb while the learner is heard. The accessible name keeps the state's own word. */
export const HEARING_YOU = 'Hearing you';

export interface OrbLayers {
  /** Two rings swelling with the learner's measured level. */
  ring: boolean;
  /** The seven bars: from the tutor's measured bands, or today's loop. */
  bars: 'live' | 'loop';
  /** The core pulses with the tutor's measured level. */
  pulse: boolean;
  /** The thinking arc: not drawn, drawn still, or going round. */
  arc: 'off' | 'still' | 'turning';
  /** A ripple asked for now may play. */
  ripple: boolean;
  /** Today's breathing and bar loops hold their resting frame. */
  loopsRest: boolean;
  /** The word drawn under the orb: the state's own, or "Hearing you". */
  caption: 'state' | 'hearing';
}

export interface OrbLayerInput {
  state: OrbLayerState;
  /** The room's facts, or null outside a room. */
  room: OrbRoom | null;
  /** The OS asks for less movement, watched live. */
  reduced: boolean;
  /** The caller has parked the orb (a tab that is not on top). */
  paused: boolean;
}

/** Outside a room: today's orb, resting only when its caller parks it. */
const NO_LAYERS = { ring: false, bars: 'loop', pulse: false, arc: 'off', ripple: false, caption: 'state' } as const;

export function orbLayers({ state, room, reduced, paused }: OrbLayerInput): OrbLayers {
  if (room === null) return { ...NO_LAYERS, loopsRest: paused };
  // A room nobody is looking at: every layer rests, and so do today's loops.
  const asleep = paused || !room.awake;
  const bars = state === 'speaking' && room.outputLive && !asleep && !reduced ? 'live' : 'loop';
  return {
    ring: state === 'listening' && room.inputLive && !asleep,
    bars,
    pulse: bars === 'live',
    arc: state !== 'thinking' ? 'off' : asleep || reduced ? 'still' : 'turning',
    ripple: !asleep && !reduced,
    // The live bars and the pulse take over from the loop while they draw, so
    // the loop rests rather than moving the core a second way.
    loopsRest: asleep || bars === 'live',
    caption: state === 'listening' && room.inputLive && room.hearing && !asleep ? 'hearing' : 'state',
  };
}

/**
 * OrbLevelRing: the ring's size as a share of the orb's. At rest it sits
 * between the orb's two rings; at the learner's loudest (the shared ring grows
 * by 0.22) it reaches just past the outer one and stays clear of the word under
 * the orb.
 */
export const ORB_LEVEL_RING_SHARE = 0.9;

/** LiveBars: bar i stands at `base + gain * band i` of its own height. */
export const LIVE_BARS = { base: 0.45, gain: 0.85 } as const;

/** OrbPulse: the core grows by this share of itself at the tutor's loudest. */
export const ORB_PULSE = 0.04;

/** OrbThinkingArc: the arc is this share of the outer ring, and goes round once in this many ms. */
export const ORB_ARC = { share: 0.22, turn: 1200 } as const;

/**
 * OrbRipple: two rings from the orb's edge to `scale` times its size, fading
 * from `from` to nothing, the second a beat behind the first, and `dots` small
 * dots flying out to `reach` of the orb's size. Durations are motion tokens,
 * named in the file that draws it.
 */
export const ORB_RIPPLE = { scale: 1.6, from: 0.5, dots: 8, reach: 0.85, dot: 0.05 } as const;
