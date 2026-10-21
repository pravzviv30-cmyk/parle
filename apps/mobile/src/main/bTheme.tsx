/**
 * The appearance context and the hooks a part reads it through (DECISIONS.md
 * UI-008, 2026-10-20). A leaf: it imports only React and the palette, so
 * components.tsx and layout.tsx can read the theme without pulling auth or
 * storage in behind them. `MainAppearanceProvider` (MainAppearance.tsx) is the
 * one place that resolves a mode and provides it.
 *
 * Outside any provider (the launch, onboarding, sign up) the default value is
 * light, and `<PinLight>` re-provides light explicitly wherever a subtree must
 * not follow the device.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { b, mainApp, type BTokens } from '../palette.ts';
import type { DisplayPreference, MainMode } from './appearanceModel.ts';
import { themedStyles } from './themedStyles.ts';

/** The tokens of one mode, with the mode they belong to. */
export type B = BTokens & { readonly mode: MainMode };

const withMode: { readonly [M in MainMode]: B } = {
  light: { ...b.light, mode: 'light' },
  dark: { ...b.dark, mode: 'dark' },
};

export type AppearanceValue = {
  mode: MainMode;
  colors: { [K in keyof typeof mainApp.light]: string };
  b: B;
  preference: DisplayPreference;
  setPreference: (value: DisplayPreference) => void;
  error: string | null;
};

/** The value for one mode, keeping whatever preference and setter it was given. */
export function appearanceFor(mode: MainMode, rest: Pick<AppearanceValue, 'preference' | 'setPreference' | 'error'>): AppearanceValue {
  return { mode, colors: mainApp[mode], b: withMode[mode], ...rest };
}

export const Appearance = createContext<AppearanceValue>(
  appearanceFor('light', { preference: 'system', setPreference: () => {}, error: null }),
);

/** The B tokens of the mode this subtree draws in, plus `mode`. */
export function useB(): B {
  return useContext(Appearance).b;
}

/**
 * A StyleSheet built from the tokens once per mode and shared by every caller
 * of the same `make` (main/themedStyles.ts), so a themed part allocates
 * nothing per render. `make` must be a module-level function, never an
 * inline arrow.
 */
export function useThemedStyles<T>(make: (t: B) => T): T {
  return themedStyles(make, useB());
}

/** Re-provides `mode` to a subtree, keeping the learner's stored preference. */
export function ModeScope({ mode, children }: { mode: MainMode; children: ReactNode }) {
  const outer = useContext(Appearance);
  const value = useMemo(
    () => (outer.mode === mode ? outer : appearanceFor(mode, { preference: outer.preference, setPreference: outer.setPreference, error: outer.error })),
    [outer, mode],
  );
  return <Appearance.Provider value={value}>{children}</Appearance.Provider>;
}

/** A subtree that stays light whatever the device or the stored choice says. */
export function PinLight({ children }: { children: ReactNode }) {
  return <ModeScope mode="light">{children}</ModeScope>;
}
