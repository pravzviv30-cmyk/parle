import { Feedback } from './motion/Feedback.tsx';
import { lockSpoken, requiredPlan, unlockPlanName, type LockedFeature, type UnlockPlan } from './access/featureAccess.ts';
/**
 * Luvani, bright (revamp B): the shared parts every screen builds from.
 *
 * White cards with no hairline and no shadow, ledger rows ruled by hairlines,
 * one fully rounded ink pill for the one primary action, underlined text links
 * for everything second, and a single highlighter band behind one French line.
 * Every tappable part presses through `Press`, the one spring. Icons are the
 * generated set in `src/icons/` (come alive, D11), drawn through `Icon`.
 *
 * Append-only: `components.test.ts` slices this file between adjacent exports,
 * so a new component goes at the end, after the stylesheet.
 */

import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
  Modal,
  PanResponder,
  Easing,
  findNodeHandle,
  KeyboardAvoidingView,
  ScrollView,
  Animated,
  View,
  Text,
  TextInput,
  Pressable,
  PixelRatio,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { AnimatedIcon, type AnimatedIconKind } from './icons/AnimatedIcon.tsx';
import { Icon, type IconName } from './icons/Icon.tsx';
import { TileOnChosen } from './icons/IconTile.tsx';
import {
  STROKE,
  accent,
  colour,
  decorative,
  font,
  frenchText,
  heroFit,
  highlight,
  onColour,
  orb,
  paper,
  pastel,
  radius,
  segmentPending,
  liftStyle,
  signal,
  space,
  textOn,
  type,
  HAIRLINE,
  HIT,
  FOCUS,
  rungColor,
  rungLabel,
} from './theme.ts';
import { useB, useThemedStyles, type B } from './main/bTheme.tsx';
import Reanimated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { pressed, tapSettled } from './motion/haptics.ts';
import { PRESS_SCALE, PRESS_SCALE_TILE, SELECT_RING_OPACITY, pressTo, ringTo, selectPop, stopMotion, useReduceMotion } from './motion.ts';
import { OrbGlyph } from './tutor/OrbGlyph.tsx';
import { OrbSurface } from './tutor/OrbSurface.tsx';
import { holdCelebrations } from './celebrate/queue.ts';
import { READING, actionRowWraps } from './responsiveLayout.ts';
import type { Rung } from '@luvani/core';
import { composeKeyDown, installFocusRule, spaceActivator } from './keyActivation.ts';

// The keyboard focus ring (F927): one rule, added once, on the web only.
if (Platform.OS === 'web') installFocusRule(FOCUS);
/** A web-only key handler react-native's types do not name, typed empty so it spreads onto a Pressable. */
const webKeyDown = (handler: ((event: { key: string; repeat?: boolean; preventDefault: () => void }) => void) | undefined) =>
  (Platform.OS === 'web' && handler ? { onKeyDown: handler } : {}) as Record<string, never>;

// ─────────────────────────────────────────────────────────────── drawn icons
// Come alive (D11): every mark below is now a delegate to the generated icon
// set in `src/icons/`, edited in place so each keeps its name, its default size
// and colour, and its place between the exports this file is sliced by. New
// code draws `<Icon name=... />` directly. The brand marks stay drawn here:
// they are Apple's and Google's, filled in the one colour they are given.

