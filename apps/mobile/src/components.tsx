/**
 * The paper & ink component vocabulary.
 *
 * Flat white cards with a hairline rule on lilac paper, solid ink pills for
 * the one primary action, quiet outline and ghost buttons for everything
 * second. Icons are authored line art at the same 2.2 stroke the
 * illustrations use — one pen drew the whole app.
 */

import { useEffect, useId, useState, type ReactNode } from 'react';
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
import {
  accent,
  decorative,
  font,
  paper,
  radius,
  shadow,
  signal,
  space,
  tint,
  type,
  DISC,
  HAIRLINE,
  HIT,
  STROKE,
  rungColor,
  type TintName,
} from './theme.ts';
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
 * A white card: one soft whisper of shadow, a hairline rule, generous corners.
 *
 * The whisper is the only shadow in the app besides the live microphone's glow,
 * and it lives in `theme.ts` as a named token so no screen ever writes a shadow
 * number. The hairline stays under it on purpose: elevation renders nothing on
 * Android below API 28 and clips oddly on the web column, and without the rule
 * a card there would dissolve into the ground.
 */
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
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
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
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
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
        onPress={onPress}
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
        <Text id={labelId} style={[type.label, { color: accent.label }]}>
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            s.field,
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
 * A segmented choice: a soft track with a violet active pill. `active` may be
 * null, for a setting nobody has chosen yet, and the group can name itself so a
 * screen reader says what the three words are a choice of (F368).
 *
 * The chosen segment wears the identity violet with warm-white lettering, the
 * way the primary pill and the active tab already do, so a learner reads their
 * daily goal off the same colour everywhere. The unchosen words stay soft ink
 * on the track, which is a step down rather than a second state colour.
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
            <Text style={[type.button, { color: isActive ? paper.onInk : paper.inkSoft }]}>{tab.label}</Text>
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
 * The learner's initial, drawn one way: a filled violet disc with a serif
 * initial in warm-white. The violet is the identity colour palette.ts names for
 * "the primary action and the monogram", so the fill is the design rather than a
 * hollow ring. It is decorative to assistive tech — the name is said in the text
 * beside it, so a screen reader walks past the disc rather than reading a letter.
 */
export function Monogram({ initial, size = HIT }: { initial: string; size?: number }) {
  return (
    <View
      {...decorative}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: accent.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: font.serif, fontSize: size * 0.44, color: paper.onInk }}>{initial}</Text>
    </View>
  );
}

/**
 * A soft paper disc under a place's line art.
 *
 * A tint is a surface under ink, never a mark and never lettering (F362).
 * This was the only place one was ever drawn until F467 added the ground under
 * a row about one place; the rule it obeys is unchanged, and both live in this
 * file so a screen never names a colour.
 */
