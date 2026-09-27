/**
 * The French notebook with one highlighter.
 *
 * One white card with a paper hairline and no shadow, ledger rows ruled by
 * hairlines, one fully rounded ink pill for the one primary action, quiet text
 * links for everything second, and a single highlighter pen behind a French
 * line. Icons are authored line art at the same 2.2 stroke the illustrations
 * use: one pen drew the whole app.
 *
 * Append-only: `components.test.ts` slices this file between adjacent exports,
 * so a new component goes at the end, after the stylesheet.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type KeyboardTypeOptions,
} from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import {
  accent,
  decorative,
  font,
  heroFit,
  highlight,
  orb,
  paper,
  radius,
  signal,
  space,
  type,
  HAIRLINE,
  HIT,
  STROKE,
  rungColor,
  rungLabel,
} from './theme.ts';
import { tapSettled } from './motion/haptics.ts';
import { drawIn, useReduceMotion } from './motion.ts';
import { OrbGlyph } from './tutor/OrbGlyph.tsx';
import type { Rung } from '@luvani/core';

// ─────────────────────────────────────────────────────────────── drawn icons
// Authored SVG in the illustration stroke. No glyph or emoji substitutes.

export function ArrowRight({ size = 18, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4 12h15.2" />
        <Path d="M13.6 5.8 19.8 12l-6.2 6.2" />
      </G>
    </Svg>
  );
}

export function ChevronLeft({ size = 22, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <Path
        d="M14.8 5.2 8 12l6.8 6.8"
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * The mirror of ChevronLeft, and the one mark at the end of a row that opens.
 *
 * Every tinted row is a button that goes somewhere, so it needs the sign a row
 * carries for that, and the back chevron already drew the shape. It is the same
 * path reflected rather than a second drawing, so the two never drift apart in
 * weight or in radius, and it is faint ink wherever it is drawn: it is a mark
 * beside words that already say where the row goes, never a word itself.
 */
export function ChevronRight({ size = 22, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <Path
        d="M9.2 5.2 16 12l-6.8 6.8"
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MicGlyph({ size = 30, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 3.2a2.9 2.9 0 0 1 2.9 2.9v5.6a2.9 2.9 0 0 1-5.8 0V6.1A2.9 2.9 0 0 1 12 3.2Z" />
        <Path d="M5.9 11.2a6.1 6.1 0 0 0 12.2 0M12 17.3v3.5" />
      </G>
    </Svg>
  );
}

export function EarGlyph({ size = 26, color = paper.ink }: { size?: number; color?: string }) {
  // Shown while the tutor is speaking: sound arriving, not being captured.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round">
        <Path d="M4 9.5v5h3.4L12 18.6V5.4L7.4 9.5z" strokeLinejoin="round" />
        <Path d="M15.4 8.6a4.6 4.6 0 0 1 0 6.8M18.2 5.9a8.4 8.4 0 0 1 0 12.2" />
      </G>
    </Svg>
  );
}

export function HelpGlyph({ size = 16, color = paper.inkSoft }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <Circle cx={12} cy={12} r={9.2} fill="none" stroke={color} strokeWidth={STROKE} />
      <Path
        d="M9.3 9.2a2.8 2.8 0 0 1 5.5.7c0 1.9-2.7 2.2-2.7 4"
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Circle cx={12.1} cy={17.2} r={1.25} fill={color} />
    </Svg>
  );
}

/**
 * A seedling: a stem and two leaves, the same figure the word-of-the-day scene
 * draws at full size. Home marks the days it has been used with it, and signs
 * the bottom of the screen with it.
 */
/**
 * The mark beside the days a learner has been active.
 *
 * The founder's mockup draws an emoji flame here. This app has no emoji in it
 * anywhere, and one would be the first thing on any screen not drawn in the pen
 * the rest of it uses, at a weight and a palette nothing else shares. So the
 * flame is drawn: the same shape, the same meaning beside the same number, in
 * the one stroke weight.
 *
 * It is a flame and not a chain. The tile it sits on counts days that have
 * happened and can only go up, and nothing in this app asks a learner to
 * protect it, which is what PRODUCT.md refused twice. The picture is warmth,
 * not debt.
 */
export function FlameGlyph({ size = 18, color = signal.correspondance }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M13 2.6c3.4 3 5 5.8 5 8.6a6 6 0 0 1-12 0c0-1.5.5-2.9 1.6-4.2.3 1.2.9 2 1.8 2.3.5-2.7 1.7-5 3.6-6.7z" />
        <Path d="M12 20a2.7 2.7 0 0 1-2.7-2.7c0-1.3.9-2.4 2.7-4 1.8 1.6 2.7 2.7 2.7 4A2.7 2.7 0 0 1 12 20z" />
      </G>
    </Svg>
  );
}

export function SproutGlyph({ size = 18, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 21c-.2-5 .1-8 .8-10.4" />
        <Path d="M12.8 12.6c.4-4 3-6.4 6.8-6.6.2 3.8-2.4 6.4-6.4 6.8z" />
        <Path d="M11.4 16.4c-.4-3.4-2.6-5.6-6-5.8-.2 3.2 2 5.6 5.6 5.8z" />
      </G>
    </Svg>
  );
}

