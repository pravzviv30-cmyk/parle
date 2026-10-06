/**
 * An icon that answers something real (come alive, icons section 1.7).
 *
 * Ten kinds, each tied to a true event the caller already holds: a reminder
 * really scheduled, a save that really resolved, a player really playing, an
 * entitlement really confirmed. The caller passes that truth; nothing here
 * guesses it or plays it early.
 *
 *   state    'on' or 'off' (the default): the resting truth. A one-shot plays
 *            when it turns on after mount (bell-ring, bookmark-fill, check-draw,
 *            cloud-check, flame-flicker's ignite, lock-open); bookmark-fill also
 *            plays its quiet reverse when it turns off. Mounting already on
 *            shows the final frame, never a replay.
 *   trigger  any value; a change after mount replays a one-shot that has no
 *            state (refresh-spin's single turn, star-pop).
 *   active   a held state that loops: a line playing (speaker-waves), a
 *            recording (mic-pulse), busy (refresh-spin), the streak screen in
 *            view (flame-flicker). The caller sets it false on blur.
 *
 * The rules every kind keeps:
 *
 * - Only transform and opacity move. A fill rising or a tick drawing on is a
 *   window with `overflow: 'hidden'` sliding over a still drawing, with the
 *   drawing counter-moved inside it; no SVG attribute is animated and nothing
 *   is built with createAnimatedComponent.
 * - Every timing goes through motion/drive.ts with the live reduced-motion
 *   answer from motion.ts, and the numbers come from motion/tokens.ts and
 *   icons/iconMotion.ts.
 * - Under Reduce Motion every kind shows its final frame, watched live: a
 *   learner who turns it on mid-loop gets the still frame at once.
 * - A loop runs only while `active` is true and the app is in the foreground.
 *   Everything is cancelled on unmount, and a one-shot lands on its final frame
 *   when the app leaves the foreground.
 * - Decorative: the control around it says what happened. It fires no haptic
 *   and no sound; the caller that owns the event does that, once.
 *
 * Not used inside a live room or on the safety stop (F137): nothing there
 * celebrates.
 */

import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { cancel, delay, repeat, sequence, spring, timing } from '../motion/drive.ts';
import { useLandOnLeave } from '../motion/landing.ts';
import { DUR, EASE, SELECT_POP_MS, SPRING } from '../motion/tokens.ts';
import { accent, colour, decorative, paper, STROKE } from '../theme.ts';
import { Icon, IconPart } from './Icon.tsx';
import { ICON_MOTION } from './iconMotion.ts';

export type AnimatedIconKind =
  | 'bell-ring'
  | 'bookmark-fill'
  | 'check-draw'
  | 'speaker-waves'
  | 'flame-flicker'
  | 'refresh-spin'
  | 'cloud-check'
  | 'mic-pulse'
  | 'star-pop'
  | 'lock-open';

export type AnimatedIconProps = {
  kind: AnimatedIconKind;
  /** Points, on the 24 box. */
  size?: number;
  /** The mark. A palette token. The flame keeps its own coral, sun and grey. */
  color?: string;
  /** The resting truth; a one-shot plays when this turns on after mount. */
  state?: 'off' | 'on';
  /** A change after mount replays a stateless one-shot (a press, a reward). */
  trigger?: string | number;
  /** A held state that loops while true and the app is in the foreground. */
  active?: boolean;
};

