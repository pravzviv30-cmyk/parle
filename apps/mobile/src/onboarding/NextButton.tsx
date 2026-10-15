/**
 * The first run's explicit Continue (F601: a choice never advances by itself).
 *
 * Off, it looks off on every ground a question page has (F758; come alive,
 * icons section 3.4): the sand skeleton with soft ink words and arrow, never
 * the soft ink fill with white words that read as a live button. A screen
 * reader hears it dimmed, with a hint saying what turns it on. The faces are
 * `firstRun/nextFace.ts`.
 *
 * Turning on, the ink fades in over `DUR.fast` (`firstRun/LiveFace.tsx`,
 * through motion/drive.ts) and one glint passes (`motion/Glint.tsx`), so the
 * moment an answer is chosen the way forward says it is ready. The arrow keeps
 * its 100/140 ms nudge under the finger. Reduced motion: the ink is there at
 * once and no glint passes, watched live.
 */

import { boldType, c } from './boldRhythm.ts';
import { nextAction } from './nextAction.ts';
import { useEffect, useRef, createElement, type KeyboardEvent } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Press } from '../components.tsx';
import { decorative, radius, space, type } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { Glint } from '../motion/Glint.tsx';
import { DUR } from '../motion/tokens.ts';
import { LiveFace } from './firstRun/LiveFace.tsx';
import { NEXT_LABEL, NEXT_OFF, NEXT_OFF_HINT, NEXT_ON } from './firstRun/nextFace.ts';

export function NextButton({ onPress, disabled, onDisabledPress, label = NEXT_LABEL, bold = false, disabledHint, showDisabledHint = false }: { onPress: () => boolean; disabled: boolean; onDisabledPress?: () => void; label?: string; bold?: boolean; disabledHint?: string; showDisabledHint?: boolean }) {
  const reduced = useReduceMotion();
  const arrow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      arrow.stopAnimation();
      arrow.setValue(0);
    }
    return () => arrow.stopAnimation();
  }, [arrow, reduced]);
  const move = (value: number) => {
    arrow.stopAnimation();
    if (reduced) return;
    Animated.timing(arrow, {
      toValue: value,
      duration: value ? 100 : 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  const face = (ink: string, words = label) => (
    <>
      <Text style={[bold ? boldType.label : type.button, { color: ink, flexShrink: 1, textAlign: 'center' }]}>{words}</Text>
      <Animated.View style={{ transform: [{ translateX: arrow }] }}>
        <ArrowRight color={bold && ink === c.white ? c.sun : ink} />
      </Animated.View>
    </>
  );
  const contents = (<>
      <View style={[st.row, bold && { minHeight: 52, paddingVertical: 14 }]}>
        {disabledHint ? <>
          {/* The question instruction reserves its largest face before any tap. */}
          <View {...decorative} aria-hidden={true} style={[st.face, { opacity: 0 }]}>{face(NEXT_OFF.words, disabledHint)}</View>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { paddingHorizontal: space(6), justifyContent: 'center' }]}>
            <View style={st.face} accessibilityLiveRegion="polite">{face(NEXT_OFF.words, showDisabledHint ? disabledHint : label)}</View>
          </View>
        </> : face(NEXT_OFF.words)}
      </View>
      <LiveFace live={!disabled} style={[st.row, bold && { minHeight: 52, paddingVertical: 14 }, { backgroundColor: bold ? c.violet : NEXT_ON.fill }]}>
        <View {...decorative} style={st.face}>
          {face(bold ? c.white : NEXT_ON.words)}
        </View>
      </LiveFace>
      <Glint when={!disabled} wait={DUR.fast} radius={bold ? 20 : radius.control} />
  </>);
  // RN Web Pressable overwrites aria-disabled from its interaction-disabled
  // prop. This explanatory action must remain clickable without advertising
  // that Continue is available. A semantic web button owns both input paths.
  if (Platform.OS === 'web') {
    const webEvents = {
      tabIndex: 0 as const,
      onPointerDown: () => { if (!disabled) move(4); },
      onPointerUp: () => move(0),
      onPointerLeave: () => move(0),
      onClick: () => nextAction(disabled, onPress, onDisabledPress),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (!event.repeat) nextAction(disabled, onPress, onDisabledPress);
      },
    };
    return <Animated.View style={bold && !reduced ? { transform: [
      { perspective: 600 },
      { translateY: arrow.interpolate({ inputRange: [0, 4], outputRange: [0, 3] }) },
      { scale: arrow.interpolate({ inputRange: [0, 4], outputRange: [1, 0.97] }) },
      { rotateX: arrow.interpolate({ inputRange: [0, 4], outputRange: ['0deg', '2deg'] }) },
    ] } : undefined}>{createElement('div', {
      ...webEvents, role: 'button', 'aria-label': label, 'aria-disabled': disabled,
      'aria-description': disabled ? NEXT_OFF_HINT : undefined,
      style: { position: 'relative', minHeight: bold ? 52 : 56, borderRadius: bold ? 20 : radius.control, overflow: 'hidden', backgroundColor: NEXT_OFF.fill, cursor: 'pointer' },
    }, contents)}</Animated.View>;
  }
  return (
    <Press
      depth={bold && !disabled ? 'raised' : 'control'}
      haptic={disabled ? 'none' : 'light'}
      accessibilityLabel={label}
      accessibilityHint={disabled ? NEXT_OFF_HINT : undefined}
      accessibilityState={{ disabled }}
      onPress={() => nextAction(disabled, onPress, onDisabledPress)}
      onPressIn={() => { if (!disabled) move(4); }}
      onPressOut={() => move(0)}
      style={[st.surface, { minHeight: bold ? 52 : 56, borderRadius: bold ? 20 : radius.control, backgroundColor: NEXT_OFF.fill }]}
    >
      {contents}
    </Press>
  );
}

const st = StyleSheet.create({
  surface: { minHeight: 56, borderRadius: radius.control, overflow: 'hidden' },
  row: {
    minHeight: 56,
    paddingVertical: space(3.5),
    paddingHorizontal: space(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(3),
  },
  face: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(3), flexShrink: 1, minWidth: 0 },
});
