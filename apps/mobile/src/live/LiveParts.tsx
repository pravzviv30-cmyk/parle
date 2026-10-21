/**
 * The parts the live room is drawn from, to the B-Live and B-LiveHelp
 * artboards (2026-10-21 UI-008), in light and dark.
 *
 * The room keeps its blue ground in both themes (the brand); the bubbles and
 * the help sheet follow the theme: cream in light, the M3 ground in dark.
 * Pure presentation: every word and every decision arrives as a prop, mostly
 * from `live/liveRoomView.ts`, and every colour is a `useB()` token. Marks are
 * decoration; the words beside them say what they mean.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { BArt } from '../art/BArt.tsx';
import { Press } from '../components.tsx';
import { TickGlyph } from '../explore/ExploreParts.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BMic, BSpeaker } from '../today/TodayParts.tsx';
import { HIT, bType, decorative, frenchText } from '../theme.ts';
import type { GoalChip, LadderStep } from './liveRoomView.ts';
import { tickAnnouncement } from '../tutor/taskTicks.ts';
import { useAppActive, useOrbAudio } from './OrbAudio.tsx';
import { orbLayers } from '../tutor/orbLayers.ts';
import { OrbPulse } from '../tutor/OrbPulse.tsx';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import { useReduceMotion } from '../motion.ts';

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

// ─────────────────────────────────────────────────────────────── top

/** The leave disc (drawn by the room, which owns its name), the scene's title and line, and the pace pill. */
export function LiveTopBar({ leave, title, line, pace }: { leave: ReactNode; title: string; line: string | null; pace: string | null }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.top}>
      {leave}
      <View style={s.topWords}>
        <Text accessibilityRole="header" style={[bType.bold17, { color: t.onBrand }]}>{title}</Text>
        {line ? <Text style={[bType.note, { color: t.onBrandSoft }]}>{line}</Text> : null}
      </View>
      {pace ? <View style={s.pace}><Text style={[bType.chip, { color: t.onBrand }]}>{pace}</Text></View> : null}
    </View>
  );
}