export function AnimatedIcon({ kind, size = 24, color = paper.ink, state = 'off', trigger, active = false }: AnimatedIconProps): ReactElement {
  const reduced = useReduceMotion();
  const awake = useForeground();
  const on = state === 'on';
  const common = { size, color, reduced };
  return (
    <View {...decorative} pointerEvents="none" style={{ width: size, height: size }}>
      {kind === 'bell-ring' ? <BellRing {...common} on={on} /> : null}
      {kind === 'bookmark-fill' ? <BookmarkFill {...common} on={on} /> : null}
      {kind === 'check-draw' ? <CheckDraw {...common} on={on} /> : null}
      {kind === 'speaker-waves' ? <SpeakerWaves {...common} active={active && awake} /> : null}
      {kind === 'flame-flicker' ? <FlameFlicker {...common} on={on} active={active && awake} /> : null}
      {kind === 'refresh-spin' ? <RefreshSpin {...common} trigger={trigger} active={active && awake} /> : null}
      {kind === 'cloud-check' ? <CloudCheck {...common} on={on} /> : null}
      {kind === 'mic-pulse' ? <MicPulse {...common} active={active && awake} /> : null}
      {kind === 'star-pop' ? <StarPop {...common} trigger={trigger} /> : null}
      {kind === 'lock-open' ? <LockOpen {...common} on={on} /> : null}
    </View>
  );
}

type Sub = { size: number; color: string; reduced: boolean };

/** Whether the app is in the foreground, watched. A loop runs only while it is. */
function useForeground(): boolean {
  const [awake, setAwake] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setAwake(next === 'active'));
    return () => subscription.remove();
  }, []);
  return awake;
}

/** The pop every kind lands with: up quickly, then home on the pop spring. */
function popTo(value: SharedValue<number>, peak: number, reduced: boolean, after = 0): void {
  const pop = sequence(reduced, timing(peak, SELECT_POP_MS, EASE.out, reduced), spring(1, SPRING.pop, reduced));
  value.value = after > 0 ? delay(after, pop, reduced) : pop;
}

/**
 * A window sliding open over a still drawing: `progress` 0 is shut, 1 open.
 * `from` 1 opens from the bottom (or the right), -1 from the top (or the left).
 * The window moves and its contents move back by the same amount, so the
 * drawing stays where it is and only how much of it shows changes.
 */
function Wipe({ progress, axis, from, size, children }: { progress: SharedValue<number>; axis: 'x' | 'y'; from: 1 | -1; size: number; children: ReactNode }) {
  const slide = useAnimatedStyle(() => {
    const off = from * size * (1 - progress.value);
    return { transform: axis === 'x' ? [{ translateX: off }] : [{ translateY: off }] };
  });
  const held = useAnimatedStyle(() => {
    const off = -from * size * (1 - progress.value);
    return { transform: axis === 'x' ? [{ translateX: off }] : [{ translateY: off }] };
  });
  return (
    <Reanimated.View style={[st.layer, st.clip, slide]}>
      <Reanimated.View style={[st.layer, held]}>{children}</Reanimated.View>
    </Reanimated.View>
  );
}

/**
 * A small mark flying out along `angle` degrees (0 is right, -90 is up) from
 * `origin`, starting `start` points out and travelling `travel` more, fading
 * as it goes. Shown only while `progress` is between 0 and 1.
 */
function Spark({
  progress,
  angle,
  origin,
  start,
  travel,
  width,
  height,
  color,
}: {
  progress: SharedValue<number>;
  angle: number;
  origin: { x: number; y: number };
  start: number;
  travel: number;
  width: number;
  height: number;
  color: string;
}) {
  const look = useAnimatedStyle(() => {
    const p = progress.value;
    const r = (angle * Math.PI) / 180;
    const d = start + travel * p;
    return {
      opacity: p > 0 && p < 1 ? 1 - p : 0,
      transform: [{ translateX: Math.cos(r) * d }, { translateY: Math.sin(r) * d }, { rotate: `${angle + 90}deg` }],
    };
  });
  return (
    <Reanimated.View
      style={[
        { position: 'absolute', left: origin.x - width / 2, top: origin.y - height / 2, width, height, borderRadius: width / 2, backgroundColor: color },
        look,
      ]}
    />
  );
}

// ------------------------------------------------------------------ bell-ring

