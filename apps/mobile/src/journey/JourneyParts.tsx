/**
 * The parts Journey and Then and now are drawn from, to the B-Journey,
 * B-ThenNow and B-Empty-States artboards (DECISIONS.md UI-008, 2026-10-20), in
 * light and dark.
 *
 * Pure presentation: every word and every decision arrives as a prop from
 * `journey/journeyView.ts` or `journey/thenNowView.ts`, and every colour is a
 * `useB()` token, so the same part draws the artboard in light and the M3
 * mapping in dark. Glyphs are the artboard's own SVG paths. Marks (rings, dots,
 * bars, tiles) are decoration: the words beside them say what they mean.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { BArt, type BArtName } from '../art/BArt.tsx';
import { Highlight, Ledger, LedgerRow, LockBadge, Press } from '../components.tsx';
import type { LockedFeature } from '../access/featureAccess.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { CheckDisc } from '../today/TodayParts.tsx';
import { ChevronGlyph } from '../explore/ExploreParts.tsx';
import { HIT, bType, decorative, frenchText, space } from '../theme.ts';
import { HELD_TAG, type JourneyRoute, type ProgressView, type Segment, type StageStep, type YourFrenchView } from './journeyView.ts';

/** Words where the French runs are tagged as French. */
export function Words({ segments }: { segments: readonly Segment[] }) {
  return <>{segments.map((s, i) => (s.fr ? <Text key={i} {...frenchText}>{s.text}</Text> : s.text))}</>;
}

// ─────────────────────────────────────────────────────────────── glyphs

/** Practised with help: the sun ring with its deeper half arc. */
function HalfRing({ size, track, arc }: { size: number; track: string; arc: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill="none" stroke={track} strokeWidth={3} />
      <Path d="M12 2 A10 10 0 0 1 12 22" fill="none" stroke={arc} strokeWidth={3} />
    </Svg>
  );
}

/** Not started: the empty ring. */
function EmptyRing({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill="none" stroke={color} strokeWidth={3} />
    </Svg>
  );
}

/** The tick in a done stage node: `M5 12.5l4.5 4.5L19 7.5`, stroke 3. */
function NodeTick({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────── the band

/** The level row: the sun pill, the 8pt bar and "n of m XP" in tabular figures. */
export function LevelRow({ title, xp, bar }: { title: string; xp: string; bar: ReactNode }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.levelRow}>
      <View style={s.levelPill}><Text style={[bType.heavy14, { color: t.text }]}>{title}</Text></View>
      <View style={s.grow}>{bar}</View>
      <Text {...decorative} style={[bType.note, s.tabular, { color: t.onBrandSoft }]}>{xp}</Text>
    </View>
  );
}

