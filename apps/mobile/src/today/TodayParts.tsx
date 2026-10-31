/**
 * The parts Today is drawn from, to the B-Today artboard (DECISIONS.md UI-008,
 * 2026-10-20, artboard B-Today), in light and dark.
 *
 * Pure presentation: every word and every decision arrives as a prop from
 * `home/todayView.ts` or the screen, and every colour is a `useB()` token, so
 * the same part draws the artboard in light and the M3 mapping in dark. The
 * glyphs are the artboard's own SVG paths (b-spec A6). Marks are decoration:
 * the words beside them say what they mean.
 */

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { BArt } from '../art/BArt.tsx';
import { TutorPortrait } from '../tutor/TutorPortrait.tsx';
import { KeyboardMark } from '../live/LiveParts.tsx';
import type { TutorVoiceKey } from '@luvani/core';
import { LockBadge, Press } from '../components.tsx';
import type { LockedFeature } from '../access/featureAccess.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { COMING_UP_COPY } from '../home/todayView.ts';
import { HIT, bType, decorative, frenchText, space } from '../theme.ts';
import { SCENE_TILE, sceneTileSide } from '../responsiveLayout.ts';

// ─────────────────────────────────────────────────────────────── glyphs

/** The artboard's mic: a capsule and its stand, stroke 2. */
export function BMic({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={8.5} y={3} width={7} height={12} rx={3.5} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** The two-wave speaker (b-spec A6), filled cone and 1.8 waves. */
export function BSpeaker({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={color} />
      <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** The outline lock of Today's locked note (b-spec A6), stroke 2. */
export function OutlineLock({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={10} width={14} height={10} rx={2.5} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

/** The level disc's star: white, with an ink stroke. */
export function StarMark({ size, fill, stroke }: { size: number; fill: string; stroke: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

/** The check circle (b-spec A6): a mint disc and an ink tick. */
export function CheckDisc({ size, fill, tick }: { size: number; fill: string; tick: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill={fill} />
      <Path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke={tick} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A quest's ring: the lavender track, and the brand arc from the top to its fraction. */
export function QuestRing({ size, fraction, track, color }: { size: number; fraction: number; track: string; color: string }) {
  const r = 10;
  const around = 2 * Math.PI * r;
  const part = Math.max(0, Math.min(1, fraction)) * around;
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={r} fill="none" stroke={track} strokeWidth={3} />
      {part > 0 ? (
        <Circle cx={12} cy={12} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${part} ${around}`} transform="rotate(-90 12 12)" />
      ) : null}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────── pieces

/** A small 13/700 pill: the quests' XP and count, padding 3 8, radius 10. */
export function SmallPill({ label, ground }: { label: string; ground: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.smallPill, { backgroundColor: ground }]}>
      <Text style={[bType.chip, { color: t.text }]}>{label}</Text>
    </View>
  );
}

/**
 * A full-width or hugging button at the artboard's height: one press at the
 * touch floor or above, one spoken label, an optional leading glyph.
 */
export function BButton({ label, accessibilityLabel, height, ground, ink, text, icon, onPress, disabled = false, hug = false }: {
  label: string;
  accessibilityLabel?: string;
  height: number;
  ground: string;
  ink: string;
  text: StyleProp<TextStyle>;
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  /** Hug the words (padding 0 18) instead of filling the row. */
  hug?: boolean;
}) {
  const s = useThemedStyles(makeStyles);
  const shape: ViewStyle = { minHeight: Math.max(HIT, height), borderRadius: height / 2, backgroundColor: ground };
  return (
    <Press haptic="light" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} frame={hug ? s.hugFrame : undefined} style={[s.button, shape, hug && s.hug, disabled && s.disabled]}>
      {icon != null ? <View {...decorative}>{icon}</View> : null}
      <Text style={[text, s.buttonWords, { color: ink }]}>{label}</Text>
    </Press>
  );
}

// ─────────────────────────────────────────────────────────────── cards

export interface ComingUpCardView {
  title: string;
  when: string;
  locked: boolean;
  /** What Rehearse now opens, and so what the lock names (F910): RealMoment, a Max door. */
  feature: LockedFeature;
}

/**
 * A section's title outside its card (UI-015): 20/800, a header for screen
 * readers, with an optional trailing note ("1 of 3 done").
 */
export function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.titleRow}>
      <Text accessibilityRole="header" style={[bType.section20, s.titleWords, { color: t.text }]}>{title}</Text>
      {trailing}
    </View>
  );
}

/**
 * "Coming up" (founder, 2026-10-20; flattened for UI-015): one lavender card
 * under the caller's section title. The tutor (their portrait, or the shared
 * orb) beside the life event the tutor remembers and when, the plan's lock
 * when Rehearse now is locked, then Rehearse as the primary and Not now as a
 * quiet link. No checklist: nothing stores one yet (Phase C).
 */
export function ComingUpCard({ view, voice, onRehearse, onNotNow }: {
  view: ComingUpCardView;
  /** The learner's tutor, drawn as their portrait; absent, the shared orb. */
  voice?: TutorVoiceKey;
  onRehearse: () => void;
  onNotNow: () => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.comingUp, { backgroundColor: t.lavender }]}>
      <View style={s.comingHead}>
        <View style={s.orb} {...decorative}>{voice ? <TutorPortrait voice={voice} size={44} ring={t.text} /> : <BArt name="tutor-orb" width={44} height={44} />}</View>
        <View style={s.grow}>
          <Text style={[bType.heavy16, { color: t.text }]}>{view.title}</Text>
          <Text style={[bType.meta, { color: t.secondary }]}>{view.when}</Text>
          {view.locked ? <View style={s.pillGap}><LockBadge feature={view.feature} /></View> : null}
        </View>
      </View>
      <View style={s.actions}>
        <BButton hug label={COMING_UP_COPY.rehearse} height={44} ground={t.primary} ink={t.onPrimary} text={bType.bold15} onPress={onRehearse} />
        <Pressable accessibilityRole="button" accessibilityLabel={`${COMING_UP_COPY.notNow}, hide this for now`} onPress={onNotNow} style={s.textLink}>
          <Text style={[bType.semi14, { color: t.text }]}>{COMING_UP_COPY.notNow}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Your week in French (flattened for UI-015): one card under the caller's
 * section title, the sentence and the See your week link. `eyebrow` is kept
 * for callers that still pass it; the title is drawn outside now.
 */
export function WeekCard({ sentence, link, onLink }: { eyebrow?: string; sentence: string; link: string; onLink: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.week, { backgroundColor: t.card }]}>
      <Text style={[bType.line15, s.weekWords, { color: t.text }]}>{sentence}</Text>
      <Pressable accessibilityRole="link" accessibilityLabel={link} onPress={onLink} style={s.weekLink}>
        <Text style={[bType.bold14, { color: t.text }]}>{link}</Text>
      </Pressable>
    </View>
  );
}

/**
 * The scene hero (UI-015), drawn on the hero card's ground with no card of its
 * own: a 108 by 84 art tile on butter beside the eyebrow ("Next scene, 2 of
 * 3"), the title and the time, the "Uses" chip when the last conversation
 * really meets the scene, then the 54pt primary Start and the other mode as an
 * underlined link. The caller owns the gated start; this draws it, its check
 * and the tutor-unreachable answer with the same start again.
 *
 * The words sit beside the tile while the card is wide enough
 * (`sceneTileSide`); on a narrow card or at large text the tile goes above
 * full-width words. The first frame guesses from the window, then the card's
 * own width decides.
 */
export function SceneLead({ eyebrow, title, french, rest, uses, start, other, checking, heldBack }: {
  eyebrow: string;
  title: string;
  french: string | null;
  rest: string;
  uses: { before: string; french: string; after: string } | null;
  /** The mode picks the icon: a keyboard for typing, a mic for speaking (F941). */
  start: { label: string; mode: 'speak' | 'type'; accessibilityLabel: string; disabled: boolean; onPress: () => void };
  /** The other mode, as a quiet link under the Start. */
  other: { label: string; disabled: boolean; onPress: () => void };
  /** The connection check's line while it runs, or null. */
  checking: string | null;
  /** A start the tutor could not take: the sentence and the same start again. */
  heldBack: { body: string; retry: string; disabled: boolean; onRetry: () => void } | null;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const side = sceneTileSide(measured ?? windowWidth - HERO_INSET, fontScale);
  return (
    <View style={s.lead} onLayout={(event) => setMeasured(Math.round(event.nativeEvent.layout.width))}>
      <View style={side ? s.leadSide : s.leadStacked}>
        <View {...decorative} style={[s.leadTile, { backgroundColor: t.butter }]}>
          <BArt name="cafe-table" width={SCENE_ART.width} height={SCENE_ART.height} />
        </View>
        <View style={side ? s.grow : undefined}>
          <Text style={[bType.eyebrow, { color: t.link }]}>{eyebrow}</Text>
          <Text accessibilityRole="header" style={[bType.stat24, { color: t.text }]}>{title}</Text>
          <Text style={[bType.meta, { color: t.muted }]}>
            {french !== null ? <Text {...frenchText}>{french}</Text> : null}
            {rest}
          </Text>
        </View>
      </View>
      {uses !== null ? (
        <View style={[s.usesChip, { backgroundColor: t.inset }]}>
          <Text style={[bType.chip, { color: t.text }]}>
            {uses.before}<Text {...frenchText}>{uses.french}</Text>{uses.after}
          </Text>
        </View>
      ) : null}
      <View style={s.leadFoot}>
        <BButton label={start.label} accessibilityLabel={start.accessibilityLabel} height={54} ground={t.primary} ink={t.onPrimary} text={bType.bold16} icon={start.mode === 'type' ? <KeyboardMark size={20} color={t.onPrimary} /> : <BMic size={20} color={t.onPrimary} />} disabled={start.disabled} onPress={start.onPress} />
        <Pressable accessibilityRole="button" accessibilityLabel={other.label} accessibilityState={{ disabled: other.disabled }} disabled={other.disabled} onPress={other.onPress} style={s.otherMode}>
          <Text style={[bType.semi14, { color: t.text, textDecorationLine: 'underline' }]}>{other.label}</Text>
        </Pressable>
        {checking !== null ? <Text accessibilityLiveRegion="polite" style={[bType.meta, s.centred, { color: t.text }]}>{checking}</Text> : null}
        {heldBack !== null ? (
          <View style={s.heldBack}>
            <Text style={[bType.line16, { color: t.text }]}>{heldBack.body}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={heldBack.retry} accessibilityState={{ disabled: heldBack.disabled }} disabled={heldBack.disabled} onPress={heldBack.onRetry} style={s.otherMode}>
              <Text style={[bType.bold16, { color: t.text, textDecorationLine: 'underline' }]}>{heldBack.retry}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The hero card's margins and padding, for the first frame: 16 + 16 + 18 + 18. */
const HERO_INSET = 68;
/** The café inside its 108 by 84 tile (board: 100 by 80, the drawing's own aspect). */
const SCENE_ART = { width: 87, height: 80 } as const;

/**
 * Today's phrase on the lavender card: the eyebrow, the French over its
 * English, the 48pt brand speaker (only when a bundled clip exists, and it
 * says Stop while it sounds), and the white "Say it yourself".
 */
export function PhraseCard({ eyebrow, fr, en, hearLabel, onHear, playing, sayLabel, sayAccessibilityLabel, onSay, note }: {
  eyebrow: string;
  fr: string;
  en: string;
  hearLabel: string;
  onHear?: () => void;
  playing: boolean;
  sayLabel: string;
  sayAccessibilityLabel: string;
  onSay: () => void;
  note: string;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.phrase}>
      <Text style={[bType.eyebrow, { color: t.link }]}>{eyebrow}</Text>
      <View style={s.phraseRow}>
        <View style={s.phraseWords}>
          <Text {...frenchText} selectable style={[bType.bold22, { color: t.text }]}>{fr}</Text>
          <Text style={[bType.line15, { color: t.secondary }]}>{en}</Text>
        </View>
        {onHear !== undefined ? (
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Stop' : hearLabel} accessibilityState={{ busy: playing }} onPress={onHear} style={s.speaker}>
            <BSpeaker size={22} color={t.onBrand} />
          </Pressable>
        ) : null}
      </View>
      <BButton label={sayLabel} accessibilityLabel={sayAccessibilityLabel} height={46} ground={t.card} ink={t.text} text={bType.bold16} onPress={onSay} />
      {note !== '' ? <Text accessibilityLiveRegion="polite" style={[bType.note, { color: t.secondary }]}>{note}</Text> : null}
    </View>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    smallPill: { paddingVertical: 3, paddingHorizontal: space(2), borderRadius: 10, flexShrink: 0 },
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2.5), paddingHorizontal: space(4) },
    buttonWords: { textAlign: 'center', flexShrink: 1 },
    hugFrame: { alignSelf: 'flex-start' },
    hug: { paddingHorizontal: 18 },
    disabled: { opacity: 0.6 },
    titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space(3), marginBottom: 10 },
    titleWords: { flexShrink: 1, minWidth: 0 },
    comingUp: { borderRadius: 24, padding: space(4), gap: 10 },
    comingHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
    orb: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
    pillGap: { marginTop: space(1) },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(4) },
    textLink: { minHeight: HIT, justifyContent: 'center' },
    week: { borderRadius: 24, padding: space(4), flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space(3) },
    weekWords: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
    weekLink: { minHeight: HIT, justifyContent: 'center' },
    lead: { gap: space(1) },
    leadSide: { flexDirection: 'row', alignItems: 'center', gap: SCENE_TILE.gap },
    leadStacked: { gap: SCENE_TILE.gap },
    leadTile: { width: SCENE_TILE.width, height: SCENE_TILE.height, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    usesChip: { marginTop: 6, alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12 },
    leadFoot: { marginTop: space(2), gap: space(1) },
    centred: { textAlign: 'center' },
    heldBack: { gap: space(1) },
    otherMode: { minHeight: HIT, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: space(2) },
    phrase: { backgroundColor: t.lavender, borderRadius: 26, padding: 18, gap: 10 },
    phraseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
    phraseWords: { flex: 1, minWidth: 0, gap: 2 },
    speaker: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.brand, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  });