/** A reminder really scheduled: Linear becomes Bulk, the bell swings about its top and pops. */
function BellRing({ size, color, reduced, on }: Sub & { on: boolean }) {
  const m = ICON_MOTION.bell;
  const swing = useSharedValue(0);
  const pop = useSharedValue(1);
  const was = useRef(on);
  const land = useCallback(() => {
    cancel(swing);
    cancel(pop);
    swing.value = 0;
    pop.value = 1;
  }, [swing, pop]);
  useLandOnLeave(land);
  useEffect(() => {
    const before = was.current;
    was.current = on;
    if (!on || before || reduced) {
      land();
      return;
    }
    swing.value = sequence(reduced, ...m.swing.map((deg, i) => timing(deg, m.steps[i] ?? DUR.micro, EASE.out, reduced)));
    popTo(pop, m.pop, reduced);
  }, [on, reduced, swing, pop, land, m]);
  const look = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value}deg` }, { scale: pop.value }] }));
  return (
    <Reanimated.View style={[st.layer, { transformOrigin: m.origin }, look]}>
      <Icon name={on ? 'bell-ring' : 'bell'} variant={on ? 'bulk' : 'linear'} size={size} color={color} />
    </Reanimated.View>
  );
}

// -------------------------------------------------------------- bookmark-fill

/** A save that really resolved: the Bulk fill rises from the bottom, the mark pops, three dots fly. */
function BookmarkFill({ size, color, reduced, on }: Sub & { on: boolean }) {
  const m = ICON_MOTION.bookmark;
  const fill = useSharedValue(on ? 1 : 0);
  const pop = useSharedValue(1);
  const burst = useSharedValue(1);
  const was = useRef(on);
  const land = useCallback(() => {
    cancel(fill);
    cancel(pop);
    cancel(burst);
    fill.value = was.current ? 1 : 0;
    pop.value = 1;
    burst.value = 1;
  }, [fill, pop, burst]);
  useLandOnLeave(land);
  useEffect(() => {
    const before = was.current;
    was.current = on;
    if (on === before || reduced) {
      land();
      return;
    }
    if (on) {
      fill.value = 0;
      burst.value = 0;
      fill.value = timing(1, m.reveal, EASE.out, reduced);
      popTo(pop, m.pop, reduced, m.popAt);
      burst.value = delay(m.popAt, timing(1, m.fade, EASE.out, reduced), reduced);
      return;
    }
    // Unsaved: the fill drains over a shorter beat, with no pop.
    cancel(pop);
    cancel(burst);
    pop.value = 1;
    burst.value = 1;
    fill.value = timing(0, m.unsave, EASE.out, reduced);
  }, [on, reduced, fill, pop, burst, land, m]);
  const whole = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const outline = useAnimatedStyle(() => ({ opacity: 1 - fill.value }));
  const origin = { x: size / 2, y: size * 0.2 };
  return (
    <Reanimated.View style={[st.layer, whole]}>
      <Reanimated.View style={[st.layer, outline]}>
        <Icon name="bookmark" size={size} color={color} />
      </Reanimated.View>
      <Wipe progress={fill} axis="y" from={1} size={size}>
        <Icon name="bookmark" variant="bulk" size={size} color={color} />
      </Wipe>
      {m.dots.map((angle) => (
        <Spark key={angle} progress={burst} angle={angle} origin={origin} start={0} travel={m.travel} width={m.dot} height={m.dot} color={accent.brand} />
      ))}
    </Reanimated.View>
  );
}

// ----------------------------------------------------------------- check-draw

/** A choice really made: the disc grows in, then the tick is wiped on from the left. */
function CheckDraw({ size, color, reduced, on }: Sub & { on: boolean }) {
  const m = ICON_MOTION.check;
  const disc = useSharedValue(on ? 1 : 0);
  const grow = useSharedValue(1);
  const wipe = useSharedValue(on ? 1 : 0);
  const was = useRef(on);
  const land = useCallback(() => {
    cancel(disc);
    cancel(grow);
    cancel(wipe);
    disc.value = was.current ? 1 : 0;
    grow.value = 1;
    wipe.value = was.current ? 1 : 0;
  }, [disc, grow, wipe]);
  useLandOnLeave(land);
  useEffect(() => {
    const before = was.current;
    was.current = on;
    if (!on || before || reduced) {
      land();
      return;
    }
    disc.value = 0;
    wipe.value = 0;
    grow.value = m.from;
    disc.value = timing(1, m.fill, EASE.out, reduced);
    grow.value = spring(1, SPRING.pop, reduced);
    wipe.value = delay(m.wipeAt, timing(1, m.wipe, EASE.out, reduced), reduced);
  }, [on, reduced, disc, grow, wipe, land, m]);
  const look = useAnimatedStyle(() => ({ opacity: disc.value, transform: [{ scale: grow.value }] }));
  return (
    <>
      <Reanimated.View style={[st.layer, look]}>
        <IconPart name="tick-circle" variant="bulk" part="disc" size={size} color={color} />
      </Reanimated.View>
      <Wipe progress={wipe} axis="x" from={-1} size={size}>
        <IconPart name="tick-circle" variant="bulk" part="tick" size={size} color={color} />
      </Wipe>
    </>
  );
}

// -------------------------------------------------------------- speaker-waves

/** A line really playing: the body holds still and the two arcs breathe, the outer one a beat behind. */
function SpeakerWaves({ size, color, reduced, active }: Sub & { active: boolean }) {
  const m = ICON_MOTION.speaker;
  const arc1 = useSharedValue(1);
  const arc2 = useSharedValue(1);
  const still = useCallback(() => {
    cancel(arc1);
    cancel(arc2);
    arc1.value = 1;
    arc2.value = 1;
  }, [arc1, arc2]);
  useEffect(() => {
    if (!active || reduced) {
      still();
      return;
    }
    const breathe = () =>
      repeat(sequence(reduced, timing(1, m.period / 2, EASE.inOut, reduced), timing(m.low, m.period / 2, EASE.inOut, reduced)), -1, false, reduced);
    arc1.value = m.low;
    arc2.value = m.low;
    arc1.value = breathe();
    arc2.value = delay(m.lag, breathe(), reduced);
    return still;
  }, [active, reduced, arc1, arc2, still, m]);
  const first = useAnimatedStyle(() => ({ opacity: arc1.value }));
  const second = useAnimatedStyle(() => ({ opacity: arc2.value }));
  const variant = active ? 'bulk' : 'linear';
  return (
    <>
      <View style={st.layer}>
        <IconPart name="speaker" variant={variant} part="body" size={size} color={color} />
      </View>
      <Reanimated.View style={[st.layer, first]}>
        <IconPart name="speaker" variant={variant} part="arc1" size={size} color={color} />
      </Reanimated.View>
      <Reanimated.View style={[st.layer, second]}>
        <IconPart name="speaker" variant={variant} part="arc2" size={size} color={color} />
      </Reanimated.View>
    </>
  );
}

// -------------------------------------------------------------- flame-flicker

/**
 * Today's streak. Not yet today is a still grey outline, nothing more. Lit
 * (the day really extended) is the Bulk flame in coral with sun sparks; it
 * ignites once when it turns on, and flickers slowly only while `active`.
 */
function FlameFlicker({ size, reduced, on, active }: Sub & { on: boolean; active: boolean }) {
  const m = ICON_MOTION.flame;
  const grow = useSharedValue(1);
  const tilt = useSharedValue(0);
  const sway = useSharedValue(0);
  const stretch = useSharedValue(1);
  const glow = useSharedValue(1);
  const was = useRef(on);
  const land = useCallback(() => {
    cancel(grow);
    cancel(tilt);
    grow.value = 1;
    tilt.value = 0;
  }, [grow, tilt]);
  useLandOnLeave(land);
  useEffect(() => {
    const before = was.current;
    was.current = on;
    if (!on || before || reduced) {
      land();
      return;
    }
    grow.value = m.from;
    tilt.value = m.tilt;
    grow.value = sequence(reduced, timing(m.peak, m.ignite / 2, EASE.out, reduced), spring(1, SPRING.pop, reduced));
    tilt.value = timing(0, m.ignite, EASE.out, reduced);
  }, [on, reduced, grow, tilt, land, m]);
  useEffect(() => {
    const quiet = () => {
      cancel(sway);
      cancel(stretch);
      cancel(glow);
      sway.value = 0;
      stretch.value = 1;
      glow.value = 1;
    };
    if (!on || !active || reduced) {
      quiet();
      return;
    }
    const half = m.period / 2;
    stretch.value = repeat(sequence(reduced, timing(m.grow, half, EASE.inOut, reduced), timing(1, half, EASE.inOut, reduced)), -1, false, reduced);
    sway.value = repeat(
      sequence(reduced, timing(m.sway, half / 2, EASE.inOut, reduced), timing(-m.sway, half, EASE.inOut, reduced), timing(0, half / 2, EASE.inOut, reduced)),
      -1,
      false,
      reduced,
    );
    glow.value = delay(m.glowLag, repeat(sequence(reduced, timing(m.glow, half, EASE.inOut, reduced), timing(1, half, EASE.inOut, reduced)), -1, false, reduced), reduced);
    return quiet;
  }, [on, active, reduced, sway, stretch, glow, m]);
  const flame = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value + sway.value}deg` }, { scale: grow.value }, { scaleY: stretch.value }],
  }));
  const sparks = useAnimatedStyle(() => ({ opacity: glow.value }));
  if (!on) {
    return (
      <View style={st.layer}>
        <Icon name="flame" size={size} color={paper.field} />
      </View>
    );
  }
  return (
    <Reanimated.View style={[st.layer, { transformOrigin: m.origin }, flame]}>
      <View style={st.layer}>
        <IconPart name="flame" variant="bulk" part="flame" size={size} color={colour.coral} />
      </View>
      <Reanimated.View style={[st.layer, sparks]}>
        <IconPart name="flame" variant="bulk" part="sparks" size={size} color={colour.coral} secondaryColor={colour.sun} />
      </Reanimated.View>
    </Reanimated.View>
  );
}

