import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';
import { Press, CheckGlyph } from '../components.tsx';
import { colour, decorative, paper, type } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';

/** One full-card target. A choice stays editable until Next. */
export function Choice({
  title,
  selected,
  onPress,
  glyph,
  compact = false,
  ground = paper.card,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  glyph?: React.ReactNode;
  compact?: boolean;
  ground?: string;
}) {
  const reduced = useReduceMotion();
  const selectedMark = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const previous = useRef(selected);
  useEffect(() => {
    if (reduced) {
      selectedMark.stopAnimation();
      selectedMark.setValue(selected ? 1 : 0);
      previous.current = selected;
      return;
    }
    if (previous.current === selected) return;
    previous.current = selected;
    selectedMark.stopAnimation();
    const response = Animated.timing(selectedMark, {
      toValue: selected ? 1 : 0,
      duration: reduced ? 0 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    response.start();
    return () => response.stop();
  }, [selected, reduced, selectedMark]);
  return (
    <Press
      haptic={selected ? 'none' : 'selection'}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        minHeight: 66,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: compact ? 10 : 14,
        backgroundColor: ground,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: selected ? colour.blue : ground,
      }}
    >
      {glyph}
      <Text style={[compact ? type.label : type.bodyStrong, { color: paper.ink, flex: 1 }]}>
        {title}
      </Text>
      <View
        {...decorative}
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: selected ? colour.blue : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View style={{ opacity: selectedMark, transform: [{ scale: selectedMark }] }}>
          <CheckGlyph size={18} color={paper.card} />
        </Animated.View>
      </View>
    </Press>
  );
}
