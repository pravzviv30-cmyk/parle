/** Cloud voice orb. The room owns input, output and state.
 * The surface stays clear; captions and measured output bands sit below it.
 * Native transforms breathe gently. Reduced motion, pause and app background
 * stop every loop; the input ring, output pulse and thinking arc keep their
 * existing audio/lifecycle gates and accessible names.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { decorative, orb, paper, space, type } from '../theme.ts';
import { NATIVE_DRIVER, useReduceMotion } from '../motion.ts';
import { useAppActive, useOrbAudio, type OrbAudio } from '../live/OrbAudio.tsx';
import { orbRests } from './orbRest.ts';
import { useB } from '../main/bTheme.tsx';
import { OrbSurface } from './OrbSurface.tsx';
import { HEARING_YOU, orbLayers, type OrbLayers } from './orbLayers.ts';
import { OrbLevelRing } from './OrbLevelRing.tsx';
import { OrbPulse } from './OrbPulse.tsx';
import { OrbRipple, useOrbCue } from './OrbRipple.tsx';
import { OrbThinkingArc } from './OrbThinkingArc.tsx';
import { LiveBars } from './LiveBars.tsx';

export type OrbState = 'ready' | 'idle' | 'connecting' | 'speaking' | 'listening' | 'thinking' | 'error';

/** The whole ring field when a caller does not choose a size. */
const ORB_DEFAULT = 132;

/** Seven bars: the speaking orb's waveform, the middle one the tallest. */
const BAR_HEIGHTS = [0.1, 0.17, 0.27, 0.38, 0.27, 0.17, 0.1] as const;

interface Look {
  /** State colour for the subtle rim and measured audio layers. */
  colour: string;
  /** Scale travel from the resting frame. */
  amplitude: number;
  /** One breath, in milliseconds. */
  period: number;
  /** Thinking dims instead of travelling. */
  shimmer: boolean;
  /** The compact state word, embedded or placed underneath by the caller. */
  caption: string;
}

const LOOKS: Record<OrbState, Look> = {
  ready: {
    colour: orb.ready,
    amplitude: 0.025,
    period: 3000,
    shimmer: false,
    caption: 'Tap to talk',
  },
  idle: {
    colour: paper.inkSoft,
    amplitude: 0,
    period: 0,
    shimmer: false,
    caption: 'Ready',
  },
  connecting: {
    colour: orb.ready,
    amplitude: 0.025,
    period: 1150,
    shimmer: false,
    caption: 'Connecting',
  },
  speaking: {
    colour: orb.speaking,
    amplitude: 0.045,
    period: 780,
    shimmer: false,
    caption: 'Listen',
  },
  listening: {
    colour: orb.yourTurn,
    amplitude: 0.035,
    period: 1120,
    shimmer: false,
    caption: 'Speak',
  },
  thinking: {
    colour: orb.thinking,
    amplitude: 0,
    period: 900,
    shimmer: true,
    caption: 'Thinking',
  },
  error: {
    colour: paper.inkSoft,
    amplitude: 0,
    period: 0,
    shimmer: false,
    caption: 'Unavailable',
  },
};

interface VoiceOrbProps {
  state: OrbState;
  size?: number;
  /** TutorIntro writes its own words beside its mini orbs. */
  withCaption?: boolean;
  /** False when the surrounding Pressable owns the accessible name. */
  announce?: boolean;
  /** A tab that is no longer focused parks every driver at its final frame. */
  paused?: boolean;
  /** Optional compact status below the cloud surface. */
  embeddedLabel?: string;
}

/**
 * The orb, and what the room it sits in says about it. Outside a room there is
 * no `OrbAudio` and no cue, `orbLayers` draws no layer, and the face below is
 * today's orb with the caller's own pause. In a room the face's loops also rest
 * while the room is asleep or a live layer moves in their place.
 */
export function VoiceOrb(props: VoiceOrbProps) {
  const audio = useOrbAudio();
  const cue = useOrbCue();
  const reduced = useReduceMotion();
  const active = useAppActive();
  const layers = orbLayers({ state: props.state, room: audio === null ? null : audio.room, reduced, paused: props.paused === true || !active });
  return <OrbFace {...props} paused={layers.loopsRest} audio={audio} layers={layers} cue={cue} />;
}

