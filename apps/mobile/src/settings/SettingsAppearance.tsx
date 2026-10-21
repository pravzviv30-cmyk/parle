import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Card as PaperCard, Field as PaperField, Press } from '../components.tsx';
import { useB } from '../main/bTheme.tsx';
import { colour, paper, signal, space, type } from '../theme.ts';
import { mainApp } from '../palette.ts';

const paperColors = { surface: paper.card as string, background: paper.ground as string, text: paper.ink as string, muted: paper.inkSoft as string, border: paper.lineOnCard as string, trouble: signal.correspondance as string, link: colour.blue as string, danger: mainApp.light.danger as string, inset: mainApp.light.inset as string };
const SettingsColors = createContext(paperColors);

/**
 * Whether the grouped rows inside draw the direction B row (2026-10-20 UI-008,
 * artboards B-Settings and B-Profile): the 13/700 group label, the white list
 * card at radius 22 with 4 16 padding, 16/600 labels with the answer stacked
 * under them, and the 18pt chevron. Off by default, so every screen that has
 * not been rebuilt keeps the P2 row it was built with.
 */
const BRows = createContext(false);

/**
 * Presentation scope only. Other consumers of the shared rows retain paper.
 * The colours are the B tokens of the mode this subtree draws in (2026-10-20
 * UI-008): light equals the old main-app light, dark is the M3 mapping.
 */
export function SettingsAppearance({ b = false, children }: { b?: boolean; children: ReactNode }) {
  const t = useB();
  const colors = { surface: t.card, background: t.ground, text: t.text, muted: t.muted, border: t.line, trouble: t.mode === 'dark' ? t.text : signal.correspondance, link: t.link, danger: t.danger, inset: t.lavender };
  return <SettingsColors.Provider value={colors}><BRows.Provider value={b}>{children}</BRows.Provider></SettingsColors.Provider>;
}

/** Whether the rows here draw the direction B row. */
export function useBRows(): boolean {
  return useContext(BRows);
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
