import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, View, type ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { focusedFieldScroll } from '../auth/focusedFieldScroll.ts';
import { visibleFormHeight } from '../auth/signupForm.ts';
import { useFormKeyboard } from '../auth/useFormKeyboard.ts';

type FocusHandlers = { onFocus: () => void; onBlur: () => void };
type FocusOwner = { focus: (group: View | null) => void; blur: (group: View | null) => void; refresh: () => void };
const idle = () => {};
export const FocusedFieldContext = createContext<FocusOwner>({ focus: idle, blur: idle, refresh: idle });
export const FocusedKeyboardContext = createContext(false);

/** A field and its immediate help/action move together above the keyboard. */
export function FocusedFieldGroup({ children, style }: { children: (focus: FocusHandlers) => ReactNode; style?: StyleProp<ViewStyle> }) {
  const owner = useContext(FocusedFieldContext);
  const group = useRef<View>(null);
  useEffect(() => {
    const mounted = group.current;
    return () => owner.blur(mounted);
  }, [owner]);
  return <View ref={group} collapsable={false} style={style} onLayout={owner.refresh}>
    {children({ onFocus: () => owner.focus(group.current), onBlur: () => owner.blur(group.current) })}
  </View>;
}

/** Only the currently edited scroll screen subscribes to keyboard changes. */
export function FocusedKeyboardObserver({ onSettled }: { onSettled: (top: number | null) => void }) {
  const { visible, keyboardTop } = useFormKeyboard(() => onSettled(keyboardTop.current));
  useEffect(() => { onSettled(keyboardTop.current); }, [visible, keyboardTop, onSettled]);
  return null;
}

export function useFocusedFieldScroll(scrollRef: RefObject<ScrollView | null>, offset: RefObject<number>) {
  const group = useRef<View | null>(null);
  const top = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const measurement = useRef(0);
  const alive = useRef(true);
  const [focused, setFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const cancel = useCallback(() => {
    measurement.current += 1;
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
  }, []);
  const refresh = useCallback(() => {
    cancel();
    const target = group.current;
    if (target === null) return;
    const ticket = measurement.current;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const scroll = scrollRef.current;
      if (!scroll || !alive.current || target !== group.current) return;
      scroll.getNativeScrollRef()?.measureInWindow((_x: number, viewportTop: number, _width: number, viewportHeight: number) => {
        target.measureInWindow((_groupX, groupTop, _groupWidth, groupHeight) => {
          if (!alive.current || ticket !== measurement.current || target !== group.current || scroll !== scrollRef.current) return;
          const height = visibleFormHeight(viewportTop, viewportHeight, top.current);
          const next = focusedFieldScroll(offset.current, viewportTop, height, groupTop, groupHeight);
          if (Math.abs(next - offset.current) > 0.5) scroll.scrollTo({ y: next, animated: false });
        });
      });
    });
  }, [cancel, offset, scrollRef]);
  const owner = useMemo<FocusOwner>(() => ({
    focus: target => { group.current = target; top.current = Keyboard.metrics?.()?.screenY ?? null; setFocused(target !== null); setKeyboardVisible(top.current !== null); refresh(); },
    blur: target => { if (group.current === target) { group.current = null; if (alive.current) { setFocused(false); setKeyboardVisible(false); } cancel(); } },
    refresh,
  }), [cancel, refresh]);
  const onKeyboardSettled = useCallback((value: number | null) => { top.current = value; if (alive.current) setKeyboardVisible(value !== null); refresh(); }, [refresh]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; group.current = null; cancel(); }; }, [cancel]);
  return { owner, focused, keyboardVisible, refresh, onKeyboardSettled };
}