// --------------------------------------------------------------- refresh-spin

/** A retry: one turn when pressed; while busy, a steady turn that finishes the turn it is in when busy ends. */
function RefreshSpin({ size, color, reduced, trigger, active }: Sub & { trigger: string | number | undefined; active: boolean }) {
  const m = ICON_MOTION.refresh;
  const turn = useSharedValue(0);
  const last = useRef(trigger);
  const spinning = active && !reduced;
  const wasSpinning = useRef(false);
  useEffect(() => {
    if (last.current === trigger) return;
    last.current = trigger;
    if (reduced || wasSpinning.current) return;
    turn.value = 0;
    turn.value = timing(360, m.press, EASE.inOut, reduced, (done) => {
      if (done) turn.value = 0;
    });
  }, [trigger, reduced, turn, m]);
  useEffect(() => {
    const before = wasSpinning.current;
    wasSpinning.current = spinning;
    if (spinning) {
      turn.value = 0;
      turn.value = repeat(timing(360, m.busy, EASE.linear, reduced), -1, false, reduced);
      return;
    }
    if (!before) return;
    // Busy ended: finish the turn in progress at the same speed, unless
    // movement is now withheld, which lands it still at once.
    const at = turn.value % 360;
    cancel(turn);
    if (reduced) {
      turn.value = 0;
      return;
    }
    turn.value = at;
    turn.value = timing(360, (m.busy * (360 - at)) / 360, EASE.linear, reduced, (done) => {
      if (done) turn.value = 0;
    });
  }, [spinning, reduced, turn, m]);
  useEffect(() => () => cancel(turn), [turn]);
  const look = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Reanimated.View style={[st.layer, look]}>
      <Icon name="refresh" size={size} color={color} />
    </Reanimated.View>
  );
}