/** One white stat tile on the band: the value 22 bold over its 12 label. */
export function BandStat({ value, label }: { value: string; label: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[bType.bold22, s.tabular, { color: t.text }]}>{value}</Text>
      <Text style={[bType.note12, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── sections

/** A 21/800 section head, its lock pill when the seam locked it, a right-hand note or link, and a subtitle. */
export function JourneyHead({ title, locked, feature, subtitle, right, link }: {
  title: string;
  locked: boolean;
  /** The feature the lock is for; required wherever `locked` can be true. */
  feature?: LockedFeature;
  subtitle?: string;
  right?: string;
  link?: { label: string; accessibilityLabel: string; onPress: () => void };
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.headRow}>
      <View style={s.headWords}>
        <View style={s.titleWrap}>
          <Text accessibilityRole="header" style={[bType.section21, { color: t.text }]}>{title}</Text>
          {locked && feature !== undefined ? <LockBadge feature={feature} /> : null}
        </View>
        {subtitle !== undefined ? <Text style={[bType.meta, { color: t.muted }]}>{subtitle}</Text> : null}
      </View>
      {right !== undefined ? <Text style={[bType.meta, { color: t.muted }]}>{right}</Text> : null}
      {link !== undefined ? (
        <Press haptic="light" accessibilityRole="link" accessibilityLabel={link.accessibilityLabel} onPress={link.onPress} style={s.link}>
          <Text style={[bType.bold15, { color: t.link }]}>{link.label}</Text>
        </Press>
      ) : null}
    </View>
  );
}

/** The white list card the Journey rows sit in: radius 22, padding 4 16. */
export function JourneyList({ children }: { children: ReactNode }) {
  const s = useThemedStyles(makeStyles);
  return <View style={s.list}>{children}</View>;
}

/** "Where you are": the five nodes on their track, and the move-up line under a hairline. */
export function StageTrack({ steps, fill, moveUp, hereWord }: { steps: readonly StageStep[]; fill: number; moveUp: string | null; hereWord: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.stageCard}>
      <View style={s.stageRow}>
        <View {...decorative} style={s.track} />
        <View {...decorative} style={[s.trackFill, { width: `${Math.min(80, fill * 100)}%` }]} />
        {steps.map((step) => {
          const here = step.state === 'here';
          return (
            <View key={step.label} style={s.stage} accessible accessibilityLabel={step.accessibilityLabel} accessibilityState={{ selected: here }}>
              <View style={here ? s.nodeRing : s.nodeSlot}>
                <View style={[s.node, step.state === 'ahead' ? s.nodeAhead : { backgroundColor: t.brand }]}>
                  {step.state === 'done'
                    ? <NodeTick size={18} color={t.onBrand} />
                    : <Text style={[here ? bType.heavy15 : bType.bold15, { color: step.state === 'ahead' ? t.muted : t.onBrand }]}>{step.number}</Text>}
                </View>
              </View>
              <Text style={[here ? bType.heavy12 : bType.note12, s.centred, { color: step.state === 'ahead' ? t.muted : t.text }]}>{step.label}</Text>
              {here ? <Text style={[bType.bold11, s.centred, { color: t.link }]}>{hereWord}</Text> : null}
            </View>
          );
        })}
      </View>
      {moveUp !== null ? <Text style={[bType.meta, s.hairline, { color: t.secondary }]}>{moveUp}</Text> : null}
    </View>
  );
}

/** One ability: its mark (check, half ring or empty ring), the can-do and its line. */
export function AbilityRow({ title, mark, line, accessibilityLabel, last }: { title: string; mark: 'earned' | 'helped' | 'none'; line: readonly Segment[]; accessibilityLabel: string; last: boolean }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.ability, !last && s.divider]} accessible accessibilityLabel={accessibilityLabel}>
      {mark === 'earned' ? <CheckDisc size={28} fill={t.mint} tick={t.onMint} />
        : mark === 'helped' ? <HalfRing size={28} track={t.sun} arc={t.sunDeep} />
        : <EmptyRing size={28} color={t.ring} />}
      <View style={[s.grow, s.gap2]}>
        <Text style={[bType.bold16, { color: t.text }]}>{title}</Text>
        <Text style={[mark === 'earned' ? bType.semi13 : bType.note, { color: mark === 'earned' ? t.mintWords : t.muted }]}><Words segments={line} /></Text>
      </View>
    </View>
  );
}

/** A first or best cell: its date label, an optional help bar, and the help word. */
export function TryCell({ label, help, tone, bar, size }: { label: string; help: string; tone: 'first' | 'best'; bar?: string; size: 'card' | 'scene' }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.cell, size === 'scene' && s.cellScene, { backgroundColor: tone === 'best' ? t.mintWash : t.inset }]}>
      <Text style={[bType.bold12, { color: tone === 'best' ? t.mintWords : t.muted }]}>{label}</Text>
      {bar !== undefined ? <View {...decorative} style={[s.bar, { backgroundColor: bar }]} /> : null}
      <Text style={[bType.semi14, { color: t.text }]}>{help}</Text>
    </View>
  );
}

/** The dashed cell in place of a best: "Try again to see your best here". */
export function DashedCell({ line }: { line: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.cell, s.dashed]}>
      <Text style={[bType.note, { color: t.muted }]}>{line}</Text>
    </View>
  );
}

/** A two-column grid. */
export function TwoUp({ children }: { children: ReactNode }) {
  const s = useThemedStyles(makeStyles);
  return <View style={s.twoUp}>{children}</View>;
}

/** A lavender chip of French used in conversation: 14/600, padding 6 10, radius 12. */
export function UsedChip({ fr, tag }: { fr: string; tag?: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.chip}>
      <Text {...frenchText} style={[bType.semi14, { color: t.text }]}>{fr}</Text>
      {tag !== undefined ? <Text style={[bType.note12, { color: t.muted }]}>{tag}</Text> : null}
    </View>
  );
}

/**
 * "Your French" (2026-10-22): the card the learner's own French sits on, first
 * under the band. It takes the theme's card in both modes; the highlighter is
 * the same pen on white and on the dark card (DESIGN.md, Highlight).
 */
