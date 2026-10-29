/**
 * The layout primitives — the frame every screen sits inside.
 *
 * A screen should not have to re-derive the safe-area maths, the keyboard
 * behaviour, or the web height fix each time it is written. Those live here once,
 * in two roots and two pieces of chrome, so eighteen screens can be told how wide
 * they are and where the notch is rather than each measuring for itself.
 *
 * `Screen` is the still root; `ScrollScreen` is the same root with a scrolling
 * body. `ScreenHeader` is the one header row, a back arrow or a leave word, never
 * both. `ConfirmSheet` is the one way to ask before leaving something metered.
 *
 * Nothing here drives movement and nothing here draws its own glyphs: timing
 * belongs to whoever owns the value and the pen already drew the back mark. The
 * frame may hold a value somebody else is moving, and stays out of the way.
 */

import { Children, useState, type ReactNode, type Ref } from 'react';
import {
  View,
  ScrollView,
  Text,
  Pressable,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CloseGlyph, GhostButton, PillButton, RoundButton, Sheet } from './components.tsx';
import { colour, paper, space, type, HAIRLINE, HIT, RHYTHM } from './theme.ts';
import { useB, type B } from './main/bTheme.tsx';
import { footerOverflow } from './footerOverflow.ts';
import { compactPhone, screenGeometry, screenInsets, READING, layoutClass, FOOTER_MAX } from './responsiveLayout.ts';

/**
 * The reading column as a style: full width up to `READING`, centred. The first
 * run wraps its header, body and footer in it, so an iPad reads it at a phone's
 * measure and a phone is unchanged.
 */
export const readingColumn = { width: '100%', maxWidth: READING, alignSelf: 'center' } as const;

/** Screens consume the frame's compact mode rather than measuring or fixing their own width. */
export function useCompactPhone() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return compactPhone(width - insets.left - insets.right, height, insets.top, insets.bottom, fontScale);
}

/** Text reflows when the system's reading size changes, without screen-local measurements. */
export function useFontScale() {
  return useWindowDimensions().fontScale;
}

/** Shared usable bounds for artwork and screens; safe-area policy stays here. */
export function useScreenGeometry() {
  const { width, height, fontScale } = useWindowDimensions();
  return screenGeometry(width, height, useSafeAreaInsets(), fontScale);
}

/** The frame follows safe areas and split view; large text keeps a single column. */
export function useLayoutClass() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return fontScale >= 1.6 ? 'compact' : layoutClass(width, insets.left, insets.right);
}

/** Paired content preserves reading order when the tablet returns to a phone width. */
export function Columns({ children }: { children: ReactNode }) {
  const regular = useLayoutClass() === 'regular';
  return <View style={{ flexDirection: regular ? 'row' : 'column', gap: RHYTHM.block }}>
    {Children.toArray(children).map((child, index) => <View key={index} style={{ flex: regular ? 1 : undefined, minWidth: 0 }}>{child}</View>)}
  </View>;
}

/** Where the bottom of a screen ends. */
export type ScreenBottom = 'tab' | 'inset' | 'none';

type ScreenProps = {
  children: ReactNode;
  /** The page's own light. Defaults to the theme's ground (`useB().ground`). */
  ground?: string;
  /** Horizontal padding of space(5) on the content, header and footer. */
  padded?: boolean;
  /** The gap below the safe-area top inset. */
  topGap?: number;
  /**
   * The body draws from the very top, under the status bar, and owns the top
   * inset itself (2026-10-20, sim nits: the scene preview's full-bleed band).
   */
  bleedTop?: boolean;
  /**
   * `tab` for a screen under the tab bar (the bar draws the bottom inset
   * itself), `inset` for a standalone screen, `none` when the body owns it.
   */
  bottom?: ScreenBottom;
  header?: ReactNode;
  footer?: ReactNode;
  /** Lift the content above the keyboard when a field is focused. */
  avoidKeyboard?: boolean;
  /** Measured scroll content remains below the viewport. */
  overflowing?: boolean;
};

