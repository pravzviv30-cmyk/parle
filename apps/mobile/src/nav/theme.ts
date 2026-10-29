/**
 * Navigation's own theme. The linking map is `linking.ts`, re-exported here.
 *
 * NavigationContainer paints its background before any screen renders, and its
 * default light theme is white — so without this the pale lilac ground breaks
 * to white at every edge and, worse, flashes white through every transition.
 */

import type { Theme } from '@react-navigation/native';
import { DefaultTheme } from '@react-navigation/native';
import { font } from '../theme.ts';
import { b } from '../palette.ts';

/**
 * The navigation theme for one mode (UI-008, 2026-10-20). Light is the paper
 * theme exactly as before; dark paints the M3 ground and surfaces, so a
 * transition edge never flashes the other mode.
 */
export function navThemeFor(mode: 'light' | 'dark'): Theme {
  const t = b[mode];
  return {
    ...DefaultTheme,
    dark: mode === 'dark',
    colors: {
      ...DefaultTheme.colors,
      background: t.ground,
      card: t.card,
      text: t.text,
      border: t.line,
      primary: t.text,
      notification: t.text,
    },
    fonts: {
      ...DefaultTheme.fonts,
      regular: { fontFamily: font.regular, fontWeight: '400' },
      medium: { fontFamily: font.medium, fontWeight: '500' },
      bold: { fontFamily: font.bold, fontWeight: '700' },
      heavy: { fontFamily: font.bold, fontWeight: '700' },
    },
  };
}

export const navTheme: Theme = navThemeFor('light');

/** Both themes, built once, so the container is handed a stable object. */
export const navThemes = { light: navTheme, dark: navThemeFor('dark') } as const;

/** The web address map lives in `linking.ts`, which loads without react-native so its tests can run it. */
export { linking } from './linking.ts';