export function TintDisc({ tint: name, size = 64, children }: { tint: TintName; size?: number; children?: React.ReactNode }) {
  return (
    <View
      {...decorative}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint[name],
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

/**
 * The ground under a row about one place, in that place's own tint.
 *
 * The founder asked for the mockup's colour to reach the rows themselves rather
 * than stopping at the disc, and the honest way to do that was to widen the
 * rule in the open rather than to route around the test that held it (F467).
 * The rule is now: a tint is a SURFACE. It is the disc under a drawing, or the
 * ground under a row that is about one place, and it is never lettering, never
 * a stroke, never a border, and never a mark that reports state. Everything the
 * old rule was protecting still holds, and `palette.test.ts` catches lettering
 * more tightly than it did before, because the ban used to miss
 * `backgroundColor` by an accident of casing rather than by permission.
 *
 * The colour maths needed nothing: every tint already sits at least eight from
 * the ground, the deeper fill, the card and the card's rule, thirty from every
 * signal and the accent, twenty from every rung, and lighter than every mark,
 * with ink clearing 4.5 on all six.
 *
 * Not decorative, unlike the disc. A row has words in it, and hiding the
 * container would take its contents with it.
 */
export function TintPanel({
  tint: name,
  children,
  style,
}: {
  tint: TintName;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ backgroundColor: tint[name], borderRadius: radius.card }, style]}>{children}</View>;
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

/** TodayRow's mark, at TodayRow's size, because it is TodayRow's mark. */
const MARK = 10;

/**
 * Seven marks for seven days, oldest first, each under the day it stands for
 * (F561, F577).
 *
 * A picture, never a target: a day that happened is a filled mark and a day
 * that did not is a hairline, on TodayRow's rule that a thing which has not
 * happened is not a state worth signalling. Home's momentum card and Profile's
 * rhythm draw the same rail, so the week looks the same wherever a learner
 * meets it.
 *
 * The fill is the identity violet since revamp A, and that is a deliberate
 * exception rather than a drift. The rule it bends is "a state mark is never
 * violet", which exists so nothing reads as the primary action; a calendar
 * record is not a state, it is a diary of days already spent, and the founder
 * chose the identity colour for it. The orb's traffic lights remain the only
 * marks in the app that report a state, and none of them is violet.
 *
 * `labels` are the seven day names. Given them, each mark sits in its own
 * column under its day; given nothing, the rail is the bare row of dots it has
 * always been. Either way the whole thing is hidden from assistive technology:
 * seven letters read aloud are not a week, and whatever the rail stands beside
 * says the week in a sentence.
 */
export function WeekRail({ week, labels }: { week: readonly boolean[]; labels?: readonly string[] }) {
  return (
    <View style={s.marks} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {week.map((filled, index) => (
        <View key={index} style={s.day}>
          {labels != null && <Text style={[type.small, { color: paper.inkSoft }]}>{labels[index]}</Text>}
          <View style={[s.mark, filled ? s.markDone : s.markWaiting]} />
        </View>
      ))}
    </View>
  );
}

/**
 * A tinted row: the mockup's one way into a place, a practice or a memory.
 *
 * This is the shape the founder circled on every frame — a soft paper ground,
 * a white disc with one line-art glyph on it, the row's name, a quiet gloss
 * under it, and the chevron that says it opens. It is a single Pressable, not
 * a card with a button inside it, because the whole row is the target: a button
 * nested in a button is invalid on the web, and a row whose tap area is only
 * its chevron is the F545 defect wearing a tint.
 *
 * It sits well over the touch floor at `HIT + space(8)`, and it grows rather
 * than clips: nothing here caps a line count or the reading size, so at the
 * largest text the title wraps and the row gets taller.
 *
 * It names itself ONCE. The title and the gloss are two Texts, and a screen
 * reader left to itself would read them as two nodes with no relationship, so
 * the Pressable carries the joined name and a caller with something better to
 * say (a place's own stamp label, say) passes it instead.
 *
 * Disabled is said in ink rather than in opacity, which is GhostButton's
 * lesson: a faded row still looks like a row, and there is no shape left to
 * fall back on. It steps down to soft ink rather than to the faint ink a ghost
 * uses, because faint ink's floor is measured against the ground and the card
 * and nothing has ever measured it on a tint, while soft ink clears the floor
 * for words on all six (palette.test.ts). Pressed is the deeper ground laid
 * over the tint as a second style, never a second tint: a tint is a surface,
 * and there is exactly one of them per place.
 */
export function TintRow({
  tint: name,
  glyph,
  title,
  gloss,
  onPress,
  accessibilityLabel,
  trailing,
  disabled = false,
}: {
  tint: TintName;
  /** One line-art glyph, drawn on the white disc. */
  glyph: ReactNode;
  title: string;
  gloss?: string;
  onPress?: () => void;
  /** Say something other than the title and gloss. Falls back to both, joined. */
  accessibilityLabel?: string;
  /** A state the row has earned, drawn before the chevron. */
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (gloss ? `${title}, ${gloss}` : title)}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        s.tintRow,
        { backgroundColor: tint[name] },
        pressed && !disabled && s.tintRowPressed,
      ]}
    >
      <View style={s.tintDisc} {...decorative}>
        {glyph}
      </View>
      <View style={s.tintWords}>
        <Text style={[type.heading, { color: disabled ? paper.inkSoft : paper.ink }]}>{title}</Text>
        {gloss != null && (
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{gloss}</Text>
        )}
      </View>
      {trailing != null ? trailing : null}
      <ChevronRight color={paper.inkFaint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  marks: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(1.5), marginTop: space(3) },
  day: { alignItems: 'center', gap: space(1) },
  mark: { width: MARK, height: MARK, borderRadius: MARK / 2 },
  markDone: { backgroundColor: accent.primary },
  markWaiting: { borderWidth: HAIRLINE + 0.4, borderColor: paper.line },
  tintRow: {
    minHeight: HIT + space(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.row,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  tintRowPressed: { backgroundColor: paper.groundDeep },
  tintDisc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: paper.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tintWords: { flex: 1, minWidth: 0 },
  abilityRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(2) },
  abilityDivided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  abilityWords: { flex: 1, minWidth: 0 },
  abilityPressed: { opacity: 0.72 },
  card: {
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
    ...shadow.whisper,
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
  tabActive: { backgroundColor: accent.primary },
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
