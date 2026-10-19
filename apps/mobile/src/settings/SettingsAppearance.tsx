import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Card as PaperCard, Field as PaperField, Press } from '../components.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { colour, paper, signal, space, type } from '../theme.ts';
import { mainApp } from '../palette.ts';

const paperColors = { surface: paper.card as string, background: paper.ground as string, text: paper.ink as string, muted: paper.inkSoft as string, border: paper.lineOnCard as string, trouble: signal.correspondance as string, link: colour.blue as string, danger: mainApp.light.danger as string, inset: mainApp.light.inset as string };
const SettingsColors = createContext(paperColors);

/** Presentation scope only. Other consumers of the shared rows retain paper. */
export function SettingsAppearance({ children }: { children: ReactNode }) {
  const { colors, mode } = useMainAppearance();
  return <SettingsColors.Provider value={{ ...colors, trouble: mode === 'dark' ? colors.text : signal.correspondance }}>{children}</SettingsColors.Provider>;
}

/** Inputs keep an intentional paper well with their existing label/error ink. */
export function SettingsField(props: ComponentProps<typeof PaperField>) {
  return <View style={{ backgroundColor: paper.card, padding: space(3), borderRadius: 16 }}><PaperField {...props} /></View>;
}

/** Existing secondary form actions, with the scoped surface and disabled ink. */
export function SettingsFormAction({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const colors = useSettingsColors();
  return <Press onPress={onPress} disabled={disabled} haptic="selection" accessibilityRole="button" accessibilityLabel={label} style={{ minHeight: 52, padding: space(3), borderRadius: 16, backgroundColor: colors.background, justifyContent: 'center' }}><Text style={[type.label, { color: disabled ? colors.muted : colors.text, textAlign: 'center' }]}>{label}</Text></Press>;
}
export function useSettingsColors() { return useContext(SettingsColors); }

export function SettingsCard({ style, tone, ...props }: ComponentProps<typeof PaperCard>) {
  const colors = useSettingsColors();
  return <PaperCard {...props} tone={tone} style={[{ backgroundColor: tone === 'journal' ? colors.background : colors.surface, borderRadius: 24 }, style]} />;
}
