import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { AppState, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { onUserScopeReset } from '../storage/scope.ts';
import { cancel, timing } from './drive.ts';
import { useAnswered, useLandOnLeave } from './landing.ts';
import { EASE } from './tokens.ts';
import { IllustrationCue, ILLUSTRATION_MS, ILLUSTRATION_STEP_MS, type IllustrationRole } from './IllustrationPolicy.ts';

export interface IllustrationLayerProps {
  children?: ReactNode;
  role?: IllustrationRole;
  index?: number;
  active?: boolean;
  eventKey?: string | number;
  style?: StyleProp<ViewStyle>;
  /** Origin in the layer's rendered coordinates, for a hand or eye. */
  origin?: readonly [number, number];
  motionScale?: number;
}

const IllustrationClock = createContext<SharedValue<number> | null>(null);

/** One lifecycle clock and OS subscription per composed illustration. */
export function IllustrationMotion({ children, active = true, eventKey }: {
  children?: ReactNode; active?: boolean; eventKey?: string | number;
}) {
  const clock = useIllustrationClock(active, eventKey);
  return <IllustrationClock.Provider value={clock}>{children}</IllustrationClock.Provider>;
}

/**
 * A short, separately articulated SVG layer gesture. All geometry is supplied
 * by the caller; this wrapper only changes transforms. Final art is present
 * while the OS answers, under Reduce Motion, and after any interruption.
 */
export function IllustrationLayer(props: IllustrationLayerProps) {
  const clock = useContext(IllustrationClock);
  return clock ? <ArticulatedLayer {...props} clock={clock} /> : <StandaloneLayer {...props} />;
}

function StandaloneLayer(props: IllustrationLayerProps) {
  const clock = useIllustrationClock(props.active ?? true, props.eventKey);
  return <ArticulatedLayer {...props} clock={clock} />;
}

function useIllustrationClock(active: boolean, eventKey?: string | number): SharedValue<number> {
  const reduced = useAnswered(useReduceMotion(true));
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const cue = useRef(new IllustrationCue(eventKey)).current;
  const clock = useSharedValue(ILLUSTRATION_MS);
  const land = () => { cancel(clock); clock.value = ILLUSTRATION_MS; };
  const latestLand = useRef(land);
  latestLand.current = land;

  useEffect(() => {
    setFocused(navigation?.isFocused() ?? true);
    if (!navigation) return;
    const focus = navigation.addListener('focus', () => setFocused(true));
    const blur = navigation.addListener('blur', () => {
      cue.interrupt(); latestLand.current(); setFocused(false);
    });
    return () => { focus(); blur(); };
  }, [navigation, cue]);

  useEffect(() => onUserScopeReset(() => {
    cue.interrupt(true); latestLand.current();
  }), [cue]);

  useEffect(() => {
    const decision = cue.decide(eventKey, {
      reduced, active, focused,
      foreground: AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
    });
    cancel(clock);
    if (decision !== 'play' || reduced !== false) {
      clock.value = ILLUSTRATION_MS;
      return;
    }
    clock.value = 0;
    clock.value = timing(ILLUSTRATION_MS, ILLUSTRATION_MS, EASE.linear, reduced);
  }, [cue, eventKey, reduced, active, focused, clock]);

  useLandOnLeave(() => { cue.interrupt(); latestLand.current(); });

  return clock;
}

function ArticulatedLayer({
  children, role = 'body', index = 0, active = true, style, origin, motionScale = 1, clock,
}: IllustrationLayerProps & { clock: SharedValue<number> }) {
  const look = useAnimatedStyle(() => {
    const ms = active ? clock.value : ILLUSTRATION_MS;
    const side = index % 2 ? -1 : 1;
    const offset = Math.max(0, index) * ILLUSTRATION_STEP_MS;
    const elapsed = Math.max(0, ms - offset);
    const rise = Math.min(1, elapsed / 550);
    const settle = Math.min(1, Math.max(0, (elapsed - 550) / 350));
    const easeRise = 1 - Math.pow(1 - rise, 3);
    const easeSettle = 1 - Math.pow(1 - settle, 3);
    let x = 0; let y = 0; let rotate = 0; let scale = 1; let scaleY = 1;
    if (role === 'body' || role === 'prop') {
      y = elapsed < 550 ? 8 - easeRise * 9 : -1 + easeSettle;
      x = role === 'prop' ? side * 14 * (1 - easeRise) : 0;
      rotate = elapsed < 550
        ? side * ((role === 'prop' ? 7 : 2) * (1 - easeRise) - 0.6 * easeRise)
        : -side * 0.6 * (1 - easeSettle);
      scale = elapsed < 550
        ? (role === 'prop' ? 0.94 : 0.99) + ((role === 'prop' ? 0.07 : 0.02) * easeRise)
        : 1.01 - 0.01 * easeSettle;
    } else if (role === 'gesture') {
      const lift = Math.min(1, Math.max(0, (ms - 450) / 270));
      const release = Math.min(1, Math.max(0, (ms - 720) / 460));
      rotate = -9 * (1 - Math.pow(1 - lift, 3)) * (1 - (1 - Math.pow(1 - release, 3)));
    } else if (role === 'face') {
      if (ms >= 1750 && ms < 1820) scaleY = 1 - ((ms - 1750) / 70) * 0.85;
      else if (ms >= 1820 && ms < 1900) scaleY = 0.15 + ((ms - 1820) / 80) * 0.85;
    }
    return {
      transform: [
        { translateX: x * motionScale }, { translateY: y * motionScale },
        { rotate: `${rotate}deg` }, { scale }, { scaleY },
      ],
    };
  });

  return (
    <Reanimated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.layer, style, origin ? { transformOrigin: [origin[0], origin[1], 0] } : undefined, look]}
    >
      {children}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({ layer: { overflow: 'visible' } });
