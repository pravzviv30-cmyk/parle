/**
 * The parts Explore is drawn from, to the B-Explore artboard (2026-10-20
 * UI-008, artboard B-Explore), in light and dark.
 *
 * Pure presentation: every word, every drawing and every badge arrives as a
 * prop from `main/exploreView.ts`, `main/exploreArt.ts` or the tab, and every
 * colour is a `useB()` token. The glyphs are the artboard's own SVG paths.
 * Art and glyphs are decoration; the words beside them carry the meaning.
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { BArt, type BArtName } from '../art/BArt.tsx';
import { LockBadge, Press } from '../components.tsx';
import { lockSpoken } from '../access/featureAccess.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { tileDecoration, type Pastel, type TopicTile } from '../main/exploreArt.ts';
import { HIT, bType, decorative, frenchText, liftStyle } from '../theme.ts';

/** The frame's gutter, which a bleeding row gives back on the right (responsiveLayout.ts). */
const GUTTER = 20;

// ─────────────────────────────────────────────────────────────── glyphs

/** The artboard's search: a 6.5 ring and its handle, stroke 2. */
export function SearchGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={11} cy={11} r={6.5} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M16 16l4.5 4.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** The row chevron, stroke 2.4. */
export function ChevronGlyph({ size, color, back = false }: { size: number; color: string; back?: boolean }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The one-wave speaker the 44pt hear buttons carry. */
export function OneWaveSpeaker({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={color} />
      <Path d="M15.5 9a4 4 0 0 1 0 6" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** The tick a chosen filter carries, so the choice is not colour alone. */
export function TickGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────── pieces

/** The 44pt lavender hear button. */
export function HearButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" depth="tile" accessibilityLabel={label} onPress={onPress} style={s.hear}>
      <OneWaveSpeaker size={18} color={t.text} />
    </Press>
  );
}

/** The 54pt search field. */
export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (text: string) => void; placeholder: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.search}>
      <SearchGlyph size={22} color={t.text} />
      <TextInput value={value} onChangeText={onChangeText} accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={t.muted} style={[bType.line16, s.input, { color: t.text }]} autoCorrect={false} returnKeyType="search" />
    </View>
  );
}

