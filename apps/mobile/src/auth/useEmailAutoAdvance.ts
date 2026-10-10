import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { TextInput } from 'react-native';

export const EMAIL_ADVANCE_PAUSE_MS = 900;

/** Stricter than submission validation: an unfinished domain must keep its caret. */
export function emailReadyForAdvance(value: string): boolean {
  return /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]{2,}$/.test(value.trim());
}

/** Advance only after an edit settles, never on mount, focus, or form restoration. */
export function useEmailAutoAdvance(emailRef: RefObject<TextInput | null>, passwordRef: RefObject<TextInput | null>, busy: boolean, requestRunning: RefObject<boolean>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(busy);
  blocked.current = busy;
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const queue = useCallback((value: string) => {
    cancel();
    if (blocked.current || requestRunning.current || !emailReadyForAdvance(value)) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!blocked.current && !requestRunning.current && emailRef.current?.isFocused()) {
        passwordRef.current?.focus();
      }
    }, EMAIL_ADVANCE_PAUSE_MS);
  }, [cancel, emailRef, passwordRef, requestRunning]);
  useEffect(() => { if (busy) cancel(); }, [busy, cancel]);
  useEffect(() => cancel, [cancel]);
  return { queue, cancel };
}
