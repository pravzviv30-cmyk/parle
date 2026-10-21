import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { HUM_WORDMARK } from '../brand/hum.ts';
import { Press } from '../components.tsx';
import { AnimatedIcon } from '../icons/AnimatedIcon.tsx';
import { Icon } from '../icons/Icon.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { HIT, decorative, font, space, type } from '../theme.ts';
import { PLANS_PRIVACY, PLANS_TERMS, PAYWALL_RESTORE } from './wallCopy.ts';
import type { PaywallNotice } from './trialPaywall.ts';

/**
 * The trial paywall's shell pieces ("P2 · Luvani"). Layout only: every word
 * and every decision arrives from `trialPaywall.ts` and `wallCopy.ts`.
 */

const WORDMARK_WIDTH = 72;

/** The top row: the Luvani wordmark at the left, the close mark at the right. */
/** `onPress` is the close mark's; without one the row shows the wordmark alone. */
export function WallTopRow({ onPress }: { onPress?: () => void }) {
  const { colors } = useMainAppearance();
  return (
    <View style={st.top}>
      <View accessibilityRole="header" accessibilityLabel="Luvani" style={{ width: WORDMARK_WIDTH, height: (WORDMARK_WIDTH * HUM_WORDMARK.height) / HUM_WORDMARK.width }}>
        <Svg {...decorative} width="100%" height="100%" viewBox={`0 0 ${HUM_WORDMARK.width} ${HUM_WORDMARK.height}`}>
          <Path d={HUM_WORDMARK.d} fill={colors.text} />
        </Svg>
      </View>
      {onPress ? (
        <Press haptic="light" onPress={onPress} accessibilityRole="button" accessibilityLabel="Close" style={st.close}>
          <Icon name="close" size={22} color={colors.muted} />
        </Press>
      ) : <View style={st.close} />}
    </View>
  );
}

/**
 * The one primary button: 56pt, fully rounded, the brand blue with white
 * words. `state` is the wall's purchase pill state, so the check still lands
 * only once the server has confirmed the entitlement.
 */
export function WallCta({ label, onPress, disabled = false, dim = 1, state = 'idle' }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Opacity for a waiting or unavailable button (.45 loading, .6 purchasing). */
  dim?: number;
  state?: 'idle' | 'busy' | 'done';
}) {
  const { b } = useMainAppearance();
  const waiting = state !== 'idle';
  return (
    <Press haptic="light" onPress={onPress} disabled={disabled || waiting} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={waiting ? { busy: state === 'busy', disabled: true } : { disabled }}
      style={[st.cta, { backgroundColor: b.brand, opacity: dim }]}>
      {waiting ? (
        <View {...decorative} style={st.mark}>
          <AnimatedIcon kind="check-draw" size={22} color={b.onBrand} state={state === 'done' ? 'on' : 'off'} />
          {state === 'done' ? null : <View style={StyleSheet.absoluteFill}><AnimatedIcon kind="refresh-spin" size={22} color={b.onBrand} active /></View>}
        </View>
      ) : null}
      <Text accessibilityLiveRegion="polite" style={[st.ctaLabel, { color: b.onBrand }]}>{label}</Text>
    </Press>
  );
}

/** The quiet button an unavailable page offers instead of a purchase. */
export function WallSecondary({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useMainAppearance();
  return (
    <Press haptic="light" onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled }} style={[st.cta, { backgroundColor: colors.inset, opacity: disabled ? 0.6 : 1 }]}>
      <Text style={[st.ctaLabel, { color: colors.text }]}>{label}</Text>
    </Press>
  );
}

/** A quiet text action at the 44pt floor, in the link colour. */
export function WallTextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useMainAppearance();
  return (
    <Press haptic="light" onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={st.link}>
      <Text style={[st.small, { color: colors.link }]}>{label}</Text>
    </Press>
  );
}

/** A notice above the button: waiting, failed, nothing to restore. */
export function WallNotice({ notice }: { notice: PaywallNotice }) {
  const { colors } = useMainAppearance();
  return (
    <View accessibilityLiveRegion="polite" style={[st.notice, { backgroundColor: colors.inset }]}>
      {notice.title !== null && <Text style={[st.noticeTitle, { color: notice.danger ? colors.danger : colors.text }]}>{notice.title}</Text>}
      <Text style={[st.noticeBody, { color: notice.title === null ? colors.text : colors.muted }]}>{notice.body}</Text>
    </View>
  );
}

/** Restore purchases, Terms and Privacy, each a 44pt target, with drawn dots between. */
export function WallLinks({ onRestore, onTerms, onPrivacy, restoreDisabled = false }: { onRestore?: () => void; onTerms: () => void; onPrivacy: () => void; restoreDisabled?: boolean }) {
  const { colors } = useMainAppearance();
  const link = (label: string, onPress: () => void, disabled = false) => (
    <Press key={label} haptic="light" onPress={onPress} disabled={disabled} accessibilityRole="link" accessibilityLabel={label} style={st.link}>
      <Text style={[st.small, { color: colors.muted }]}>{label}</Text>
    </Press>
  );
  // A drawn dot, not a character: the punctuation rule keeps the middot out of copy.
  const dot = (key: string) => <View key={key} {...decorative} style={[st.dot, { backgroundColor: colors.muted }]} />;
  const items: ReactNode[] = [];
  if (onRestore) items.push(link(PAYWALL_RESTORE, onRestore, restoreDisabled), dot('a'));
  items.push(link(PLANS_TERMS, onTerms), dot('b'), link(PLANS_PRIVACY, onPrivacy));
  return <View style={st.links}>{items}</View>;
}

/** An inset-coloured block standing in for text that has not arrived. */
export function WallSkeleton({ width, height, round = 8 }: { width: number | `${number}%`; height: number; round?: number }) {
  const { colors } = useMainAppearance();
  return <View {...decorative} style={{ width, height, borderRadius: round, backgroundColor: colors.inset, alignSelf: 'center' }} />;
}

/** The check beside a standard paywall benefit. */
export function BenefitRow({ line }: { line: string }) {
  const { colors, b } = useMainAppearance();
  return (
    <View style={st.benefit}>
      <View {...decorative} style={st.benefitMark}><Icon name="check" size={18} color={b.mark} /></View>
      <Text style={[st.body, { color: colors.text, flex: 1, minWidth: 0 }]}>{line}</Text>
    </View>
  );
}

export const wallType = StyleSheet.create({
  headline: { ...type.title, textAlign: 'center' },
  stateTitle: { ...type.title, textAlign: 'center' },
  price: { ...type.title, textAlign: 'center' },
  body: { ...type.mainBody },
  bold: { fontFamily: font.bold },
  detail: { ...type.small, textAlign: 'center' },
  line: { ...type.small },
  title: { ...type.bodyStrong },
  medium: { ...type.bodyStrong },
});

const st = StyleSheet.create({
  top: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space(2) },
  close: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  cta: { minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2), paddingHorizontal: space(6), paddingVertical: space(3), alignSelf: 'stretch' },
  ctaLabel: { ...type.button, textAlign: 'center', flexShrink: 1 },
  mark: { width: 22, height: 22 },
  notice: { borderRadius: 20, padding: space(4), gap: space(1) },
  noticeTitle: { ...type.bodyStrong },
  noticeBody: { ...type.small },
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: space(1) },
  link: { minHeight: HIT, minWidth: HIT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(1) },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  small: { ...type.small, textAlign: 'center' },
  body: { ...type.mainBody },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  benefitMark: { paddingTop: 2 },
});