// ---------------------------------------------------------------- cloud-check

/** An account really saved: the cloud rises in, the tick is wiped on inside it, and the whole pops. */
function CloudCheck({ size, color, reduced, on }: Sub & { on: boolean }) {
  const m = ICON_MOTION.cloud;
  const arrive = useSharedValue(on ? 1 : 0);
  const wipe = useSharedValue(on ? 1 : 0);
  const pop = useSharedValue(1);
  const was = useRef(on);
  const land = useCallback(() => {
    cancel(arrive);
    cancel(wipe);
    cancel(pop);
    arrive.value = was.current ? 1 : 0;
    wipe.value = was.current ? 1 : 0;
    pop.value = 1;
  }, [arrive, wipe, pop]);
  useLandOnLeave(land);
  useEffect(() => {
    const before = was.current;
    was.current = on;
    if (!on || before || reduced) {
      land();
      return;
    }
    arrive.value = 0;
    wipe.value = 0;
    arrive.value = timing(1, m.arrive, EASE.out, reduced);
    wipe.value = delay(m.wipeAt, timing(1, m.wipe, EASE.out, reduced), reduced);
    popTo(pop, m.pop, reduced, m.wipeAt + m.wipe);
  }, [on, reduced, arrive, wipe, pop, land, m]);
  const whole = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const cloud = useAnimatedStyle(() => ({ opacity: arrive.value, transform: [{ translateY: m.rise * (1 - arrive.value) }] }));
  const check = Math.round(size * m.check);
  return (
    <Reanimated.View style={[st.layer, whole]}>
      <Reanimated.View style={[st.layer, cloud]}>
        <Icon name="cloud" size={size} color={color} />
      </Reanimated.View>
      <Wipe progress={wipe} axis="x" from={-1} size={size}>
        <View style={{ position: 'absolute', left: (size - check) / 2, top: size * 0.58 - check / 2 }}>
          <Icon name="check" size={check} color={color} />
        </View>
      </Wipe>
    </Reanimated.View>
  );
}