/** The filter chips: one row that runs off the right edge, as drawn. */
export function FilterRow<K extends string>({ filters, chosen, onToggle }: { filters: readonly { key: K; label: string }[]; chosen: ReadonlySet<K>; onToggle: (key: K) => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="toolbar" accessibilityLabel="Filters" style={s.bleed} contentContainerStyle={s.chips}>
      {filters.map(f => {
        const on = chosen.has(f.key);
        return (
          <Press key={f.key} haptic="selection" accessibilityRole="button" accessibilityLabel={f.label} accessibilityState={{ selected: on }} hitSlop={{ top: 3, bottom: 3 }} onPress={() => onToggle(f.key)} style={[s.chip, { backgroundColor: on ? t.brand : t.card }]}>
            {on ? <TickGlyph size={14} color={t.onBrand} /> : null}
            <Text style={[on ? bType.bold14 : bType.semi14, { color: on ? t.onBrand : t.text }]}>{f.label}</Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}

/** A 21/800 section head with its link on the right. */
export function SectionHead({ title, link }: { title: string; link?: { label: string; onPress: () => void } }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.head}>
      <Text accessibilityRole="header" style={[bType.section21, s.grow, { color: t.text }]}>{title}</Text>
      {link !== undefined ? (
        <Press haptic="light" accessibilityRole="link" accessibilityLabel={link.label} onPress={link.onPress} style={s.link}>
          <Text style={[bType.bold15, { color: t.link }]}>{link.label}</Text>
        </Press>
      ) : null}
    </View>
  );
}

/** The 52pt pastel tile a row leads with. */
function RowTile({ art, width, height, ground }: { art: BArtName; width: number; height: number; ground: Pastel }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return <View {...decorative} style={[s.rowTile, { backgroundColor: t[ground] }]}><BArt name={art} width={width} height={height} /></View>;
}

/** The white list card the artboard groups rows in (radius 24, padding 4 14). */
export function ListCard({ children }: { children: ReactNode }) {
  const s = useThemedStyles(makeStyles);
  return <View style={s.list}>{children}</View>;
}

// ─────────────────────────────────────────────────────────────── cards

/** Prepare for something real: the sun-ringed card, its field and Build my practice. */
export function PrepareCard({ title, line, label, value, onChangeText, placeholder, maxLength, locked, action, onAction }: {
  title: string; line: string; label: string; value: string; onChangeText: (text: string) => void; placeholder: string; maxLength: number; locked: boolean; action: string; onAction: () => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.prepare}>
      <View style={s.prepareHead}>
        <View {...decorative} style={[s.prepareTile, { backgroundColor: t.butter }]}><BArt name="map-route" width={52} height={47} style={s.prepareArt} /></View>
        <View style={s.grow}>
          <View style={s.titleRow}>
            <Text accessibilityRole="header" style={[bType.bold18, { color: t.text }]}>{title}</Text>
            {locked ? <LockBadge feature="realMoment" /> : null}
          </View>
          <Text style={[bType.meta, { color: t.muted }]}>{line}</Text>
        </View>
      </View>
      <View style={s.field}>
        <Text style={[bType.semi13, { color: t.muted }]}>{label}</Text>
        <TextInput value={value} onChangeText={onChangeText} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={t.muted} maxLength={maxLength} autoCapitalize="sentences" returnKeyType="done" style={[bType.line16, s.fieldInput, { color: t.text }]} />
      </View>
      <Press haptic="light" accessibilityLabel={action} onPress={onAction} style={[s.button48, { backgroundColor: t.primary }]}>
        <Text style={[bType.bold16, { color: t.onPrimary }]}>{action}</Text>
      </Press>
    </View>
  );
}

/** A "French for real life" tile: pastel art area with its circle and ellipse, white caption, the lift. */
export function TopicTileCard({ tile, title, onPress }: { tile: TopicTile; title: string; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const deco = tileDecoration(t.mode);
  return (
    <Press haptic="light" depth="tile" accessibilityLabel={`${title}, ${tile.line}`} onPress={onPress} frame={s.fill} style={[s.topic, { backgroundColor: t[tile.ground] }]}>
      <View {...decorative} style={[s.topicArt, 'top' in tile.seat ? s.topicArtCentre : null]}>
        <View style={[s.circle, { backgroundColor: t.card, opacity: deco.circle }]} />
        {tile.ellipse ? <View style={[s.ellipse, { backgroundColor: t.scrim, opacity: deco.ellipse }]} /> : null}
        <BArt name={tile.art} width={tile.width} height={tile.height} style={'top' in tile.seat ? { marginTop: tile.seat.top } : { marginBottom: tile.seat.bottom }} />
      </View>
      <View style={s.caption}>
        <Text style={[bType.bold16, { color: t.text }]}>{title}</Text>
        <Text style={[bType.note, { color: t.muted }]}>{tile.line}</Text>
      </View>
    </Press>
  );
}

/** One situation row: the topic tile, title, practise line and meta, with the free-sample accent. */
export function SituationRow({ title, practise, meta, tile, last, onPress }: {
  title: string; practise: string; meta: { plain: string; accent: string | null };
  tile: { art: BArtName; width: number; height: number; ground: Pastel }; last: boolean; onPress: () => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const said = [title, practise, meta.plain + (meta.accent ?? '')].join(', ');
  return (
    <Press haptic="light" accessibilityLabel={said} onPress={onPress} style={[s.situation, !last && s.divider]}>
      <RowTile {...tile} />
      <View style={[s.grow, s.gap4]}>
        <Text style={[bType.bold16, { color: t.text }]}>{title}</Text>
        <Text style={[bType.meta, { color: t.secondary }]}>{practise}</Text>
        <Text style={[bType.note, { color: t.muted }]}>
          {meta.plain}
          {meta.accent !== null ? <Text style={[bType.chip, { color: t.mintWords }]}>{meta.accent}</Text> : null}
        </Text>
      </View>
    </Press>
  );
}

/** For your next conversation: the indigo card, the orb, and the white idea rows. */
export function NextConversationCard({ title, line, ideas, disabled, onIdea }: {
  title: string; line: string; ideas: readonly { key: string; title: string; detail: string; french: boolean }[]; disabled: boolean; onIdea: (key: string) => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.next}>
      <View style={s.nextHead}>
        <View {...decorative} style={s.orb}><BArt name="tutor-orb" width={44} height={44} /></View>
        <View style={s.grow}>
          <Text accessibilityRole="header" style={[bType.bold18, { color: t.sun }]}>{title}</Text>
          <Text style={[bType.meta, { color: t.onBrandSoft }]}>{line}</Text>
        </View>
      </View>
      {ideas.map(idea => (
        <Press key={idea.key} haptic="light" accessibilityLabel={`${idea.title}, ${idea.detail}`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onIdea(idea.key)} style={s.idea}>
          <View style={s.grow}>
            <Text style={[bType.bold16, { color: t.text }]}>{idea.title}</Text>
            <Text {...(idea.french ? frenchText : {})} style={[bType.note, { color: t.muted }]}>{idea.detail}</Text>
          </View>
          <ChevronGlyph size={18} color={t.text} />
        </Press>
      ))}
    </View>
  );
}

/** A little practice: 158pt cards in one row that bleeds off the right edge. */
export function PracticeScroller({ cards }: { cards: readonly { key: string; title: string; line: string; art: BArtName; width: number; height: number; ground: Pastel; onPress: () => void }[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bleed} contentContainerStyle={s.practiceRow}>
      {cards.map(card => (
        <Press key={card.key} haptic="light" depth="tile" accessibilityLabel={`${card.title}, ${card.line}`} onPress={card.onPress} style={s.practice}>
          <View {...decorative} style={[s.practiceArt, { backgroundColor: t[card.ground] }]}><BArt name={card.art} width={card.width} height={card.height} /></View>
          <View style={s.practiceCaption}>
            <Text style={[bType.bold15, { color: t.text }]}>{card.title}</Text>
            <Text style={[bType.note, { color: t.muted }]}>{card.line}</Text>
          </View>
        </Press>
      ))}
    </ScrollView>
  );
}

/** A plan-only collection opens on any paid plan (`hasExplorePlan`), so its lock names Core (F910). */
const EXPLORE_LOCK_PLAN = 'starter' as const;

/** A "Take the conversation further" row with its Free sample pill or round lock. */
export function FurtherRow({ title, line, tile, badge, last, onPress }: {
  title: string; line: string; tile: { art: BArtName; width: number; height: number; ground: Pastel };
  badge: { kind: 'pill'; label: string } | { kind: 'lock' } | null; last: boolean; onPress: () => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const said = [title, line, badge === null ? null : badge.kind === 'pill' ? badge.label : lockSpoken(EXPLORE_LOCK_PLAN)].filter(Boolean).join(', ');
  return (
    <Press haptic="light" accessibilityLabel={said} onPress={onPress} style={[s.further, !last && s.divider]}>
      <RowTile {...tile} />
      <View style={[s.grow, s.gap2]}>
        <Text style={[bType.bold16, { color: t.text }]}>{title}</Text>
        <Text style={[bType.note, { color: t.muted }]}>{line}</Text>
      </View>
      {badge?.kind === 'pill' ? <View {...decorative} style={[s.smallPill, { backgroundColor: t.lavender }]}><Text style={[bType.bold12, { color: t.text }]}>{badge.label}</Text></View> : null}
      {badge?.kind === 'lock' ? <LockBadge plan={EXPLORE_LOCK_PLAN} form="round" said /> : null}
    </Press>
  );
}

/** A word or phrase row: the French, the English, and the 44pt hear button when a voice exists. */
export function WordRow({ fr, en, hear, last, onPress }: { fr: string; en: string; hear: { label: string; onPress: () => void } | null; last: boolean; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.word, !last && s.divider]}>
      <Press haptic="light" accessibilityLabel={`${fr}, ${en}`} onPress={onPress} frame={s.grow} style={s.wordWords}>
        <Text {...frenchText} style={[bType.bold16, { color: t.text }]}>{fr}</Text>
        <Text style={[bType.note, { color: t.muted }]}>{en}</Text>
      </Press>
      {hear !== null ? <HearButton label={hear.label} onPress={hear.onPress} /> : null}
    </View>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    fill: { flex: 1 },
    gap2: { gap: 2 },
    gap4: { gap: 4 },
    titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
    hear: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.lavender, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    search: { minHeight: 54, borderRadius: 27, backgroundColor: t.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 },
    input: { flex: 1, minWidth: 0, minHeight: HIT },
    bleed: { marginRight: -GUTTER, flexGrow: 0 },
    chips: { gap: 8, paddingRight: GUTTER },
    chip: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
    head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    link: { minHeight: HIT, justifyContent: 'center' },
    rowTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
    list: { backgroundColor: t.card, borderRadius: 24, paddingVertical: 4, paddingHorizontal: 14 },
    divider: { borderBottomWidth: 1, borderBottomColor: t.line },
    prepare: { backgroundColor: t.card, borderRadius: 26, padding: 18, gap: 12, borderWidth: 2, borderColor: t.sun },
    prepareHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    prepareTile: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
    prepareArt: { marginTop: 6 },
    field: { gap: 6 },
    fieldInput: { minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: t.field, backgroundColor: t.ground, paddingHorizontal: 14 },
    button48: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    topic: { flex: 1, borderRadius: 26, overflow: 'hidden', ...liftStyle },
    topicArt: { height: 138, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
    topicArtCentre: { justifyContent: 'center' },
    circle: { position: 'absolute', width: 156, height: 156, borderRadius: 78, top: -26, alignSelf: 'center' },
    ellipse: { position: 'absolute', width: 112, height: 14, borderRadius: 7, bottom: 8, alignSelf: 'center' },
    caption: { flexGrow: 1, backgroundColor: t.card, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14, gap: 2 },
    situation: { flexDirection: 'row', gap: 12, paddingVertical: 14, minHeight: HIT },
    next: { backgroundColor: t.brand, borderRadius: 28, padding: 18, gap: 12 },
    nextHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    orb: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
    idea: { backgroundColor: t.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT },
    practiceRow: { gap: 10, paddingRight: GUTTER },
    practice: { width: 158, backgroundColor: t.card, borderRadius: 24, overflow: 'hidden' },
    practiceArt: { height: 100, alignItems: 'center', justifyContent: 'center' },
    practiceCaption: { padding: 12, gap: 2 },
    further: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: HIT },
    smallPill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, flexShrink: 0 },
    word: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    wordWords: { gap: 2, minHeight: HIT, justifyContent: 'center' },
  });
