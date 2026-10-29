import { createElement, useLayoutEffect, type ReactNode, type RefObject } from 'react';
import { Platform, View } from 'react-native';

/**
 * The sign-in and sign-up fields, inside a real <form> on web (F938), so a
 * browser's password manager recognises them and offers to save or fill.
 *
 * Native has no forms: a plain View, laid out like any other.
 *
 * Enter still submits exactly once. Every field inside handles
 * `onSubmitEditing`, which react-native-web runs after calling
 * `preventDefault` on the key, so the form's own submission never fires from
 * a key press. It fires only when the browser or a password manager submits
 * the form itself, and then the page load is stopped and the screen's submit
 * runs.
 */
export function AuthForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  if (Platform.OS !== 'web') return <View>{children}</View>;
  return createElement(
    'form',
    {
      noValidate: true,
      style: { display: 'flex', flexDirection: 'column', margin: 0 },
      onSubmit: (event: { preventDefault: () => void }) => {
        event.preventDefault();
        onSubmit();
      },
    },
    children,
  );
}

/**
 * Gives a field its `name` on web ("email", "current-password",
 * "new-password"). react-native-web's TextInput drops a `name` prop, and its
 * ref is the DOM input itself, so the attribute is set there.
 */
export function useWebFieldName(ref: RefObject<unknown>, name: string) {
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current as { setAttribute?: (key: string, value: string) => void } | null;
    node?.setAttribute?.('name', name);
  });
}
