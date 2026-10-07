/**
 * The tutor's voice circle (SNIPPETS orb).
 *
 * Two rings and a core in the state colour, and one mark per state inside the
 * core, in the glyph colour `onOrb` pairs with that fill: the seven bars while
 * the tutor speaks, which are the waveform; a microphone whenever it is your
 * turn to talk or the room is getting ready; three dots while the tutor
 * thinks. White on coral and ink, ink on mint and sun. On the Tutor landing page
 * the short state label sits directly under the mark; in a live room the
 * existing caption can remain under the orb.
 *
 * The SVG in `OrbGlyph` is still. This wrapper animates only opacity and
 * transform with core Animated and the native driver. The waveform is a small
 * set of ordinary views, so no SVG attribute is driven from JavaScript.
 *
 * The living orb (come alive, core loop 3.3). Inside a conversation room
 * (`live/RoomLevels` hands it the room's real audio through `OrbAudio`) the
 * same drawing gains layers in the same colours, each in its own file under
 * `tutor/` and each decided by `orbLayers.ts`: a ring that swells with the
 * learner's real microphone level (`OrbLevelRing`), bars and a core that follow
 * the tutor's real voice (`LiveBars`, `OrbPulse`), a segment of the ring going
 * round while the tutor is really thinking (`OrbThinkingArc`), and one ripple on
 * the goal tick that completes a scene (`OrbRipple`). While the learner is heard
 * the word under the orb reads "Hearing you"; the accessible name keeps the
 * state's own word, so a screen reader is not told twice a sentence. A level
 * that is not measured draws nothing: the orb keeps today's loops. Every layer
 * rests behind another screen, with the app away, when paused or when movement
 * is reduced. Outside a room there is no `OrbAudio` and the orb is exactly what
 * it was.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { decorative, onOrb, orb, paper, space, type } from '../theme.ts';
import { NATIVE_DRIVER, useReduceMotion } from '../motion.ts';
import { MicGlyph } from '../components.tsx';
import { useOrbAudio, type OrbAudio } from '../live/OrbAudio.tsx';
import { orbRests } from './orbRest.ts';
import { OrbGlyph } from './OrbGlyph.tsx';
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
  /** One state colour draws both rings and the core. */
  colour: string;
  /** What sits on that colour: the mark and the embedded status. */
  glyph: string;
  /** The one mark in the core: bars while speaking, a microphone when it is your turn, dots while thinking. */
  mark: 'bars' | 'mic' | 'dots';
  /** Whether the bars wait or respond. Only the speaking orb's waveform moves. */
  bars: 'still' | 'moving';
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
    glyph: onOrb.ready,
    mark: 'mic',
    bars: 'still',
    amplitude: 0.025,
    period: 3000,
    shimmer: false,
    caption: 'Tap to talk',
  },
  idle: {
    colour: paper.inkSoft,
    glyph: paper.onInk,
    mark: 'mic',
    bars: 'still',
    amplitude: 0,
    period: 0,
    shimmer: false,
    caption: 'Ready',
  },
  connecting: {
    colour: orb.ready,
    glyph: onOrb.ready,
    mark: 'mic',
    bars: 'still',
    amplitude: 0.025,
    period: 1150,
    shimmer: false,
    caption: 'Connecting',
  },
  speaking: {
    colour: orb.speaking,
    glyph: onOrb.speaking,
    mark: 'bars',
    bars: 'moving',
    amplitude: 0.045,
    period: 780,
    shimmer: false,
    caption: 'Listen',
  },
  listening: {
    colour: orb.yourTurn,
    glyph: onOrb.yourTurn,
    mark: 'mic',
    bars: 'still',
    amplitude: 0.035,
    period: 1120,
    shimmer: false,
    caption: 'Speak',
  },
  thinking: {
    colour: orb.thinking,
    glyph: onOrb.thinking,
    mark: 'dots',
    bars: 'still',
    amplitude: 0,
    period: 900,
    shimmer: true,
    caption: 'Thinking',
  },
  error: {
    colour: paper.inkSoft,
    glyph: paper.onInk,
    mark: 'mic',
    bars: 'still',
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
  /** A short status drawn directly inside the colour field, below the bars. */
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
  const layers = orbLayers({ state: props.state, room: audio === null ? null : audio.room, reduced, paused: props.paused === true });
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
  const drivers = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
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
        drivers[1]!.setValue(0.5);
        const shimmer = Animated.loop(
          Animated.sequence([
            Animated.timing(dim, {
              toValue: 0.62,
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
      if (look.bars !== 'moving') drivers[1]!.setValue(0.5);
      const moving = look.bars === 'moving' ? drivers : drivers.slice(0, 1);
      moving.forEach((driver, index) => {
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

  const barWidth = Math.max(2, Math.round(size * 0.018));
  const barGap = Math.max(2, Math.round(size * 0.018));
  const barScales = BAR_HEIGHTS.map((_, index) =>
    drivers[1]!.interpolate({
      inputRange: [0, 1],
      outputRange: index % 2 === 0 ? [0.76, 1.08] : [1.08, 0.76],
    }),
  );

  return (
    <View
      style={[st.root, { width: size, height: size }]}
      {...(announce
        ? { accessibilityRole: 'image' as const, accessibilityLabel: `Tutor: ${look.caption}` }
        : decorative)}
    >
      {/* Behind the drawing: the ripple on a scene's final goal tick, and the
          ring that swells with the learner's real level. */}
      {audio !== null ? <OrbRipple cue={cue} size={size} color={look.colour} allowed={layers.ripple} /> : null}
      {layers.ring && audio !== null ? <OrbLevelRing level={audio.input} size={size} color={look.colour} /> : null}

      <OrbPulse level={audio === null ? null : audio.output} on={layers.pulse}>
        <Animated.View style={{ opacity: dim, transform: [{ scale: breath }], pointerEvents: 'none' }}>
          <OrbGlyph color={look.colour} size={size} />
        </Animated.View>
      </OrbPulse>

      {layers.arc !== 'off' ? <OrbThinkingArc size={size} color={look.colour} active={layers.arc === 'turning'} /> : null}

      <Animated.View style={[st.signal, { opacity: dim, pointerEvents: 'none' }]} {...decorative}>
        {look.mark === 'bars' ? (
          layers.bars === 'live' && audio !== null ? (
            <LiveBars bands={audio.bands} heights={BAR_HEIGHTS} size={size} width={barWidth} gap={barGap} color={look.glyph} />
          ) : (
          <View style={[st.bars, { gap: barGap, height: size * 0.4 }]}>
            {BAR_HEIGHTS.map((height, index) => (
              <Animated.View
                key={`${height}-${index}`}
                style={[
                  {
                    backgroundColor: look.glyph,
                    width: barWidth,
                    height: Math.max(5, size * height),
                    borderRadius: barWidth / 2,
                    transform: [{ scaleY: barScales[index]! }],
                  },
                ]}
              />
            ))}
          </View>
          )
        ) : null}
        {look.mark === 'mic' ? <MicGlyph size={size * (32 / 120)} color={look.glyph} /> : null}
        {look.mark === 'dots' ? (
          <View style={[st.dots, { gap: size * (6 / 120) }]}>
            {[0, 1, 2].map((dot) => (
              <View
                key={dot}
                style={{ width: size * (8 / 120), height: size * (8 / 120), borderRadius: size * (4 / 120), backgroundColor: look.glyph }}
              />
            ))}
          </View>
        ) : null}
        {embeddedLabel !== undefined ? (
          <Text style={[st.embeddedLabel, { color: look.glyph }]}>{embeddedLabel}</Text>
        ) : null}
      </Animated.View>

      {/* The word under the orb may read "Hearing you" while the learner is
          heard; what a screen reader is told stays the state's own word, so
          it is not interrupted every time somebody pauses for breath. */}
      {withCaption ? (
        <Text style={st.caption} accessibilityLabel={look.caption}>
          {layers.caption === 'hearing' ? HEARING_YOU : look.caption}
        </Text>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  signal: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center' },
  embeddedLabel: {
    ...type.bodyStrong,
    position: 'absolute',
    bottom: '16%',
    textAlign: 'center',
  },
  caption: {
    ...type.label,
    position: 'absolute',
    bottom: -space(6),
    color: paper.ink,
    textAlign: 'center',
  },
});
