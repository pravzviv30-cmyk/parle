/**
 * The orb's one celebration: two ripples and a scatter of dots, once, when the
 * goal tick that completes a scene lands (come alive, core loop 2.7 and 3.3).
 *
 * Asked for through `OrbCue`, a key the conversation sets on that tick
 * (`tutor/useTaskTicks.ts`). The orb plays a key that arrives while it is on
 * screen, once; a key it mounts with has already been seen, so an orb that
 * comes back after the scene's card is never a replay. The ripples are a still
 * Svg ring in the state's colour, growing from the orb's edge to 1.6 times its
 * size and fading from 0.5 to nothing, the second a beat behind; the dots fly
 * out and fade with the first. Transform and opacity only, through
 * motion/drive.ts.
 *
 * Silent and still in the other senses: no sound and no haptic, because a live
 * room holds the learner's ears (decision D8; the fanfare waits for the recap).
 * It plays only while `orbLayers` allows a ripple: not with movement reduced,
 * not behind another screen or with the app away; leaving the foreground or
 * unmounting lands it on its final frame, which is nothing. Decorative.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReduceMotion } from '../motion.ts';
import { cancel, delay, timing } from '../motion/drive.ts';
import { useLandOnLeave } from '../motion/landing.ts';
import { DUR, EASE } from '../motion/tokens.ts';
import { decorative, STROKE } from '../theme.ts';
import { ORB_RIPPLE } from './orbLayers.ts';
import { ORB_BOX } from './OrbGlyph.tsx';

const OrbCueContext = createContext<string | null>(null);

/** The ripple's key for the orbs inside it, or null for none. Set by the conversation on a scene's final goal tick. */
export function OrbCue({ value, children }: { value: string | null; children: ReactNode }) {
  return <OrbCueContext.Provider value={value}>{children}</OrbCueContext.Provider>;
}

/** The ripple key the orb is inside, if any. */
export function useOrbCue(): string | null {
  return useContext(OrbCueContext);
}

const CENTRE = ORB_BOX / 2;

export function OrbRipple({ cue, size, color, allowed }: { cue: string | null; size: number; color: string; allowed: boolean }) {
  const reduced = useReduceMotion();
  const first = useSharedValue(0);
  const second = useSharedValue(0);
  // The key this orb mounted with is already spent: only a new one plays.
  const spent = useRef(cue);
  const [playing, setPlaying] = useState(false);

  const land = () => {
    cancel(first);
    cancel(second);
    first.value = 1;
    second.value = 1;
    setPlaying(false);
  };

  useEffect(() => {
    if (cue === null || cue === spent.current) return;
    spent.current = cue;
    if (!allowed || reduced) return;
    first.value = 0;
    second.value = 0;
    setPlaying(true);
    first.value = timing(1, DUR.reveal, EASE.out, reduced);
    second.value = delay(DUR.fast, timing(1, DUR.reveal, EASE.out, reduced, (done) => {
      if (done) setPlaying(false);
    }), reduced);
    // The orb's state, its size and its colour may change under a ripple; only a new key plays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue]);

  // Reduce Motion turned on, or the room going to sleep, ends a ripple at once.
  useEffect(() => {
    if (playing && (reduced || !allowed)) land();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, allowed, playing]);

  useLandOnLeave(land);

  if (!playing) return null;
  return (
    <View {...decorative} style={st.layer}>
      <Ring progress={first} size={size} color={color} />
      <Ring progress={second} size={size} color={color} />
      {Array.from({ length: ORB_RIPPLE.dots }, (_, i) => (
        <Dot key={i} progress={first} angle={(i / ORB_RIPPLE.dots) * 2 * Math.PI} size={size} color={color} />
      ))}
    </View>
  );
}

function Ring({ progress, size, color }: { progress: SharedValue<number>; size: number; color: string }) {
  const look = useAnimatedStyle(() => ({
    opacity: ORB_RIPPLE.from * (1 - progress.value),
    transform: [{ scale: 1 + (ORB_RIPPLE.scale - 1) * progress.value }],
  }));
  return (
    <Reanimated.View style={[st.layer, look]}>
      <Svg width={size} height={size} viewBox={`0 0 ${ORB_BOX} ${ORB_BOX}`} {...decorative}>
        <Circle cx={CENTRE} cy={CENTRE} r={CENTRE - STROKE} fill="none" stroke={color} strokeWidth={STROKE} />
      </Svg>
    </Reanimated.View>
  );
}

function Dot({ progress, angle, size, color }: { progress: SharedValue<number>; angle: number; size: number; color: string }) {
  // From behind the core to past the second ripple's edge.
  const reach = size * ORB_RIPPLE.reach;
  const dx = Math.cos(angle) * reach;
  const dy = Math.sin(angle) * reach;
  const look = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateX: dx * progress.value }, { translateY: dy * progress.value }],
  }));
  const d = Math.max(4, size * ORB_RIPPLE.dot);
  return <Reanimated.View style={[st.dot, { width: d, height: d, borderRadius: d / 2, backgroundColor: color }, look]} />;
}

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  dot: { position: 'absolute', pointerEvents: 'none' },
});
