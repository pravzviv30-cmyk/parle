import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo, PixelRatio, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colour, font, paper, space, type, HIT } from '../theme.ts';
import { Press } from '../components.tsx';
import { Icon, type IconName } from '../icons/Icon.tsx';
import { dueCount } from '../review/store.ts';
import { tapSettled } from '../motion/haptics.ts';
import { TabGlyph } from './TabGlyph.tsx';
import { navigationWidth } from '../responsiveLayout.ts';
import { useMainAppearance } from '../main/MainAppearance.tsx';
export const MAIN_TABS = ['Home', 'Explore', 'Tutor', 'Library', 'MyFrench'] as const;
const LABELS: Record<string, string> = { Home: 'Home', Explore: 'Explore', Tutor: 'Speak', Library: 'My French', MyFrench: 'Progress', Practice: 'My French' };
const ICONS: Record<string, IconName> = { Home: 'home', Explore: 'exploring', Tutor: 'microphone', Library: 'cards', MyFrench: 'progress' };
const WRAPS_UNDER_GLYPH = 1.6;
function labelsWrapUnderGlyph(fontScale: number): boolean { return fontScale >= WRAPS_UNDER_GLYPH; }
/** One stable dock. Compatibility Practice is represented by the My French destination. */
export function LuvaniTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useMainAppearance(); const { width } = useWindowDimensions();
  const wrapped = labelsWrapUnderGlyph(PixelRatio.getFontScale());
  const [due, setDue] = useState<number | null>(null);
  useEffect(() => { let live = true; void dueCount().then(n => { if (live) setDue(n); }).catch(() => { if (live) setDue(null); }); return () => { live = false; }; }, [state.index]);
  const current = state.routes[state.index]?.name;
  return <View style={[st.bar, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, space(2)) }]}><View style={[st.cells, { width: navigationWidth(width, insets.left, insets.right) - space(6) }]}>
    {MAIN_TABS.map(name => { const route = state.routes.find(r => r.name === name); if (!route) return null;
      const focused = current === name || current === 'Practice' && name === 'Library'; const label = LABELS[name]!;
      const dot = name === 'Library' ? due === null ? null : due > 0 : false;
      const onPress = () => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!focused && !event.defaultPrevented) { tapSettled(); navigation.navigate(route.name as never); announceTab(route.name); } };
      return <Press key={route.key} haptic="none" onPress={onPress} frame={[st.cell, wrapped && st.cellWrapped]} style={[st.face, focused && { backgroundColor: colour.blue }]} accessibilityRole="tab" accessibilityState={{ selected: focused }} aria-selected={focused} accessibilityLabel={dot ? `${label}, practice ready` : label}>
        <TabGlyph focused={focused} badged={dot}>{bulk => <Icon name={ICONS[name]!} size={22} color={focused ? colour.sun : paper.ground} variant={bulk ? 'bulk' : 'linear'}/>}</TabGlyph>
        <Text style={[st.label, { color: paper.ground, fontFamily: focused ? font.bold : font.medium }]}>{label}</Text>
      </Press>;
    })}
  </View></View>;
}
export function announceTab(name: string) { AccessibilityInfo.announceForAccessibility(`${LABELS[name] ?? name} tab`); }
const st = StyleSheet.create({ bar: { alignItems: 'center', paddingTop: space(2) }, cells: { flexDirection: 'row', backgroundColor: paper.ink, borderRadius: 32, padding: space(2) }, cell: { flex: 1, minHeight: HIT + space(4), minWidth: 0 }, cellWrapped: { flexBasis: '20%', flexGrow: 0, flexShrink: 0 }, face: { alignSelf: 'stretch', flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(1), paddingVertical: space(2), paddingHorizontal: space(1), borderRadius: 20 }, label: { ...type.tabLabel, textAlign: 'center' } });
