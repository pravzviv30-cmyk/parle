/**
 * The parts Practice and its new-learner page are drawn from, to the
 * B-Practice and B-Empty-Practice artboards (2026-10-21 UI-008), in light and
 * dark.
 *
 * Pure presentation: every word, route decision and lock arrives as a prop
 * from `practice/practiceTabView.ts` or the tab, and every colour is a
 * `useB()` token. The glyphs are the artboard's own SVG paths. Art and glyphs
 * are decoration; the words beside them carry the meaning, and a locked door
 * says its lock once, in its own label.
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BArt } from '../art/BArt.tsx';
import { LOCK_BADGE_LABEL, LockBadge, Press } from '../components.tsx';
import { ChevronGlyph, SearchGlyph, TickGlyph } from '../explore/ExploreParts.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BButton, BMic } from '../today/TodayParts.tsx';
import { HIT, bType, decorative, frenchText, liftStyle } from '../theme.ts';

/** The frame's gutter, which a bleeding row gives back on the right (responsiveLayout.ts). */
const GUTTER = 20;

const lockSaid = (label: string, locked: boolean): string => (locked ? `${label}, ${LOCK_BADGE_LABEL}` : label);

// ─────────────────────────────────────────────────────────────── glyphs

/** The resume disc's play triangle. */
function PlayGlyph({ size, color }: { size: number; color: string }) {
  return <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24"><Path d="M7 4.5l13 7.5-13 7.5z" fill={color} /></Svg>;
}

/** "Try your replies": the speech bubble, stroke 2. */
function ChatGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