// ------------------------------------------------------------------ mic-pulse

/**
 * Recording: two mint rings swell out from behind the microphone and fade,
 * the second half a beat behind. No invented level: the rings keep time, they
 * do not pretend to hear. Under Reduce Motion one still ring says it is live.
 */
function MicPulse({ size, color, reduced, active }: Sub & { active: boolean }) {
  const m = ICON_MOTION.mic;
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  useEffect(() => {
    const quiet = () => {
      cancel(ring1);
      cancel(ring2);
      ring1.value = 0;
      ring2.value = 0;
    };
    if (!active || reduced) {
      quiet();
      return;
    }
    const swell = () => repeat(timing(1, m.period, EASE.out, reduced), -1, false, reduced);
    ring1.value = swell();
    ring2.value = delay(m.lag, swell(), reduced);
    return quiet;
  }, [active, reduced, ring1, ring2, m]);
  const first = useAnimatedStyle(() => ({ opacity: m.start * (1 - ring1.value), transform: [{ scale: 1 + (m.grow - 1) * ring1.value }] }));
  const second = useAnimatedStyle(() => ({ opacity: reduced ? 0 : m.start * (1 - ring2.value), transform: [{ scale: 1 + (m.grow - 1) * ring2.value }] }));
  const ring = { borderRadius: size / 2, borderWidth: STROKE, borderColor: colour.mint };
  return (
    <>
      {active ? (
        <>
          <Reanimated.View style={[st.layer, ring, second]} />
          <Reanimated.View style={[st.layer, ring, first]} />
        </>
      ) : null}
      <View style={st.layer}>
        <Icon name="microphone" size={size} color={color} />
      </View>
    </>
  );
}

// ------------------------------------------------------------------- star-pop