/** The goals strip: a mint tick for done, a sun ring for now, a soft ring for to do. */
export function GoalsStrip({ chips }: { chips: readonly GoalChip[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  // A goal reached while the strip is on screen is said once, in its own
  // words (tutor/taskTicks.ts). Goals already done at first sight are not.
  const firstLook = useRef<Set<string> | null>(null);
  const said = useRef(new Set<string>());
  const signature = chips.map((chip) => `${chip.id}:${chip.state}`).join('|');
  useEffect(() => {
    if (chips.length === 0) return;
    const done = chips.filter((chip) => chip.state === 'done');
    if (firstLook.current === null) { firstLook.current = new Set(done.map((chip) => chip.id)); return; }
    const fresh = done.filter((chip) => !firstLook.current!.has(chip.id) && !said.current.has(chip.id));
    for (const chip of fresh) said.current.add(chip.id);
    const line = tickAnnouncement(fresh.map((chip) => chip.label));
    if (line !== null) AccessibilityInfo.announceForAccessibility(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  if (chips.length === 0) return null;
  return (
    <View style={s.goals} accessibilityRole="list" accessibilityLabel="Goals in this scene">
      {chips.map((chip) => (
        <View key={chip.id} style={s.goal} accessible accessibilityLabel={chip.spoken}>
          {chip.state === 'done'
            ? <View style={s.goalDone}><TickGlyph size={12} color={t.onMint} /></View>
            : <View style={[s.goalRing, chip.state === 'current' ? s.goalRingNow : s.goalRingLater]} />}
          <Text style={[chip.state === 'current' ? bType.bold14 : bType.meta, { color: chip.state === 'current' ? t.onBrand : t.onBrandSoft },
            chip.state === 'done' && s.struck]}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The tutor's orb: two rings and the tutor-orb art, with the state in words
 * under it. The art pulses with the room's measured levels, exactly as the C2
 * sphere did (BoldVoiceOrb): the mic's while it records, the tutor's while it
 * speaks, still otherwise. Never a fabricated meter.
 */
export function LiveOrb({ caption, size, state, active }: { caption: string; size: 'full' | 'small'; state: OrbState; active: boolean }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const audio = useOrbAudio();
  const foreground = useAppActive();
  const reduced = useReduceMotion();
  const layers = orbLayers({ state, room: audio?.room ?? null, reduced, paused: !active || !foreground });
  const input = layers.ring && audio !== null;
  const output = layers.bars === 'live' && audio !== null;
  const outer = size === 'full' ? 200 : 96;
  return (
    <View style={s.orbBlock}>
      <View {...decorative} style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[s.ring, { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: t.orbRing }]} />
        <View style={[s.ring, { width: outer * 0.82, height: outer * 0.82, borderRadius: outer * 0.41, backgroundColor: t.violet2 }]} />
        <OrbPulse level={input ? audio.input : output ? audio.output : null} on={input || output}>
          <BArt name="tutor-orb" width={outer * 0.64} height={outer * 0.64} style={{ borderRadius: outer * 0.32, overflow: 'hidden' }} />
        </OrbPulse>
      </View>
      <Text accessibilityLiveRegion="polite" style={[bType.bold18, s.center, { color: t.onBrand }]}>{caption}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── bubbles

/** The tutor's bubble: name, French, English, and a 44pt hear button. */
export function TutorBubble({ name, fr, en, onHear }: { name: string; fr: string; en: string | null; onHear?: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.tutorBubble}>
      <View style={s.bubbleWords}>
        <Text style={[bType.bold12, { color: t.link }]}>{name}</Text>
        <Text {...frenchText} style={[bType.bold19, { color: t.text }]}>{fr}</Text>
        {en ? <Text style={[bType.meta, { color: t.muted }]}>{en}</Text> : null}
      </View>
      {onHear ? (
        <Press haptic="light" depth="tile" accessibilityLabel="Hear it again" onPress={onHear} style={s.hear}>
          <BSpeaker size={18} color={t.text} />
        </Press>
      ) : null}
    </View>
  );
}

/** The learner's bubble, in sun, on the right. */
export function YouBubble({ text }: { text: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.youBubble}>
      <Text style={[bType.bold12, { color: t.onMint }]}>You</Text>
      <Text {...frenchText} style={[bType.bold17, { color: t.onMint }]}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── controls

/** A 56pt deep-blue side control with its 12/600 label under it. */
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
      <Text {...decorative} style={[bType.semi12, { color: t.onBrandSoft }]}>{label}</Text>
    </View>
  );
}

/** The 84pt sun mic with its rim, and the mic's state in words under it. */
export function MicControl({ label, accessibilityLabel, onPress, disabled = false }: { label: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.micColumn}>
      <Press haptic="light" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.mic, disabled && s.disabled]}>
        <BMicHeavy color={t.onMint} />
      </Press>
      <Text {...decorative} style={[bType.bold12, { color: t.onBrand }]}>{label}</Text>
    </View>
  );
}

function BMicHeavy({ color }: { color: string }) {
  return (
    <Svg {...decorative} width={32} height={32} viewBox="0 0 24 24">
      <Rect x={8.5} y={3} width={7} height={12} rx={3.5} fill="none" stroke={color} strokeWidth={2.2} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
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

/** The 54pt primary with the mic: "Say your choice". */
export function SheetPrimary({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.primary, disabled && s.disabled]}>
      <BMic size={20} color={t.onPrimary} />
      <Text style={[bType.bold17, { color: t.onPrimary }]}>{label}</Text>
    </Press>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    topWords: { flex: 1, minWidth: 0 },
    pace: { backgroundColor: t.violetDeep, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12 },
    goals: { marginTop: 14, backgroundColor: t.violetDeep, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8 },
    goal: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
    goalDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: t.mint, alignItems: 'center', justifyContent: 'center' },
    goalRing: { width: 22, height: 22, borderRadius: 11 },
    goalRingNow: { borderWidth: 2.5, borderColor: t.sun },
    goalRingLater: { borderWidth: 2, borderColor: t.violet2 },
    struck: { textDecorationLine: 'line-through' },
    orbBlock: { alignItems: 'center', gap: 10, marginTop: 22 },
    ring: { position: 'absolute' },
    center: { textAlign: 'center' },
    tutorBubble: { backgroundColor: t.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderBottomLeftRadius: 6, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    bubbleWords: { flex: 1, gap: 4 },
    hear: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.lavender, alignItems: 'center', justifyContent: 'center' },
    youBubble: { alignSelf: 'flex-end', maxWidth: 270, backgroundColor: t.sun, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 6, borderBottomLeftRadius: 22, paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
    side: { width: 72, alignItems: 'center', gap: 4 },
    sideDisc: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.violetDeep, alignItems: 'center', justifyContent: 'center' },
    micColumn: { alignItems: 'center', gap: 4 },
    mic: { width: 84, height: 84, borderRadius: 42, borderWidth: 6, borderColor: t.orbRing, backgroundColor: t.sun, alignItems: 'center', justifyContent: 'center' },
    disabled: { opacity: 0.55 },
    ladder: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 6 },
    ladderStep: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 6 },
    ladderRule: { width: 14, height: 2, backgroundColor: t.ring },
    ladderPill: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
    choice: { minHeight: 60, borderWidth: 2, borderColor: t.line, borderRadius: 18, backgroundColor: t.card, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 14, gap: 4 },
    choicePress: { minHeight: 56, justifyContent: 'center', paddingVertical: 10 },
    choiceWords: { flex: 1, gap: 2, paddingVertical: 10 },
    choiceHear: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
    sheet: { flexShrink: 1, backgroundColor: t.ground, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingHorizontal: 22, gap: 14 },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: t.ring },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetClose: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    asked: { backgroundColor: t.card, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
    secondary: { minHeight: 46, borderRadius: 23, backgroundColor: t.card, borderWidth: 2, borderColor: t.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
    primary: { minHeight: 54, borderRadius: 27, backgroundColor: t.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  });
}
