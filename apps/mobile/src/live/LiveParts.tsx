/**
 * Shared parts of the live room (UI-014, direction D): the top bar, the glyphs,
 * the notebook's side controls and the Help sheet with its ladder and choices.
 * Pure presentation: every word and decision arrives as a prop, mostly from
 * `live/liveRoomView.ts`, and every colour is a `useB()` token.
 */

import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Press } from '../components.tsx';
import { TickGlyph } from '../explore/ExploreParts.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BMic, BSpeaker } from '../today/TodayParts.tsx';
import { HIT, bType, decorative, frenchText } from '../theme.ts';
import type { LadderStep } from './liveRoomView.ts';

// ─────────────────────────────────────────────────────────────── glyphs

/** The artboard's close cross, stroke 2.2. */
export function CloseGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** The keyboard (b-spec A6), stroke 1.8. */
export function KeyboardMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={6} width={19} height={12} rx={3} fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M6.5 10h1M10 10h1M13.5 10h1M17 10h.5M8 14h8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** The lightbulb of the Help control, stroke 1.8. */
export function BulbGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A small flag on its pole, stroke 1.8: the beta's "Report this reply". */
export function FlagGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 21V4M6 4h10l-2 4 2 4H6" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────── top

/**
 * The leave disc (drawn by the room, which owns its name), the scene's title
 * centred with its pace under it, and the room menu disc at the other end
 * (UI-014, direction D). The scene's line is drawn only when there is no pace,
 * so a scene shows two lines at most and the title stays the one to read.
 */
export function LiveTopBar({ leave, title, line, pace, report }: { leave: ReactNode; title: string; line: string | null; pace: string | null; report?: ReactNode }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const under = pace ?? line;
  return (
    <View style={s.top}>
      {leave}
      <View style={s.topWords}>
        <Text accessibilityRole="header" style={[bType.bold17, s.center, { color: t.onBrand }]}>{title}</Text>
        {under ? <Text style={[bType.meta, s.center, { color: t.onBrandSoft }]}>{under}</Text> : null}
      </View>
      {report ?? <View {...decorative} style={s.topSpace} />}
    </View>
  );
}


// ─────────────────────────────────────────────────────────────── controls

/**
 * A 56pt side control on the notebook sheet (UI-014, direction D): a `card`
 * disc, the caller's glyph in `text`, and its `meta` label in `text` under it.
 * The disc is decoration on the sheet; the glyph and the words name it.
 */
export function SideControl({ label, accessibilityLabel, icon, onPress, disabled = false, expanded }: {
  label: string; accessibilityLabel: string; icon: ReactNode; onPress: () => void; disabled?: boolean; expanded?: boolean;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.side}>
      <Press haptic="light" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled, ...(expanded === undefined ? {} : { expanded }) }}
        disabled={disabled} onPress={onPress} style={[s.sideDisc, disabled && s.disabled]}>
        {icon}
      </Press>
      <Text {...decorative} style={[bType.meta, s.center, { color: t.text }]}>{label}</Text>
    </View>
  );
}


// ─────────────────────────────────────────────────────────────── help sheet

/** One step of the ladder: mint with a tick when given, ink when current, quiet when ahead. */
function LadderPill({ step }: { step: LadderStep }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const ground = step.state === 'given' ? t.mintWash : step.state === 'current' ? t.primary : t.quiet;
  const ink = step.state === 'given' ? t.mintWords : step.state === 'current' ? t.onPrimary : t.muted;
  return (
    <View style={[s.ladderPill, { backgroundColor: ground }]}>
      {step.state === 'given' ? <TickGlyph size={12} color={ink} /> : null}
      <Text style={[step.state === 'ahead' ? bType.semi14 : bType.bold14, { color: ink }]}>{step.label}</Text>
    </View>
  );
}

/** Hint, Choices, Line given, joined by short rules. */
export function HelpLadder({ steps, spoken }: { steps: readonly LadderStep[]; spoken: string }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.ladder} accessible accessibilityLabel={spoken}>
      {steps.map((step, index) => (
        <View key={step.key} style={s.ladderStep}>
          {index > 0 ? <View {...decorative} style={s.ladderRule} /> : null}
          <LadderPill step={step} />
        </View>
      ))}
    </View>
  );
}

