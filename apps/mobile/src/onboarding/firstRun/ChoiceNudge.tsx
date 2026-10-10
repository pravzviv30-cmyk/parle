import { useEffect, useRef, type ReactNode } from 'react';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../../motion.ts';
import { cancel, delay, sequence, timing } from '../../motion/drive.ts';
import { EASE } from '../../motion/tokens.ts';

/** A disabled Continue points to unanswered choices without moving them sideways. */
export function ChoiceNudge({ event, index, children, width }: { event: number; index: number; children: ReactNode; width?: `${number}%` }) {
  const reduced = useReduceMotion();
  const y = useSharedValue(0);
  const first = useRef(event);
  useEffect(() => {
    cancel(y);
    y.value = 0;
    if (event > 0 && event !== first.current && !reduced) y.value = delay(index * 40, sequence(reduced,
      timing(-3, 120, EASE.out, reduced), timing(0, 180, EASE.out, reduced)), reduced);
    return () => cancel(y);
  }, [event, index, reduced, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  // A row must claim the available width before its flexing words are laid
  // out. An unspecified width shrink-wrapped to the icon and hid its label.
  return <Reanimated.View style={[{ width: width ?? '100%', minWidth: 0 }, style]}>{children}</Reanimated.View>;
}