/** "Remember it": the lightbulb, stroke 2. */
function BulbGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20.5h5" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The one-wave speaker the "Understand it" step leads with. */
function StepSpeaker({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={color} />
      <Path d="M15.5 9a4 4 0 0 1 0 6" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** The filled lock the artboard's buttons carry beside their words. */
function FilledLock({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18v-5a2.5 2.5 0 0 1 2.5-2.5z" fill={color} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke={color} strokeWidth={2.4} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────── search and topics

/** The 50pt search over this page's conversations. */
export function PracticeSearch({ value, onChangeText, placeholder }: { value: string; onChangeText: (text: string) => void; placeholder: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.search}>
      <SearchGlyph size={20} color={t.text} />
      <TextInput value={value} onChangeText={onChangeText} accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={t.muted} style={[bType.line16, s.input, { color: t.text }]} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
    </View>
  );
}

/** The topic tabs: 40pt, radius 20, one row that runs off the right edge. */
export function TopicTabs<K extends string | null>({ tabs, chosen, onChoose }: { tabs: readonly { key: K; label: string }[]; chosen: K; onChoose: (key: K) => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel="Topics" style={s.bleed} contentContainerStyle={s.tabs}>
      {tabs.map((tab) => {
        const on = tab.key === chosen;
        return (
          <Press key={tab.key ?? 'all'} haptic="selection" accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }} hitSlop={{ top: 2, bottom: 2 }} onPress={() => onChoose(tab.key)} style={[s.tab, { backgroundColor: on ? t.brand : t.card }]}>
            {on ? <TickGlyph size={14} color={t.onBrand} /> : null}
            <Text style={[on ? bType.bold15 : bType.semi15, { color: on ? t.onBrand : t.text }]}>{tab.label}</Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────── lead cards

/** Pick up where you stopped: the blue card, its decor circle and the sun play disc. */
export function ResumeCard({ title, line, onPress }: { title: string; line: string; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  // onMint is the ink that stays ink in both modes, on the sun disc as on mint.
  return (
    <Press haptic="light" depth="tile" accessibilityLabel={`${title}, ${line}`} onPress={onPress} style={s.resume}>
      <View {...decorative} style={s.resumeDecor} />
      <View {...decorative} style={s.playDisc}><PlayGlyph size={18} color={t.onMint} /></View>
      <View style={s.grow2}>
        <Text style={[bType.bold18, { color: t.sun }]}>{title}</Text>
        <Text style={[bType.meta, { color: t.onBrandSoft }]}>{line}</Text>
      </View>
    </Press>
  );
}

/**
 * Comes up often (founder, 2026-10-21): the butter card, an authored pattern
 * name and hint, never a count. The card opens Your fixes; "Practise this" is
 * drawn only when a drill can ask for a fix that shows the pattern.
 */
export function PatternCard({ eyebrow, title, hint, note, practise, locked, onCard, onPractise }: {
  eyebrow: string;
  title: string;
  hint: string;
  note: string | null;
  practise: string;
  locked: boolean;
  onCard: (() => void) | null;
  onPractise: (() => void) | null;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const body = (
    <>
      <View style={s.patternEyebrow}>
        <Text style={[bType.chip, { color: t.text }]}>{eyebrow}</Text>
        {locked ? <LockBadge said /> : null}
      </View>
      <View style={s.patternRow}>
        <View style={s.grow2}>
          <Text style={[bType.bold18, { color: t.text }]}>{title}</Text>
          <Text style={[bType.meta, { color: t.secondary }]}>{hint}</Text>
        </View>
        {onPractise !== null ? <BButton hug label={practise} accessibilityLabel={lockSaid(`${practise}, ${title}`, locked)} height={40} ground={t.primary} ink={t.onPrimary} text={bType.bold14} onPress={onPractise} /> : null}
      </View>
      {note !== null ? <Text style={[bType.note12, { color: t.secondary }]}>{note}</Text> : null}
    </>
  );
  if (onCard === null) return <View style={s.pattern}>{body}</View>;
  return (
    <Press haptic="light" depth="tile" accessibilityLabel={lockSaid(`${eyebrow}, ${title}, ${hint}`, locked)} onPress={onCard} style={s.pattern}>
      {body}
    </Press>
  );
}

/** "Your conversations" and its sun "3 this week" pill. */
export function ConversationsHead({ title, week }: { title: string; week: string | null }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.convHead}>
      <Text accessibilityRole="header" style={[bType.section21, s.grow, { color: t.text }]}>{title}</Text>
      {week !== null ? <View style={s.weekPill}><Text style={[bType.heavy13, { color: t.onMint }]}>{week}</Text></View> : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── conversation cards

export interface StepView { key: 'understand' | 'listen' | 'remember'; title: string; gloss: string; onPress: () => void }

const STEP_GLYPH = { understand: StepSpeaker, listen: ChatGlyph, remember: BulbGlyph } as const;

/** The white chip of a kept French phrase, or the "+3 more" beside them. */
function PhraseChip({ label, french }: { label: string; french: boolean }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.chip}>
      <Text {...(french ? frenchText : {})} style={[bType.semi13, { color: t.text }]}>{label}</Text>
    </View>
  );
}

/**
 * The newest conversation, drawn large: the butter band with the café drawing,
 * the summary and kept phrases, its fixes row, the three practice steps and
 * the ink "Talk about it again". A step's minutes have no estimate, so the
 * step keeps its place without one.
 */
export function LargeConversationCard({ title, meta, summary, kept, more, revisited, fixes, stepsLabel, steps, stepsLocked, revisit }: {
  title: string;
  meta: string;
  summary: string;
  kept: readonly string[];
  more: string | null;
  revisited: readonly string[] | null;
  fixes: { title: string; gloss: string; locked: boolean; onPress: () => void } | null;
  stepsLabel: string;
  steps: readonly StepView[] | null;
  stepsLocked: boolean;
  revisit: { label: string; uses: string; locked: boolean; onPress: () => void } | null;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.large}>
      <View style={s.band}>
        <BArt name="cafe-table" width={76} height={69} />
        <View style={s.grow2}>
          <Text accessibilityRole="header" style={[bType.bold19, { color: t.text }]}>{title}</Text>
          {meta !== '' ? <Text style={[bType.note, { color: t.secondary }]}>{meta}</Text> : null}
        </View>
      </View>
      <View style={s.largeBody}>
        {summary !== '' ? <Text style={[bType.para15, { color: t.secondary }]}>{summary}</Text> : null}
        {revisited !== null ? <RevisitPanel lines={revisited} /> : null}
        {kept.length > 0 ? (
          <View style={s.chips}>
            {kept.map((fr) => <PhraseChip key={fr} label={fr} french />)}
            {more !== null ? <PhraseChip label={more} french={false} /> : null}
          </View>
        ) : null}
        {fixes !== null ? (
          <Press haptic="light" depth="tile" accessibilityLabel={lockSaid(`${fixes.title}, ${fixes.gloss}`, fixes.locked)} onPress={fixes.onPress} style={s.fixesRow}>
            <View style={s.grow}>
              <Text style={[bType.bold15, { color: t.text }]}>{fixes.title}</Text>
              <Text style={[bType.note, { color: t.secondary }]}>{fixes.gloss}</Text>
            </View>
            {fixes.locked ? <LockBadge form="round" said /> : null}
            <ChevronGlyph size={18} color={t.text} />
          </Press>
        ) : null}
        {steps !== null ? (
          <View style={s.steps}>
            <Text style={[bType.chip, { color: t.muted }]}>{stepsLabel}</Text>
            {steps.map((step) => {
              const Glyph = STEP_GLYPH[step.key];
              return (
                <Press key={step.key} haptic="light" depth="tile" accessibilityLabel={lockSaid(`${stepsLabel}, ${step.title}, ${step.gloss}`, stepsLocked)} onPress={step.onPress} style={s.step}>
                  <View {...decorative} style={s.stepIcon}><Glyph size={18} color={t.link} /></View>
                  <View style={s.grow}>
                    <Text style={[bType.bold15, { color: t.text }]}>{step.title}</Text>
                    <Text style={[bType.note, { color: t.secondary }]}>{step.gloss}</Text>
                  </View>
                  {stepsLocked ? <LockBadge form="round" said /> : null}
                </Press>
              );
            })}
          </View>
        ) : null}
        {revisit !== null ? (
          <View style={s.revisit}>
            <Press haptic="light" accessibilityLabel={`${revisit.label}. ${revisit.uses}${revisit.locked ? `, ${LOCK_BADGE_LABEL}` : ''}`} onPress={revisit.onPress} style={s.talk}>
              <BMic size={18} color={t.onPrimary} />
              {revisit.locked ? <FilledLock size={14} color={t.onPrimary} /> : null}
              <Text style={[bType.bold17, { color: t.onPrimary }]}>{revisit.label}</Text>
            </Press>
            <Text style={[bType.note12, { color: t.muted }]}>{revisit.uses}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The mint panel a revisit carries: the first line as its 12/700 head, the learner's own French under it. */
function RevisitPanel({ lines }: { lines: readonly string[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const [head, ...rest] = lines;
  return (
    <View style={s.revisitPanel}>
      <Text style={[bType.bold12, { color: t.mintWords }]}>{head}</Text>
      {rest.map((line) => <Text key={line} style={[bType.meta, { color: t.text }]}>{line}</Text>)}
    </View>
  );
}

/** A small 44pt button of the smaller card, with the artboard's 13pt lock when locked. */
function CardButton({ label, accessibilityLabel, ground, locked, onPress }: { label: string; accessibilityLabel: string; ground: string; locked: boolean; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityLabel={lockSaid(accessibilityLabel, locked)} onPress={onPress} frame={s.fill} style={[s.cardButton, { backgroundColor: ground }]}>
      {locked ? <FilledLock size={13} color={t.link} /> : null}
      <Text style={[bType.bold15, { color: t.text }]}>{label}</Text>
    </Press>
  );
}

/** An older conversation, drawn small: the tile, its lines, the revisit panel and Practise it / Talk again. */
export function CompactConversationCard({ title, meta, summary, art, revisited, practise, talk }: {
  title: string;
  meta: string;
  summary: string;
  art: { name: 'friends-cheer' | 'map-route'; ground: 'lavender' | 'sage' };
  revisited: readonly string[] | null;
  practise: { label: string; locked: boolean; onPress: () => void } | null;
  talk: { label: string; uses: string; locked: boolean; onPress: () => void } | null;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const size = art.name === 'friends-cheer' ? { width: 66, height: 60 } : { width: 64, height: 58 };
  return (
    <View style={s.compact}>
      <View style={s.compactHead}>
        <View {...decorative} style={[s.tile, { backgroundColor: t[art.ground] }]}><BArt name={art.name} {...size} /></View>
        <View style={s.grow2}>
          <Text accessibilityRole="header" style={[bType.title17, { color: t.text }]}>{title}</Text>
          {meta !== '' ? <Text style={[bType.note, { color: t.muted }]}>{meta}</Text> : null}
          {summary !== '' ? <Text style={[bType.note, { color: t.secondary }]}>{summary}</Text> : null}
        </View>
      </View>
      {revisited !== null ? <View style={s.compactPanel}><RevisitPanel lines={revisited} /></View> : null}
      {practise !== null || talk !== null ? (
        <View style={s.cardButtons}>
          {practise !== null ? <CardButton label={practise.label} accessibilityLabel={`${practise.label}, ${title}`} ground={t.lavender} locked={practise.locked} onPress={practise.onPress} /> : null}
          {talk !== null ? <CardButton label={talk.label} accessibilityLabel={`${talk.label}, ${title}. ${talk.uses}`} ground={t.inset} locked={talk.locked} onPress={talk.onPress} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** A 44pt centred text link: "Older conversations". */
export function PageLink({ label, disabled = false, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={s.pageLink}>
      <Text style={[bType.bold15, { color: t.link }]}>{label}</Text>
    </Press>
  );
}

// ─────────────────────────────────────────────────────────────── mix and saved

/** Mix your conversations: the blue card, the phrasebook, the trial pill when locked, the white chevron. */
export function MixCard({ title, line, locked, onPress }: { title: string; line: string; locked: boolean; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" depth="tile" accessibilityLabel={lockSaid(`${title}, ${line}`, locked)} onPress={onPress} style={s.mix}>
      <BArt name="phrasebook" width={62} height={57} />
      <View style={s.grow2}>
        <Text style={[bType.title17, { color: t.sun }]}>{title}</Text>
        {locked ? <LockBadge ground="card" said /> : null}
        <Text style={[bType.meta, { color: t.onBrandSoft }]}>{line}</Text>
      </View>
      <ChevronGlyph size={18} color={t.onBrand} />
    </Press>
  );
}

/** The two white saved tiles: Saved phrases, and Saved conversation text where it exists. */
export function SavedTiles({ tiles }: { tiles: readonly { key: string; title: string; line: string; onPress: () => void }[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.savedRow}>
      {tiles.map((tile) => (
        <Press key={tile.key} haptic="light" depth="tile" accessibilityLabel={`${tile.title}, ${tile.line}`} onPress={tile.onPress} frame={s.fill} style={s.savedTile}>
          <Text style={[bType.bold15, { color: t.text }]}>{tile.title}</Text>
          <Text style={[bType.note, { color: t.muted }]}>{tile.line}</Text>
        </Press>
      ))}
    </View>
  );
}

/** A white row card for a door the artboard does not draw (hear, say and compare). */
export function QuietRow({ title, line, onPress }: { title: string; line: string; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" depth="tile" accessibilityLabel={`${title}, ${line}`} onPress={onPress} style={s.quiet}>
      <View style={s.grow}>
        <Text style={[bType.bold15, { color: t.text }]}>{title}</Text>
        <Text style={[bType.note, { color: t.muted }]}>{line}</Text>
      </View>
      <ChevronGlyph size={18} color={t.text} />
    </Press>
  );
}

/** A quiet notice with its retry: a read that did not finish, or a page drawn from the phone. */
export function Notice({ title, body, action, disabled, onPress, live = false }: { title: string | null; body: string; action: string; disabled: boolean; onPress: () => void; live?: boolean }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.notice} {...(live ? { accessibilityLiveRegion: 'polite' as const } : {})}>
      {title !== null ? <Text style={[bType.bold16, { color: t.text }]}>{title}</Text> : null}
      <Text style={[bType.meta, { color: t.secondary }]}>{body}</Text>
      <BButton hug label={action} height={44} ground={t.quiet} ink={t.text} text={bType.bold15} disabled={disabled} onPress={onPress} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── the empty page

/** The new learner's card: the watering plant, the head, the line and the 54pt start. */
export function EmptyCard({ title, body, start, disabled, onStart, children }: { title: string; body: string; start: string; disabled: boolean; onStart: () => void; children?: ReactNode }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.empty}>
      <BArt name="watering-plant" width={180} height={164} />
      <Text accessibilityRole="header" style={[bType.section22, s.centred, { color: t.text }]}>{title}</Text>
      <Text style={[bType.para15, s.centred, { color: t.secondary }]}>{body}</Text>
      <View style={s.emptyStart}>
        <BButton label={start} height={54} ground={t.primary} ink={t.onPrimary} text={bType.bold17} icon={<BMic size={20} color={t.onPrimary} />} disabled={disabled} onPress={onStart} />
      </View>
      {children}
    </View>
  );
}

/** A 20/800 head over a short list. */
export function SubHead({ title }: { title: string }) {
  const t = useB();
  return <Text accessibilityRole="header" style={[bType.section20, { color: t.text }]}>{title}</Text>;
}

/** A Ready-now row: pastel ground, its drawing, two lines and a chevron. */
export function ReadyRow({ title, lines, art, ground, locked, disabled = false, onPress }: {
  title: string;
  lines: readonly string[];
  art: 'phrasebook' | 'voice-chat';
  ground: 'butter' | 'peach';
  locked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" depth="tile" accessibilityLabel={lockSaid([title, ...lines].join(', '), locked)} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.ready, { backgroundColor: t[ground] }]}>
      <BArt name={art} width={56} height={51} />
      <View style={s.grow2}>
        <Text style={[bType.bold16, { color: t.text }]}>{title}</Text>
        {lines.map((line) => <Text key={line} style={[bType.note, { color: t.secondary }]}>{line}</Text>)}
      </View>
      {locked ? <LockBadge form="round" said /> : null}
      <ChevronGlyph size={18} color={t.text} />
    </Press>
  );
}

/** The dashed saved box: the star jar and the line, a door to the phrasebook. */
export function SavedBox({ line, onPress }: { line: string; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" depth="tile" accessibilityLabel={line} onPress={onPress} style={s.savedBox}>
      <BArt name="star-jar" width={52} height={46} />
      <Text style={[bType.line15, s.grow, { color: t.secondary }]}>{line}</Text>
    </Press>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    grow2: { flex: 1, minWidth: 0, gap: 2 },
    fill: { flex: 1 },
    centred: { textAlign: 'center' },
    search: { minHeight: 50, borderRadius: 25, backgroundColor: t.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 },
    input: { flex: 1, minWidth: 0, minHeight: HIT },
    bleed: { marginRight: -GUTTER, flexGrow: 0 },
    tabs: { gap: 8, paddingRight: GUTTER },
    tab: { minHeight: 40, borderRadius: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
    resume: { backgroundColor: t.brand, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
    resumeDecor: { position: 'absolute', right: -30, top: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: t.violet2 },
    playDisc: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.sun, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    pattern: { backgroundColor: t.butter, borderRadius: 24, padding: 16, gap: 8 },
    patternEyebrow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
    patternRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    convHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minHeight: HIT },
    weekPill: { backgroundColor: t.sun, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
    large: { backgroundColor: t.card, borderRadius: 28, overflow: 'hidden', ...liftStyle },
    band: { backgroundColor: t.butter, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    largeBody: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { backgroundColor: t.inset, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12 },
    fixesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: t.butter, minHeight: HIT },
    steps: { gap: 8 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: t.lavender, minHeight: HIT },
    stepIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    revisit: { gap: 6 },
    talk: { minHeight: 52, borderRadius: 26, backgroundColor: t.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
    revisitPanel: { backgroundColor: t.mintWash, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, gap: 4 },
    compact: { backgroundColor: t.card, borderRadius: 24, overflow: 'hidden' },
    compactHead: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    tile: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
    compactPanel: { marginHorizontal: 16, marginBottom: 12 },
    cardButtons: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
    cardButton: { minHeight: HIT, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
    pageLink: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
    mix: { backgroundColor: t.brand, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
    savedRow: { flexDirection: 'row', gap: 8 },
    savedTile: { backgroundColor: t.card, borderRadius: 20, padding: 14, gap: 4, minHeight: HIT },
    quiet: { backgroundColor: t.card, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT },
    notice: { backgroundColor: t.card, borderRadius: 24, padding: 16, gap: 8 },
    empty: { backgroundColor: t.card, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
    emptyStart: { marginTop: 6, alignSelf: 'stretch' },
    ready: { borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: HIT },
    savedBox: { borderWidth: 2, borderStyle: 'dashed', borderColor: t.ring, borderRadius: 22, paddingVertical: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT },
  });