export function YourFrenchCard({ children }: { children: ReactNode }) {
  const s = useThemedStyles(makeStyles);
  return <View style={s.list}>{children}</View>;
}

/** One part of Your French: its line or lines, opening its door. */
export function YourFrenchRow({ accessibilityLabel, onPress, last, children }: { accessibilityLabel: string; onPress: () => void; last: boolean; children: ReactNode }) {
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={[s.yourRow, !last && s.divider]}>
      {children}
    </Press>
  );
}

/** A Your French line: 15 regular, ink, French runs tagged. */
export function YourFrenchLine({ segments, soft = false }: { segments: readonly Segment[]; soft?: boolean }) {
  const t = useB();
  return <Text style={[soft ? bType.meta : bType.line15, { color: soft ? t.muted : t.text }]}><Words segments={segments} /></Text>;
}

/** The one highlighted phrase, and its words-only note when it held in a new situation. */
export function YourFeatured({ fr, tag }: { fr: string; tag: string | null }) {
  const t = useB();
  return (
    <View>
      <Highlight text={fr} />
      {tag !== null ? <Text style={[bType.note12, { color: t.muted }]}>{tag}</Text> : null}
    </View>
  );
}

/** The chips under the featured phrase. */
export function YourChips({ children }: { children: ReactNode }) {
  const s = useThemedStyles(makeStyles);
  return <View style={s.chips}>{children}</View>;
}

/**
 * Your French, whole (2026-10-22): its head, the card with the forward line or
 * the open parts, and a locked part's teaser under the card. The tab and the
 * dev preview draw it the same way. The open parts are drawn once each, in the
 * view's order, never in a .map, so the one highlighter stays one.
 */
