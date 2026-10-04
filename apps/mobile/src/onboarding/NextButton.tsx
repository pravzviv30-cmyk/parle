import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Text } from 'react-native';
import { ArrowRight, Press } from '../components.tsx';
import { paper, type } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';

export function NextButton({ onPress, disabled }: { onPress: () => boolean; disabled: boolean }) {
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
  return (
    <Press
      haptic="light"
      disabled={disabled}
      accessibilityLabel="Next"
      accessibilityState={{ disabled }}
      onPress={onPress}
      onPressIn={() => move(4)}
      onPressOut={() => move(0)}
      style={{
        minHeight: 56,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 16,
        backgroundColor: disabled ? paper.inkSoft : paper.ink,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <Text style={[type.button, { color: paper.onInk }]}>Next</Text>
      <Animated.View style={{ transform: [{ translateX: arrow }] }}>
        <ArrowRight color={paper.onInk} />
      </Animated.View>
    </Press>
  );
}
