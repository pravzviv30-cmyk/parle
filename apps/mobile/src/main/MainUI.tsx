import { useState, type ReactNode, type Ref } from 'react';
import { Text, View, StyleSheet, useWindowDimensions, type ScrollView } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { ScrollScreen } from '../layout.tsx';
import { Press, Sheet } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { colour, font, paper, space, type, HIT } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { MainIllustration } from '../illustrations/MainIllustration.tsx';
import { useMainAppearance } from './MainAppearance.tsx';
import { DisplayPreferences } from '../settings/DisplayPreferences.tsx';
export function MainScreen({ title, children, header, onBack, onProfile, footer, bottom, avoidKeyboard, scrollRef }: { title: string; children: ReactNode; header?: ReactNode; onBack?: () => void; onProfile?: () => void; footer?: ReactNode; bottom?: 'tab' | 'inset'; avoidKeyboard?: boolean; scrollRef?: Ref<ScrollView> }) {
  const { colors, preference, setPreference, error } = useMainAppearance(); const { profile } = useProfile();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>(); const [display, setDisplay] = useState(false);
  return <ScrollScreen bottom={bottom ?? (onBack ? 'inset' : 'tab')} ground={colors.background} footer={footer} avoidKeyboard={avoidKeyboard} scrollRef={scrollRef}>
    <View style={s.stack}>
      {onBack && <Press onPress={onBack} style={s.back} accessibilityRole="button" accessibilityLabel="Back"><Icon name="back" size={22} color={colors.text}/><Text style={[type.label, { color: colors.text }]}>Back</Text></Press>}
      <View style={s.heading}><Text accessibilityRole="header" style={[s.title, { color: colors.text }]}>{title}</Text>
        {!onBack && <Press onPress={onProfile ?? (() => setDisplay(true))} accessibilityRole="button" accessibilityLabel="Profile and display settings" style={[s.avatar, { backgroundColor: colors.inset }]}><Text style={[type.label, { color: colors.text }]}>{Array.from(profile.name?.trim() || 'You')[0]?.toLocaleUpperCase()}</Text></Press>}
      </View>{header}{children}
    </View>
    <Sheet surface={colors.surface} ink={colors.text} visible={display} title="Make yourself at home" onClose={() => setDisplay(false)}>
      <Text style={[type.body, { color: colors.muted }]}>Choose how Luvani looks on this device.</Text>
      <DisplayPreferences />
      <MainButton label="Profile and settings" onPress={() => { setDisplay(false); nav.navigate('Profile'); }}/><MainButton label="Done" tone="quiet" onPress={() => setDisplay(false)}/>
    </Sheet>
  </ScrollScreen>;
}
export function MainButton({ label, onPress, tone = 'primary', disabled = false, accessibilityLabel }: { label: string; onPress: () => void; tone?: 'primary' | 'gold' | 'quiet'; disabled?: boolean; accessibilityLabel?: string }) {
  const { colors } = useMainAppearance();
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, { backgroundColor: tone === 'gold' ? colour.sun : tone === 'quiet' ? colors.inset : colour.blue, opacity: disabled ? .55 : 1 }]}><Text accessibilityLiveRegion="polite" style={[type.label, { color: tone === 'gold' ? paper.ink : tone === 'quiet' ? colors.text : paper.onInk, textAlign: 'center' }]}>{label}</Text></Press>;
}
export function MainRow({ title, detail, onPress, disabled = false }: { title: string; detail?: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string }) {
  const { colors } = useMainAppearance();
  return <Press disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityState={{ disabled }} style={[s.row, { backgroundColor: colors.surface }]}><View style={s.rowCopy}><Text style={[type.label, { color: colors.text }]}>{title}</Text>{detail ? <Text style={[type.small, { color: colors.muted }]}>{detail}</Text> : null}</View><Icon name="chevron-right" size={24} color={colors.text}/></Press>;
}
type Motif = 'cloud' | 'talk' | 'phrases' | 'practice' | 'journal' | 'market' | 'plans' | 'travel' | 'listen' | 'recovery';
export function MainFeature({ title, body, motif, action, tone = 'hero', children }: { title: string; body?: string; motif: Motif; action?: { label: string; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'gold' | 'quiet' }; tone?: 'hero' | 'plum' | 'teal' | 'rose' | 'ochre'; children?: ReactNode }) {
  const { colors, mode } = useMainAppearance(); const focused = useIsFocused(); const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale >= 1.5; const ink = tone === 'hero' ? paper.onInk : colors.text;
  return <View style={[s.feature, { backgroundColor: colors[tone] }]}><View style={[s.featureHead, compact && s.featureStack]}><Text style={[s.featureTitle, compact && { flex: undefined, width: '100%' }, { color: ink }]}>{title}</Text><MainIllustration motif={motif} theme={mode} width={compact ? 144 : 120} active={focused}/></View>{body ? <Text style={[type.body, { color: ink }]}>{body}</Text> : null}{children}{action && <MainButton {...action} tone={action.tone ?? (tone === 'hero' ? 'gold' : 'primary')}/>}</View>;
}
export function MainHeading({ children }: { children: ReactNode }) { const { colors } = useMainAppearance(); return <Text accessibilityRole="header" style={[s.section, { color: colors.text }]}>{children}</Text>; }
export function MainText({ children, muted = false }: { children: ReactNode; muted?: boolean }) { const { colors } = useMainAppearance(); return <Text style={[type.body, { color: muted ? colors.muted : colors.text }]}>{children}</Text>; }
const s = StyleSheet.create({ stack: { gap: space(5), paddingBottom: space(5) }, heading: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(1) }, title: { ...type.mainDisplay, flex: 1, minWidth: 0 }, avatar: { width: HIT, minHeight: HIT, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, back: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2) }, button: { minHeight: 52, paddingVertical: space(4), paddingHorizontal: space(4), borderRadius: 20, justifyContent: 'center', alignSelf: 'stretch' }, row: { minHeight: 76, padding: space(4), flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: 24 }, rowCopy: { flex: 1, gap: space(1.5), minWidth: 0 }, feature: { borderRadius: 24, padding: space(5), gap: space(3) }, featureHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) }, featureStack: { flexDirection: 'column-reverse', alignItems: 'flex-start' }, featureTitle: { ...type.mainHeading, flex: 1, minWidth: 0 }, section: { ...type.mainHeading, marginTop: space(2) } });
