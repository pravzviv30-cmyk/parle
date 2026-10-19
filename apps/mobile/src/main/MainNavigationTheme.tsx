import { useMemo, type ReactNode } from 'react';
import type { Theme } from '@react-navigation/native';
import { navTheme } from '../nav/theme.ts';
import { useMainAppearance } from './MainAppearance.tsx';
/** Navigation and screen surfaces change together, including transition edges. */
export function MainNavigationTheme({ children }: { children: (theme: Theme) => ReactNode }) {
  const { mode, colors } = useMainAppearance();
  const theme = useMemo<Theme>(() => ({ ...navTheme, dark: mode === 'dark', colors: {
    ...navTheme.colors, background: colors.background, card: colors.surface,
    text: colors.text, border: colors.border, primary: colors.text,
  } }), [mode, colors]);
  return children(theme);
}