/** XP really recorded: the star spins in and pops, and four sun ticks fly out from its edge. */
function StarPop({ size, color, reduced, trigger }: Sub & { trigger: string | number | undefined }) {
  const m = ICON_MOTION.star;
  const grow = useSharedValue(1);
  const spin = useSharedValue(0);
  const burst = useSharedValue(1);
  const last = useRef(trigger);
  const land = useCallback(() => {
    cancel(grow);
    cancel(spin);
    cancel(burst);
    grow.value = 1;
    spin.value = 0;
    burst.value = 1;
  }, [grow, spin, burst]);
  useLandOnLeave(land);
  useEffect(() => {
    if (last.current === trigger) return;
    last.current = trigger;
    if (reduced) {
      land();
      return;
    }
    grow.value = 0;
    spin.value = m.tilt;
    burst.value = 0;
    grow.value = sequence(reduced, timing(m.peak, m.rise, EASE.out, reduced), spring(1, SPRING.pop, reduced));
    spin.value = timing(0, m.settle, EASE.out, reduced);
    burst.value = delay(m.rise, timing(1, m.fade, EASE.out, reduced), reduced);
  }, [trigger, reduced, grow, spin, burst, land, m]);
  const look = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }, { scale: grow.value }] }));
  const origin = { x: size / 2, y: size / 2 };
  return (
    <>
      <Reanimated.View style={[st.layer, look]}>
        <Icon name="star" variant="bulk" size={size} color={color} />
      </Reanimated.View>
      {m.ticks.map((angle) => (
        <Spark
          key={angle}
          progress={burst}
          angle={angle}
          origin={origin}
          start={size / 2}
          travel={m.travel}
          width={m.tick.width}
          height={m.tick.height}
          color={colour.sun}
        />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ lock-open

/**
 * A plan really confirmed (an entitlement, never a tap on Buy): the lock gives
 * way to the open lock, whose shackle lifts and swings open on its left hinge,
 * and the body pops once.
 */
function LockOpen({ size, color, reduced, on }: Sub & { on: boolean }) {
  const m = ICON_MOTION.lock;
  const open = useSharedValue(on ? 1 : 0);
  const shackle = useSharedValue(0);
  const pop = useSharedValue(1);
  const was = useRef(on);
  const land = useCallback(() => {
    cancel(open);
    cancel(shackle);
    cancel(pop);
    open.value = was.current ? 1 : 0;
    shackle.value = 0;
    pop.value = 1;
  }, [open, shackle, pop]);
  useLandOnLeave(land);
  useEffect(() => {
    const before = was.current;
    was.current = on;
    if (!on || before || reduced) {
      land();
      return;
    }
    open.value = 0;
    shackle.value = 1;
    open.value = timing(1, m.fade, EASE.out, reduced);
    shackle.value = spring(0, SPRING.snap, reduced);
    popTo(pop, m.pop, reduced);
  }, [on, reduced, open, shackle, pop, land, m]);
  const whole = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const closed = useAnimatedStyle(() => ({ opacity: 1 - open.value }));
  const opened = useAnimatedStyle(() => ({ opacity: open.value }));
  const swing = useAnimatedStyle(() => ({
    transform: [{ translateY: m.lift * shackle.value }, { rotate: `${m.swing * shackle.value}deg` }],
  }));
  return (
    <Reanimated.View style={[st.layer, whole]}>
      <Reanimated.View style={[st.layer, closed]}>
        <Icon name="lock" variant="bulk" size={size} color={color} />
      </Reanimated.View>
      <Reanimated.View style={[st.layer, opened]}>
        <View style={st.layer}>
          <IconPart name="unlock" variant="bulk" part="body" size={size} color={color} />
        </View>
        <Reanimated.View style={[st.layer, { transformOrigin: m.hinge }, swing]}>
          <IconPart name="unlock" variant="bulk" part="shackle" size={size} color={color} />
        </Reanimated.View>
      </Reanimated.View>
    </Reanimated.View>
  );
}

const st = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
});