/** An outline bookmark. Drawn on the control that saves a situation, not on a saved one. */
export function BookmarkGlyph({ size = 18, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <Path
        d="M6.4 4.2h11.2v16.2L12 16.6l-5.6 3.8z"
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Concentric rings. The mark beside a goal for today, so the number it sits
 * next to reads as something aimed at rather than something scored.
 */
export function TargetGlyph({ size = 18, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE}>
        <Circle cx={12} cy={12} r={8.6} />
        <Circle cx={12} cy={12} r={4.4} />
        <Circle cx={12} cy={12} r={1.3} fill={color} stroke="none" />
      </G>
    </Svg>
  );
}

/**
 * A tick inside a ring. The mark beside how much of the deck is coming back,
 * drawn as a check and not a medal, because the figure under it is what a
 * learner remembered rather than a prize somebody handed them.
 *
 * Ink by default, so it stays neutral wherever nobody colours it. Home draws it
 * in the accent beside the Recall tile's figure, where the violet labels the card and
 * reports no state.
 */
export function BadgeGlyph({ size = 18, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={8.6} />
        <Path d="M8.2 12 11 14.8l4.8-5.6" />
      </G>
    </Svg>
  );
}

/** A monochrome G in the house line style — no brand-colour asset needed. */
export function GoogleMark({ size = 20, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round">
        <Path d="M20.4 12.2A8.6 8.6 0 1 1 17.8 6" />
        <Path d="M12.6 12.2h7.8" />
      </G>
    </Svg>
  );
}

/** A monochrome apple in the house line style, for the same reason as the G. */
export function AppleMark({ size = 20, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 8.6c-1.3-1.2-3.4-1.4-4.9-.3-2.4 1.8-2.5 5.9-.5 9 1 1.6 2.2 2.7 3.5 2.7.8 0 1.2-.5 1.9-.5s1.1.5 1.9.5c1.3 0 2.5-1.1 3.5-2.7.5-.8.9-1.6 1.1-2.4-1.5-.6-2.4-2-2.4-3.5 0-1.3.7-2.5 1.7-3.2-1.3-1.4-3.3-1.7-4.6-.7z" />
        <Path d="M12 8.6c0-1.9 1-3.4 2.6-4.1" />
      </G>
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────── surfaces

/**
 * The one card: white, radius 16, a paper hairline, no shadow, no ink outline,
 * and never nested inside another card.
 *
 * `tone="feature"` is deprecated: the chartreuse is a highlighter now, so a
 * feature card draws plain paper like every other card. `journal` keeps the
 * ground colour for the one card that sits a French line on the page itself.
 */
export function Card({
  children,
  style,
  padded = true,
  tone = 'paper',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  tone?: 'paper' | 'feature' | 'journal';
}) {
  return <View style={[s.card, tone === 'journal' && { backgroundColor: paper.ground }, padded && s.cardPadded, style]}>{children}</View>;
}

/** The one small caps label a card may carry, in soft ink. */
export function Label({ children, color = paper.inkSoft }: { children: React.ReactNode; color?: string }) {
  return <Text style={[type.label, { color }]}>{children}</Text>;
}

// ────────────────────────────────────────────────────────────────── controls

/** The one primary action on a screen: a 56pt ink pill, fully rounded like the logo's L. */
export function PillButton({
  label,
  onPress,
  disabled = false,
  icon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  /** Say something other than the label to assistive tech. Falls back to label. */
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        tapSettled();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [s.pill, disabled && s.pillDisabled, pressed && !disabled && s.pillPressed]}
    >
      {icon}
      <Text style={[type.button, { color: paper.onInk }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * A secondary action: a quiet text link at the touch floor, ink words with no
 * box, so it never competes with the one ink pill.
 */
export function OutlineButton({
  label,
  sub,
  onPress,
  disabled = false,
  icon,
  accessibilityLabel,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  /**
   * What a screen reader hears, when the word alone names nothing.
   *
   * Home's Bookmark button is the case that needed it: "Bookmark" and "Saved"
   * are states of a control sitting under a heading a blind learner passed
   * several lines ago, so the button has to carry the situation with it the way
   * `startLabel` already does for the next-situation pill.
   */
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        tapSettled();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [s.outline, pressed && !disabled && s.outlinePressed, disabled && { opacity: 0.45 }]}
    >
      <View style={s.outlineRow}>
        {icon}
        <Text style={[type.bodyStrong, { color: paper.ink }]}>{label}</Text>
      </View>
      {sub != null && <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{sub}</Text>}
    </Pressable>
  );
}

/**
 * A quiet inline action — text only, full touch height.
 *
 * Disabled is said in ink, not in opacity. OutlineButton can afford
 * `opacity: 0.45` because a white pill with an ink rule still reads as a
 * control after it fades; a bare word has no shape to fall back on, and
 * inkSoft at 0.45 measures 2.0 against the lilac ground — it would not look
 * unavailable, it would look gone. So this borrows PillButton's meaning, the
 * faint ink, in the one surface a text button has. It overrides the caller's
 * `color` on purpose: five screens pass full `paper.ink`, and a dead control
 * drawn in the live colour is the bug this closes rather than a variant of it.
 *
 * No `accessibilityState` here, and none in PillButton or OutlineButton
 * either: Pressable already folds its own `disabled` into that state, and the
 * prop wins over anything spelled out alongside it.
 */
export function GhostButton({
  label,
  onPress,
  disabled = false,
  color = paper.inkSoft,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  /** Say something other than the label to assistive tech. Falls back to label. */
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [s.ghost, pressed && !disabled && { opacity: 0.55 }]}
    >
      <Text style={[type.bodyStrong, { color: disabled ? paper.inkFaint : color }]}>{label}</Text>
    </Pressable>
  );
}


/**
 * A tappable option the learner can choose — the successor of the direction
 * plaque. French text in the serif, English gloss beneath, optional replay.
 *
 * `selected` is the heavier ink rule and is spoken to a screen reader; `playing`
 * is the replay ear sounding, drawn as the accent glyph on a quiet disc with a
 * "Stop" label. The two are orthogonal: a learner can audition one voice while
 * another is the chosen one, so a card can be selected and playing at once.
 */
export function OptionCard({
  text,
  gloss,
  onPress,
  onHear,
  selected = false,
  playing = false,
}: {
  text: string;
  gloss?: string;
  onPress: () => void;
  /** Replay this option aloud without choosing it. */
  onHear?: () => void;
  selected?: boolean;
  /** This option's sample is sounding: the ear becomes a Stop on a lit disc. */
  playing?: boolean;
}) {
  // The hear control is a sibling of the main press target, not a child — a
  // button nested inside a button is invalid HTML on web. Pressed feedback is
  // lifted to the container so the whole card still flashes as one object.
  const [pressed, setPressed] = useState(false);
  return (
    <View style={[s.option, selected && s.optionSelected, pressed && s.optionPressed]}>
      <Pressable
        onPress={() => {
          tapSettled();
          onPress();
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={gloss ? `${text}, ${gloss}` : text}
        accessibilityState={{ selected }}
        aria-selected={selected}
        style={s.optionMain}
      >
        <View style={{ flex: 1 }}>
          <Text style={[type.french, { color: paper.ink }]}>{text}</Text>
          {gloss != null && (
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{gloss}</Text>
          )}
        </View>
      </Pressable>
      {onHear && (
        <Pressable
          onPress={onHear}
          hitSlop={10}
          accessibilityRole="button"
          // A sounding ear stops on the next tap, so it says so — and the glyph
          // lights on a quiet disc rather than moving, since there is nothing to
          // reduce-motion here.
          accessibilityLabel={playing ? `Stop ${text}` : `Hear ${text}`}
          style={({ pressed: hearPressed }) => [
            { padding: space(2) },
            playing && { backgroundColor: paper.groundDeep, borderRadius: radius.pill },
            hearPressed && { opacity: 0.6 },
          ]}
        >
          <EarGlyph size={18} color={playing ? accent.primary : paper.inkSoft} />
        </Pressable>
      )}
      <ArrowRight size={18} color={paper.inkFaint} />
    </View>
  );
}

/**
 * A labelled text input with an inline error line.
 *
 * Every form in the app is one of these, so the assistive bindings live here
 * rather than in eight screens. Three platforms want three mechanisms, and the
 * spellings below were read off react-native 0.86.2 and react-native-web
 * 0.21.2 — the pair Expo SDK 57 pins — rather than assumed:
 *
 * - Android is the only platform with labelledby, and it resolves the id of
 *   another element, so the label carries an id and the input names it.
 * - iOS has no labelledby at all. The name it reads is the label prop, and a
 *   wrong field folds its error into that name the way OptionRow folds its
 *   gloss, so someone coming back to a failed field still hears why.
 * - Web forwards all of it as ARIA. Describedby and invalid are web-only and
 *   the native typings do not name them, so they travel as a spread.
 *
 * `id` not `nativeID`, and `aria-label` not `accessibilityLabel`: react-native
 * reads the newer spelling first on both platforms and react-native-web still
 * warns on `nativeID`. The one exception is `accessibilityLiveRegion`, which
 * Text on native answers to only under that name.
 *
 * Announcing the error as it appears is that live region on Android and
 * `role="alert"` on web. VoiceOver has neither, so iOS is told out loud.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secure = false,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  autoFocus = false,
  maxLength,
  center = false,
  multiline = false,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  maxLength?: number;
  center?: boolean;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  // A password shown while it is typed. Off by default, and only a secure
  // field ever draws the control that turns it on (F373).
  const [revealed, setRevealed] = useState(false);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const errorId = `${fieldId}-error`;
  // A field with no visible label still has a placeholder, and an input
  // announced as "text field" and nothing else is the bug this closes.
  const name = label ?? placeholder;

  useEffect(() => {
    if (error == null || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const webError: Record<string, string> | null =
    error != null && Platform.OS === 'web'
      ? { 'aria-describedby': errorId, 'aria-invalid': 'true' }
      : null;

  return (
    <View style={{ gap: space(1.5) }}>
      {/* Not <Label>: it takes no id, and Android finds the label by id. */}
      {label != null && (
        <Text id={labelId} style={[type.label, { color: paper.inkSoft }]}>
          {label}
        </Text>
      )}
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          {...webError}
          aria-label={name != null && error != null ? `${name}, ${error}` : name}
          aria-labelledby={label != null ? labelId : undefined}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={paper.inkFaint}
          secureTextEntry={secure && !revealed}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
          maxLength={maxLength}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            s.field,
            multiline && { minHeight: 100, textAlignVertical: 'top' },
            secure && { paddingRight: space(16) },
            center && { textAlign: 'center' },
            focused && { borderColor: paper.ink },
          ]}
        />
        {secure && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              minWidth: HIT,
              minHeight: HIT,
              paddingHorizontal: space(4),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[type.small, { fontFamily: font.sansMedium, color: paper.inkSoft }]}>{revealed ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
      {error != null && (
        <Text
          id={errorId}
          role="alert"
          accessibilityLiveRegion="polite"
          style={[type.small, { color: signal.correspondance }]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

/**
 * A segmented choice: a paper track with a white active segment. `active` may
 * be null, for a setting nobody has chosen yet, and the group can name itself
 * so a screen reader says what the three words are a choice of (F368).
 *
 * The chosen segment is white with ink lettering, so the control never competes
 * with the one ink pill on the screen. The unchosen words stay soft ink on the
 * track, which is a step down rather than a second state colour.
 *
 * Selection is said twice, once per platform, and the two are not
 * interchangeable. `accessibilityState` is what VoiceOver and TalkBack read;
 * `aria-selected` is what the browser puts in the accessibility tree, and
 * react-native-web does not derive one from the other for a `tab` role. Without
 * the second line a learner on the web hears three identical buttons (F522).
 */
export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
  track = paper.groundDeep,
  accessibilityLabel,
}: {
  tabs: readonly { key: K; label: string }[];
  active: K | null;
  onChange: (key: K) => void;
  /** The quiet pressed-state colour behind the pill. */
  track?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View style={[s.tabTrack, { backgroundColor: track }]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            aria-selected={isActive}
            style={[s.tab, isActive && s.tabActive]}
          >
            <Text style={[type.button, { color: isActive ? paper.ink : paper.inkSoft }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * One counted fact. End cards, Home and My French use it, so it lives here.
 * Two to a row by default; three when a screen has three facts and one line.
 */
export function Stat({ value, label, columns = 2 }: { value: string; label: string; columns?: 2 | 3 }) {
  return (
    <View style={{ flexBasis: columns === 3 ? '30%' : '46%', flexGrow: 1 }}>
      <Text style={[type.title, { color: paper.ink }]}>{value}</Text>
      {/* The caption is words under a number, so it is soft ink, not the faint
          ink that was only ever cleared as a mark (F330). */}
      <Text style={[type.label, { color: paper.inkSoft, marginTop: space(1) }]}>{label}</Text>
    </View>
  );
}

/**
 * The learner's initial, drawn one way: an ink initial on the deeper paper.
 *
 * The notebook keeps ink for the one primary pill, so the learner's mark steps
 * back to `groundDeep` with the initial in ink. DM Sans Medium, because
 * Fraunces is for French only. It is decorative to assistive tech: the name is
 * said in the text beside it, so a screen reader walks past a loose letter.
 */
export function Monogram({ initial, size = HIT }: { initial: string; size?: number }) {
  return (
    <View
      {...decorative}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: paper.groundDeep,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: font.sansMedium, fontSize: size * 0.44, color: paper.ink }}>{initial}</Text>
    </View>
  );
}

/** Onboarding progress: one dot per page, the current one stretched. */
export function ProgressDots({ total, index }: { total: number; index: number }) {
  return (
    <View style={s.dotsRow} accessible accessibilityLabel={`Step ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[s.dot, i === index && s.dotHere, i < index && { backgroundColor: paper.inkSoft }]} />
      ))}
    </View>
  );
}

/**
 * THE speak control: one green circle, everywhere the learner talks — green
 * means "you speak", matching the voice orb's traffic light.
 * `active` while the mic is live; `muted` when the tutor holds the floor.
 */
export function SpeakCircle({
  onPress,
  onPressIn,
  onPressOut,
  active = false,
  muted = false,
  disabled = false,
  size = 108,
  accessibilityLabel,
}: {
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  active?: boolean;
  muted?: boolean;
  disabled?: boolean;
  size?: number;
  accessibilityLabel: string;
}) {
  const iconColor = active ? paper.onInk : muted ? paper.inkFaint : signal.good;
  return (
    <Pressable
      onPress={
        onPress === undefined
          ? undefined
          : () => {
              tapSettled();
              onPress();
            }
      }
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || muted}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        s.speak,
        { width: size, height: size, borderRadius: size / 2 },
        active ? s.speakLive : muted ? s.speakMuted : s.speakIdle,
        pressed && !active && { backgroundColor: paper.groundDeep },
      ]}
    >
      <MicGlyph size={size * 0.34} color={iconColor} />
    </Pressable>
  );
}

/** A rung bullet. Support colour when active, quiet outline when not. */
export function LineBullet({ rung, active, size = 26 }: { rung: Rung; active: boolean; size?: number }) {
  const color = rungColor[rung];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: active ? color : 'transparent',
        borderWidth: active ? 0 : HAIRLINE + 0.5,
        borderColor: active ? color : paper.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: type.button.fontFamily,
          fontSize: size * 0.44,
          // Rung 4 is ink-filled; its numeral must go light or it vanishes.
          color: active ? (rung === 4 ? paper.onInk : paper.ink) : paper.inkFaint,
        }}
      >
        {rung}
      </Text>
    </View>
  );
}

/**
 * The lesson as a line: one stop per turn, the current one struck larger.
 *
 * It counts nothing out loud. The dots were made numberless for sighted
 * learners on purpose, and for a while the accessible name still said "Stop
 * three of seven" every turn, which meant the one invariant this app is
 * strictest about, that no score is shown mid-session, held for everybody
 * except the learner using a screen reader. `docs/PEDAGOGY.md` states it and
 * `SessionView.tsx` explains it in as many words: a count mid-session is a
 * score.
 *
 * So the rail is decorative to assistive tech, exactly as the week rail on Home
 * already is. Nothing is lost by it: what a learner needs to know mid-session
 * is what to say next, and that is the card above, read aloud, in words.
 */
export function StationLine({ total, index }: { total: number; index: number }) {
  return (
    <View style={s.stationRow} {...decorative}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < index;
        const here = i === index;
        return (
          <View key={i} style={s.stationCell}>
            {i > 0 && <View style={[s.stationRail, { backgroundColor: done || here ? paper.ink : paper.line }]} />}
            <View
              style={[
                s.stationDot,
                here && s.stationDotHere,
                { backgroundColor: done || here ? paper.ink : paper.line },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

/**
 * Length-aware display sizing for a French line: short lines strike large,
 * long ones step down the way a sign is cut to fit its longest word.
 */
export function fitDisplay(text: string): TextStyle {
  if (text.length <= 16) return type.frenchLg;
  if (text.length <= 32) return { fontFamily: type.frenchLg.fontFamily, fontSize: 24, lineHeight: 31 };
  return { fontFamily: type.frenchLg.fontFamily, fontSize: 20, lineHeight: 27 };
}


/**
 * A column of words that takes the rest of a row and can still shrink.
 *
 * `flex: 1` on its own gives the column its share and forbids it going below
 * its content's width, so at the largest reading size a French title beside a
 * disc pushes the disc, and then the card, off the screen. Every row in the app
 * that sets a glyph beside words wants the same two rules, so they are written
 * once here and named by their job rather than re-typed as a measurement on
 * each screen.
 */
export const ROW_WORDS = { flex: 1, minWidth: 0 } as const;

/**
 * One thing the learner can now do, as a row (F545).
 *
 * Home's abilities card and My French's stamped situations draw the same row,
 * so a situation handled on your own looks the same on both tabs: the place's
 * disc, the situation in the learner's language, and a chevron because the row
 * opens somewhere. The disc arrives as a child rather than being drawn here,
 * because `MissionDisc` imports this file and a component that imported it
 * back would be a cycle.
 *
 * Every row is a button at the touch floor and says, for assistive tech, what
 * the mark beside it is claiming: the passport's own `stampLabel`.
 */
export function AbilityRow({
  leading,
  title,
  accessibilityLabel,
  onPress,
  first = false,
}: {
  leading: React.ReactNode;
  title: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** Rows after the first carry a divider above them. */
  first?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [s.abilityRow, !first && s.abilityDivided, pressed && s.abilityPressed]}
    >
      {leading}
      <View style={s.abilityWords}>
        <Text style={[type.bodyStrong, { color: paper.ink }]}>{title}</Text>
      </View>
      <ArrowRight />
    </Pressable>
  );
}

// The seven-mark week rail (`WeekRail`, F561/F577) stood here until the
// notebook final sweep, 2026-09-27. The week is a sentence on Today and on
// Profile now, and the rail's last live caller was the retired French wall page.

const s = StyleSheet.create({
  abilityRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(2) },
  abilityDivided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  abilityWords: ROW_WORDS,
  abilityPressed: { opacity: 0.72 },
  card: {
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
  },
  cardPadded: { paddingVertical: space(4), paddingHorizontal: space(4) },
  pill: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    backgroundColor: accent.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space(6),
    paddingVertical: space(3),
  },
  pillPressed: { backgroundColor: paper.ink, transform: [{ scale: 0.985 }, { translateY: 1 }] },
  pillDisabled: { backgroundColor: paper.inkFaint },
  outline: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(2),
    paddingHorizontal: space(3),
  },
  outlinePressed: { opacity: 0.6 },
  outlineRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  ghost: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(3),
  },
  chip: {
    minHeight: HIT,
    justifyContent: 'center',
    backgroundColor: paper.groundDeep,
    borderRadius: radius.chip,
    paddingVertical: space(2),
    paddingHorizontal: space(3.5),
  },
  chipSelected: { backgroundColor: accent.primary },
  option: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  optionSelected: { borderColor: paper.ink, borderWidth: 1.5 },
  optionPressed: { backgroundColor: paper.groundDeep },
  optionMain: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  field: {
    minHeight: HIT + 6,
    backgroundColor: paper.card,
    borderWidth: 1.5,
    borderColor: paper.line,
    borderRadius: radius.input,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    ...type.body,
    color: paper.ink,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: paper.groundDeep,
    borderRadius: radius.control,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    padding: 3,
  },
  tab: {
    flex: 1,
    // theme.ts calls HIT the floor "enforced on every control", and this was
    // the one control built under it.
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
  },
  tabActive: { backgroundColor: paper.card, borderWidth: HAIRLINE, borderColor: paper.line },
  dotsRow: { flexDirection: 'row', gap: space(1.5), alignItems: 'center' },
  dot: { width: 20, height: 5, borderRadius: 1, backgroundColor: paper.line },
  dotHere: { width: 36, backgroundColor: paper.ink },
  speak: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.card,
  },
  speakIdle: { borderWidth: 2, borderColor: signal.good },
  speakLive: {
    backgroundColor: signal.good,
    shadowColor: signal.good,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  speakMuted: { borderWidth: 2, borderColor: paper.line },
  stationRow: { flexDirection: 'row', alignItems: 'center' },
  stationCell: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stationRail: { height: 2, flex: 1 },
  stationDot: { width: 7, height: 7, borderRadius: radius.pill },
  stationDotHere: {
    width: 13,
    height: 13,
    borderWidth: 3,
    borderColor: paper.ground,
  },
});

// ─────────────────────────────────────────── the notebook marks (Phase 1)
// Appended, because every region above is sliced between adjacent exports.

/**
 * A ruled list: one hairline above the first row, and every `LedgerRow` rules
 * the line under itself. A list to assistive tech, so a screen reader can say
 * how many rows there are before the learner walks them.
 */
export function Ledger({
  children,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View accessibilityRole="list" accessibilityLabel={accessibilityLabel} style={[{ borderTopWidth: HAIRLINE, borderTopColor: paper.line }, style]}>
      {children}
    </View>
  );
}

/**
 * One line in a ledger: an optional 24pt ink glyph with no disc, a title, a
 * gloss, an optional note, trailing meta, and the chevron that says it opens.
 *
 * One Pressable, never a card with a button inside it: the whole row is the
 * target, and a button nested in a button is invalid on the web (F545). It sits
 * at 56pt and grows rather than clips, because nothing here caps a line count
 * or the reading size. It names itself ONCE, from the title and the gloss,
 * unless the caller has something better to say. Disabled is said in soft ink
 * rather than opacity, because a faded row has no shape to fall back on.
 */
export function LedgerRow({
  glyph,
  label,
  title,
  gloss,
  note,
  meta,
  trailing,
  onPress,
  accessibilityLabel,
  disabled = false,
}: {
  /** One line-art glyph in ink. No disc under it. */
  glyph?: ReactNode;
  /** The row's one caps line, above the title, when the title alone names nothing. */
  label?: string;
  title: string;
  gloss?: string;
  /** A second quiet line, for a separate fact such as a dated outcome. */
  note?: string | null;
  /** A short fact at the trailing edge, before the chevron. */
  meta?: string;
  /** A state the row has earned, drawn before the chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Say something other than the title and gloss. Falls back to both, joined. */
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (gloss ? `${title}, ${gloss}` : title)}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [ls.row, pressed && !disabled && ls.pressed]}
    >
      {glyph != null ? (
        <View style={ls.glyph} {...decorative}>
          {glyph}
        </View>
      ) : null}
      <View style={ls.words}>
        {label != null ? <Label>{label}</Label> : null}
        <Text style={[type.heading, { color: disabled ? paper.inkSoft : paper.ink }]}>{title}</Text>
        {gloss != null && gloss !== '' ? <Text style={[type.small, { color: paper.inkSoft }]}>{gloss}</Text> : null}
        {note != null && note !== '' ? <Text style={[type.small, { color: paper.inkSoft }]}>{note}</Text> : null}
      </View>
      {meta != null ? <Text style={[type.small, { color: paper.inkSoft }]}>{meta}</Text> : null}
      {trailing != null ? trailing : null}
      <ChevronRight color={paper.inkFaint} />
    </Pressable>
  );
}

/**
 * The highlighter: an inline band drawn once behind a French line.
 *
 * The band draws in from the left through `drawIn`, on a transform, on the
 * native driver, and never again. Under reduced motion it lands on the drawn
 * band: the mark is the content and the stroke is the flourish. The band is
 * decorative; the line on it is what a screen reader hears. At most one per
 * screen, and it is the only surface the chartreuse may take besides the
 * level path's "you are here" stop.
 */
export function Highlight({
  text,
  style,
  accessibilityLabel,
}: {
  /** The French line the band sits behind. */
  text: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const reduced = useReduceMotion();
  const draw = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = drawIn(draw, reduced);
    return () => animation?.stop();
  }, [draw, reduced]);
  return (
    <View style={ls.bandHost}>
      <Animated.View
        {...decorative}
        pointerEvents="none"
        style={[ls.band, { backgroundColor: highlight, transformOrigin: 'left', transform: [{ scaleX: draw }] }]}
      />
      <Text accessibilityLabel={accessibilityLabel} style={[type.french, { color: paper.ink }, style]}>
        {text}
      </Text>
    </View>
  );
}

/**
 * A sound, named: its IPA as notation beside one example word in French, for
 * instance /ʁ/ rouge. One element to a screen reader, so the symbol and the
 * word are heard as one sound rather than two loose words.
 */
export function SoundTag({ ipa, example }: { ipa: string; example: string }) {
  return (
    <View accessible accessibilityLabel={`Sound ${ipa}, as in ${example}`} style={ls.soundTag}>
      <Text style={[type.notation, { color: paper.ink }]}>{ipa}</Text>
      <Text style={[type.frenchSm, { color: paper.ink }]}>{example}</Text>
    </View>
  );
}

/**
 * The support ladder at a glance: four rungs in their own support colours, the
 * current one drawn taller, and the rung's sentence beside them. The rungs are
 * decorative; the sentence from `rungLabel` is what is read.
 */
export function LadderMark({ rung, tutorName }: { rung: Rung; tutorName: string }) {
  return (
    <View style={ls.ladder}>
      <View style={ls.rungs} {...decorative}>
        {([1, 2, 3, 4] as const).map((r) => (
          <View key={r} style={[ls.rung, { backgroundColor: rungColor[r] }, r === rung && ls.rungHere]} />
        ))}
      </View>
      <Text style={[type.small, ROW_WORDS, { color: paper.ink }]}>{rungLabel(rung, tutorName)}</Text>
    </View>
  );
}

/** One can-do on the level path, and where the learner stands against it. */
export type LevelStop = { canDo: string; state: 'earned' | 'here' | 'ahead' };
/** One level on the path, A0 or A1, with its can-dos in order. */
export type PathLevel = { level: string; stops: readonly LevelStop[] };

const YOU_ARE_HERE = 'You are here';

function stopLabel(level: string, stop: LevelStop): string {
  const where = stop.state === 'earned' ? 'done' : stop.state === 'here' ? 'you are here' : 'not yet';
  return `${level}, ${stop.canDo}, ${where}`;
}

/**
 * The level path: each level, its can-dos in order, and one "you are here".
 *
 * The here stop is the highlighter, which is one of its two legal hosts. A
 * done stop is an ink dot and a stop ahead is a hairline ring, so the path
 * reads without colour. Every stop is one sentence to a screen reader.
 */
export function LevelPath({ levels }: { levels: readonly PathLevel[] }) {
  return (
    <View style={ls.path}>
      {levels.map((level) => (
        <View key={level.level} style={ls.pathLevel}>
          <Text accessibilityRole="header" style={[type.label, { color: paper.inkSoft }]}>
            {level.level}
          </Text>
          {level.stops.map((stop, index) => (
            <View key={`${level.level}-${index}`} accessible accessibilityLabel={stopLabel(level.level, stop)} style={ls.stop}>
              <View
                {...decorative}
                style={[
                  ls.stopMark,
                  stop.state === 'earned' && ls.stopEarned,
                  stop.state === 'here' && { backgroundColor: highlight, borderColor: paper.ink },
                ]}
              />
              <View style={ROW_WORDS}>
                <Text style={[type.body, { color: stop.state === 'ahead' ? paper.inkSoft : paper.ink }]}>{stop.canDo}</Text>
                {stop.state === 'here' ? <Text style={[type.small, { color: paper.ink }]}>{YOU_ARE_HERE}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * A tutor, introduced: the orb, the name, the voice in words, the signature
 * line in French, a sample to hear, and a quiet link to change tutor. There is
 * no face and no initial: the orb is the tutor and the monogram is the
 * learner's. The sample says "Stop" while it sounds, like every replay ear.
 */
export function TutorCard({
  name,
  voice,
  signature,
  onHear,
  playing,
  onChange,
  changeLabel = 'Change tutor',
}: {
  name: string;
  /** The voice in words, for instance "Warm, unhurried Parisian". */
  voice: string;
  /** One line the tutor says, in French. */
  signature: string;
  onHear: () => void;
  playing: boolean;
  onChange: () => void;
  changeLabel?: string;
}) {
  return (
    <Card style={ls.tutor}>
      <View style={ls.tutorHead}>
        <View {...decorative}>
          <OrbGlyph color={orb.ready} size={HIT + space(3)} />
        </View>
        <View style={ROW_WORDS}>
          <Text style={[type.cardTitle, { color: paper.ink }]}>{name}</Text>
          <Text style={[type.small, { color: paper.inkSoft }]}>{voice}</Text>
        </View>
        <Pressable
          onPress={onHear}
          accessibilityRole="button"
          accessibilityLabel={playing ? `Stop ${name}` : `Hear ${name}`}
          style={({ pressed }) => [ls.hear, pressed && ls.hearPressed]}
        >
          <EarGlyph size={22} color={paper.ink} />
        </Pressable>
      </View>
      <Text style={[type.french, { color: paper.ink }]}>{signature}</Text>
      <GhostButton label={changeLabel} onPress={onChange} color={paper.ink} />
    </Card>
  );
}

const CAN_DO_LEAD = "You'll be able to";

/**
 * The brief for one scene: what it is, what the learner will be able to do,
 * the lines they will say, and how long it takes, with one Start.
 *
 * Every field but the title and the Start is optional, so a caller draws the
 * fields it has. The Start and the quiet "Type instead" arrive as nodes the
 * caller built, because `surfaceContract.test.ts` counts one primary pill per
 * screen by reading the screen's own file; a pill folded in here would move
 * every count into a shared component. The corner is a 44pt slot in flow, for
 * the bookmark, so at the largest reading size it pushes the title down rather
 * than sitting on it. One caps line at most: the level and the label, joined.
 */
export function SceneBrief({
  level,
  label,
  title,
  french,
  summary,
  canDo,
  lines = [],
  minutes,
  minutesMark,
  support,
  tutor,
  reason,
  action,
  secondary,
  corner,
}: {
  /** A0, A1. */
  level?: string;
  label?: string;
  /** The scene's name in the learner's language. */
  title: string;
  /** The scene's name in French, set as the French hero. */
  french?: string;
  /** One plain line about the scene. */
  summary?: string;
  /** What the learner will be able to do, led by "You'll be able to". */
  canDo?: string;
  /** Two or three lines the learner will say, in French. */
  lines?: readonly string[];
  /** How long, already in words. */
  minutes?: string;
  /** A mark before the minutes, such as the clock glyph. */
  minutesMark?: ReactNode;
  /** How much help the tutor gives, in words. */
  support?: string;
  /** Who is teaching, in words. */
  tutor?: string;
  /** Why this scene was put in front of the learner. */
  reason?: string;
  /** The one Start, built by the caller so its pill stays countable. */
  action: ReactNode;
  /** The quiet second way in, such as "Type instead". */
  secondary?: ReactNode;
  /** A 44pt slot at the top right: the bookmark toggle, or nothing. */
  corner?: ReactNode;
}) {
  const caps = [level, label].filter((part): part is string => part != null && part !== '').join(' · ');
  return (
    <Card style={ls.brief}>
      {caps !== '' || corner != null ? (
        <View style={ls.briefHead}>
          <View style={ROW_WORDS}>{caps !== '' ? <Label>{caps}</Label> : null}</View>
          {corner != null ? <View style={ls.corner}>{corner}</View> : null}
        </View>
      ) : null}
      {french != null ? <Text style={[fitHero(french), { color: paper.ink }]}>{french}</Text> : null}
      <Text accessibilityRole="header" style={[type.cardTitle, { color: paper.ink }]}>
        {title}
      </Text>
      {summary != null ? <Text style={[type.body, { color: paper.inkSoft }]}>{summary}</Text> : null}
      {canDo != null ? (
        <View style={ls.canDo}>
          <Text style={[type.small, { color: paper.inkSoft }]}>{CAN_DO_LEAD}</Text>
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{canDo}</Text>
        </View>
      ) : null}
      {lines.length > 0 ? (
        <View style={ls.lines}>
          {lines.map((line) => (
            <Text key={line} style={[type.french, { color: paper.ink }]}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      {minutes != null || support != null || tutor != null ? (
        <View style={ls.facts}>
          {minutes != null ? (
            <View style={ls.fact}>
              {minutesMark}
              <Text style={[type.small, { color: paper.inkSoft }]}>{minutes}</Text>
            </View>
          ) : null}
          {support != null ? <Text style={[type.small, { color: paper.inkSoft }]}>{support}</Text> : null}
          {tutor != null ? <Text style={[type.small, { color: paper.inkSoft }]}>{tutor}</Text> : null}
        </View>
      ) : null}
      {reason != null ? <Text style={[type.small, { color: paper.inkSoft }]}>{reason}</Text> : null}
      {action}
      {secondary != null ? secondary : null}
    </Card>
  );
}

/**
 * Length-aware sizing for the French hero: 34 for a short line, then 30, then
 * 26, the way a sign is cut to fit its longest word rather than clipped. Every
 * step is larger than any UI head a card carries (theme.test.ts).
 */
export function fitHero(text: string): TextStyle {
  if (text.length <= 16) return type.frenchHero;
  if (text.length <= 32) return heroFit.long;
  return heroFit.longest;
}

const ls = StyleSheet.create({
  row: {
    minHeight: HIT + space(3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
    borderBottomWidth: HAIRLINE,
    borderBottomColor: paper.line,
  },
  pressed: { transform: [{ scale: 0.985 }, { translateY: 1 }] },
  glyph: { minWidth: 24, alignItems: 'center', justifyContent: 'center' },
  words: { ...ROW_WORDS, gap: space(0.5) },
  bandHost: { alignSelf: 'flex-start', paddingHorizontal: space(1) },
  band: { position: 'absolute', left: 0, right: 0, top: '42%', bottom: space(0.5), borderRadius: space(0.5) },
  soundTag: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    gap: space(2),
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(1),
  },
  ladder: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  rungs: { flexDirection: 'row', alignItems: 'flex-end', gap: space(1) },
  rung: { width: space(4), height: space(1.5), borderRadius: space(0.5) },
  rungHere: { height: space(4) },
  path: { gap: space(5) },
  pathLevel: { gap: space(3) },
  stop: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  stopMark: {
    width: space(3.5),
    height: space(3.5),
    marginTop: space(1),
    borderRadius: radius.pill,
    borderWidth: HAIRLINE + 0.5,
    borderColor: paper.line,
  },
  stopEarned: { backgroundColor: paper.ink, borderColor: paper.ink },
  tutor: { gap: space(3) },
  tutorHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  hear: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearPressed: { backgroundColor: paper.groundDeep },
  brief: { gap: space(3) },
  briefHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space(3) },
  corner: { minWidth: HIT, minHeight: HIT, alignItems: 'flex-end', justifyContent: 'center' },
  canDo: { gap: space(0.5) },
  lines: { gap: space(1.5), paddingLeft: space(3), borderLeftWidth: HAIRLINE + 1, borderLeftColor: paper.line },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(3) },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
});