export function YourFrenchSection({ view, onOpen, onTeaser }: { view: YourFrenchView; onOpen: (route: JourneyRoute) => void; onTeaser: (feature: LockedFeature) => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const yourPhrases = view.open.includes('phrases') ? view.phrases : null;
  const yourSounds = view.open.includes('sounds') ? view.sounds : null;
  const yourScenes = view.open.includes('scenes') ? view.scenes : null;
  const lastYourPart = view.open[view.open.length - 1];
  /** A locked part's one line (B-Journey): it opens the Wall, through the caller. */
  const teaser = (line: string, feature: LockedFeature) => (
    <Ledger>
      <LedgerRow title={line} accessibilityLabel={line} onPress={() => onTeaser(feature)} />
    </Ledger>
  );
  return (
    <View style={s.yourStack}>
      <JourneyHead title={view.heading} locked={false} />
      {(view.forward !== null || view.open.length > 0) && (
        <YourFrenchCard>
          {view.forward !== null && <Text style={[bType.line15, s.forward, { color: t.text }]}>{view.forward}</Text>}
          {yourPhrases !== null && (
            <YourFrenchRow last={lastYourPart === 'phrases'} onPress={() => onOpen(yourPhrases.route)} accessibilityLabel={yourPhrases.accessibilityLabel}>
              <YourFrenchLine segments={[{ text: yourPhrases.usedLine! }]} />
              {yourPhrases.heldLine !== null && <YourFrenchLine soft segments={[{ text: yourPhrases.heldLine }]} />}
              {yourPhrases.featured !== null && <YourFeatured fr={yourPhrases.featured.front} tag={yourPhrases.featured.held ? HELD_TAG : null} />}
              {yourPhrases.chips.length > 0 && <YourChips>{yourPhrases.chips.map((c) => <UsedChip key={c.front} fr={c.front} tag={c.held ? HELD_TAG : undefined} />)}</YourChips>}
              {yourPhrases.moreLine !== null && <YourFrenchLine soft segments={[{ text: yourPhrases.moreLine }]} />}
            </YourFrenchRow>
          )}
          {yourSounds !== null && (
            <YourFrenchRow last={lastYourPart === 'sounds'} onPress={() => onOpen(yourSounds.route)} accessibilityLabel={yourSounds.accessibilityLabel}>
              <YourFrenchLine segments={yourSounds.line!} />
            </YourFrenchRow>
          )}
          {yourScenes !== null && (
            <YourFrenchRow last={lastYourPart === 'scenes'} onPress={() => onOpen(yourScenes.route)} accessibilityLabel={yourScenes.accessibilityLabel}>
              <YourFrenchLine segments={[{ text: yourScenes.line }]} />
              <YourFrenchLine soft segments={yourScenes.titles.flatMap((title, k) => (k === 0 ? [{ text: title, fr: true as const }] : [{ text: ', ' }, { text: title, fr: true as const }]))} />
            </YourFrenchRow>
          )}
        </YourFrenchCard>
      )}
      {view.phrases?.teaser != null && teaser(view.phrases.teaser, view.phrases.feature)}
      {view.sounds?.teaser != null && teaser(view.sounds.teaser, view.sounds.feature)}
    </View>
  );
}

/** The mint "Help you needed" card with the tutor-orb. */
export function HelpCard({ heading, line, locked, feature, onPress, accessibilityLabel }: { heading: string; line: string; locked: boolean; feature: LockedFeature; onPress?: () => void; accessibilityLabel?: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const body = (
    <>
      <View {...decorative} style={s.helpOrb}><BArt name="tutor-orb" width={40} height={40} /></View>
      <View style={[s.grow, s.gap2]}>
        <View style={s.titleWrap}>
          <Text accessibilityRole="header" style={[bType.chip, { color: t.mintWords }]}>{heading}</Text>
          {locked ? <LockBadge feature={feature} ground="card" said /> : null}
        </View>
        <Text style={[bType.bold17Loose, { color: t.text }]}>{line}</Text>
      </View>
    </>
  );
  if (onPress === undefined) return <View style={s.help}>{body}</View>;
  return <Press haptic="light" accessibilityLabel={accessibilityLabel} onPress={onPress} style={s.help}>{body}</Press>;
}

/** A sound row: the 44pt letter tile, "As in …", its line, and the one Practise link. */
export function SoundRowView({ ipa, example, line, tile, last, practise }: {
  ipa: string | null;
  example: string | null;
  line: string;
  tile: 'peach' | 'lavender';
  last: boolean;
  practise: { label: string; accessibilityLabel: string; onPress: () => void } | null;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.soundRow, !last && s.divider]}>
      {ipa !== null ? <View {...decorative} style={[s.soundTile, { backgroundColor: t[tile] }]}><Text style={[bType.heavy16, { color: t.text }]}>{ipa}</Text></View> : null}
      <View style={[s.grow, s.gap2]}>
        {example !== null ? <Text style={[bType.bold15, { color: t.text }]}>As in “<Text {...frenchText}>{example}</Text>”</Text> : null}
        <Text style={[bType.note, { color: t.muted }]}>{line}</Text>
      </View>
      {practise !== null ? (
        <Press haptic="light" accessibilityRole="link" accessibilityLabel={practise.accessibilityLabel} onPress={practise.onPress} style={s.link}>
          <Text style={[bType.bold14, { color: t.link }]}>{practise.label}</Text>
        </Press>
      ) : null}
    </View>
  );
}

/**
 * "How it’s going" (2026-10-28, LEARN-013): Getting better at and Needs
 * another go, drawn as Your week's rows with Your French's chips. The tab and
 * the dev preview draw it the same way. A locked section shows its teaser.
 */
export function ProgressSection({ view, onOpen, onTeaser }: { view: ProgressView; onOpen: (route: JourneyRoute) => void; onTeaser: (feature: LockedFeature) => void }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.yourStack}>
      <JourneyHead title={view.heading} locked={view.locked} feature={view.feature} />
      {view.teaser !== null ? (
        <Ledger>
          <LedgerRow title={view.teaser} accessibilityLabel={view.teaser} onPress={() => onTeaser(view.feature)} />
        </Ledger>
      ) : (
        <JourneyList>
          {view.rows.map((row, i) => (
            <WeekRowView key={row.key} label={row.label} lines={row.lines} dot={row.dot} last={i === view.rows.length - 1}
              accessibilityLabel={row.accessibilityLabel} onPress={row.route === null ? undefined : () => onOpen(row.route!)}>
              {row.chips.length > 0 && <YourChips>{row.chips.map((fr) => <UsedChip key={fr} fr={fr} />)}</YourChips>}
            </WeekRowView>
          ))}
        </JourneyList>
      )}
    </View>
  );
}

/**
 * A week row: the 10pt dot, the 12/700 label and the 15 line. Opens its place
 * when given one. "How it’s going" draws its rows with it too, with more than
 * one line and its French chips under them.
 */