/**
 * The grounds whose words are white, so the clock and battery above them must
 * be white too. Blue and coral are the two colour pages that take white words
 * (palette.ts `textOn`), and ink is the dark live ground.
 */
const LIGHT_BAR_GROUNDS: readonly string[] = [colour.blue, colour.coral, paper.ink];

/**
 * The status bar a ground asks for, or null for the theme's ground, where the
 * route's bar (main/MainNavigationTheme.tsx) already governs. The OS stacks
 * status bar styles, so a colour page's style lifts again when the page
 * unmounts. In dark mode every themed surface is dark, so only sun and mint,
 * the two grounds that take ink, keep a dark bar (UI-008, 2026-10-20).
 */
export function barStyleFor(ground: string, t: Pick<B, 'ground' | 'mode'> = { ground: paper.ground, mode: 'light' }): 'light' | 'dark' | null {
  if (ground === t.ground) return null;
  if (LIGHT_BAR_GROUNDS.includes(ground)) return 'light';
  return t.mode === 'dark' && ground !== colour.sun && ground !== colour.mint ? 'light' : 'dark';
}

/**
 * The still root. A full-height View on the page's paper, with the safe-area
 * top inset already paid and the bottom chosen by `bottom`. Header and footer
 * sit outside any scroll region and share the body's horizontal pad, so a back
 * arrow lines up with the content beneath it.
 *
 * The footer's hairline is a paper rule, so it is drawn only on the paper
 * ground: across a blue or sun page it would be a cream scratch over the
 * colour. A colour ground also sets the status bar, light on blue, coral and
 * ink and dark on sun and mint, so the clock stays legible on it (F601).
 */
export function Screen({
  children,
  ground: asked,
  padded = true,
  topGap = space(4),
  bleedTop = false,
  bottom = 'inset',
  header,
  footer,
  avoidKeyboard,
  overflowing = false,
}: ScreenProps) {
  const t = useB();
  // The house paper means the theme's ground: identical under PinLight, and
  // the M3 ground once a route is dark-ready (UI-008, 2026-10-20).
  const ground = asked === undefined || asked === paper.ground ? t.ground : asked;
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const geometry = screenGeometry(width, height, insets, fontScale);
  const horizontal = screenInsets(width, insets.left, insets.right, padded);
  const bottomPad =
    bottom === 'tab' ? space(3) : bottom === 'inset' ? insets.bottom + space(4) : 0;
  const onPaper = ground === t.ground;
  const bar = barStyleFor(ground, t);

  const root = (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: ground,
        paddingTop: insets.top + topGap,
        paddingBottom: bottomPad,
        // A full-bleed band pays the top inset itself, through <TopInset />.
        ...(bleedTop ? { paddingTop: 0 } : null),
      }}
    >
      {bar != null ? <StatusBar style={bar} /> : null}
      {header != null ? <View style={horizontal}>{header}</View> : null}
      <View style={{ flex: 1, minHeight: 0, ...horizontal }}>{children}</View>
      {footer != null ? (
        <View
          style={{
            ...horizontal,
            paddingTop: space(3),
            ...(onPaper && overflowing ? { borderTopWidth: HAIRLINE, borderTopColor: t.line } : null),
            backgroundColor: ground,
          }}
        >
          <ScrollView
            style={{ width: '100%', maxWidth: FOOTER_MAX, maxHeight: geometry.footerMaxHeight, flexGrow: 0, alignSelf: 'center' }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {footer}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  if (avoidKeyboard) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, minHeight: 0 }}
      >
        {root}
      </KeyboardAvoidingView>
    );
  }
  return root;
}

/**
 * The top inset as a spacer, for the band of a `bleedTop` screen
 * (2026-10-20, sim nits): the frame stays the one reader of the safe area.
 */
export function TopInset({ extra = 0 }: { extra?: number }) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top + extra }} />;
}