/** One choice row: the French, its English, and a speaker that hears it. */
export function ChoiceRow({ fr, en, onPress, onHear }: { fr: string; en: string; onPress?: () => void; onHear?: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const words = (
    <View style={s.choiceWords}>
      <Text {...frenchText} style={[bType.bold17, { color: t.text }]}>{fr}</Text>
      <Text style={[bType.note, { color: t.muted }]}>{en}</Text>
    </View>
  );
  return (
    <View style={s.choice}>
      {onPress ? <Press haptic="light" accessibilityLabel={`${fr}, ${en}`} onPress={onPress} frame={{ flex: 1 }} style={s.choicePress}>{words}</Press> : words}
      {onHear ? (
        <Press haptic="light" accessibilityLabel={`Hear ${fr}`} onPress={onHear} style={s.choiceHear}>
          <BSpeaker size={18} color={t.text} />
        </Press>
      ) : null}
    </View>
  );
}

/** The cream sheet (the M3 ground in dark): grabber, title and close, then its content. */
export function HelpSheet({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.sheet} accessibilityViewIsModal>
      <View {...decorative} style={s.grabber} />
      <View style={s.sheetHead}>
        <Text accessibilityRole="header" style={[bType.section21, { color: t.text }]}>{title}</Text>
        <Press haptic="none" accessibilityLabel={closeLabel} onPress={onClose} style={s.sheetClose}>
          <CloseGlyph size={18} color={t.text} />
        </Press>
      </View>
      {children}
    </View>
  );
}

/** "{tutor} asked": the line the learner is answering. */
export function AskedCard({ label, fr, en }: { label: string; fr: string; en: string | null }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.asked}>
      <Text style={[bType.bold12, { color: t.link }]}>{label}</Text>
      <Text style={[bType.line16, { color: t.text }]}>
        <Text {...frenchText} style={bType.bold16}>{fr}</Text>
        {en ? <Text style={{ color: t.muted }}>{` ${en}`}</Text> : null}
      </Text>
    </View>
  );
}

/** The 46pt outlined secondary in the sheet: "More help: show the line". */
export function SheetSecondary({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.secondary, disabled && s.disabled]}>
      <Text style={[bType.bold15, { color: t.text }]}>{label}</Text>
    </Press>
  );
}

/**
 * The 54pt primary, with the mic by default: "Say your choice". A primary
 * that does not open the mic ("Write to us") passes `icon={null}`, so the
 * green-means-you-speak mark never sits on something that is not speaking.
 */
export function SheetPrimary({ label, onPress, disabled = false, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: ReactNode }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.primary, disabled && s.disabled]}>
      {icon === undefined ? <BMic size={20} color={t.onPrimary} /> : icon}
      <Text style={[bType.bold17, { color: t.onPrimary }]}>{label}</Text>
    </Press>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    topWords: { flex: 1, minWidth: 0 },
    topSpace: { width: HIT, height: HIT },
    center: { textAlign: 'center' },
    side: { width: 72, alignItems: 'center', gap: 6 },
    sideDisc: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    disabled: { opacity: 0.55 },
    ladder: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 6 },
    ladderStep: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 6 },
    ladderRule: { width: 14, height: 2, backgroundColor: t.ring },
    ladderPill: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
    choice: { minHeight: 60, borderWidth: 2, borderColor: t.field, borderRadius: 18, backgroundColor: t.card, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 14, gap: 4 },
    choicePress: { minHeight: 56, justifyContent: 'center', paddingVertical: 10 },
    choiceWords: { flex: 1, gap: 2, paddingVertical: 10 },
    choiceHear: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
    sheet: { flexShrink: 1, backgroundColor: t.ground, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingHorizontal: 22, gap: 14 },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: t.ring },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetClose: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    asked: { backgroundColor: t.card, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
    secondary: { minHeight: 46, borderRadius: 23, backgroundColor: t.card, borderWidth: 2, borderColor: t.field, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
    primary: { minHeight: 54, borderRadius: 27, backgroundColor: t.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  });
}