export function WeekRowView({ label, line, dot, last, onPress, lines, children, accessibilityLabel }: {
  label: string;
  line?: string;
  dot: 'mint' | 'sun' | 'brand';
  last: boolean;
  onPress?: () => void;
  lines?: readonly string[];
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const said = lines ?? (line !== undefined ? [line] : []);
  const body = (
    <>
      <View {...decorative} style={[s.dot, { backgroundColor: t[dot] }]} />
      <View style={s.grow}>
        <Text style={[bType.bold12, { color: t.muted }]}>{label}</Text>
        {said.map((text) => <Text key={text} style={[bType.line15, { color: t.text }]}>{text}</Text>)}
        {children}
      </View>
    </>
  );
  const label11y = accessibilityLabel ?? `${label}. ${said.join(' ')}`;
  return onPress !== undefined
    ? <Press haptic="light" accessibilityLabel={label11y} onPress={onPress} style={[s.weekRow, !last && s.divider]}>{body}</Press>
    : <View accessible accessibilityLabel={label11y} style={[s.weekRow, !last && s.divider]}>{body}</View>;
}

/** The Postcards (peach, cafe-table) and Badges (lavender, three discs and the flame) tiles. */
export function CollectionTile({ kind, title, line, onPress }: { kind: 'postcards' | 'badges'; title: string; line: string; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const postcards = kind === 'postcards';
  return (
    <Press haptic="light" accessibilityLabel={`${title}, ${line}`} onPress={onPress} frame={s.tileFrame} style={[s.tile, { backgroundColor: postcards ? t.peach : t.lavender }]}>
      <View {...decorative} style={[s.tileArt, { backgroundColor: postcards ? t.peachSoft : t.lavenderSoft }]}>
        {postcards ? <BArt name="cafe-table" width={70} height={64} style={s.postcardArt} /> : (
          <>
            <View style={[s.badge, { backgroundColor: t.sun }]}><BArt name="flame" width={18} height={22} /></View>
            <View style={[s.badge, { backgroundColor: t.brand }]} />
            <View style={[s.badge, { backgroundColor: t.mint }]} />
          </>
        )}
      </View>
      <View>
        <Text style={[bType.bold16, { color: t.text }]}>{title}</Text>
        <Text style={[bType.note, { color: t.secondary }]}>{line}</Text>
      </View>
    </Press>
  );
}

/** The empty journey: the butter card, the map-route drawing, its words and one start (B-Empty-States). */
export function EmptyJourneyCard({ eyebrow, title, body, children }: { eyebrow?: string | null; title: string; body: string; children: ReactNode }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.empty}>
      <BArt name="map-route" width={150} height={137} />
      {eyebrow ? <Text style={[bType.eyebrow, s.centred, { color: t.secondary }]}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={[bType.bold19, s.centred, { color: t.text }]}>{title}</Text>
      <Text style={[bType.para15, s.centred, { color: t.secondary }]}>{body}</Text>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── then and now

/** The 44pt white back button with the artboard's chevron. */
export function BackButton({ onPress }: { onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} style={s.back}>
      <ChevronGlyph size={20} color={t.text} back />
    </Press>
  );
}

/** "How much help you needed": four bars and their words, On your own in bold. */
export function HelpLegend({ label, bars }: { label: string; bars: readonly { word: string; bar: 'lavender' | 'periwinkle' | 'hint' | 'mint' }[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.legend}>
      <Text accessibilityRole="header" style={[bType.chip, { color: t.muted }]}>{label}</Text>
      <View style={s.legendRow}>
        {bars.map((b, i) => (
          <View key={b.word} style={s.legendCol}>
            <View {...decorative} style={[s.bar, s.full, { backgroundColor: t[b.bar] }]} />
            <Text style={[i === bars.length - 1 ? bType.bold12 : bType.note12, s.centred, { color: t.text }]}>{b.word}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A scene's head: its 48pt tile with the canvas icon, the French title and the status. */
export function SceneHead({ scene, status, earned, ground, icon }: { scene: string; status: string; earned: boolean; ground: 'sage' | 'butter' | 'lavender'; icon: { name: BArtName; width: number; height: number } }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.sceneHead}>
      <View {...decorative} style={[s.sceneTile, { backgroundColor: t[ground] }]}><BArt name={icon.name} width={icon.width} height={icon.height} /></View>
      <View style={s.grow}>
        <Text {...frenchText} style={[bType.title17, { color: t.text }]}>{scene}</Text>
        <Text style={[earned ? bType.semi13 : bType.note, { color: earned ? t.mintWords : t.muted }]}>{status}</Text>
      </View>
    </View>
  );
}

/** A scene card: radius 24, padding 16, gap 12; `row` for the one-line untried card. */
export function SceneCard({ children, row = false, accessibilityLabel }: { children: ReactNode; row?: boolean; accessibilityLabel?: string }) {
  const s = useThemedStyles(makeStyles);
  return <View style={row ? s.sceneRowCard : s.sceneCard} accessible={accessibilityLabel !== undefined} accessibilityLabel={accessibilityLabel}>{children}</View>;
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    gap2: { gap: 2 },
    full: { alignSelf: 'stretch' },
    centred: { textAlign: 'center' },
    tabular: { fontVariant: ['tabular-nums'] },
    divider: { borderBottomWidth: 1, borderBottomColor: t.line },
    // paddingVertical 14 deliberately matches the ability row's artboard value, so the two lists share a rhythm.
    yourRow: { gap: space(2), paddingVertical: 14, minHeight: HIT },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
    // The section's own stack, the tab's stack gap (MyFrenchTab st.stack).
    yourStack: { gap: space(3) },
    // 14 deliberately matches the Your French row it stands in for (yourRow).
    forward: { paddingVertical: 14 },
    hairline: { borderTopWidth: 1, borderTopColor: t.line, paddingTop: 10 },
    link: { minHeight: HIT, justifyContent: 'center', flexShrink: 0 },
    // The band.
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    levelPill: { backgroundColor: t.sun, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, flexShrink: 0 },
    stat: { flex: 1, minWidth: 0, backgroundColor: t.card, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
    // Section heads and lists.
    headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space(2) },
    headWords: { flex: 1, minWidth: 0, gap: 2 },
    titleWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
    list: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 4, paddingHorizontal: 16 },
    // Where you are.
    stageCard: { backgroundColor: t.card, borderRadius: 22, paddingTop: 16, paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
    stageRow: { flexDirection: 'row' },
    track: { position: 'absolute', left: '10%', right: '10%', top: 17, height: 4, borderRadius: 2, backgroundColor: t.stageTrack },
    trackFill: { position: 'absolute', left: '10%', top: 17, height: 4, borderRadius: 2, backgroundColor: t.brand },
    stage: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
    nodeSlot: { width: 38, height: 38 },
    // The current node's 4pt lavender ring sits outside its 38pt disc, as the box-shadow does.
    nodeRing: { width: 46, height: 46, borderRadius: 23, margin: -4, padding: 4, backgroundColor: t.lavender },
    node: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    nodeAhead: { backgroundColor: t.card, borderWidth: 2, borderColor: t.ring },
    // What you can do.
    ability: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, minHeight: HIT },
    // Then and now cells.
    twoUp: { flexDirection: 'row', gap: 8 },
    cell: { flex: 1, minWidth: 0, borderRadius: 14, padding: 10, gap: 2 },
    cellScene: { gap: 6 },
    bar: { height: 8, borderRadius: 4 },
    dashed: { borderWidth: 2, borderStyle: 'dashed', borderColor: t.ring, justifyContent: 'center', gap: 6 },
    // French used.
    chip: { backgroundColor: t.lavender, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
    // Help you needed.
    help: { backgroundColor: t.mintWash, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    helpOrb: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', flexShrink: 0 },
    // Sounds and week.
    soundRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: HIT },
    soundTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    weekRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, minHeight: HIT },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, flexShrink: 0 },
    // Collections.
    tileFrame: { flex: 1, minWidth: 0 },
    tile: { borderRadius: 22, padding: 14, gap: 8 },
    tileArt: { height: 64, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
    postcardArt: { marginTop: 8 },
    badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    // The empty journey.
    empty: { backgroundColor: t.butter, borderRadius: 26, paddingVertical: 20, paddingHorizontal: 18, alignItems: 'center', gap: 8 },
    // Then and now.
    back: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    legend: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
    legendRow: { flexDirection: 'row', gap: 6 },
    legendCol: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
    sceneHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sceneTile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    sceneCard: { backgroundColor: t.card, borderRadius: 24, padding: 16, gap: 12 },
    sceneRowCard: { backgroundColor: t.card, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16 },
  });
