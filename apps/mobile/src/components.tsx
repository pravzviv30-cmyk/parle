/**
 * The paper & ink component vocabulary.
 *
 * Flat white cards with a hairline rule on lilac paper, solid ink pills for
 * the one primary action, quiet outline and ghost buttons for everything
 * second. Icons are authored line art at the same 2.2 stroke the
 * illustrations use — one pen drew the whole app.
 */

import { useEffect, useId, useState } from 'react';
import {
  AccessibilityInfo,
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
import { accent, decorative, paper, radius, signal, space, type, HAIRLINE, HIT, STROKE, rungColor } from './theme.ts';
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

// ─────────────────────────────────────────────────────────────────── surfaces

/** A flat white card: hairline rule, soft corners, no shadow. */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[s.card, padded && s.cardPadded, style]}>{children}</View>;
}

/** A small caps label above a card or a count. Violet by default: identity work. */
export function Label({ children, color = accent.label }: { children: React.ReactNode; color?: string }) {
  return <Text style={[type.label, { color }]}>{children}</Text>;
}

// ────────────────────────────────────────────────────────────────── controls

/** The one primary action on a screen: a solid ink pill. */
export function PillButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.pill, disabled && s.pillDisabled, pressed && !disabled && { opacity: 0.88 }]}
    >
      {icon}
      <Text style={[type.button, { color: paper.onInk }]}>{label}</Text>
    </Pressable>
  );
}

/** A secondary action: white pill, ink rule. */
export function OutlineButton({
  label,
  sub,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.outline, pressed && !disabled && { backgroundColor: paper.groundDeep }, disabled && { opacity: 0.45 }]}
    >
      <View style={s.outlineRow}>
        {icon}
        <Text style={[type.button, { color: paper.ink }]}>{label}</Text>
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
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.ghost, pressed && !disabled && { opacity: 0.55 }]}
    >
      <Text style={[type.bodyStrong, { color: disabled ? paper.inkFaint : color }]}>{label}</Text>
    </Pressable>
  );
}


/**
 * A tappable option the learner can choose — the successor of the direction
 * plaque. French text in the serif, English gloss beneath, optional replay.
 */
export function OptionCard({
  text,
  gloss,
  onPress,
  onHear,
  selected = false,
}: {
  text: string;
  gloss?: string;
  onPress: () => void;
  /** Replay this option aloud without choosing it. */
  onHear?: () => void;
  selected?: boolean;
}) {
  // The hear control is a sibling of the main press target, not a child — a
  // button nested inside a button is invalid HTML on web. Pressed feedback is
  // lifted to the container so the whole card still flashes as one object.
  const [pressed, setPressed] = useState(false);
  return (
    <View style={[s.option, selected && s.optionSelected, pressed && s.optionPressed]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={gloss ? `${text}, ${gloss}` : text}
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
          accessibilityLabel={`Hear ${text}`}
          style={({ pressed: hearPressed }) => [{ padding: space(2) }, hearPressed && { opacity: 0.6 }]}
        >
          <EarGlyph size={18} color={paper.inkSoft} />
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
}) {
  const [focused, setFocused] = useState(false);
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
        <Text id={labelId} style={[type.label, { color: accent.label }]}>
          {label}
        </Text>
      )}
      <TextInput
        {...webError}
        aria-label={name != null && error != null ? `${name}, ${error}` : name}
        aria-labelledby={label != null ? labelId : undefined}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={paper.inkFaint}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[s.field, center && { textAlign: 'center' }, focused && { borderColor: paper.ink }]}
      />
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

/** The Home top tabs: a soft track with a white active pill. */
export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
  tint = paper.groundDeep,
}: {
  tabs: readonly { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
  /** The current room's quiet pressed-state colour. */
  tint?: string;
}) {
  return (
    <View style={[s.tabTrack, { backgroundColor: tint }]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[s.tab, isActive && s.tabActive]}
          >
            <Text style={[type.button, { color: isActive ? paper.ink : paper.inkSoft }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Onboarding progress: one dot per page, the current one stretched. */
/** One counted fact. End cards and Home both use it, so it lives here. */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flexBasis: '46%', flexGrow: 1 }}>
      <Text style={[type.title, { color: paper.ink }]}>{value}</Text>
      <Text style={[type.label, { color: paper.inkFaint, marginTop: space(1) }]}>{label}</Text>
    </View>
  );
}

export function ProgressDots({ total, index }: { total: number; index: number }) {
  return (
    <View style={s.dotsRow} accessibilityLabel={`Step ${index + 1} of ${total}`}>
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
      onPress={onPress}
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

/** The lesson as a line: one stop per turn, the current one struck larger. */
export function StationLine({ total, index }: { total: number; index: number }) {
  return (
    <View style={s.stationRow} accessibilityLabel={`Stop ${index + 1} of ${total}`}>
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

const s = StyleSheet.create({
  card: {
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
  },
  cardPadded: { paddingVertical: space(4), paddingHorizontal: space(4) },
  pill: {
    minHeight: HIT + 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    backgroundColor: accent.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space(6),
  },
  pillDisabled: { backgroundColor: paper.inkFaint },
  outline: {
    minHeight: HIT + 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.card,
    borderWidth: 1.5,
    borderColor: paper.ink,
    borderRadius: radius.pill,
    paddingVertical: space(2.5),
    paddingHorizontal: space(5),
  },
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
    borderRadius: radius.pill,
    padding: 3,
  },
  tab: {
    flex: 1,
    // theme.ts calls HIT the floor "enforced on every control", and this was
    // the one control built under it.
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  tabActive: { backgroundColor: paper.card },
  dotsRow: { flexDirection: 'row', gap: space(1.5), alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: paper.line },
  dotHere: { width: 22, backgroundColor: paper.ink },
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
