/**
 * The parts onboarding is drawn from, to the B-OB-* artboards (DECISIONS.md
 * UI-008, 2026-10-21, artboards B-OB-Welcome, B-Question, B-OB-Q2 to Q6,
 * B-OB-Plan, B-OB-Tutor, B-OB-Ready, B-OB-FirstScene, B-OB-Consent).
 *
 * Onboarding stays pinned light (founder decision): every colour is a `useB()`
 * token and the onboarding tree sits outside the main appearance provider, so
 * `useB()` resolves to `b.light` here. Pure presentation: every word and every
 * decision arrives as a prop. Drawings and glyphs are decoration; the words
 * beside them carry the meaning (surfaceContract J6).
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { BArt, type BArtName } from '../art/BArt.tsx';
import { Press, RoundButton } from '../components.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { HIT, bType, decorative, frenchText } from '../theme.ts';
import { WELCOME_BUBBLE_SPOTS, WELCOME_STAGE, welcomeStageScale } from '../responsiveLayout.ts';
import type { C2QuestionPage } from './c2QuestionScenes.ts';
import { useOnboardingTopInset } from './OnboardingLayout.tsx';

// ─────────────────────────────────────────────────────────────── glyphs

/** The artboards' tick in a disc or box: `M5 12.5l4.5 4.5L19 7.5`, stroke 3. */
export function BTick({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The welcome button's arrow, stroke 2.4. */
export function BArrow({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** "Your tutor is AI": the shield with a tick (B-OB-Ready). */
export function BShield({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** "Speak when you choose": the mic at stroke 1.8 (B-OB-Ready). */
export function BMicThin({ size, color, stroke = 1.8 }: { size: number; color: string; stroke?: number }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={8.5} y={3} width={7} height={12} rx={3.5} fill="none" stroke={color} strokeWidth={stroke} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
    </Svg>
  );
}

/** "Your voice is not stored": a waveform with a slash (B-OB-Ready). */
export function BVoiceOff({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 12h1M7.5 8v8M11 5v14M14.5 8v8M18 10.5v3M20 12h0" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M3 3l18 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** The keyboard of "Type instead" (b-spec A6). */
export function BKeyboard({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={6} width={19} height={12} rx={3} fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M6.5 10h1M10 10h1M13.5 10h1M17 10h.5M8 14h8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────── bands

export type BandTone = 'sun' | 'brand' | 'mint';

/** What sits on each band: the progress track and fill, the count, the halo and the status bar. */
export function bandColours(t: B, tone: BandTone) {
  if (tone === 'brand') return { ground: t.brand, track: t.violet2, fill: t.sun, ink: t.onBrand, soft: t.onBrandSoft, halo: t.violet2, statusBar: 'light' as const };
  return { ground: tone === 'sun' ? t.sun : t.mint, track: t.card, fill: t.brand, ink: t.text, soft: t.text, halo: tone === 'sun' ? t.haloSun : t.haloMint, statusBar: 'dark' as const };
}

/** Each question's band, halo drawing and size (b-spec B-Question, B-OB-Q2 to Q6). */
export const QUESTION_BANDS: Readonly<Record<C2QuestionPage, { tone: BandTone; art: BArtName; width: number; height: number }>> = {
  reason: { tone: 'sun', art: 'voice-chat', width: 166, height: 152 },
  interests: { tone: 'brand', art: 'phrasebook', width: 170, height: 150 },
  'start-level': { tone: 'mint', art: 'watering-plant', width: 166, height: 152 },
  confidence: { tone: 'sun', art: 'coffee-break', width: 170, height: 156 },
  time: { tone: 'brand', art: 'clock-calendar', width: 170, height: 150 },
  focus: { tone: 'mint', art: 'star-jar', width: 176, height: 150 },
};

/**
 * The question band: the 6 high progress bar and "n of 6", then the halo and
 * its drawing. The artboard's back disc holds the Back chevron when `onBack`
 * is given (F915, LR-13, 2026-10-29, superseding F352's "no visible back"),
 * and otherwise keeps its 44 place empty.
 */
export function BQuestionBand({ page, step, total, onBack }: { page: C2QuestionPage; step: number; total: number; onBack?: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const top = useOnboardingTopInset();
  const band = QUESTION_BANDS[page];
  const k = bandColours(t, band.tone);
  const fraction = Math.max(0, Math.min(1, step / total));
  return (
    <View style={[s.questionBand, { backgroundColor: k.ground, paddingTop: top + 14 }]}>
      <View style={s.progressRow}>
        {onBack ? <RoundButton kind="back" accessibilityLabel="Back" onPress={onBack} /> : <View style={s.backSpace} />}
        <View accessibilityRole="progressbar" accessibilityLabel="Onboarding"
          accessibilityValue={{ min: 0, max: total, now: step, text: `Onboarding, step ${step} of ${total}` }}
          style={[s.track, { backgroundColor: k.track }]}>
          <View style={[s.fill, { width: `${fraction * 100}%`, backgroundColor: k.fill }]} />
        </View>
        <Text {...decorative} style={[bType.bold14, { color: k.ink }]}>{`${step} of ${total}`}</Text>
      </View>
      <View {...decorative} style={s.haloRow}>
        <View style={[s.halo, { backgroundColor: k.halo }]} />
        <BArt name={band.art} width={band.width} height={band.height} />
      </View>
    </View>
  );
}

/**
 * The top of a page with no band (the welcome): the clock's inset plus the
 * artboard's own top padding.
 */
export function BTopSpace({ extra }: { extra: number }) {
  return <View style={{ height: useOnboardingTopInset() + extra }} />;
}

/**
 * A band with the 40 bottom corners that heads Plan, Tutor, Ready, First scene
 * and Save your plan. `art` is placed from just under the clock.
 */
export function BBand({ tone, children, art, style, onBack }: {
  tone: BandTone;
  /** Draws the Back chevron in the artboard's back disc (F915); without it the place stays empty. */
  onBack?: () => void;
  children: ReactNode;
  /** Absolutely placed decoration (circle and drawing), drawn behind the words. */
  art?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const top = useOnboardingTopInset();
  const k = bandColours(t, tone);
  return (
    <View style={[s.band, { backgroundColor: k.ground, paddingTop: top + 14 }, style]}>
      {art != null ? <View {...decorative} style={[StyleSheet.absoluteFill, { top }]}>{art}</View> : null}
      {/* The artboard's back disc: the Back chevron after the first step (F915), otherwise an empty place. */}
      {onBack ? <RoundButton kind="back" accessibilityLabel="Back" onPress={onBack} /> : <View style={s.backSpace} />}
      {children}
    </View>
  );
}

/** A decorative disc placed on a band (the artboards' violet circles behind a drawing). */
export function BBandDisc({ size, right, top, color }: { size: number; right: number; top: number; color: string }) {
  return <View {...decorative} style={{ position: 'absolute', right, top, width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** The canvas tutor orb, clipped round and placed on a band (B-OB-Ready). Never a face. */
export function BBandOrb({ size, right, top }: { size: number; right: number; top: number }) {
  return (
    <View {...decorative} style={{ position: 'absolute', right, top, width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <BArt name="tutor-orb" width={size} height={size} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── choices

/**
 * One answer row (b-spec B-Question, B-OB-Q2 to Q6). Selected rows fill with
 * the brand and carry a sun tick (a disc for one answer, a rounded square for
 * several); unselected rows are white with an empty ring or box. The glyph and
 * the checked state both say it, never colour alone.
 */
export function BOption({ title, detail, icon, selected, multiple = false, onPress }: {
  title: string;
  detail?: string;
  /** Q1's small drawing at the left of the row. */
  icon?: { name: BArtName; width: number; height: number };
  selected: boolean;
  multiple?: boolean;
  onPress: () => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const compact = detail == null;
  const ink = selected ? t.onBrand : t.text;
  const mark = compact ? 24 : 26;
  return (
    <Press haptic="selection" accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected }} aria-checked={selected}
      accessibilityLabel={detail ? `${title}. ${detail}` : title} onPress={onPress} glowRadius={18} frame={{ borderRadius: 18 }}
      style={[compact ? s.optionCompact : s.option, { backgroundColor: selected ? t.brand : t.card }]}>
      {icon ? <View {...decorative} style={s.optionIcon}><BArt name={icon.name} width={icon.width} height={icon.height} /></View> : null}
      <View style={s.optionWords}>
        <Text style={[compact ? bType.semi17 : bType.title17, { color: ink }]}>{title}</Text>
        {detail ? <Text style={[bType.meta, { color: selected ? t.onBrandSoft : t.muted }]}>{detail}</Text> : null}
      </View>
      <View {...decorative} style={s.optionMark}>
        {selected ? (
          <View style={{ width: mark, height: mark, borderRadius: multiple ? 8 : mark / 2, backgroundColor: t.sun, alignItems: 'center', justifyContent: 'center' }}>
            <BTick size={16} color={t.text} />
          </View>
        ) : (
          <View style={{ width: 22, height: 22, borderRadius: multiple ? 4 : 11, borderWidth: 2, borderColor: t.field }} />
        )}
      </View>
    </Press>
  );
}

/** Q1's option drawings (b-spec B-Question); a reason with no drawing keeps its row without one. */
export const REASON_ICONS: Readonly<Record<string, { name: BArtName; width: number; height: number }>> = {
  trip: { name: 'icon-suitcase', width: 26, height: 30 },
  food: { name: 'icon-cafe', width: 30, height: 28 },
  family: { name: 'icon-friends', width: 32, height: 26 },
  moving: { name: 'icon-house', width: 30, height: 28 },
  work: { name: 'icon-briefcase', width: 30, height: 24 },
};

// ─────────────────────────────────────────────────────────────── welcome

/** friends-cheer's cloud sits 19.5 units left of its frame; show 24 so it is never cut (2026-10-21 simulator check). */
export const WELCOME_BLEED = 24;

/** The welcome's art area: halo, sun disc, shadow, the friends drawing, confetti and three speech bubbles. */
export function BWelcomeArt() {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const confetti: { left: number; top: number; size: number; color: string; rotate: string }[] = [
    { left: 30, top: 110, size: 12, color: t.sun, rotate: '20deg' },
    { left: 344, top: 128, size: 10, color: t.mint, rotate: '45deg' },
    { left: 40, top: 286, size: 9, color: t.peach, rotate: '30deg' },
    { left: 190, top: 0, size: 8, color: t.periwinkle, rotate: '45deg' },
  ];
  // F921: the 390-wide artboard scales about its middle to fit a narrower
  // screen, so every bubble stays on it at 320; 390 and wider draw unchanged.
  const scale = welcomeStageScale(useWindowDimensions().width);
  const grounds = [t.card, t.mint, t.peach];
  const bubbles = WELCOME_BUBBLE_SPOTS.map((spot, at) => ({ ...spot, ground: grounds[at]! }));
  return (
    <View {...decorative} style={[s.welcomeArt, { height: WELCOME_STAGE.height * scale }]}>
      <View style={[s.welcomeStage, scale < 1 ? { transform: [{ scale }] } : null]}>
        <View style={[s.disc, { left: 55, top: 20, width: 280, height: 280, borderRadius: 140, backgroundColor: t.violet2 }]} />
        <View style={[s.disc, { left: 79, top: 44, width: 232, height: 232, borderRadius: 116, backgroundColor: t.sun }]} />
        <View style={[s.disc, { left: 122, top: 268, width: 146, height: 16, borderRadius: 8, backgroundColor: t.sunDeep }]} />
        <BArt name="friends-cheer" width={256} height={234} bleed={WELCOME_BLEED} style={{ position: 'absolute', left: 67, top: 40, overflow: 'visible' }} />
        {confetti.map((bit, at) => (
          <View key={at} style={[s.disc, { left: bit.left, top: bit.top, width: bit.size, height: bit.size, borderRadius: 3, backgroundColor: bit.color, transform: [{ rotate: bit.rotate }] }]} />
        ))}
        {bubbles.map((bubble) => (
          <View key={bubble.words} style={[s.bubbleAt, { left: bubble.left, top: bubble.top, transform: [{ rotate: bubble.rotate }] }]}>
            {/* The artboard's hard 6 drop, drawn as an offset layer rather than a shadow. */}
            <View style={[s.bubbleDrop, { backgroundColor: t.text }, bubble.tail === 'left' ? s.bubbleTailLeft : s.bubbleTailRight]} />
            <View style={[s.bubble, { backgroundColor: bubble.ground }, bubble.tail === 'left' ? s.bubbleTailLeft : s.bubbleTailRight]}>
              <Text {...frenchText} style={[bType.heavy17, { color: t.text }]}>{bubble.words}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** One of the welcome's three promises: a deep blue chip with a mint tick. */
export function BWelcomeChip({ label }: { label: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.welcomeChip, { backgroundColor: t.violetDeep }]}>
      <View {...decorative} style={[s.chipTick, { backgroundColor: t.mint }]}><BTick size={12} color={t.onMint} /></View>
      <Text style={[bType.bold14, { color: t.onBrand }]}>{label}</Text>
    </View>
  );
}

/** The welcome's 60 sun button with its pressed edge and arrow. */
export function BSunButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.sunEdge, { backgroundColor: t.sunShadow }]}>
      <Press haptic="light" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} glowRadius={30} frame={{ borderRadius: 30 }} style={[s.sunButton, { backgroundColor: t.sun }]}>
        <Text style={[bType.heavy19, { color: t.text }]}>{label}</Text>
        <BArrow size={22} color={t.text} />
      </Press>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── plan

/** The five stage names, in order (the same words as journey/journeyView.ts `STAGES`). */
export const PLAN_STAGES = ['Starter', 'Basics', 'Everyday', 'Chatting', 'Confident'] as const;

/** A white chip on the plan band, 14/600. */
export function BPlanChip({ label }: { label: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return <View style={[s.planChip, { backgroundColor: t.card }]}><Text style={[bType.semi14, { color: t.text }]}>{label}</Text></View>;
}

/** The five-stage card: the track, the current stage ringed in lavender. */
export function BStageCard({ current }: { current: number }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.stageCard, { backgroundColor: t.card }]}>
      <View {...decorative} style={[s.stageTrack, { backgroundColor: t.stageTrack }]} />
      <View style={s.stageRow}>
        {PLAN_STAGES.map((stage, at) => (
          <View key={stage} style={s.stageCell} accessible accessibilityLabel={at === current ? `${stage}, where you start` : stage}>
            <View {...decorative} style={at === current
              ? [s.stageDot, { backgroundColor: t.brand, borderWidth: 4, borderColor: t.lavender, width: 38, height: 38, borderRadius: 19, marginVertical: -4 }]
              : [s.stageDot, { backgroundColor: t.card, borderWidth: 2, borderColor: t.ring }]} />
            <Text style={[at === current ? bType.heavy12 : bType.note12, { color: at === current ? t.text : t.muted }]}>{stage}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** One of "Your first three scenes": a 52 tile, the scene, its can-do and the "First" pill. */
export function BSceneRow({ index, title, line, first, last, art }: { index: number; title: string; line: string; first: boolean; last: boolean; art: BArtName }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const grounds = [t.sage, t.butter, t.lavender];
  return (
    <View style={[s.sceneRow, !last && { borderBottomWidth: 1, borderBottomColor: t.line }]}>
      <View {...decorative} style={[s.sceneTile, { backgroundColor: grounds[index % 3] }]}>
        <BArt name={art} width={30} height={28} />
      </View>
      <View style={s.sceneWords}>
        <Text {...frenchText} style={[bType.bold16, { color: t.text }]}>{`${index + 1}. ${title}`}</Text>
        <Text style={[bType.note, { color: t.muted }]}>{line}</Text>
      </View>
      {first ? <View style={[s.firstPill, { backgroundColor: t.brand }]}><Text style={[bType.bold12, { color: t.onBrand }]}>First</Text></View> : null}
    </View>
  );
}

/** "How it works": the blue card, a sun title and three dotted lines. */
export function BHowItWorks({ title, steps }: { title: string; steps: readonly string[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const dots = [t.card, t.sun, t.mint];
  return (
    <View style={[s.howCard, { backgroundColor: t.brand }]}>
      <Text accessibilityRole="header" style={[bType.title17, { color: t.sun }]}>{title}</Text>
      {steps.map((step, at) => (
        <View key={step} style={s.howRow}>
          <View {...decorative} style={[s.howDot, { backgroundColor: dots[at % 3] }]} />
          <Text style={[bType.para15, s.flex, { color: t.onBrand }]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── tutor

/** The tutor band's orb: three discs and the canvas orb. Never a face. */
export function BTutorOrb({ size = 150 }: { size?: number }) {
  const t = useB();
  const inner = (size * 122) / 150;
  const orb = (size * 100) / 150;
  return (
    <View {...decorative} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: t.violet2 }} />
      <View style={{ position: 'absolute', width: inner, height: inner, borderRadius: inner / 2, backgroundColor: t.hint }} />
      <View style={{ width: orb, height: orb, borderRadius: orb / 2, overflow: 'hidden' }}>
        <BArt name="tutor-orb" width={orb} height={orb} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────── cards

/** A white card, radius 24, padding 16. */
export function BCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return <View style={[s.card, { backgroundColor: t.card }, style]}>{children}</View>;
}

/** An info row on Before you start: a 40 tinted disc with its glyph, a bold title and a paragraph. */
export function BInfoRow({ ground, icon, title, body }: { ground: string; icon: ReactNode; title: string; body: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.infoRow}>
      <View {...decorative} style={[s.infoDisc, { backgroundColor: ground }]}>{icon}</View>
      <View style={s.flex}>
        <Text style={[bType.bold16, { color: t.text }]}>{title}</Text>
        <Text style={[bType.para14, { color: t.secondary }]}>{body}</Text>
      </View>
    </View>
  );
}

/**
 * An optional choice on Before you start as the artboard's 50 by 30 switch:
 * off by default, a knob on the left and the field grey; on is brand with the
 * knob right. The role and checked state say which, never colour alone.
 */
export function BSwitchCard({ title, detail, selected, onPress }: { title: string; detail?: string; selected: boolean; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="selection" accessibilityRole="switch" accessibilityState={{ checked: selected }} aria-checked={selected}
      accessibilityLabel={detail ? `${title}. ${detail}` : title} onPress={onPress} glowRadius={24} frame={{ borderRadius: 24 }}
      style={[s.card, s.switchCard, { backgroundColor: t.card }]}>
      <View style={s.flex}>
        <Text style={[bType.bold16, { color: t.text }]}>{title}</Text>
        {detail ? <Text style={[bType.note, { color: t.secondary }]}>{detail}</Text> : null}
      </View>
      <View {...decorative} style={[s.switchTrack, { backgroundColor: selected ? t.brand : t.field }]}>
        <View style={[s.switchKnob, { backgroundColor: t.card, left: selected ? 23 : 3 }]} />
      </View>
    </Press>
  );
}

/** A 14/700 brand text link at the touch floor. */
export function BTextLink({ label, onPress, accessibilityLabel, center = false, color, icon }: { label: string; onPress: () => void; accessibilityLabel?: string; center?: boolean; color?: string; icon?: ReactNode }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="light" accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={[s.textLink, center && s.textLinkCenter]}>
      {icon != null ? <View {...decorative}>{icon}</View> : null}
      <Text style={[bType.bold14, { color: color ?? t.link }]}>{label}</Text>
    </Press>
  );
}

/** A small 13/700 pill on a band, "About 3 min", padding 4 10, radius 12. */
export function BBandPill({ label }: { label: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return <View style={[s.bandPill, { backgroundColor: t.card }]}><Text style={[bType.chip, { color: t.text }]}>{label}</Text></View>;
}

const makeStyles = (_t: B) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  backDisc: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center' },
  backSpace: { width: HIT, height: HIT },
  questionBand: { borderBottomLeftRadius: 48, borderBottomRightRadius: 48, paddingHorizontal: 22, paddingBottom: 10, gap: 4, overflow: 'hidden' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  haloRow: { height: 156, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: 0, alignSelf: 'center', width: 156, height: 156, borderRadius: 78 },
  band: { borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: 22, paddingBottom: 22, gap: 6, overflow: 'hidden' },
  option: { minHeight: 64, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 16 },
  optionCompact: { minHeight: 58, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingLeft: 12, paddingRight: 16 },
  optionIcon: { width: 32, alignItems: 'center' },
  optionWords: { flex: 1, minWidth: 0, gap: 2 },
  optionMark: { width: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  welcomeArt: { height: 320, alignItems: 'center', justifyContent: 'center', overflow: 'visible', marginHorizontal: -24 },
  welcomeStage: { width: 390, height: 320, overflow: 'visible' },
  disc: { position: 'absolute' },
  bubbleAt: { position: 'absolute' },
  bubble: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18 },
  bubbleDrop: { position: 'absolute', left: 0, right: 0, top: 6, bottom: -6, borderRadius: 18, opacity: 0.18 },
  bubbleTailLeft: { borderBottomLeftRadius: 4 },
  bubbleTailRight: { borderBottomRightRadius: 4 },
  welcomeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16 },
  chipTick: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sunEdge: { borderRadius: 30, paddingBottom: 6 },
  sunButton: { minHeight: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  planChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14 },
  stageCard: { borderRadius: 22, paddingTop: 16, paddingHorizontal: 10, paddingBottom: 14 },
  stageTrack: { position: 'absolute', left: '13%', right: '13%', top: 30, height: 4, borderRadius: 2 },
  stageRow: { flexDirection: 'row' },
  stageCell: { flex: 1, alignItems: 'center', gap: 6 },
  stageDot: { width: 30, height: 30, borderRadius: 15 },
  sceneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  sceneTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sceneWords: { flex: 1, minWidth: 0, gap: 2 },
  firstPill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  howCard: { borderRadius: 22, padding: 16, gap: 10 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  howDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  card: { borderRadius: 24, padding: 16, gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  infoDisc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  switchCard: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: HIT },
  switchTrack: { width: 50, height: 30, borderRadius: 15 },
  switchKnob: { position: 'absolute', top: 3, width: 24, height: 24, borderRadius: 12 },
  textLink: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  textLinkCenter: { alignSelf: 'center', justifyContent: 'center' },
  bandPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
});
