/**
 * The parts Profile is drawn from, to the B-Profile artboard (2026-10-20
 * UI-008, artboard B-Profile), in light and dark.
 *
 * Pure presentation: every word arrives as a prop from `settings/profileView.ts`
 * or the screen, and every colour is a `useB()` token. The gear is the
 * artboard's own SVG. The grouped rows are the shared `SettingsGroup` and
 * `SettingsRow` in their B form (`<SettingsAppearance b>`).
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Press } from '../components.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { HIT, bType, decorative } from '../theme.ts';
import type { PlanCardView, ProfileStat } from './profileView.ts';

/** The artboard's gear: a 3.2 ring inside the toothed outline. */
export function GearGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={3.2} fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M12 2.8l1.6 2.3 2.7-.8.6 2.8 2.7.9-.8 2.7 2.3 1.3-2.3 1.3.8 2.7-2.7.9-.6 2.8-2.7-.8L12 21.2l-1.6-2.3-2.7.8-.6-2.8-2.7-.9.8-2.7L2.9 12l2.3-1.3-.8-2.7 2.7-.9.6-2.8 2.7.8z" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** A 44pt white disc holding one glyph: the gear. */
export function IconDisc({ label, hint, onPress, children }: { label: string; hint?: string; onPress: () => void; children: ReactNode }) {
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="selection" accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress} style={s.disc}>
      <View {...decorative}>{children}</View>
    </Press>
  );
}

/** The identity row: the 76pt sun disc with the initial, the 30/800 name, the since line, and Edit. */
export function Identity({ initial, name, since, edit, onEdit }: { initial: string; name: string; since: string | null; edit: string; onEdit: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.identity}>
      <View style={s.avatar} {...decorative}>
        {/* Ink on sun in both modes (onMint is the ink a sun or mint disc carries). */}
        <Text style={[s.initial, { color: t.onMint }]}>{initial}</Text>
      </View>
      <View style={s.who}>
        <Text accessibilityRole="header" style={[s.name, { color: t.text }]}>{name}</Text>
        {since !== null ? <Text style={[bType.meta, { color: t.muted }]}>{since}</Text> : null}
      </View>
      <Press haptic="selection" accessibilityRole="button" accessibilityLabel="Edit your name" onPress={onEdit} style={s.edit}>
        <Text style={[bType.bold15, { color: t.text }]}>{edit}</Text>
      </Press>
    </View>
  );
}

/** The white stats card: three centred cells, the middle one ruled either side. */
export function StatsCard({ stats, onOpen }: { stats: readonly ProfileStat[]; onOpen: (stat: ProfileStat) => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.stats}>
      {stats.map((stat, i) => (
        <Press
          key={stat.key}
          haptic="light"
          accessibilityRole="link"
          accessibilityLabel={stat.value === null ? stat.label : `${stat.value}, ${stat.label}`}
          onPress={() => onOpen(stat)}
          frame={s.statFrame}
          style={[s.stat, i === 1 && s.statRuled]}
        >
          {stat.value !== null ? <Text style={[bType.bold17, s.centred, { color: t.text }]}>{stat.value}</Text> : null}
          <Text style={[bType.note12, s.centred, { color: t.muted }]}>{stat.label}</Text>
        </Press>
      ))}
    </View>
  );
}

/** The blue plan card: "Your plan" in sun, the plan's name, what it includes, and the white pill. */
export function PlanBanner({ eyebrow, view, onPress }: { eyebrow: string; view: PlanCardView; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const spoken = [eyebrow, view.title, view.line, view.action].filter((part): part is string => part !== null).join(', ');
  return (
    <Press haptic="light" accessibilityRole="button" accessibilityLabel={spoken} onPress={onPress} style={s.plan}>
      <View style={s.planWords}>
        <Text style={[bType.chip, { color: t.sun }]}>{eyebrow}</Text>
        {view.title !== null ? <Text style={[bType.bold18, { color: t.onBrand }]}>{view.title}</Text> : null}
        <Text style={[bType.meta, { color: t.onBrandSoft }]}>{view.line}</Text>
      </View>
      <View style={s.planPill}>
        <Text style={[bType.bold14, { color: t.text }]}>{view.action}</Text>
      </View>
    </Press>
  );
}

/** A leading drawing for a row, clipped round when asked (the tutor orb). */
export function RowArt({ round, size, children }: { round?: boolean; size: number; children: ReactNode }) {
  return <View style={round ? { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' } : undefined}>{children}</View>;
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    disc: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: t.sun, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    initial: bType.initial34,
    who: { flex: 1, minWidth: 0, gap: 2 },
    name: bType.name30,
    edit: { minHeight: HIT, minWidth: HIT, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    stats: { flexDirection: 'row', backgroundColor: t.card, borderRadius: 22, padding: 12, gap: 6 },
    statFrame: { flex: 1, minWidth: 0 },
    stat: { minHeight: HIT, padding: 4, gap: 2, alignItems: 'center', justifyContent: 'center' },
    statRuled: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: t.line },
    centred: { textAlign: 'center' },
    plan: { backgroundColor: t.brand, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
    planWords: { flex: 1, minWidth: 0, gap: 2 },
    planPill: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  });