/** Next: an arrow. */
export function ArrowRight({ size = 18, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="forward" size={size} color={color} />;
}

/** Back: a chevron pointing left. */
export function ChevronLeft({ size = 22, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="back" size={size} color={color} />;
}

/**
 * The mirror of ChevronLeft, and the one mark at the end of a row that opens.
 * It is a mark beside words that already say where the row goes, never a word
 * itself.
 */
export function ChevronRight({ size = 22, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="chevron-right" size={size} color={color} />;
}

/**
 * The microphone, which is also Speak: the Speak tab and the control are the
 * same microphone on purpose, so `nav/icons.tsx` re-exports this one, and the
 * tab bar passes `focused` to draw it Bulk when Speak is the selected tab.
 */
export function MicGlyph({ size = 30, color: asked, focused = false }: { size?: number; color?: string; focused?: boolean }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="microphone" variant={focused ? 'bulk' : 'linear'} size={size} color={color} />;
}

/** The speaker: sound arriving, not being captured. */
export function EarGlyph({ size = 26, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="speaker" size={size} color={color} />;
}

/** Help: a question in a speech bubble. */
export function HelpGlyph({ size = 16, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.muted;
  return <Icon name="help" size={size} color={color} />;
}

/**
 * The mark beside the days a learner has been active: a flame, the warmth of
 * the days that have happened, in the one stroke weight. No caller today; the
 * streak's own flame is `game/art`'s and moves through `AnimatedIcon`.
 */
export function FlameGlyph({ size = 18, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="flame" size={size} color={color} />;
}

/** A seedling: Luvani's own drawing in the set, kept until its callers retire (F602, F605). */
export function SproutGlyph({ size = 18, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="sprout" size={size} color={color} />;
}

/** An outline bookmark, drawn on the control that saves a situation, not on a saved one. */
export function BookmarkGlyph({ size = 18, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="bookmark" size={size} color={color} />;
}

/** The mark beside a goal for today, so the number beside it reads as aimed at rather than scored. */
export function TargetGlyph({ size = 18, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="flag" size={size} color={color} />;
}

/**
 * A tick inside a ring, beside how much of the deck is coming back: a check and
 * not a medal, because the figure under it is what a learner remembered rather
 * than a prize somebody handed them.
 */
export function BadgeGlyph({ size = 18, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="tick-circle" size={size} color={color} />;
}

/** ICONS.md `google`: the brand mark, filled in the one colour it is given. */
export function GoogleMark({ size = 20, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <Path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill={color}
      />
    </Svg>
  );
}

/** ICONS.md `apple`: the brand mark, filled in the one colour it is given. */
export function AppleMark({ size = 20, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <Path
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        fill={color}
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────── surfaces

/**
 * The one card (SNIPPETS card-white): white at the card radius, with no
 * hairline, no shadow and no outline, and never nested inside another card.
 * White on the paper ground is the whole edge.
 *
 * `tone="feature"` is deprecated and draws white like every other card.
 * `journal` keeps the ground colour for the one card that sits a French line on
 * the page itself. `lift` is the one soft lift (UI-006), for an illustrated
 * Explore tile only; every other card stays flat.
 */
export function Card({
  children,
  style,
  padded = true,
  tone = 'paper',
  lift = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  tone?: 'paper' | 'feature' | 'journal';
  /** The one soft lift (UI-006), for an illustrated Explore tile only. */
  lift?: boolean;
}) {
  const t = useB();
  const s = useThemedStyles(makeS);
  return <View style={[s.card, tone === 'journal' && { backgroundColor: t.ground }, lift && liftStyle, padded && s.cardPadded, style]}>{children}</View>;
}

/**
 * The meta line a card may carry (SNIPPETS meta-line): small, soft ink,
 * sentence case, never a pill. STYLE's `label` weight is for buttons and row
 * titles; a line that annotates a card is quieter than the heading under it.
 */
export function Label({ children, color: asked }: { children: React.ReactNode; color?: string }) {
  const t = useB();
  const color = asked ?? t.muted;
  return <Text style={[type.small, { color }]}>{children}</Text>;
}

// ────────────────────────────────────────────────────────────────── controls

/**
 * The one button (UI-004/UI-005). The primary action on a screen is a 54pt
 * ink pill, fully rounded, with white `button` words and an optional leading
 * icon; `variant="secondary"` is a 46pt white or pastel pill with ink words. Ink with white lettering on paper, sun, mint or white; white
 * with ink lettering on blue or coral. Disabled is soft ink lettering on the
 * sand skeleton for an ink pill, and on the blue ground's pale secondary for a
 * white one (come alive, icons section 3.4; F758): a soft ink pill with white
 * words read as a live one, so the off pill is quieter than any live control
 * rather than a second dark one.
 */
export function PillButton({
  label,
  onPress,
  disabled = false,
  icon,
  trailingIcon,
  accessibilityLabel,
  tone = 'ink',
  compact = false,
  outlined = false,
  decoration,
  ref,
  state = 'idle',
  variant = 'primary',
  pastel,
  disabledReason,
  lip = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /**
   * Why a disabled pill is off, for the learner who reaches it by keyboard or
   * screen reader. When given, the pill stays in the tab order, says it is
   * off and why, and ignores the press (F927, the NextButton pattern).
   */
  disabledReason?: string;
  icon?: React.ReactNode;
  /** Decorative directional affordance after the label. */
  trailingIcon?: React.ReactNode;
  /** Say something other than the label to assistive tech. Falls back to label. */
  accessibilityLabel?: string;
  /** Ink or brand fill with white words; white or sun fill with ink words. */
  tone?: 'ink' | 'white' | 'sun' | 'brand';
  /** Half-width auth actions retain the touch floor and allow their labels to wrap. */
  compact?: boolean;
  /** An ink border gives a white auth action definition on cream. */
  outlined?: boolean;
  /** Non-interactive surface decoration, inside the pressed geometry. */
  decoration?: React.ReactNode;
  /** The pressable itself, for a caller that moves a screen reader onto it (the answer sheet's Continue). */
  ref?: Ref<View>;
  /**
   * The pill waiting in place (come alive, README Part 5.G). `busy` turns its
   * mark into the turning refresh; `done` draws the check where the spinner
   * was, and is passed only for a real resolved result, such as an entitlement
   * the server confirmed. Either keeps the live fill and takes no second press.
   * Back to `idle` simply drops the mark: no shake. The caller's label says the
   * state ("Opening the store…"); movement is the icons' own, still under
   * Reduce Motion.
   */
  state?: 'idle' | 'busy' | 'done';
  /**
   * Deprecated no-op (UI-004/UI-005): the bold-rhythm look is folded into the
   * one pill, so every primary action draws the same. Still accepted so the
   * onboarding alias and older call sites type-check.
   */
  design?: 'bold-rhythm';
  /**
   * `primary` is the 54pt ink pill. `secondary` is the 46pt white pill with
   * ink words, or a pastel one when `pastel` names the ground (UI-005).
   */
  variant?: 'primary' | 'secondary';
  /** The pastel fill of a secondary pill on a white card. */
  pastel?: keyof typeof pastelFill;
  /**
   * Drill B v2 (UI-016): a 4pt lip in `primaryLip` drawn as a View under the
   * pill, never a shadow, sinking 2pt while pressed. Opt in; off by default so
   * every other pill draws as before. A disabled pill keeps the space but no lip.
   */
  lip?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const t = useB();
  const s = useThemedStyles(makeS);
  const waiting = state !== 'idle';
  const secondary = variant === 'secondary';
  // White and sun pills sit on a colour ground and keep their ink in both
  // modes; the ink pill is the theme's primary, and a secondary pill is themed.
  const foreground = secondary ? t.text : tone === 'white' || tone === 'sun' ? paper.ink : t.onPrimary;
  const [pressed, setPressed] = useState(false);
  const sunk = lip && pressed && !disabled && !waiting ? PILL_LIP_PRESS : 0;
  const pressIn = lip ? () => setPressed(true) : undefined;
  const pressOut = lip ? () => setPressed(false) : undefined;
  const pill = (
    <Press haptic="light" depth="control" onPressIn={pressIn} onPressOut={pressOut} style={[lip && { marginTop: sunk, marginBottom: PILL_LIP - sunk }, s.pill, compact && { paddingHorizontal: space(3) }, tone === 'white' && s.pillWhite, outlined && s.pillOutlined, tone === 'sun' && { backgroundColor: colour.sun }, tone === 'brand' && { backgroundColor: colour.blue }, secondary && s.pillSecondary, secondary && pastel != null && { backgroundColor: t[pastel] }, disabled && (tone === 'white' ? s.pillDisabledOnColour : s.pillDisabled)]} disabled={disabled || waiting} disabledReason={disabled && !waiting ? disabledReason : undefined} onPress={onPress} accessibilityLabel={accessibilityLabel ?? label} accessibilityState={waiting ? { busy: state === 'busy', disabled: true } : undefined} ref={ref}>
      {waiting ? <PillWait done={state === 'done'} color={foreground} /> : icon}
      <Text style={[type.button, { color: disabled ? (tone === 'white' ? paper.inkSoft : t.muted) : foreground }, compact && { flexShrink: 1, textAlign: 'center' }]} maxFontSizeMultiplier={fontScale + 1}>{label}</Text>
      {!waiting && trailingIcon}
      {decoration}
    </Press>
  );
  if (!lip) return pill;
  return <View style={{ borderRadius: radius.pill, backgroundColor: disabled ? 'transparent' : t.primaryLip }}>{pill}</View>;
}

/** The drill primary's lip, and how far the pill sinks into it under a finger (UI-016). */
const PILL_LIP = 4;
const PILL_LIP_PRESS = 2;

/**
 * The pill's waiting mark: the check-draw mounted from the start so it draws
 * when the result lands, with the turning refresh over it until then.
 */
function PillWait({ done, color }: { done: boolean; color: string }) {
  const s = useThemedStyles(makeS);
  return (
    <View {...decorative} style={s.pillWait}>
      <AnimatedIcon kind="check-draw" size={PILL_MARK} color={color} state={done ? 'on' : 'off'} />
      {done ? null : (
        <View style={StyleSheet.absoluteFill}>
          <AnimatedIcon kind="refresh-spin" size={PILL_MARK} color={color} active />
        </View>
      )}
    </View>
  );
}

const PILL_MARK = 24;
/** UI-005 control heights: the primary pill and the secondary pill. */
export const PILL_HEIGHT = 54;
export const SECONDARY_HEIGHT = 46;
/** The pastel names a secondary pill may take; their fills come from the theme. */
const pastelFill = pastel;


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
  const t = useB();
  const s = useThemedStyles(makeS);
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
        <Text style={[type.bodyStrong, { color: t.text }]}>{label}</Text>
      </View>
      {sub != null && <Text style={[type.small, { color: t.muted, marginTop: space(0.5) }]}>{sub}</Text>}
    </Pressable>
  );
}

/**
 * The second action (SNIPPETS link-text): an underlined word at the touch
 * floor, ink on paper, sun and mint, white on blue and coral (the caller passes
 * `color`). At most two per screen, never a box, so nothing competes with the
 * one pill.
 *
 * Disabled is said in soft ink, not in opacity: a bare word has no shape to
 * fall back on once it fades. It overrides the caller's `color` on purpose,
 * because a dead control drawn in the live colour is the bug this closes. A
 * disabled Press never presses, so it neither shrinks nor ticks.
 *
 * No `accessibilityState` here, and none in PillButton or OutlineButton
 * either: Pressable already folds its own `disabled` into that state, and the
 * prop wins over anything spelled out alongside it.
 */
export function GhostButton({
  label,
  onPress,
  disabled = false,
  color: asked,
  small = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  /** Small supporting links keep the same minimum touch target. */
  small?: boolean;
  /** Say something other than the label to assistive tech. Falls back to label. */
  accessibilityLabel?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const t = useB();
  const s = useThemedStyles(makeS);
  const color = asked ?? t.text;
  return (
    <Press haptic="light" style={s.ghost} disabled={disabled} onPress={onPress} accessibilityLabel={accessibilityLabel ?? label}>
      <Text style={[small ? type.small : type.label, { color: disabled ? t.muted : color, textDecorationLine: 'underline' }]} maxFontSizeMultiplier={fontScale + 1}>{label}</Text>
    </Press>
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
  const t = useB();
  const s = useThemedStyles(makeS);
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
          <Text style={[type.french, { color: t.text }]}>{text}</Text>
          {gloss != null && (
            <Text style={[type.small, { color: t.muted, marginTop: space(0.5) }]}>{gloss}</Text>
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
            playing && { backgroundColor: t.skeleton, borderRadius: radius.pill },
            hearPressed && { opacity: 0.6 },
          ]}
        >
          <EarGlyph size={18} color={playing ? t.text : t.muted} />
        </Pressable>
      )}
      <ArrowRight size={18} color={t.muted} />
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
  const t = useB();
  const s = useThemedStyles(makeS);
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
        <Text id={labelId} style={[type.small, { fontFamily: font.semiBold, color: t.text }]}>
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
          placeholder={placeholder ?? 'Type here'}
          placeholderTextColor={t.muted}
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
            focused && { borderColor: t.text },
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
            <Text style={[type.small, { fontFamily: font.medium, color: t.muted }]}>{revealed ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
      {error != null && (
        // SNIPPETS field: the alert mark, then what happened and what to do,
        // in ink. Errors are never red; the mark and the words carry it. The
        // mark is decorative, so what is announced is still the one line.
        <View style={s.fieldError}>
          <View style={s.fieldErrorMark}>
            <AlertGlyph size={16} color={t.text} />
          </View>
          <Text
            id={errorId}
            role="alert"
            accessibilityLiveRegion="polite"
            style={[type.small, ROW_WORDS, { color: t.text }]}
          >
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * A segmented choice (SNIPPETS segmented): a sand track with a white chosen
 * segment, never ink capsules. `active` may be null, for a setting nobody has
 * chosen yet, and the group can name itself so a screen reader says what the
 * three words are a choice of (F368).
 *
 * The chosen word is ink at Bold on white, the rest soft ink at SemiBold on the
 * track, so the control never competes with the one ink pill. Each segment
 * stays at the 44 touch floor (SNIPPETS draws 38), so the track is 50 tall, and
 * the corners are concentric: the track's field radius, each segment 3 less.
 * A choice is a selection tick, so each segment presses through `Press` with
 * `haptic="selection"`.
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
  track: askedTrack,
  appearance = 'segments',
  accessibilityLabel,
}: {
  tabs: readonly { key: K; label: string }[];
  active: K | null;
  onChange: (key: K) => void;
  /** The sand track behind the segments. */
  track?: string;
  appearance?: 'segments' | 'underline';
  accessibilityLabel?: string;
}) {
  const t = useB();
  const s = useThemedStyles(makeS);
  const track = askedTrack ?? t.skeleton;
  return (
    <View style={[s.tabTrack, { backgroundColor: appearance === 'underline' ? 'transparent' : track, borderRadius: appearance === 'underline' ? 0 : radius.control }]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Press haptic="selection" frame={s.segmentFrame}
            key={tab.key}
            style={[s.tab, appearance === 'segments' && isActive && s.tabActive, appearance === 'underline' && { borderBottomWidth: 2, borderBottomColor: isActive ? accent.brand : 'transparent', borderRadius: 0 }]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            aria-selected={isActive}
          >
            <Text style={[type.label, { color: isActive ? t.text : t.muted, fontFamily: isActive ? font.bold : font.semiBold }]}>{tab.label}</Text>
          </Press>
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
  const t = useB();
  return (
    <View style={{ flexBasis: columns === 3 ? '30%' : '46%', flexGrow: 1 }}>
      <Text style={[type.title, { color: t.text }]}>{value}</Text>
      {/* The caption is words under a number, so it is soft ink, not the faint
          ink that was only ever cleared as a mark (F330). */}
      <Text style={[type.label, { color: t.muted, marginTop: space(1) }]}>{label}</Text>
    </View>
  );
}

/**
 * The learner's initial, drawn one way (SNIPPETS header-tab): a white initial
 * in Outfit Bold on an ink disc, sized from the disc.
 *
 * It is decorative to assistive tech: the name is said in the text beside it,
 * or the control that holds it names itself, so a screen reader walks past a
 * loose letter.
 */
export function Monogram({ initial, size = HIT, inverted = false }: { initial: string | null; size?: number; inverted?: boolean }) {
  const t = useB();
  // 2026-10-20 UI-008, artboard B-Journey: on the brand band the disc flips to
  // the card fill with ink letters (`inverted`); everywhere else it is unchanged.
  const ink = inverted ? t.text : t.onAvatar;
  return (
    <View
      {...decorative}
      style={[{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.avatar,
        alignItems: 'center',
        justifyContent: 'center',
      }, inverted ? { backgroundColor: t.card } : null]}
    >
      {initial === null ? (
        // 2026-10-20, sim nits: no name, no letter; a neutral person glyph.
        <Icon name="user" size={Math.round(size * 0.5)} color={ink} />
      ) : (
        <Text style={[{ fontFamily: font.bold, fontSize: size * 0.44, color: t.onAvatar }, inverted ? { color: ink } : null]}>{initial}</Text>
      )}
    </View>
  );
}

/**
 * Progress through a sequence (SNIPPETS story-segments): N equal bars, the done
 * ones first, in the words' colour of the ground they sit on, the rest in that
 * ground's pending tint. One element to assistive tech, "Step 2 of 6".
 *
 * The row stretches to its slot, because four of its callers sit it in the
 * header's centred title slot, where bars that share the width would otherwise
 * share nothing.
 */
export function ProgressDots({ total, index, ground = 'paper' }: { total: number; index: number; ground?: Ground | 'paper' }) {
  const t = useB();
  const s = useThemedStyles(makeS);
  const done = ground === 'blue' || ground === 'coral' ? paper.onInk : ground === 'paper' ? t.text : paper.ink;
  return (
    <View style={s.segments} accessible accessibilityLabel={`Step ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[s.segment, { backgroundColor: i <= index ? done : ground === 'paper' ? t.line : segmentPending[ground] }]} />
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
  const t = useB();
  const s = useThemedStyles(makeS);
  // The live and idle circle is mint in both modes, so its mic stays ink.
  const iconColor = muted ? t.muted : paper.ink;
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
      accessibilityState={{ disabled: disabled || muted }}
      style={({ pressed }) => [
        s.speak,
        { width: size, height: size, borderRadius: size / 2 },
        active ? s.speakLive : muted ? s.speakMuted : s.speakIdle,
        pressed && !active && { backgroundColor: t.skeleton },
      ]}
    >
      <MicGlyph size={size * 0.34} color={iconColor} />
    </Pressable>
  );
}

/** A rung bullet. Support colour when active, quiet outline when not. */
export function LineBullet({ rung, active, size = 26 }: { rung: Rung; active: boolean; size?: number }) {
  const t = useB();
  const color = rung === 4 ? t.text : t.skeleton;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: active ? color : 'transparent',
        borderWidth: active ? 0 : HAIRLINE + 0.5,
        borderColor: active ? color : t.field,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: type.button.fontFamily,
          fontSize: size * 0.44,
          // Rung 4 is ink-filled; its numeral must go light or it vanishes.
          color: active ? (rung === 4 ? (t.mode === 'light' ? paper.onInk : t.ground) : t.text) : t.muted,
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
  const t = useB();
  const s = useThemedStyles(makeS);
  return (
    <View style={s.stationRow} {...decorative}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < index;
        const here = i === index;
        return (
          <View key={i} style={s.stationCell}>
            {i > 0 && <View style={[s.stationRail, { backgroundColor: done || here ? t.text : t.line }]} />}
            <View
              style={[
                s.stationDot,
                here && s.stationDotHere,
                { backgroundColor: done || here ? t.text : t.line },
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
  const t = useB();
  const s = useThemedStyles(makeS);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [s.abilityRow, !first && s.abilityDivided, pressed && s.abilityPressed]}
    >
      {leading}
      <View style={s.abilityWords}>
        <Text style={[type.bodyStrong, { color: t.text }]}>{title}</Text>
      </View>
      <ArrowRight />
    </Pressable>
  );
}

// The seven-mark week rail (`WeekRail`, F561/F577) stood here until the
// notebook final sweep, 2026-09-27. The week is a sentence on Today and on
// Profile now, and the rail's last live caller was the retired French wall page.

/** The parts' shared sheet, built once per mode (UI-008, 2026-10-20). */
const makeS = (t: B) => StyleSheet.create({
  abilityRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(2) },
  abilityDivided: { borderTopWidth: HAIRLINE, borderTopColor: t.line },
  abilityWords: ROW_WORDS,
  abilityPressed: { opacity: 0.72 },
  card: { backgroundColor: t.card, borderRadius: radius.card },
  cardPadded: { paddingVertical: space(4), paddingHorizontal: space(4) },
  pill: {
    minHeight: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    backgroundColor: t.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space(6),
    paddingVertical: space(3),
  },
  pillWhite: { backgroundColor: paper.card },
  // UI-005: the secondary pill, 46pt (inside 44 to 48), white with ink words.
  pillSecondary: { minHeight: SECONDARY_HEIGHT, backgroundColor: t.card, paddingVertical: space(2) },
  pillOutlined: { borderWidth: STROKE, borderColor: t.text },
  pillWait: { width: PILL_MARK, height: PILL_MARK },
  pillDisabled: { backgroundColor: t.skeleton },
  // A white pill sits on blue or coral, where the sand reads as one more live
  // fill; off there is the blue ground's pale secondary (F758).
  pillDisabledOnColour: { backgroundColor: onColour.blue },
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
  option: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: t.card,
    borderWidth: HAIRLINE,
    borderColor: t.field,
    borderRadius: radius.card,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  optionSelected: { borderColor: t.text, borderWidth: 1.5 },
  optionPressed: { backgroundColor: t.skeleton },
  optionMain: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', borderRadius: radius.card },
  field: {
    minHeight: HIT + 12,
    backgroundColor: t.card,
    borderWidth: 1.5,
    borderColor: t.field,
    borderRadius: radius.input,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    ...type.body,
    color: t.text,
  },
  tabTrack: { flexDirection: 'row', backgroundColor: t.skeleton, borderRadius: radius.field, padding: 3 },
  tab: {
    // theme.ts calls HIT the floor "enforced on every control", and SNIPPETS'
    // 38 would be the one control built under it.
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.field - 3,
  },
  tabActive: { backgroundColor: t.card },
  segmentFrame: { flex: 1 },
  segments: { flexDirection: 'row', alignSelf: 'stretch', gap: space(1.5) },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  speak: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.card,
  },
  speakIdle: { backgroundColor: colour.mint },
  speakLive: { backgroundColor: colour.mint },
  speakMuted: { borderWidth: 2, borderColor: t.field },
  stationRow: { flexDirection: 'row', alignItems: 'center' },
  stationCell: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stationRail: { height: 2, flex: 1 },
  stationDot: { width: 7, height: 7, borderRadius: radius.pill },
  stationDotHere: {
    width: 13,
    height: 13,
    borderWidth: 3,
    borderColor: t.ground,
  },
  fieldError: { flexDirection: 'row', alignItems: 'flex-start', gap: space(1.5) },
  // Centres the 16 mark on the small line's first 20pt row.
  fieldErrorMark: { paddingTop: space(0.5) },
});

// ─────────────────────────────────────────── the notebook marks (Phase 1)
// Appended, because every region above is sliced between adjacent exports.

/**
 * A list (SNIPPETS list): rows inside one white card, split by hairlines. The
 * rule sits BETWEEN rows, never above the first or under the last, so the
 * card's own edge is the only edge. A child that is null or false draws no row
 * and no rule, because the rows are counted after React drops them. A list to
 * assistive tech, so a screen reader can say how many rows there are before the
 * learner walks them; the rules are decorative.
 *
 * It is a card, so it is never put inside another card (F602 files the screens
 * that still do to their own passes).
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
  const rows = Children.toArray(children);
  const ls = useThemedStyles(makeLs);
  return (
    <View accessibilityRole="list" accessibilityLabel={accessibilityLabel} style={[ls.ledger, style]}>
      {rows.flatMap((row, index) => (index === 0 ? [row] : [<View key={`rule-${index}`} {...decorative} style={ls.rule} />, row]))}
    </View>
  );
}

/**
 * One row of a list (SNIPPETS list): an optional 24pt ink glyph with no disc, a
 * 16 title, a soft detail, an optional note, trailing meta, and the soft 20
 * chevron that says it opens. A French title (`lang="fr"`) is set as French
 * and marked so a screen reader reads it in a French voice.
 *
 * One Press, never a card with a button inside it: the whole row is the
 * target, and a button nested in a button is invalid on the web (F545). It sits
 * at 60 and grows rather than clips, because nothing here caps a line count or
 * the reading size. It names itself ONCE, from the title and the gloss, unless
 * the caller has something better to say. Disabled is said in soft ink rather
 * than opacity, because a faded row has no shape to fall back on. The row rules
 * nothing itself: the `Ledger` around it draws the hairline between rows.
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
  lang,
}: {
  /** One line-art glyph in ink. No disc under it. */
  glyph?: ReactNode;
  /** The row's one meta line, above the title, when the title alone names nothing. */
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
  /** The title is a French line: set as French, and read in a French voice. */
  lang?: 'fr';
}) {
  const t = useB();
  const ls = useThemedStyles(makeLs);
  const color = disabled ? t.muted : t.text;
  return (
    <Press haptic="light" style={ls.row} disabled={disabled} onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (gloss ? `${title}, ${gloss}` : title)}
      accessibilityState={{ disabled }}
    >
      {glyph != null ? (
        <View style={ls.glyph} {...decorative}>
          {glyph}
        </View>
      ) : null}
      <View style={ls.words}>
        {label != null ? <Label>{label}</Label> : null}
        {lang === 'fr' ? (
          <Text {...frenchText} style={[type.french, { color }]}>{title}</Text>
        ) : (
          <Text style={[type.label, { color }]}>{title}</Text>
        )}
        {gloss != null && gloss !== '' ? <Text style={[type.small, { color: t.muted }]}>{gloss}</Text> : null}
        {note != null && note !== '' ? <Text style={[type.small, { color: t.muted }]}>{note}</Text> : null}
      </View>
      {meta != null ? <Text style={[type.small, { color: t.muted }]}>{meta}</Text> : null}
      {trailing != null ? trailing : null}
      <ChevronRight size={20} color={t.muted} />
    </Press>
  );
}

/**
 * The highlighter (SNIPPETS highlight): a still band behind one French line.
 *
 * STYLE section 11's motion budget is the orb, the recap count-up and the
 * confetti, and the pen stroke is not in it, so the band no longer draws in:
 * it is there, the whole of it, from the first frame. The band is decorative;
 * the line on it is what a screen reader hears, marked as French so it is read
 * in a French voice. At most one per screen, only on white or paper, and the
 * only surface the chartreuse may take besides the level path's "you are here"
 * stop.
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
  const ls = useThemedStyles(makeLs);
  // The highlighter is the same pen in both modes, so its words stay ink.
  return (
    <View style={ls.bandHost}>
      <View {...decorative} style={[ls.band, { backgroundColor: highlight, pointerEvents: 'none' }]} />
      <Text {...frenchText} accessibilityLabel={accessibilityLabel} style={[type.french, { color: paper.ink }, style]}>
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
  const t = useB();
  const ls = useThemedStyles(makeLs);
  return (
    <View accessible accessibilityLabel={`Sound ${ipa}, as in ${example}`} style={ls.soundTag}>
      <Text style={[type.notation, { color: t.text }]}>{ipa}</Text>
      <Text {...frenchText} style={[type.frenchSm, { color: t.text }]}>{example}</Text>
    </View>
  );
}

/**
 * The support ladder at a glance: four rungs in their own support colours, the
 * current one drawn taller, and the rung's sentence beside them. The rungs are
 * decorative; the sentence from `rungLabel` is what is read.
 */
export function LadderMark({ rung, tutorName }: { rung: Rung; tutorName: string }) {
  const t = useB();
  const ls = useThemedStyles(makeLs);
  // rungColor in light; the same roles (skeleton, then ink) in dark.
  const fill = (r: Rung) => (t.mode === 'light' ? rungColor[r] : r === 4 ? t.text : t.skeleton);
  return (
    <View style={ls.ladder}>
      <View style={ls.rungs} {...decorative}>
        {([1, 2, 3, 4] as const).map((r) => (
          <View key={r} style={[ls.rung, { backgroundColor: fill(r) }, r === rung && ls.rungHere]} />
        ))}
      </View>
      <Text style={[type.small, ROW_WORDS, { color: t.text }]}>{rungLabel(rung, tutorName)}</Text>
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
  const t = useB();
  const ls = useThemedStyles(makeLs);
  return (
    <View style={ls.path}>
      {levels.map((level) => (
        <View key={level.level} style={ls.pathLevel}>
          <Text accessibilityRole="header" style={[type.label, { color: t.muted }]}>
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
                <Text style={[type.body, { color: stop.state === 'ahead' ? t.muted : t.text }]}>{stop.canDo}</Text>
                {stop.state === 'here' ? <Text style={[type.small, { color: t.text }]}>{YOU_ARE_HERE}</Text> : null}
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
 *
 * Revamp B (F601): a white card. The orb, then the name, the voice and the
 * change link as one column, then the sample as a 44 ink disc with the white
 * speaker mark, pressed through the one spring. The signature sits under the
 * row, marked as French so a screen reader reads it in a French voice. Come
 * alive: the speaker's arcs breathe while the sample really plays.
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
  /** The voice in words, for instance "Warm, unhurried Parisian". Speak (B2) leaves it out. */
  voice?: string;
  /** One line the tutor says, in French. */
  signature: string;
  onHear: () => void;
  playing: boolean;
  onChange: () => void;
  changeLabel?: string;
}) {
  const t = useB();
  const ls = useThemedStyles(makeLs);
  return (
    <Card style={ls.tutor}>
      <View style={ls.tutorHead}>
        <View {...decorative}>
          <OrbSurface color={orb.ready} size={HIT + space(3)} />
        </View>
        <View style={ROW_WORDS}>
          <Text style={[type.heading, { color: t.text }]}>{name}</Text>
          {voice !== undefined ? <Text style={[type.small, { color: t.muted }]}>{voice}</Text> : null}
          <View style={ls.tutorChange}>
            <IconAction layout="inline" icon="edit" label={changeLabel} onPress={onChange}  />
          </View>
        </View>
        <Press haptic="light" onPress={onHear} style={ls.hear}
          accessibilityRole="button"
          accessibilityLabel={playing ? `Stop ${name}` : `Hear ${name}`}
        >
          <AnimatedIcon kind="speaker-waves" size={22} active={playing} color={paper.onInk} />
        </Press>
      </View>
      <Text {...frenchText} style={[type.french, { color: t.text }]}>
        {signature}
      </Text>
    </Card>
  );
}

const CAN_DO_LEAD = "You'll be able to";

/**
 * The brief for one scene (SNIPPETS card-colour): the one blue card on a paper
 * screen. A meta line, the scene's name in French with its English under it,
 * what the learner will be able to do, one line they will say, and the
 * caller's white Start.
 *
 * Every field but the meta line, the title and the Start is optional, so a
 * caller draws the fields it has. With no French name the English title leads
 * at the French line's size, still the heading, and is not marked as French.
 * The Start and the quiet second way in arrive as nodes the caller built,
 * because `surfaceContract.test.ts` counts one primary pill per screen by
 * reading the screen's own file; a pill folded in here would move every count
 * into a shared component. The card holds a pill, so it is never a press
 * itself. The corner is a 44pt slot in flow beside the meta line, for the
 * bookmark, so at the largest reading size it pushes the title down rather
 * than sitting on it.
 *
 * White words on the blue, and the blue ground's own secondary for the quieter
 * lines: soft ink is never set on a colour.
 */
export function SceneBrief({
  meta,
  french,
  title,
  canDo,
  line,
  note,
  action,
  secondary,
  corner,
  art,
}: {
  /** One meta line: the label, the minutes and the tutor, already in words. */
  meta: string;
  /** The scene's name in French, set as the French line and read as French. */
  french?: string;
  /** The scene's name in the learner's language. */
  title: string;
  /** What the learner will be able to do, as one finished sentence (`canDoSentence`). */
  canDo?: string;
  /** One line the learner will say, in French, with its English if there is one. */
  line?: { fr: string; en?: string };
  /** One quiet line under the rest, such as why the scene is waiting. */
  note?: string;
  /** The one Start, built by the caller so its pill stays countable. */
  action: ReactNode;
  /** The quiet second way in, such as "Type instead". */
  secondary?: ReactNode;
  /** A 44pt slot at the top right: the bookmark toggle, or nothing. */
  corner?: ReactNode;
  /** The scene's place drawing above the meta line (Phase 4): decorative, never pressable. */
  art?: ReactNode;
}) {
  const ls = useThemedStyles(makeLs);
  return (
    <ColourCard ground="blue" style={ls.brief}>
      {art != null ? art : null}
      <View style={ls.briefHead}>
        <Text style={[type.small, ROW_WORDS, { color: onColour.blue }]}>{meta}</Text>
        {corner != null ? <View style={ls.corner}>{corner}</View> : null}
      </View>
      {french != null ? (
        <View style={ls.briefTitle}>
          <Text {...frenchText} accessibilityRole="header" style={[type.frenchLg, { color: textOn.blue }]}>
            {french}
          </Text>
          <Text style={[type.body, { color: onColour.blue }]}>{title}</Text>
        </View>
      ) : (
        <Text accessibilityRole="header" style={[type.frenchLg, { color: textOn.blue }]}>
          {title}
        </Text>
      )}
      {canDo != null ? <Text style={[type.body, { color: textOn.blue }]}>{canDo}</Text> : null}
      {line != null ? (
        <View style={ls.briefLine}>
          <Text {...frenchText} style={[type.french, { color: textOn.blue }]}>
            {line.fr}
          </Text>
          {line.en != null ? <Text style={[type.small, { color: onColour.blue }]}>{line.en}</Text> : null}
        </View>
      ) : null}
      {note != null ? <Text style={[type.small, { color: onColour.blue }]}>{note}</Text> : null}
      {action}
      {secondary != null ? secondary : null}
    </ColourCard>
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

const makeLs = (t: B) => StyleSheet.create({
  // SNIPPETS list: a white card, 4 above and below the rows and 20 at the sides.
  ledger: { backgroundColor: t.card, borderRadius: radius.card, paddingVertical: space(1), paddingHorizontal: space(5) },
  rule: { height: HAIRLINE, backgroundColor: t.line },
  row: {
    minHeight: HIT + space(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2.5),
  },
  glyph: { minWidth: 24, alignItems: 'center', justifyContent: 'center' },
  words: { ...ROW_WORDS, gap: space(0.5) },
  bandHost: { alignSelf: 'flex-start', paddingHorizontal: space(1) },
  band: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: space(1.5) },
  soundTag: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    gap: space(2),
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
    borderColor: t.field,
  },
  stopEarned: { backgroundColor: t.text, borderColor: t.text },
  tutor: { gap: space(3) },
  tutorHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  // The link's own side pad is pulled back so its word lines up under the
  // name; its 44 target still reaches into the gap beside the orb, not onto it.
  tutorChange: { alignSelf: 'flex-start', marginLeft: -space(3) },
  hear: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The board's rhythm inside the blue card: 12 between blocks, 4 between the
  // French name and its English, 2 between the line and its English.
  brief: { gap: space(3) },
  // Centred, so the bookmark in its 44 slot sits on the meta line's middle.
  briefHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3) },
  corner: { minWidth: HIT, minHeight: HIT, alignItems: 'flex-end', justifyContent: 'center' },
  briefTitle: { gap: space(1) },
  briefLine: { gap: space(0.5) },
});

// ─────────────────────────────────────────────────── the B parts (revamp B)
// Appended, because every region above is sliced between adjacent exports.
// Each is a SNIPPETS.md part, drawn from tokens, and every tappable one presses
// through `Press`.

/** light: a press. selection: a choice or a toggle. none: the caller answers (the tab bar). */
export type Haptic = 'light' | 'selection' | 'none';

export type PressProps = Omit<PressableProps, 'style' | 'onPress' | 'children'> & {
  onPress?: () => void | boolean;
  /** light: a press. selection: a choice or a toggle. none: the caller answers (the tab bar). */
  haptic?: Haptic;
  /** The surface that shrinks: background, radius, padding. */
  style?: StyleProp<ViewStyle>;
  /** The Pressable's place in its parent: flex, alignSelf, width. Never a colour. */
  frame?: StyleProp<ViewStyle>;
  /** control: pills, links and rows go to 0.97. tile: option tiles and icon buttons press deeper, to 0.95. */
  depth?: 'control' | 'tile' | 'raised';
  /**
   * For a choice: whether this one is the chosen one. Becoming chosen pops the
   * surface once and fades in a blue ring layer around it. Leave it out for an
   * action, which draws no ring at all.
   */
  selected?: boolean;
  /** The surface's corner, so the ring around it follows it. Defaults to the control radius. */
  glowRadius?: number;
  /** The pressable itself, for a caller that moves a screen reader onto it. */
  ref?: Ref<View>;
  /**
   * Why a disabled control is off (F927). With `disabled`, the control stays
   * focusable, says it is off and says this reason, and ignores the press.
   */
  disabledReason?: string;
  children: ReactNode;
};

/** The four colour grounds a B part can sit on (STYLE section 4). */
export type Ground = 'blue' | 'coral' | 'sun' | 'mint';

/**
 * The one press (STYLE section 11): every tappable thing scales to 0.97 on the
 * press spring while the finger is down, springs back on lift, and answers
 * with a light impact for a press or a selection tick for a choice. A tile
 * (`depth="tile"`) presses deeper, to 0.95.
 *
 * Two layers, because the thing that shrinks must be the drawn surface and an
 * animated Pressable is refused by motion.test.ts: the Pressable holds the
 * part's place in its parent (`frame`), and the Reanimated view inside it is
 * the surface (`style`). The spring runs on the UI thread through
 * `motion/drive.ts`. Under reduced motion the scale lands at once, so the press
 * is still felt and nothing travels, and turning it on mid-press lands the
 * surface at rest.
 *
 * A choice passes `selected`. When it becomes the chosen one the surface pops
 * once (`SELECT_POP`, then the pop spring) and a blue ring layer fades in four
 * points around it, at 0.16. The ring is a view drawn under the surface, not a
 * cast shadow (F569), and it is decorative: the caller's fill and words, and
 * `accessibilityState`, say what was chosen. No second haptic on select; the
 * press already answered.
 *
 * Cancel-on-move is Pressable's own contract: when a scroll view takes the
 * responder, Pressable fires `onPressOut` and never `onPress`, so the spring
 * returns and nothing happens. The role defaults to button and a caller's own
 * role wins (a segment passes `tab`). A disabled Press never presses, so it
 * neither shrinks nor ticks.
 */
export function Press({ onPress, haptic = 'light', style, frame, depth = 'control', selected, glowRadius = radius.control, disabled = false, disabledReason, onPressIn, onPressOut, children, ref: outerRef, onLongPress, ...others }: PressProps) {
  // A caller's own onKeyDown is web-only and untyped; it runs beside the Space handler.
  const { onKeyDown: callerKeyDown, ...rest } = others as typeof others & { onKeyDown?: (event: { key: string; repeat?: boolean; preventDefault: () => void }) => void };
  const reduced = useReduceMotion();
  // Disabled with a reason stays reachable (F927): the Pressable is not
  // disabled, so it keeps tabIndex 0, and the off state and the reason are
  // said instead. react-native-web drops aria-description, so it is set on the
  // node; it overwrites aria-disabled from its own prop, so the deprecated
  // accessibilityDisabled carries it.
  const explained = disabled && disabledReason != null;
  const node = useRef<View | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = node.current as unknown as { setAttribute?: (name: string, value: string) => void; removeAttribute?: (name: string) => void } | null;
    if (element?.setAttribute == null) return;
    if (explained) element.setAttribute('aria-description', disabledReason);
    else element.removeAttribute?.('aria-description');
  }, [explained, disabledReason]);
  const setRef = (value: View | null) => {
    node.current = value;
    if (typeof outerRef === 'function') outerRef(value);
    else if (outerRef != null) (outerRef as { current: View | null }).current = value;
  };
  const say = explained
    ? Platform.OS === 'web'
      ? { accessibilityDisabled: true }
      : { accessibilityState: { ...rest.accessibilityState, disabled: true }, accessibilityHint: disabledReason }
    : {};
  const activate = () => {
    if (disabled || onPress?.() === false) return;
    if (haptic === 'light') pressed();
    else if (haptic === 'selection') tapSettled();
  };
  // The keyboard ring is drawn on the Pressable, the outer frame; give it the
  // surface's corner so a pill's ring is a pill (a caller's frame still wins).
  const frameRadius = StyleSheet.flatten(style)?.borderRadius;
  const role = rest.accessibilityRole ?? (rest as { role?: string }).role ?? 'button';
  const onSpace = Platform.OS === 'web' ? spaceActivator(role, activate) : undefined;
  const scale = useSharedValue(1);
  const chosen = useRef(selected === true);
  const pressStyle = useAnimatedStyle(() => ({ transform: depth === 'raised' && !reduced ? [{ perspective: 600 }, { translateY: (1 - scale.value) * 80 }, { rotateX: `${(1 - scale.value) * 65}deg` }, { scale: scale.value }] : [{ scale: scale.value }] }));
  useEffect(() => () => stopMotion(scale), [scale]);
  useEffect(() => { if (reduced) pressTo(scale, 1, true); }, [reduced, scale]);
  useEffect(() => {
    const now = selected === true;
    if (now === chosen.current) return;
    chosen.current = now;
    // Raised choices already settle on release. A second pop interrupts that
    // spring and briefly reverses the surface's press depth.
    if (now && depth !== 'raised') selectPop(scale, reduced);
  }, [selected, reduced, scale, depth]);
  return (
    <Pressable
      accessibilityRole="button" {...rest} {...say}
      ref={setRef}
      {...webKeyDown(composeKeyDown(onSpace, callerKeyDown))}
      onLongPress={explained ? undefined : onLongPress}
      disabled={disabled && !explained ? true : undefined}
      onPressIn={(event) => {
        if (explained) return;
        pressTo(scale, depth === 'tile' || depth === 'raised' ? PRESS_SCALE_TILE : PRESS_SCALE, reduced);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressTo(scale, 1, reduced);
        onPressOut?.(event);
      }}
      onPress={activate}
      style={frameRadius != null ? [{ borderRadius: frameRadius }, frame] : frame}
    >
      {selected !== undefined ? (
        <SelectRing selected={selected} scale={scale} glowRadius={glowRadius} reduced={reduced} />
      ) : null}
      <Reanimated.View style={[style, pressStyle]}>{children}</Reanimated.View>
    </Pressable>
  );
}

/**
 * The chosen tile's blue ring layer. `Press` mounts it only for a choice, so an
 * action builds no ring value and no second animated style. It fades in when
 * the choice lands here and out when it moves on, and scales with the press so
 * the two stay one shape. Under reduced motion it is at rest at once.
 */
function SelectRing({ selected, scale, glowRadius, reduced }: { selected: boolean; scale: SharedValue<number>; glowRadius: number; reduced: boolean }) {
  const ring = useSharedValue(selected ? SELECT_RING_OPACITY : 0);
  const chosen = useRef(selected);
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value, transform: [{ scale: scale.value }] }));
  useEffect(() => () => stopMotion(ring), [ring]);
  useEffect(() => { if (reduced) ringTo(ring, chosen.current, true); }, [reduced, ring]);
  useEffect(() => {
    const now = selected;
    if (now === chosen.current) return;
    chosen.current = now;
    ringTo(ring, now, reduced);
  }, [selected, reduced, ring]);
  return (
    <Reanimated.View
      {...decorative}
      style={[{ pointerEvents: 'none', position: 'absolute', top: -space(1), right: -space(1), bottom: -space(1), left: -space(1), borderRadius: glowRadius + space(1), backgroundColor: colour.blue }, ringStyle]}
    />
  );
}

/** Close: the way out of a sheet or a story. A delegate to the icon set (D11). */
export function CloseGlyph({ size = 24, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="close" size={size} color={color} />;
}

/** The chosen option's tick: Luvani's own drawing in the icon set. */
export function CheckGlyph({ size = 24, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="check" size={size} color={color} />;
}

/**
 * A round control (SNIPPETS header-pushed, button-next-round): back and close
 * are a disc at the touch floor with a 24 mark; next is a larger disc with a
 * 28 mark and, beside it, the word it leads to.
 *
 * White is a white disc with an ink mark, on paper or any ground. Sun is the
 * round next on blue or coral, with the word in white. Ink is the round next on
 * a sun ground, with a white mark and the word in ink. The name defaults to the
 * word beside the disc when there is one, so what a screen reader says is what
 * the learner reads, and otherwise to Back, Next or Close.
 *
 * A hint is passed straight through when the name alone does not say what
 * happens next: the live room's close opens a confirmation rather than ending
 * the session, and a screen reader says so (F603). Without one, nothing extra
 * is said.
 */
export function RoundButton({
  kind,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  tone,
  appearance,
  label,
}: {
  kind: 'back' | 'next' | 'close';
  onPress: () => void;
  disabled?: boolean;
  /** Defaults to the label beside the disc, or 'Back', 'Next', 'Close'. */
  accessibilityLabel?: string;
  /** What pressing it is about to do, when the name alone does not say. Passed to Press as it is. */
  accessibilityHint?: string;
  /** white: a white disc, ink mark (back and close, any ground). sun: the round next on blue or coral. ink: the round next on a sun ground. Defaults white, or sun for next. */
  tone?: 'white' | 'sun' | 'ink';
  /**
   * Opt-in: the disc and mark from the selected appearance instead of the tone
   * (P2, 2026-10-19). Absent, the button draws exactly as before.
   */
  appearance?: { disc: string; mark: string };
  /** The word beside a round next, in type.bodyStrong, in the ground's text colour. */
  label?: string;
}) {
  const next = kind === 'next';
  const disc = next ? HIT + space(5) : HIT;
  const ground = tone ?? (next ? 'sun' : 'white');
  const t = useB();
  const b = useThemedStyles(makeB);
  // The white disc is the theme's card (white in light, the M3 surface in
  // dark); sun and ink are colour controls and keep their values in both.
  const fill = appearance?.disc ?? (ground === 'white' ? t.card : ground === 'sun' ? colour.sun : paper.ink);
  const markColour = appearance?.mark ?? (ground === 'ink' ? paper.onInk : ground === 'white' ? t.text : paper.ink);
  const words = ground === 'sun' ? textOn.blue : ground === 'ink' ? paper.ink : t.text;
  const name = accessibilityLabel ?? label ?? (kind === 'back' ? 'Back' : next ? 'Next' : 'Close');
  return (
    <Press haptic="light" onPress={onPress} disabled={disabled} accessibilityState={{ disabled }} accessibilityLabel={name} accessibilityHint={accessibilityHint} frame={b.roundFrame} style={[b.roundRow, disabled && { opacity: 0.5 }]}>
      <View style={[b.roundDisc, { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: fill }]}>
        {kind === 'back' ? <ChevronLeft size={24} color={markColour} /> : null}
        {kind === 'next' ? <ArrowRight size={28} color={markColour} /> : null}
        {kind === 'close' ? <CloseGlyph size={24} color={markColour} /> : null}
      </View>
      {label != null ? <Text style={[type.bodyStrong, { color: words }]}>{label}</Text> : null}
    </Press>
  );
}

/**
 * The one colour card on a paper screen (SNIPPETS card-colour): one ground at
 * the feature radius. The caller sets its words in `textOn[ground]` and its
 * secondary line in `onColour[ground]`.
 *
 * With `onPress` the whole card is the target. A card that holds its own pill
 * never takes `onPress`: SNIPPETS never nests a link in a link, and a button
 * inside a button is invalid on the web (F545). So this part draws no pill.
 */
export function ColourCard({
  ground,
  children,
  onPress,
  accessibilityLabel,
  style,
  lift = false,
}: {
  ground: Ground | `pastel.${keyof typeof pastel}`;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** The one soft lift (UI-006), for an illustrated Explore tile only. */
  lift?: boolean;
}) {
  const t = useB();
  // A pastel is a themed tint (the M3 plum, ochre, rose and teal in dark); the
  // four colours are the same in both modes.
  const fill = ground.startsWith('pastel.') ? t[ground.slice(7) as keyof typeof pastel] : colour[ground as Ground];
  const surface = [
    lift && liftStyle,
    { backgroundColor: fill, borderRadius: radius.feature, padding: space(6), gap: space(4), overflow: 'hidden' as const },
    style,
  ];
  if (onPress != null) {
    return (
      <Press haptic="light" accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={surface}>
        {children}
      </Press>
    );
  }
  return <View style={surface}>{children}</View>;
}

/**
 * A number and one plain line (SNIPPETS stat-tile), on a colour ground or on
 * paper. One phrase to a screen reader: "1 min 12, longest stretch in French".
 */
export function StatTile({ value, label, mark, compact = false, valueNode }: {
  value: string;
  label: string;
  /**
   * What is drawn in the number's place when it moves (B5, 2026-10-20: Today's
   * count-ups). `value` is still what a screen reader hears.
   */
  valueNode?: ReactNode;
  /**
   * A decorative disc above the number, as on Today's stats row (B0,
   * 2026-10-20). Hidden from a screen reader: the value and label say it. A
   * ring or bar that means something must be labelled by its caller instead.
   */
  mark?: ReactNode;
  /** The smaller, centred cut that sits three to a `StatRow` card. */
  compact?: boolean;
}) {
  const t = useB();
  const b = useThemedStyles(makeB);
  return (
    <View style={compact ? b.statCompact : b.statTile} accessible accessibilityLabel={`${value}, ${label}`}>
      {mark ? <View {...decorative}>{mark}</View> : null}
      {valueNode ?? <Text style={[compact ? b.statCompactValue : type.stat, { color: t.text }]}>{value}</Text>}
      <Text style={[compact ? b.statCompactLabel : type.small, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

/**
 * Three stats in one white card, three equal columns (B-Today's stats row, B0
 * 2026-10-20). It lays out `StatTile compact` children and draws nothing of
 * its own; a column's words wrap rather than shrink at a large reading size.
 */
export function StatRow({ children }: { children: ReactNode }) {
  const b = useThemedStyles(makeB);
  return (
    <View style={b.statRow}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={b.statColumn}>{child}</View>
      ))}
    </View>
  );
}

/**
 * A small pill (B0, 2026-10-20), lifted from the archive's filter row so every
 * chip is one part.
 *
 * `filter` is a choice in a row of them: the touch floor is its height, the
 * chosen one fills with ink and carries a tick so the state is never colour
 * alone, and it says selected on a device and on the web (F522). `meta` is a
 * still fact, "About 6 min" or a scene's state, never pressable; `tone` picks
 * its ground and `leading` an optional mark before the words.
 */
export function Chip(props:
  | { variant: 'filter'; label: string; selected: boolean; onPress: () => void; role?: 'tab' | 'button'; accessibilityLabel?: string; ground?: 'card' | 'violet2' }
  | {
      variant: 'meta';
      /**
       * Words, or words with a French span nested in them (B5, 2026-10-20:
       * Today's "Builds on" chip sets its quoted phrase as French).
       */
      label: ReactNode;
      /** butter and sage are Today's quest XP chips (B5, 2026-10-20), ink words on both. */
      tone?: 'card' | 'ink' | 'lavender' | 'butter' | 'sage';
      leading?: ReactNode;
      /** The label is French (B3, 2026-10-20): set and read as French. */ lang?: 'fr' }
) {
  const t = useB();
  const b = useThemedStyles(makeB);
  if (props.variant === 'meta') {
    const tone = props.tone ?? 'card';
    // The ink chip is the theme's primary (ink in light, violet in dark).
    const ground = tone === 'ink' ? (t.mode === 'light' ? signal.good : t.primary) : tone === 'lavender' ? t.lavender : tone === 'butter' ? t.butter : tone === 'sage' ? t.sage : t.card;
    const words = tone === 'ink' ? t.onPrimary : t.text;
    return (
      <View style={[b.metaChip, { backgroundColor: ground }]}>
        {props.leading}
        <Text {...(props.lang === 'fr' ? frenchText : {})} style={[type.small, { color: words }]}>{props.label}</Text>
      </View>
    );
  }
  const { label, selected, onPress, role = 'tab', accessibilityLabel, ground = 'card' } = props;
  // violet2 is the chip ground on a blue card (DESIGN.md), white words only.
  const violet = ground === 'violet2' && !selected;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      aria-selected={selected}
      {...webKeyDown(spaceActivator(role, onPress))}
      style={[b.filterChip, selected && b.filterChipChosen, violet && { backgroundColor: colour.violet2, borderColor: colour.violet2 }]}
    >
      {selected ? <View {...decorative}><CheckGlyph size={16} color={paper.onInk} /></View> : null}
      <Text style={[type.button, { color: selected || violet ? paper.onInk : t.muted }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * A lock, drawn two ways from the v82 artboards (B0, 2026-10-20): a pill
 * reading the plan that opens it ("Core" or "Max"), and a 28pt white disc with
 * the lock alone. Both say "Locked. Part of Core." to a screen reader (F910,
 * founder decision 14, 2026-10-29; it used to name the trial).
 *
 * The plan is the feature's (`requiredPlan`, from the capability table), never
 * the learner's, so a learner in Core's store trial still sees a Max lock say
 * Max. A badge that is not a feature lock (the paid streak repair) names its
 * plan directly.
 *
 * Pure presentation. Whether a feature is locked is `access/featureAccess.ts`'s
 * answer (the D24 standing, open when the plan is unknown), and a surface draws
 * this only when that seam says so.
 *
 * Read once (2026-10-20, lock seam wiring): inside a control whose own label
 * already ends with `lockSaid`'s words, pass `said` and the badge is hidden
 * from screen readers, so the words are not heard twice.
 */
export function LockBadge(props: { form?: 'pill' | 'round'; ground?: 'lavender' | 'card'; said?: boolean } & ({ feature: LockedFeature; plan?: undefined } | { plan: UnlockPlan; feature?: undefined })) {
  const { form = 'pill', ground = 'lavender', said = false } = props;
  const plan: UnlockPlan = props.plan ?? requiredPlan(props.feature!);
  const t = useB();
  const b = useThemedStyles(makeB);
  const spoken = said ? decorative : { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: lockSpoken(plan) };
  // The lock's blue is the theme's link: the brand blue in light, the M3
  // periwinkle link in dark, where the blue would vanish on the plum tint.
  if (form === 'round') {
    return (
      <View style={b.lockRound} {...spoken}>
        <View {...decorative}><Icon name="lock" size={14} color={t.link} /></View>
      </View>
    );
  }
  return (
    <View style={[b.lockPill, { backgroundColor: ground === 'card' ? t.card : t.lavender }]} {...spoken}>
      <View {...decorative}><Icon name="lock" size={12} color={t.link} /></View>
      <Text style={b.lockWords}>{unlockPlanName(plan)}</Text>
    </View>
  );
}

/**
 * The one giant number on a colour board (SNIPPETS hero-number), with its unit
 * beside it on the baseline, both in the ground's words colour. One phrase to a
 * screen reader. Still: the count-up is F611's.
 */
export function HeroNumber({ value, unit, ground }: { value: string; unit: string; ground: Ground }) {
  const b = useThemedStyles(makeB);
  const color = textOn[ground];
  return (
    <View style={b.heroRow} accessible accessibilityLabel={`${value} ${unit}`}>
      <Text style={[type.hero, { color }]}>{value}</Text>
      <Text style={[type.title, { color, paddingBottom: space(1.5) }]}>{unit}</Text>
    </View>
  );
}

/**
 * A one-tap choice (SNIPPETS option): a title, an optional line under it, and
 * the mark at its end. Come alive (icons section 1.6): a thin wrapper over the
 * one `Choice`, so a chosen row fills with the brand blue and carries a white
 * disc with the blue check, and the field ring marks one not chosen. It stays a
 * button with a selected state, said on a device and on the web, because its
 * callers have no radio group around it; a Hear beside it is its own target.
 */
export function OptionRow({ title, detail, selected, onPress, accessibilityLabel, onHear, playing = false }: {
  title: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  onHear?: () => void;
  playing?: boolean;
}) {
  return <Choice role="button" title={title} detail={detail} selected={selected} onPress={onPress} accessibilityLabel={accessibilityLabel} onHear={onHear} playing={playing} />;
}

/**
 * A bottom sheet (SNIPPETS sheet) over the screen it belongs to: an ink scrim
 * that closes it when tapped, and a white panel with a grabber and a title.
 *
 * The panel is modal to VoiceOver, so the screen under it goes quiet, and the
 * two-finger escape closes it as the scrim does. There is no drag to dismiss:
 * that is gesture-handler, which this app does not take. The scrim is ink at
 * 0.45 on its own layer, so no raw colour enters this file.
 *
 * The title is a polite live region, so TalkBack says it as the sheet rises,
 * the way the old centred leave card said its question (F603). `ConfirmSheet`
 * in layout.tsx is drawn over this part and closes on its safe answer.
 */
export function Sheet({ visible, title, onClose, children, footer, returnFocus, reading = false, surface, ink }: { visible: boolean; title: string; onClose: () => void | boolean; children: ReactNode; footer?: ReactNode; returnFocus?: { current: Text | null }; reading?: boolean; /** Panel colour from the selected appearance; paper when absent. */ surface?: string; /** Title ink from the selected appearance; paper ink when absent. */ ink?: string }) {
  const insets = useSafeAreaInsets();
  const t = useB();
  const b = useThemedStyles(makeB);
  // F755: while the content runs under the footer, a hairline sits over the
  // footer and the scroll indicator flashes once per opening (`sheetRunsUnder`).
  const scroller = useRef<ScrollView>(null);
  const measures = useRef({ content: 0, viewport: 0, offset: 0 });
  const [cue, setCue] = useState(false);
  const flashed = useRef(false);
  const measureCue = () => setCue(sheetRunsUnder(measures.current.content, measures.current.viewport, measures.current.offset));
  const reduced = useReduceMotion();
  const reducedNow = useRef(reduced); reducedNow.current = reduced;
  const snapshot = useRef({ title, children, footer });
  if (visible) snapshot.current = { title, children, footer };
  const wasOpen = useRef(false);
  const [present, setPresent] = useState(visible);
  const arrival = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const heading = useRef<Text>(null);
  const close = useRef(onClose); close.current = onClose;
  const motion = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    motion.current?.stop();
    if (visible) { setPresent(true); drag.setValue(0); }
    if (reduced) { arrival.setValue(visible ? 1 : 0); setPresent(visible); return; }
    motion.current = Animated.timing(arrival, { toValue: visible ? 1 : 0, duration: visible ? 310 : 250, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    motion.current.start(({ finished }) => { if (finished && !visible) setPresent(false); });
    return () => motion.current?.stop();
  }, [visible, reduced, arrival, drag]);
  // The sheet's Modal would sit above the celebration host, so the host waits
  // while one is presented and goes on once it has gone (come alive, F743).
  useEffect(() => (present ? holdCelebrations() : undefined), [present]);
  // A closed sheet forgets its measures, so the next opening is measured afresh.
  useEffect(() => {
    if (visible) return;
    flashed.current = false;
    measures.current = { content: 0, viewport: 0, offset: 0 };
    setCue(false);
  }, [visible]);
  useEffect(() => {
    if (!visible || !cue || flashed.current) return undefined;
    flashed.current = true;
    const flash = setTimeout(() => scroller.current?.flashScrollIndicators(), SHEET_CUE_FLASH_MS);
    return () => clearTimeout(flash);
  }, [visible, cue]);
  useEffect(() => {
    if (present) { wasOpen.current = true; return; }
    if (wasOpen.current && Platform.OS !== 'web') {
      wasOpen.current = false;
      const handle = findNodeHandle(returnFocus?.current ?? null);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [present, returnFocus]);
  useEffect(() => {
    if (reduced) { drag.stopAnimation(); drag.setValue(0); }
    return () => drag.stopAnimation();
  }, [reduced, drag]);
  const gesture = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => drag.stopAnimation(),
    onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if ((g.dy > 70 || g.vy > 0.8) && close.current() !== false) return;
      drag.stopAnimation();
      if (reducedNow.current) { drag.setValue(0); return; }
      Animated.timing(drag, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    },
    onPanResponderTerminate: () => { drag.stopAnimation(); drag.setValue(0); },
  })).current;
  const focusHeading = () => {
    if (Platform.OS === 'web') { (heading.current as unknown as { focus?: () => void })?.focus?.(); return; }
    const handle = findNodeHandle(heading.current); if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  };
  useEffect(() => {
    if (visible) focusHeading();
  }, [title]);
  return (
    <Modal visible={present} transparent animationType="none" onShow={focusHeading} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={b.sheetOverlay}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: arrival.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }), backgroundColor: t.scrim }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View accessibilityViewIsModal {...(Platform.OS === 'web' ? { role: 'dialog', 'aria-modal': true } as object : {})} onAccessibilityEscape={onClose}
            style={[b.sheetPanel, reading && b.sheetReading, surface !== undefined ? { backgroundColor: surface } : undefined, { maxHeight: '94%', paddingTop: 0, paddingBottom: Math.max(insets.bottom, space(6)), borderTopLeftRadius: radius.feature, borderTopRightRadius: radius.feature,
              transform: [{ translateY: Animated.add(drag, arrival.interpolate({ inputRange: [0, 1], outputRange: [600, 0] })) }] }]}>
            <View {...gesture.panHandlers} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><View {...decorative} style={b.grabber} /></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <Text ref={heading} accessibilityRole="header" {...(Platform.OS === 'web' ? { tabIndex: -1 } as object : {})} style={[type.heading, { color: ink ?? t.text, flex: 1 }]}>{snapshot.current.title}</Text>
              <IconButton icon="close" label="Close" onPress={onClose} />
            </View>
            <ScrollView
              ref={scroller}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ gap: space(4) }}
              scrollEventThrottle={100}
              onLayout={(event) => { measures.current.viewport = event.nativeEvent.layout.height; measureCue(); }}
              onContentSizeChange={(_width, height) => { measures.current.content = height; measureCue(); }}
              onScroll={(event) => { measures.current.offset = event.nativeEvent.contentOffset.y; measureCue(); }}
            >{snapshot.current.children}</ScrollView>
            {snapshot.current.footer != null ? (
              <View style={cue ? { borderTopWidth: HAIRLINE, borderTopColor: t.line } : null}>{snapshot.current.footer}</View>
            ) : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Loading (SNIPPETS skeleton): still sand blocks shaped like what is coming,
 * read once as "Loading". No shimmer: STYLE section 11's motion budget is the
 * orb, the recap count-up and the confetti.
 */
export function Skeleton({ blocks }: { blocks: readonly { height: number; width?: number | `${number}%`; radius: number }[] }) {
  const t = useB();
  const b = useThemedStyles(makeB);
  return (
    <View style={b.skeleton} accessible accessibilityLabel="Loading">
      {blocks.map((block, index) => (
        <View
          key={index}
          style={{ height: block.height, width: block.width, borderRadius: block.radius, backgroundColor: t.skeleton }}
        />
      ))}
    </View>
  );
}

/** A small reassurance, centred (SNIPPETS quiet-line). */
export function QuietLine({ children }: { children: string }) {
  const t = useB();
  return <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>{children}</Text>;
}

/**
 * A French line with its English and a way to hear it (SNIPPETS french-block).
 *
 * The French leads, set large, and is marked as French so a screen reader
 * reads it in a French voice; the English sits under it, quieter. The hear
 * control is a disc at the touch floor that says Stop while the line sounds.
 * On white: ink words and an ink disc with a white ear. On blue: white words, the
 * blue ground's secondary for the English, and a white disc with an ink ear.
 * Come alive: while the line really plays, the speaker's arcs breathe
 * (`AnimatedIcon`, still under Reduce Motion); the disc itself is unchanged.
 */
export function FrenchBlock({
  french,
  english,
  size = 'lg',
  onHear,
  playing = false,
  ground = 'white',
}: {
  french: string;
  english?: string;
  size?: 'lg' | 'md';
  onHear?: () => void;
  playing?: boolean;
  ground?: 'white' | 'blue' | 'sun';
}) {
  const t = useB();
  const b = useThemedStyles(makeB);
  const onBlue = ground === 'blue';
  const sun = ground === 'sun';
  // Blue and sun are colour grounds and keep their words; white is the card.
  const color = onBlue ? paper.onInk : sun ? paper.ink : t.text;
  const secondary = onBlue ? onColour.blue : sun ? onColour.sun : t.muted;
  return (
    <View style={b.frenchRow}>
      <View style={b.frenchWords}>
        <Text {...frenchText} style={[size === 'lg' ? type.frenchLg : type.french, { color }]}>
          {french}
        </Text>
        {english != null ? <Text style={[type.small, { fontFamily: font.regular, color: secondary }]}>{english}</Text> : null}
      </View>
      {onHear != null ? (
        <Press
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Stop' : 'Hear this line'}
          onPress={onHear}
          style={[b.hearDisc, { backgroundColor: onBlue ? paper.card : sun ? paper.ink : t.primary }]}
        >
          <AnimatedIcon kind="speaker-waves" size={22} active={playing} color={onBlue ? paper.ink : paper.onInk} />
        </Press>
      ) : null}
    </View>
  );
}

const makeB = (t: B) => StyleSheet.create({
  roundFrame: { alignSelf: 'flex-start' },
  roundRow: { flexDirection: 'row', alignItems: 'center', gap: space(3.5) },
  roundDisc: { alignItems: 'center', justifyContent: 'center' },
  statTile: { backgroundColor: t.card, borderRadius: radius.tile, padding: space(4), gap: space(1.5) },
  statCompact: { alignItems: 'center', gap: space(1.5) },
  statCompactValue: { ...type.statSm, textAlign: 'center' },
  statCompactLabel: { ...type.caption, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: space(1.5), backgroundColor: t.card, borderRadius: radius.card, paddingVertical: space(3.5), paddingHorizontal: space(3) },
  statColumn: { flex: 1, minWidth: 0 },
  // The touch floor is the height, not the padding, so a chip stays reachable
  // whatever the reading size does to the word inside it.
  filterChip: {
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1.5),
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: space(4),
    borderRadius: radius.pill,
    backgroundColor: t.card,
    borderWidth: HAIRLINE,
    borderColor: t.field,
  },
  filterChipChosen: { backgroundColor: t.primary, borderColor: t.primary },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  // 2026-10-20, lock seam wiring: the words wrap inside the pill at 320pt and large text instead of running past the row.
  lockPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: space(1.25), minHeight: 26, paddingHorizontal: space(2.5), borderRadius: radius.pill },
  lockWords: { ...type.badge, color: t.link, flexShrink: 1 },
  lockRound: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space(2.5) },
  sheetOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' },
  // On an iPad the first run's sheets keep its reading column (come alive, icons section 3.6).
  sheetReading: { alignSelf: 'center', width: '100%', maxWidth: READING },
  sheetPanel: {
    backgroundColor: t.card,
    paddingTop: space(3),
    paddingHorizontal: space(5),
    paddingBottom: space(10),
    gap: space(4),
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: t.line },
  skeleton: { gap: space(3) },
  frenchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  frenchWords: { ...ROW_WORDS, gap: space(1.5) },
  hearDisc: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center' },
});

// ─────────────────────────────────────────── the Start parts (revamp B, F601)
// Appended, because every region above is sliced between adjacent exports.

/**
 * Where a learner stands against one goal (SNIPPETS task-ticks and mark-next):
 * a 24 disc. Done is mint with an ink tick, next is a plain sun dot, and one
 * not reached yet is the field ring. It is one element to a screen reader and
 * says its state in a word, so the colour is never the only signal: the tick,
 * the fill and the ring are three shapes as well as three colours.
 */
export function SceneMark({ state }: { state: 'earned' | 'here' | 'ahead' }) {
  const t = useB();
  return (
    <View
      accessible
      accessibilityLabel={state === 'earned' ? 'Done' : state === 'here' ? 'Next' : 'Not yet'}
      style={[
        sp.sceneMark,
        state === 'earned' && { backgroundColor: colour.mint },
        state === 'here' && { backgroundColor: colour.sun },
        state === 'ahead' && { borderWidth: 2, borderColor: t.field },
      ]}
    >
      {state === 'earned' ? <CheckGlyph size={16} color={paper.ink} /> : null}
    </View>
  );
}

/**
 * A can-do as one sentence after "You'll be able to": the catalogue writes
 * each can-do as its own capitalised line ("Order a coffee at the counter"),
 * so the first letter is lowered, any full stop it carried is dropped, and the
 * sentence ends on one. "You'll be able to order a coffee at the counter."
 */
export function canDoSentence(canDo: string): string {
  const line = canDo.trim().replace(/\s*\.+$/, '');
  return `${CAN_DO_LEAD} ${line.charAt(0).toLowerCase()}${line.slice(1)}.`;
}

/**
 * The alert, beside a field's error line. Errors are never red. A delegate to
 * the icon set (D11), drawn decorative: the error words are what is read.
 *
 * It lives here rather than in `glyphs.tsx` because `Field` draws it, and
 * `glyphs.tsx` already imports from this file, so the reverse edge would be a
 * cycle. `glyphs.tsx` re-exports it, the way it re-exports the speaker.
 */
export function AlertGlyph({ size = 24, color: asked }: { size?: number; color?: string }) {
  const t = useB();
  const color = asked ?? t.text;
  return <Icon name="alert" size={size} color={color} />;
}

const sp = StyleSheet.create({
  sceneMark: {
    width: space(6),
    height: space(6),
    borderRadius: space(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
});


/** A live-room action: one consistent touch target with a named state. */
export function ControlTile({ label, glyph, onPress, disabled = false, accessibilityLabel }: {
  label: string; glyph: ReactNode; onPress: () => void; disabled?: boolean; accessibilityLabel?: string;
}) {
  const t = useB();
  return (
    <Press haptic="light" disabled={disabled} accessibilityState={{ disabled }} accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress} frame={{ flex: 1, minWidth: 0 }} style={{ minHeight: 56, minWidth: HIT, alignItems: 'center', justifyContent: 'center', gap: space(2), padding: space(3), borderRadius: radius.field, backgroundColor: disabled ? t.skeleton : t.card }}>
      {glyph}
      <Text style={[type.small, { color: disabled ? t.muted : t.text }]}>{label}</Text>
    </Press>
  );
}

// ──────────────────────────────── the icon controls (come alive, D2, F727)
// Appended, because every region above is sliced between adjacent exports.
// Each presses through `Press`, draws from tokens, casts no shadow, says off
// in colour rather than opacity, and plays no sound of its own: an outcome's
// sound comes from the event that settled it, never from a tap.

/**
 * The six actions a button may say with a picture alone (icons section 1.6):
 * back, close, hear, keep, do this line again and remind me are read the same
 * way everywhere. Anything else is an `IconAction`, with its word on screen.
 */
export type IconButtonIcon = 'back' | 'close' | 'speaker' | 'bookmark' | 'replay' | 'bell';

/** What an icon button may play, each on an event its caller really holds. */
export type IconButtonAnimation = Extract<AnimatedIconKind, 'bookmark-fill' | 'speaker-waves' | 'bell-ring' | 'refresh-spin'>;

/** What a control sits on: paper (a white card or sheet counts as paper), or one of the four colour grounds. */
export type ControlGround = 'paper' | Ground;

/**
 * A control's mark and words on its ground, and the colour that says it is
 * off there. Soft ink is for paper and white only: on a colour the off colour
 * is that ground's own secondary (icons review 14), and never an opacity.
 */
function groundInk(ground: ControlGround, disabled: boolean, t: B): string {
  if (ground === 'paper') return disabled ? t.muted : t.text;
  return disabled ? onColour[ground] : textOn[ground];
}

/** A toggle that is on draws in the brand blue where its mark would be ink, and keeps the white on a white mark. */
function chosenInk(base: string, t: B): string {
  // In dark the theme's ink is cream, and its brand mark is the M3 link.
  return base === t.text ? (t.mode === 'light' ? accent.brand : t.link) : base;
}

/**
 * A button with no visible label (icons section 1.6): one of six marks at the
 * touch floor, so it carries a spoken label, required, and that label is what
 * a screen reader says. The mark is decorative.
 *
 * `plain` is the mark alone in its ground's ink; `disc` is the white disc with
 * an ink mark that RoundButton draws; `ink` is the ink disc with a white mark
 * that FrenchBlock draws. `md` is a 44 target with a 24 mark, `lg` a 56 disc
 * with a 28 mark for the main audio on a page. Both sizes come from `HIT`.
 *
 * A toggle passes `selected` (kept, reminders on): the mark turns Bulk, in the
 * brand blue where it would be ink, and the state is said on a device and on
 * the web. `animate` names what moves with it, through `AnimatedIcon`, and only
 * on the truth the caller passes: `selected` turns a one-shot on, `trigger`
 * replays one, `active` holds a loop such as a line playing. It presses deeper,
 * like a tile, and ticks like a choice when it is a toggle. Off is soft ink on
 * paper and on a sand disc, or the ground's own secondary on a colour.
 */
export function IconButton({
  icon,
  label,
  accessibilityLabel,
  onPress,
  tone = 'plain',
  size = 'md',
  ground = 'paper',
  selected,
  animate,
  trigger,
  active = false,
  disabled = false,
  accessibilityHint,
  haptic,
}: {
  /** One of the six; anything else needs a word on screen, so it is an IconAction. */
  icon: IconButtonIcon;
  /** Required: nothing on screen names this button, so this is what is said. */
  label: string;
  /** A fuller name, when the label alone names nothing where the button sits. Falls back to label. */
  accessibilityLabel?: string;
  onPress: () => void | boolean;
  tone?: 'plain' | 'disc' | 'ink';
  size?: 'md' | 'lg';
  /** What a plain button sits on, so its mark takes that ground's ink. */
  ground?: ControlGround;
  /** A toggle's state. Leave it out for an action. */
  selected?: boolean;
  animate?: IconButtonAnimation;
  /** A real event's key; a change replays a one-shot once. */
  trigger?: string | number;
  /** A held state that loops, such as the line playing. */
  active?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  haptic?: Haptic;
}) {
  const hit = size === 'lg' ? HIT + space(3) : HIT;
  const markSize = size === 'lg' ? 28 : 24;
  const on = selected === true;
  const t = useB();
  const fill = tone === 'plain' ? undefined : disabled ? t.skeleton : tone === 'ink' ? t.primary : t.card;
  const base = tone === 'plain' ? groundInk(ground, disabled, t) : disabled ? t.muted : tone === 'ink' ? t.onPrimary : t.text;
  const mark = on && !disabled ? chosenInk(base, t) : base;
  return (
    <Press
      haptic={haptic ?? (selected === undefined ? 'light' : 'selection')}
      depth="tile"
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined ? undefined : { selected }}
      aria-pressed={selected}
      frame={ic.buttonFrame}
      style={[ic.button, { width: hit, height: hit, borderRadius: hit / 2 }, fill !== undefined && { backgroundColor: fill }]}
    >
      {animate !== undefined ? (
        <AnimatedIcon kind={animate} size={markSize} color={mark} state={on ? 'on' : 'off'} trigger={trigger} active={active} />
      ) : (
        <Icon name={icon} variant={on ? 'bulk' : 'linear'} size={markSize} color={mark} />
      )}
    </Press>
  );
}

/**
 * An action with an icon and a short word (icons section 1.6), for everything
 * that is not one of IconButton's six. The word is visible and is the default
 * spoken name; a short word can carry a fuller one ("Details" says "Feedback
 * details").
 *
 * `tile` is the icon over the word in a white tile, for a row of two to four
 * (`IconActionRow`); it presses deeper. `inline` is the icon beside the word
 * with no box, in the ground's words colour, at the touch floor.
 *
 * A tile that is `selected` (founder decision D7, fill and glow, no lip and no
 * shadow) fills with the blue ground's pale secondary, gains a 2pt brand
 * border and a Bulk brand icon, pops once and lights the ring layer `Press`
 * draws around it; on a blue or coral ground the chosen fill is the sun with
 * ink on it. It ticks as a choice. `busy` turns the icon into the turning
 * refresh, says busy to a screen reader and takes no second press; the caller
 * supplies the busy word ("Checking…"). Off is the sand tile with soft ink, or
 * soft ink on paper and the ground's secondary on a colour for an inline one.
 */
export function IconAction({
  icon,
  label,
  accessibilityLabel,
  onPress,
  layout = 'tile',
  ground = 'paper',
  selected,
  busy = false,
  disabled = false,
  animate,
  trigger,
  accessibilityHint,
  haptic,
}: {
  /** An icon from the set, or 'orb' for a tutor action: the tutor is never a person. */
  icon: IconName | 'orb';
  /** Visible, and the default spoken name. */
  label: string;
  /** The full sentence, when the visible word is short. Falls back to label. */
  accessibilityLabel?: string;
  onPress: () => void | boolean;
  layout?: 'tile' | 'inline';
  /** What the action sits on: an inline one takes that ground's words colour. */
  ground?: ControlGround;
  selected?: boolean;
  busy?: boolean;
  disabled?: boolean;
  animate?: AnimatedIconKind;
  trigger?: string | number;
  accessibilityHint?: string;
  haptic?: Haptic;
}) {
  const tile = layout === 'tile';
  const on = selected === true && !disabled;
  const warm = ground === 'blue' || ground === 'coral';
  const iconSize = tile ? 24 : 20;
  const t = useB();
  // A chosen warm tile is sun in both modes, so its words stay ink there.
  const words = tile ? (disabled ? t.muted : on && warm ? paper.ink : t.text) : groundInk(ground, disabled, t);
  const mark = !on ? words : tile && warm ? paper.ink : chosenInk(words, t);
  const surface = tile
    ? {
        backgroundColor: disabled ? t.skeleton : on ? (warm ? colour.sun : t.mode === 'light' ? onColour.blue : t.lavender) : t.card,
        borderColor: on ? (warm ? colour.sun : accent.brand) : 'transparent',
      }
    : null;
  const variant = tile || on ? 'bulk' : 'linear';
  return (
    <Press
      haptic={haptic ?? (selected === undefined ? 'light' : 'selection')}
      depth={tile ? 'tile' : 'control'}
      selected={tile ? selected : undefined}
      glowRadius={radius.tile}
      disabled={disabled}
      onPress={() => (busy ? false : onPress())}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, busy }}
      aria-pressed={selected}
      frame={tile ? ic.tileFrame : ic.inlineFrame}
      style={tile ? [ic.tile, surface] : ic.inline}
    >
      {busy ? (
        <AnimatedIcon kind="refresh-spin" size={iconSize} color={mark} active />
      ) : icon === 'orb' ? (
        <View {...decorative}>
          <OrbGlyph color={mark} size={iconSize} />
        </View>
      ) : animate !== undefined ? (
        <AnimatedIcon kind={animate} size={iconSize} color={mark} state={on ? 'on' : 'off'} trigger={trigger} />
      ) : (
        <Icon name={icon} variant={variant} size={iconSize} color={mark} secondaryColor={tile && !on && !disabled ? accent.brand : undefined} />
      )}
      <Text style={[tile ? type.small : type.label, { color: words }, tile && ic.tileWords]}>{label}</Text>
    </Press>
  );
}

/**
 * Two to four action tiles sharing a row equally, each allowed to shrink
 * (`flex: 1, minWidth: 0`). At the largest reading sizes they wrap two to a
 * line rather than squeeze, re-measured when the reading size changes while
 * the app is open, and so do four on a narrow phone (`actionRowWraps`). More
 * than four is a list, not a row.
 */
export function IconActionRow({ children }: { children: ReactNode }) {
  // Watched so the row re-renders when the OS text size changes; PixelRatio is
  // what the words are actually drawn at.
  const { width } = useWindowDimensions();
  // `toArray`, not `Children.count`: count includes the `false` a conditional
  // tile leaves behind, which would wrap a row of three drawn tiles.
  const tiles = Children.toArray(children);
  const wraps = actionRowWraps(tiles.length, width, PixelRatio.getFontScale());
  return (
    <View style={[ic.row, wraps && ic.rowWrapped]}>
      {tiles.map((child, index) => (
        <View key={isValidElement(child) && child.key != null ? child.key : index} style={wraps ? ic.cellWrapped : ic.cell}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Where a choice sits: paper, a white card or sheet, or the blue or sun ground of a first-run page. */
export type ChoiceGround = 'paper' | 'card' | 'blue' | 'sun';

/**
 * The one choice (icons section 1.6): a pick-one, or an answer, as a row or a
 * tile. Every option, plan, voice, level, goal and time draws through this,
 * and `OptionRow` and the first run's `Choice` are thin names for it.
 * `OptionCard`, the answer row in sittings and drills, joins them once the
 * voice-card test (F355) reads the Hear here rather than its own ear.
 *
 * A row is 72 (56 when compact) with the caller's tile at its head, the title,
 * a line under it and a 28 disc at its end; a tile stacks the tile over the
 * title for a grid of two. Not chosen: white with a 2pt hairline border, which
 * never matches the ground; on a white sheet the fill is the paper instead.
 * Chosen (founder decision D7: fill and glow, no lip, no shadow): the brand
 * blue with white words and a white disc holding the blue check, or the sun
 * with ink words on a blue ground, where blue would vanish. The tile inside
 * turns white with a brand mark (`TileOnChosen`) so a blue or sun tile never
 * disappears into the fill. Becoming chosen pops once and lights the ring
 * layer `Press` draws; the disc settles in. It ticks like a choice.
 *
 * A radio by default, with its checked state said on a device and on the web;
 * `role="button"` keeps a selected state instead, for rows that act on the tap.
 * A French title is set and read as French. A Hear is its own `IconButton`
 * beside the choice, never inside it, so hearing never chooses and no button
 * sits in a button on the web. Sound for a choice comes later, from the event.
 */
export function Choice({
  title,
  detail,
  tile,
  glyph,
  selected,
  onPress,
  role = 'radio',
  layout = 'row',
  ground = 'paper',
  onHear,
  playing = false,
  compact = false,
  outlined = false,
  navigation = false,
  lang,
  accessibilityLabel,
}: {
  title: string;
  detail?: string;
  /** The mark at the head: an `IconTile`, or a `ChoiceArt` that draws one. */
  tile?: ReactNode;
  /** The first run's older name for `tile`, until its pages move to it. */
  glyph?: ReactNode;
  selected: boolean;
  onPress: () => void;
  /** radio, one of a set (the default); button, a row that acts on the tap. */
  role?: 'radio' | 'button';
  layout?: 'row' | 'tile';
  /**
   * What the choice sits on. `paper.ground` is the first run's older way of
   * saying `card`: those sheets passed the fill they wanted, the paper, on the
   * white sheet. It stays until they move to `card`.
   */
  ground?: ChoiceGround | typeof paper.ground;
  /** Hear this choice without choosing it: a separate target beside it. */
  onHear?: () => void;
  /** The sample is sounding: the Hear says Stop and its arcs breathe. */
  playing?: boolean;
  compact?: boolean;
  /** Calm white selection with a blue outline, used for compact plan comparisons. */
  outlined?: boolean;
  /** A navigation row is a plain button, never a toggle or radio. */
  navigation?: boolean;
  /** The title is a French line: set as French, and read in a French voice. */
  lang?: 'fr';
  /** Say something other than the title and detail. Falls back to both, joined. */
  accessibilityLabel?: string;
}) {
  const t = useB();
  const on: ChoiceGround = ground === paper.ground ? 'card' : ground;
  const sunny = on === 'blue';
  const radio = role === 'radio';
  const head = tile ?? glyph;
  const isTile = layout === 'tile';
  // On blue or sun the unchosen choice is a white plate in both modes; on the
  // paper or a card it is themed (UI-008, 2026-10-20).
  const onColourGround = on === 'blue' || on === 'sun';
  const filled = selected && !outlined;
  const fill = filled ? (sunny ? colour.sun : accent.brand) : on === 'card' ? t.ground : onColourGround ? paper.card : t.card;
  const words = filled ? (sunny ? paper.ink : paper.onInk) : onColourGround ? paper.ink : t.text;
  const quiet = filled ? (sunny ? onColour.sun : onColour.blue) : onColourGround ? paper.inkSoft : t.muted;
  const rest = onColourGround ? paper.card : t.card;
  const titleStyle = lang === 'fr' ? type.french : outlined ? type.heading : compact ? type.label : type.bodyStrong;
  const disc = (
    <Feedback kind="selection" active={selected}>
      {selected ? (
        <View {...decorative} style={[ch.disc, { backgroundColor: paper.card }]}>
          <CheckGlyph size={18} color={accent.brand} />
        </View>
      ) : (
        <View {...decorative} style={[ch.disc, { borderWidth: 2, borderColor: t.field }]} />
      )}
    </Feedback>
  );
  const press = (
    <Press
      haptic="selection"
      depth={isTile ? 'tile' : 'control'}
      selected={selected}
      glowRadius={radius.tile}
      accessibilityRole={role}
      accessibilityState={navigation ? undefined : radio ? { checked: selected } : { selected }}
      aria-checked={radio ? selected : undefined}
      aria-selected={navigation || radio ? undefined : selected}
      aria-pressed={navigation || radio ? undefined : selected}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${title}, ${detail}` : title)}
      onPress={onPress}
      frame={onHear == null ? (isTile ? ch.share : undefined) : isTile ? undefined : ch.share}
      style={[isTile ? ch.tile : [ch.row, compact && ch.rowCompact, outlined && { minHeight: space(19), paddingVertical: space(4) }], { backgroundColor: fill, borderColor: outlined ? (selected ? accent.brand : rest) : selected ? fill : onColourGround ? paper.field : t.field }]}
    >
      {head != null ? <TileOnChosen.Provider value={selected}>{head}</TileOnChosen.Provider> : null}
      <View style={isTile ? ch.tileWords : ch.words}>
        <Text {...(lang === 'fr' ? frenchText : {})} style={[titleStyle, { color: words }, isTile && ch.centred]}>
          {title}
        </Text>
        {detail != null ? <Text style={[type.small, { color: quiet }, isTile && ch.centred]}>{detail}</Text> : null}
      </View>
      {navigation ? null : isTile ? <View style={ch.tileDisc}>{disc}</View> : disc}
    </Press>
  );
  if (onHear == null) return press;
  return (
    <View style={isTile ? ch.hearUnder : ch.hearBeside}>
      {press}
      {/* Its own slot, so the button sits centred on the row rather than at its top. */}
      <View>
        <IconButton
          icon="speaker"
          label={`${playing ? 'Stop' : 'Hear'} ${title}`}
          onPress={onHear}
          animate="speaker-waves"
          active={playing}
          ground={on === 'blue' || on === 'sun' ? on : 'paper'}
        />
      </View>
    </View>
  );
}

const ic = StyleSheet.create({
  buttonFrame: { alignSelf: 'flex-start' },
  button: { alignItems: 'center', justifyContent: 'center' },
  tileFrame: { flexGrow: 1 },
  tile: {
    flexGrow: 1,
    minHeight: HIT + space(7),
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1.5),
    paddingVertical: space(3),
    paddingHorizontal: space(2),
    borderRadius: radius.tile,
    borderWidth: 2,
  },
  tileWords: { textAlign: 'center' },
  inlineFrame: { alignSelf: 'flex-start' },
  inline: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(2) },
  row: { flexDirection: 'row', gap: space(3) },
  rowWrapped: { flexWrap: 'wrap' },
  cell: { flex: 1, minWidth: 0 },
  cellWrapped: { flexBasis: '47%', flexGrow: 1, minWidth: 0 },
});

const ch = StyleSheet.create({
  row: {
    minHeight: HIT + space(7),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    borderRadius: radius.tile,
    borderWidth: 2,
  },
  rowCompact: { minHeight: HIT + space(3), paddingVertical: space(2) },
  words: { ...ROW_WORDS, gap: space(0.5) },
  disc: { width: space(7), height: space(7), borderRadius: space(3.5), alignItems: 'center', justifyContent: 'center' },
  share: { flex: 1, minWidth: 0 },
  tile: {
    flexGrow: 1,
    minHeight: space(30),
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    padding: space(4),
    borderRadius: radius.tile,
    borderWidth: 2,
  },
  tileWords: { alignSelf: 'stretch', gap: space(0.5) },
  tileDisc: { position: 'absolute', top: space(2.5), right: space(2.5) },
  centred: { textAlign: 'center' },
  hearBeside: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  hearUnder: { flex: 1, minWidth: 0, alignItems: 'center', gap: space(1) },
});

/**
 * When a sheet says there is more below (F755; come alive, icons section 3.5).
 * Appended, like the icon controls above, so no sliced region moves.
 *
 * A sheet's footer sits outside its scroll, so a tall sheet on a phone runs its
 * last controls under the footer with nothing to say they are there: on the
 * first run's start sheet that was the consent switches. The cue is a flat
 * hairline over the footer, drawn only while content runs under it, and one
 * flash of the scroll indicator `SHEET_CUE_FLASH_MS` after it first holds in an
 * opening. A sheet whose content fits draws no rule, and neither does one
 * scrolled to its end. Pure, so the rule is tested without a renderer.
 */
export const SHEET_CUE_FLASH_MS = 400;

/** True while content runs under the footer: taller than the view, with its end not yet in sight. */
export function sheetRunsUnder(content: number, viewport: number, offset: number): boolean {
  if (!(content > 0) || !(viewport > 0)) return false;
  const seen = Math.max(0, offset) + viewport;
  return content > viewport + 1 && seen < content - 1;
}