type ScrollScreenProps = ScreenProps & {
  /** Blank safe-area/gutter taps dismiss editing without adding a control. */
  dismissKeyboardOnBackground?: boolean;
  /** Inside a Sheet, that sheet owns scrolling, insets and its one heading. */
  embedded?: boolean;
  /** Pin a short body to the vertical centre instead of the top. */
  center?: boolean;
  scrollRef?: Ref<ScrollView>;
  onScroll?: ScrollViewProps['onScroll'];
  /** A scene may hold scrolling until its skippable introduction has settled. */
  scrollEnabled?: boolean;
  scrollEventThrottle?: number;
  /** Native keyboard insets are an alternative to the whole-frame avoiding view. */
  automaticallyAdjustKeyboardInsets?: boolean;
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  onViewportLayout?: ScrollViewProps['onLayout'];
};

/**
 * The same root with a scrolling body. The ScrollView carries the web height
 * fix so a short page still fills the column, keeps taps while the keyboard is
 * up, and hides its bar. The body's horizontal pad comes from Screen, so the
 * scroll content lines up with the header and footer without a second number.
 */
export function ScrollScreen({
  dismissKeyboardOnBackground = false,
  children,
  embedded = false,
  center,
  scrollRef,
  onScroll,
  scrollEnabled,
  scrollEventThrottle = 100,
  automaticallyAdjustKeyboardInsets,
  keyboardDismissMode,
  onViewportLayout,
  ground,
  padded,
  topGap,
  bleedTop,
  bottom,
  header,
  footer,
  avoidKeyboard,
}: ScrollScreenProps) {
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [offset, setOffset] = useState(0);
  const overflowing = footerOverflow(contentHeight, viewportHeight, offset);
  if (embedded) {
    return <View style={{ gap: space(4) }}>{children}{footer}</View>;
  }
  // RN web treats programmatic focus scrolling as a drag; only gestures dismiss.
  const resolvedKeyboardDismissMode = Platform.OS === 'web' ? 'none' : keyboardDismissMode;
  const webDragDismisses = Platform.OS === 'web' && keyboardDismissMode === 'on-drag';
  const screen = (
    <Screen
      ground={ground}
      padded={padded}
      topGap={topGap}
      bleedTop={bleedTop}
      bottom={bottom}
      header={header}
      footer={footer}
      avoidKeyboard={avoidKeyboard}
      overflowing={overflowing}
    >
      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        onContentSizeChange={(_, height) => setContentHeight(height)}
        onLayout={(event) => {
          setViewportHeight(event.nativeEvent.layout.height);
          onViewportLayout?.(event);
        }}
        onScroll={(event) => {
          setOffset(event.nativeEvent.contentOffset.y);
          onScroll?.(event);
        }}
        scrollEventThrottle={scrollEventThrottle}
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{
          flexGrow: 1,
          // The last card clears the tab bar without the tab padding its own
          // scroll: the frame owns the air above the bar, here, once.
          ...(bottom === 'tab' ? { paddingBottom: space(8) } : null),
          ...(center ? { justifyContent: 'center' } : null),
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
        keyboardDismissMode={resolvedKeyboardDismissMode}
        {...(webDragDismisses ? { onWheel: Keyboard.dismiss } : {})}
        onTouchMove={webDragDismisses ? Keyboard.dismiss : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Screen>
  );
  // This is background behaviour, never a navigation action or a grouped
  // accessibility button. Child fields and named controls keep their own
  // responders and accessibility elements; the keyboard's Done also dismisses.
  // On web the wrapper receives input clicks too and immediately blurs them.
  // Let the browser own pointer and keyboard focus instead.
  return dismissKeyboardOnBackground && Platform.OS !== 'web' ? (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      <View style={{ flex: 1, minHeight: 0 }}>{screen}</View>
    </TouchableWithoutFeedback>
  ) : screen;
}

/**
 * A screen cannot ask for both a back arrow and a leave word: one goes back a
 * step in a stack, the other abandons something the meter is counting, and a
 * header that offered both would let a learner think a tab switch left the room.
 */
type ScreenHeaderProps = { title?: ReactNode; trailing?: ReactNode; divider?: boolean; ink?: string; muted?: string; ground?: 'blue' | 'coral' | 'paper'; /** Opt-in (P2): the back disc and chevron from the selected appearance. Absent, the white disc as before. */ backAppearance?: { disc: string; mark: string } } & (
  | { back?: { onPress: () => void; label?: string; disabled?: boolean }; leave?: never }
  | { leave?: { onPress: () => void; label: string; accessibilityLabel?: string; close?: boolean }; back?: never; /** A close header's centre: the sitting bar, or nothing. */ centre?: ReactNode }
);

/**
 * The one header row. The round back button on the left or a leave word on the
 * right, with an optional node in the centre — a title, a dot rail, a small
 * label. The way back is SNIPPETS' header-pushed disc: white, at the touch
 * floor, with the ICONS.md back mark, on paper or a colour ground alike.
 */
export function ScreenHeader(props: ScreenHeaderProps) {
  const { title } = props;
  const back = props.back;
  const leave = props.leave;
  const t = useB();
  // 2026-10-21 UI-008, artboards B-Review and B-Drill: a full-screen sitting's
  // way out is the 44 card disc with the 18 close mark on the left, then the
  // centre (the sitting bar, or an empty slot) and the trailing words. The
  // title is not drawn there; it names the centre for a screen reader.
  if (leave != null && leave.close === true) {
    return (
      <View style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Pressable
          onPress={leave.onPress}
          accessibilityRole="button"
          accessibilityLabel={leave.accessibilityLabel ?? leave.label}
          style={({ pressed }) => ({ width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: t.card, opacity: pressed ? 0.7 : 1 })}
        >
          <CloseGlyph size={18} color={t.text} />
        </Pressable>
        <View
          accessible={typeof title === 'string'}
          accessibilityRole={typeof title === 'string' ? 'header' : undefined}
          accessibilityLabel={typeof title === 'string' ? title : undefined}
          style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
        >
          {'centre' in props ? props.centre : null}
        </View>
        {props.trailing}
      </View>
    );
  }
  // Three slots always, so the centre is the centre. The left holds the round
  // back button or an empty box its width; the right holds the leave word or an empty box its
  // width; the title sits in the flex centre between two equal touch floors, not
  // half a hit target off it because one side happened to be empty.
  return (
    <View style={{ minHeight: HIT + space(3), flexDirection: 'row', alignItems: 'center', borderBottomWidth: props.divider === true ? HAIRLINE : 0, borderBottomColor: t.line, marginBottom: space(4), paddingBottom: space(2) }}>
      {back != null ? (
        <RoundButton kind="back" onPress={back.onPress} accessibilityLabel={back.label ?? 'Back'} disabled={back.disabled} appearance={props.backAppearance} />
      ) : (
        <View style={{ width: HIT }} />
      )}
      <View style={{ flex: 1, alignItems: 'flex-start', gap: space(1), marginHorizontal: space(2) }}>
        {typeof title === 'string' || typeof title === 'number' ? (
          // A bare string under a View is a raw text node — Fabric drops it and
          // logs. A caller that wants a status line passes its own <Text> (with
          // a live region); this only keeps a plain string title from vanishing.
          <Text accessibilityRole="header" style={[type.heading, { color: props.ink ?? t.text }]}>{title}</Text>
        ) : (
          title ?? null
        )}
        {props.trailing}
      </View>
      {leave != null ? (
        <Pressable
          onPress={leave.onPress}
          accessibilityRole="button"
          accessibilityLabel={leave.accessibilityLabel ?? leave.label}
          style={{ minWidth: HIT, minHeight: HIT, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <Text style={[type.bodyStrong, { color: props.muted ?? t.muted }]}>{leave.label}</Text>
        </Pressable>
      ) : (
        <View style={{ minWidth: HIT }} />
      )}
    </View>
  );
}

/**
 * A word that swipes through a slot, beside a name that travels with it.
 *
 * Home's greeting changes and the learner's name sits beside it, so the greeting
 * is not one line that fades: it is a slot the word rises through. `word` is
 * showing now and carries its own comma, because the comma belongs to the
 * greeting rather than to the name. `next` is the word rising in behind it.
 * `rest` is the learner's real first name, or null when they skipped it — never
 * a stand-in name.
 *
 * `progress` runs 0 to 1 across one swipe and is driven by whoever owns the
 * timing. The frame is handed the value; it never starts it.
 */
type TabHeaderProps = {
  /** Full-colour editorial screens use the approved display role. */
  display?: boolean;
  /** The tab's name, set large. */
  title: string;
  /** One plain line saying what the tab is for. Home is the one tab without one. */
  purpose?: string;
  /** An optional control on the title row — the learner's monogram on Home. */
  trailing?: ReactNode;
  /**
   * Left is every tab but one. Centre is Profile, where the header is the
   * learner rather than a subject, and it takes `leading` above the title.
   */
  align?: 'left' | 'center';
  /** A mark above a centred title — the learner's monogram on Profile. */
  leading?: ReactNode;
  /** Anything the tab wants under the purpose, still inside the header block. */
  children?: ReactNode;
  /** Title ink from the selected appearance; paper ink when absent. */
  ink?: string;
  /**
   * A line above the title, with the trailing control aligned to the top
   * (2026-10-20 UI-008, artboard B-Journey: "Starter stage" over "Your journey").
   */
  eyebrow?: ReactNode;
  /** No bottom margin, for a header inside a band that sets its own gap (B-Journey). */
  flush?: boolean;
  /** Purpose-line ink from the selected appearance; paper's soft ink when absent. */
  mutedInk?: string;
};

/**
 * The one tab header. A tab opens with its name set at the working title size
 * (`type.title`, 30 at ExtraBold) and left, a plain purpose line beneath it
 * where it has one, and an optional control on the title row. Revamp B (F602):
 * the 44 display size is for the colour pages of the first run, and a tab is a
 * working screen, so its title is the one working title. Home's greeting is one
 * of these titles, not a headline of its own. The centred branch below keeps
 * the display size until Profile's own pass (F606) decides it.
 *
 * It is the FIRST child of a tab's scroll body, not the frame's `header` slot:
 * a title over a purpose line is taller than the screen at the largest reading
 * size, so it has to scroll with the content rather than pin to the top.
 * Nothing here caps the reading size or truncates the title.
 *
 * Two of the props are optional for reasons Home gave them.
 *
 * `purpose` used to be required, and every tab still says what it is for in
 * one line. Home is the exception the founder asked for: its header is the
 * greeting alone, so the line is absent rather than empty. A tab that passes
 * one is drawn exactly as it was.
 *
 * The title's type lives only here. Home's greeting changes through the day,
 * and the alternative was a tab spreading a title style into a stylesheet of
 * its own, which is how five tabs end up with five slightly different titles.
 * The greeting is a still line (F418): the plain `Text` every tab renders.
 *
 * `align` is the third, and it is deliberately not a free choice. Four tabs
 * name a subject and read left, because a left edge is where the eye starts a
 * line and four headers that agree are what makes the app feel like one app.
 * Profile is the one tab that is a person: the mockup opens it on the learner's
 * own mark with their name under it, and a centred column is the only honest
 * way to draw that. So centring is one branch here rather than a `textAlign` a
 * screen may reach for, and it is the ONLY place in this file a tab title is
 * aligned at all.
 *
 * The centred branch draws no moving word and no trailing control on purpose.
 * The greeting swap belongs to Home, which is left; a control beside a centred
 * title pulls it off centre; and a header that could do everything is a header
 * with no shape.
 */
export function TabHeader({ title, purpose, trailing, leading, align = 'left', children, display = false, ink: askedInk, mutedInk: askedMuted, eyebrow, flush = false }: TabHeaderProps) {
  const t = useB();
  const ink = askedInk ?? t.text;
  const mutedInk = askedMuted ?? t.muted;
  if (display) return <View style={{ gap: space(3), marginBottom: space(4) }}>
    {(leading != null || trailing != null) && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: space(11) }}>{leading ?? <View />}{trailing}</View>}
    <Text accessibilityRole="header" style={[type.display, { color: ink }]}>{title}</Text>
    {children}
  </View>;
  if (align === 'center') {
    return (
      <View style={{ marginBottom: space(5), alignItems: 'center', paddingVertical: space(2) }}>
        {leading != null ? leading : null}
        <Text
          accessibilityRole="header"
          style={[
            type.display,
            { color: ink, textAlign: 'center', marginTop: leading != null ? space(3) : 0 },
          ]}
        >
          {title}
        </Text>
        {purpose != null ? (
          <Text style={[type.body, { color: mutedInk, marginTop: space(2), textAlign: 'center' }]}>
            {purpose}
          </Text>
        ) : null}
        {children != null ? children : null}
      </View>
    );
  }
  return (
    <View style={[{ marginBottom: space(5) }, flush ? { marginBottom: 0 } : null]}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space(3) }, eyebrow != null ? { alignItems: 'flex-start' } : null]}>
        <View style={{ flex: 1, gap: 2 }}>
          {eyebrow != null ? eyebrow : null}
          <Text accessibilityRole="header" style={[type.title, { color: ink }]}>
            {title}
          </Text>
        </View>
        {trailing != null ? trailing : null}
      </View>
      {purpose != null ? (
        <Text style={[type.body, { color: mutedInk, marginTop: space(2) }]}>{purpose}</Text>
      ) : null}
      {children != null ? children : null}
    </View>
  );
}