function OrbFace({
  state,
  size = ORB_DEFAULT,
  withCaption = true,
  announce = true,
  paused = false,
  embeddedLabel,
  audio,
  layers,
  cue,
}: VoiceOrbProps & {
  /** The room's levels, or null outside a room. */
  audio: OrbAudio | null;
  /** Which living layers draw, from `orbLayers`. */
  layers: OrbLayers;
  /** The ripple's key, from `OrbCue`. */
  cue: string | null;
}) {
  const look = LOOKS[state];
  const t = useB();
  const drivers = [useRef(new Animated.Value(0)).current];
  const dim = useRef(new Animated.Value(1)).current;
  const reduced = useReduceMotion();

  useEffect(() => {
    let cancelled = false;
    const running: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const run = () => {
      if (cancelled) return;
      if (orbRests({ amplitude: look.amplitude, shimmer: look.shimmer, reduced, paused })) {
        for (const driver of drivers) driver.setValue(0.5);
        dim.setValue(1);
        return;
      }

      if (look.shimmer) {
        const shimmer = Animated.loop(
          Animated.sequence([
            Animated.timing(dim, {
              toValue: 0.82,
              duration: look.period,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: NATIVE_DRIVER,
            }),
            Animated.timing(dim, {
              toValue: 1,
              duration: look.period,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: NATIVE_DRIVER,
            }),
          ]),
        );
        running.push(shimmer);
        shimmer.start();
        return;
      }

      dim.setValue(1);
      drivers.forEach((driver, index) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(driver, {
              toValue: 1,
              duration: look.period,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: NATIVE_DRIVER,
            }),
            Animated.timing(driver, {
              toValue: 0,
              duration: look.period,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: NATIVE_DRIVER,
            }),
          ]),
        );
        running.push(loop);
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            loop.start();
          }, index * 240),
        );
      });
    };

    run();
    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      for (const animation of running) animation.stop();
    };
    // Stable refs are deliberately omitted. State, reduced motion and focus are
    // the three facts that may replace a running loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced, paused]);

  const breath = drivers[0]!.interpolate({
    inputRange: [0, 1],
    outputRange: [1 - look.amplitude, 1 + look.amplitude],
  });

  const meterSize = Math.min(48, size * 0.28);
  const barWidth = 2;
  const barGap = 2;

  return (
    <View
      style={[st.root, { width: size }]}
      {...(announce
        ? { accessibilityRole: 'image' as const, accessibilityLabel: `Tutor: ${look.caption}` }
        : decorative)}
    >
      <View style={[st.face, { width: size, height: size }]}>
      {/* Behind the drawing: the ripple on a scene's final goal tick, and the
          ring that swells with the learner's real level. */}
      {audio !== null ? <OrbRipple cue={cue} size={size} color={look.colour} allowed={layers.ripple} /> : null}
      {layers.ring && audio !== null ? <OrbLevelRing level={audio.input} size={size} color={look.colour} /> : null}

      <OrbPulse level={audio === null ? null : audio.output} on={layers.pulse}>
        <Animated.View style={{ opacity: dim, transform: [{ scale: breath }, { rotate: drivers[0]!.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] }) }], pointerEvents: 'none' }}>
          <OrbSurface color={look.colour} size={size} />
        </Animated.View>
      </OrbPulse>

      {layers.arc !== 'off' ? <OrbThinkingArc size={size} color={look.colour} active={layers.arc === 'turning'} /> : null}

      </View>
      {(withCaption || embeddedLabel !== undefined) && (
        <View style={st.status}>
          {layers.bars === 'live' && audio !== null && <View {...decorative}>
            <LiveBars bands={audio.bands} heights={BAR_HEIGHTS} size={meterSize} width={barWidth} gap={barGap} color={t.text} />
          </View>}
          <Text style={[st.caption, { color: t.text }]} accessibilityLabel={look.caption}>
            {embeddedLabel ?? (layers.caption === 'hearing' ? HEARING_YOU : look.caption)}
          </Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { alignItems: 'center' },
  face: { alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space(2), minHeight: 44 },
  caption: { ...type.label, textAlign: 'center' },
});
