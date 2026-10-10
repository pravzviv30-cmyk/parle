import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from 'react-native';
import { useReduceMotion } from '../motion.ts';
import { DUR } from '../motion/tokens.ts';

/** Visibility follows the software keyboard, never field focus or a typing timer. */
export function useFormKeyboard(onSettled: () => void) {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());
  const keyboardTop = useRef<number | null>(Keyboard.metrics?.()?.screenY ?? null);
  const currentVisible = useRef(visible);
  const settled = useRef(onSettled);
  settled.current = onSettled;
  const reduced = useReduceMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const change = (event: KeyboardEvent, showing: boolean) => {
      keyboardTop.current = showing ? event.endCoordinates.screenY : null;
      if (currentVisible.current === showing) return;
      currentVisible.current = showing;
      // UIKit owns scroll-inset movement. This one transaction folds the inline
      // action using the same keyboard duration/curve, including its opacity.
      if (!reducedRef.current) {
        const type = LayoutAnimation.Types[event.easing] ?? LayoutAnimation.Types.keyboard;
        LayoutAnimation.configureNext({
          duration: event.duration > 0 ? event.duration : DUR.base,
          update: { type },
          create: { type, property: LayoutAnimation.Properties.opacity },
          delete: { type, property: LayoutAnimation.Properties.opacity },
        });
      }
      setVisible(showing);
    };
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      change(event, true);
      settled.current();
    });
    const hidden = Keyboard.addListener('keyboardDidHide', (event) => change(event, false));
    const willChange = Platform.OS === 'ios' ? Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      const showing = event.endCoordinates.height > 0 && event.endCoordinates.screenY < Dimensions.get('screen').height;
      change(event, showing);
    }) : null;
    const didChange = Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidChangeFrame', (event) => {
      if (currentVisible.current) {
        keyboardTop.current = event.endCoordinates.screenY;
        settled.current();
      }
    }) : null;
    return () => { shown.remove(); hidden.remove(); willChange?.remove(); didChange?.remove(); };
  }, []);
  return { visible, keyboardTop };
}