/**
 * The greeting: two complete lines passing through one stable slot.
 *
 * The old word-only strip moved a full line and separately measured the name.
 * On a native phone that could briefly clip both words at the handoff and it
 * made the name's horizontal correction feel like a second animation. The
 * greeting and name now move as one phrase: the outgoing line rises one full
 * line while the incoming line rises from the slot below it. Their opacities
 * cross at the same pace, so the heading never has an empty frame and the two
 * phrases never sit directly on top of each other.
 *
 * At accessibility text sizes the animation stands down and the full `title`
 * renders in normal flow. A fixed-height motion slot must never clip a wrapped
 * learner name.
 *
 * A screen reader hears one greeting: the row is a single accessible heading
 * labelled with the still line, and the slot is hidden from assistive tech
 * outright. There is no live region anywhere near this row — a header that
 * renamed itself every few seconds and announced each one is the most hostile
 * thing this app could do to somebody listening to it.
 */
type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * The confirmed action is running. The sheet stays up, both buttons are off,
   * the link reads `busyLabel`, and every way out is ignored so the learner's
   * answer stands. Off by default, so existing callers are unchanged.
   */
  busy?: boolean;
  busyLabel?: string;
};

const ignore = (): void => {};

/**
 * The one leave-confirmation. It asks before a learner abandons something the
 * meter is counting. The safe answer, staying, is the solid pill and comes
 * first; the leaving answer is the quiet link under it, so the primary action
 * on the sheet is the one that keeps the room.
 *
 * Revamp B (F603): it is the shared bottom `Sheet`, rising under the ink scrim,
 * rather than a card of its own in the middle of the screen. The props are the
 * same, so its callers change nothing. The sheet's own ways out all land on
 * `onCancel`: a tap on the scrim and the screen reader's escape both keep the
 * learner in the room, because staying is the answer that costs nothing. Only
 * the link leaves. The sheet announces its title as it rises, so the question
 * is still heard the moment it is asked.
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel: askedConfirm,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  busyLabel,
}: ConfirmSheetProps) {
  const t = useB();
  const confirmLabel = busy ? (busyLabel ?? askedConfirm) : askedConfirm;
  return (
    <Sheet visible={visible} title={title} onClose={busy ? ignore : onCancel}>
      <Text style={[type.body, { color: t.muted }]}>{body}</Text>
      <PillButton label={cancelLabel} onPress={onCancel} disabled={busy} />
      <GhostButton label={confirmLabel} onPress={onConfirm} disabled={busy} />
    </Sheet>
  );
}
