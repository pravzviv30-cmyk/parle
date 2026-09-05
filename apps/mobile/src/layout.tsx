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
 * belongs to whoever owns the value and the pen already drew the chevron. The
 * frame may hold a value somebody else is moving, and stays out of the way.
 */

import type { ReactNode } from 'react';
import {
  Animated,
  View,
  ScrollView,
  Text,
  Pressable,
  Platform,
  PixelRatio,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Card, PillButton, OutlineButton } from './components.tsx';
import { decorative, paper, space, type, HIT } from './theme.ts';

/** Where the bottom of a screen ends. */
export type ScreenBottom = 'tab' | 'inset' | 'none';

type ScreenProps = {
  children: ReactNode;
  /** The page's own light. Defaults to the house paper. */
  ground?: string;
  /** Horizontal padding of space(5) on the content, header and footer. */
  padded?: boolean;
  /** The gap below the safe-area top inset. */
  topGap?: number;
  /**
   * `tab` for a screen under the tab bar (the bar draws the bottom inset
   * itself), `inset` for a standalone screen, `none` when the body owns it.
   */
  bottom?: ScreenBottom;
  header?: ReactNode;
  footer?: ReactNode;
  /** Lift the content above the keyboard when a field is focused. */
  avoidKeyboard?: boolean;
};

/**
 * The still root. A full-height View on the page's paper, with the safe-area
 * top inset already paid and the bottom chosen by `bottom`. Header and footer
 * sit outside any scroll region and share the body's horizontal pad, so a back
 * arrow lines up with the content beneath it.
 */
export function Screen({
  children,
  ground = paper.ground,
  padded = true,
  topGap = space(4),
  bottom = 'inset',
  header,
  footer,
  avoidKeyboard,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padX = padded ? space(5) : 0;
  const bottomPad =
    bottom === 'tab' ? space(3) : bottom === 'inset' ? insets.bottom + space(4) : 0;

  const root = (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: ground,
        paddingTop: insets.top + topGap,
        paddingBottom: bottomPad,
      }}
    >
      {header != null ? <View style={{ paddingHorizontal: padX }}>{header}</View> : null}
      <View style={{ flex: 1, minHeight: 0, paddingHorizontal: padX }}>{children}</View>
      {footer != null ? <View style={{ paddingHorizontal: padX }}>{footer}</View> : null}
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

type ScrollScreenProps = ScreenProps & {
  /** Pin a short body to the vertical centre instead of the top. */
  center?: boolean;
};

/**
 * The same root with a scrolling body. The ScrollView carries the web height
 * fix so a short page still fills the column, keeps taps while the keyboard is
 * up, and hides its bar. The body's horizontal pad comes from Screen, so the
 * scroll content lines up with the header and footer without a second number.
 */
export function ScrollScreen({
  children,
  center,
  ground,
  padded,
  topGap,
  bottom,
  header,
  footer,
  avoidKeyboard,
}: ScrollScreenProps) {
  return (
    <Screen
      ground={ground}
      padded={padded}
      topGap={topGap}
      bottom={bottom}
      header={header}
      footer={footer}
      avoidKeyboard={avoidKeyboard}
    >
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{
          flexGrow: 1,
          // The last card clears the tab bar without the tab padding its own
          // scroll: the frame owns the air above the bar, here, once.
          ...(bottom === 'tab' ? { paddingBottom: space(8) } : null),
          ...(center ? { justifyContent: 'center' } : null),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Screen>
  );
}

/**
 * A screen cannot ask for both a back arrow and a leave word: one goes back a
 * step in a stack, the other abandons something the meter is counting, and a
 * header that offered both would let a learner think a tab switch left the room.
 */
type ScreenHeaderProps = { title?: ReactNode } & (
  | { back?: { onPress: () => void; label?: string }; leave?: never }
  | { leave?: { onPress: () => void; label: string; accessibilityLabel?: string }; back?: never }
);

/**
 * The one header row. A back arrow on the left or a leave word on the right,
 * with an optional node in the centre — a title, a dot rail, a small label.
 */
export function ScreenHeader(props: ScreenHeaderProps) {
  const { title } = props;
  const back = props.back;
  const leave = props.leave;
  // Three slots always, so the centre is the centre. The left holds the chevron
  // or an empty box its width; the right holds the leave word or an empty box its
  // width; the title sits in the flex centre between two equal touch floors, not
  // half a hit target off it because one side happened to be empty.
  return (
    <View style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center' }}>
      {back != null ? (
        <Pressable
          onPress={back.onPress}
          accessibilityRole="button"
          accessibilityLabel={back.label ?? 'Back'}
          style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft />
        </Pressable>
      ) : (
        <View style={{ width: HIT }} />
      )}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {typeof title === 'string' || typeof title === 'number' ? (
          // A bare string under a View is a raw text node — Fabric drops it and
          // logs. A caller that wants a status line passes its own <Text> (with
          // a live region); this only keeps a plain string title from vanishing.
          <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{title}</Text>
        ) : (
          title
        )}
      </View>
      {leave != null ? (
        <Pressable
          onPress={leave.onPress}
          accessibilityRole="button"
          accessibilityLabel={leave.accessibilityLabel ?? leave.label}
          style={{ minWidth: HIT, minHeight: HIT, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <Text style={[type.bodyStrong, { color: paper.inkSoft }]}>{leave.label}</Text>
        </Pressable>
      ) : (
        <View style={{ minWidth: HIT }} />
      )}
    </View>
  );
}

/**
 * A word that moves through a fixed slot, beside a name that does not.
 *
 * Home's greeting changes and the learner's name beside it must not, so the
 * greeting is not one line that fades: it is a placeholder the word travels
 * through. `word` is showing now and carries its own comma, because the comma
 * belongs to the greeting rather than to the name. `next` is the word rising in
 * behind it. `widest` is the widest word the pool can produce and is what gives
 * the slot its size. `rest` is the learner's real first name, or null when they
 * skipped it — never a stand-in name.
 *
 * `progress` runs 0 to 1 across one swipe and is driven by whoever owns the
 * timing. The frame is handed the value; it never starts it.
 */
export interface TitleSwap {
  /** The word showing now, comma included: 'Salut,' */
  word: string;
  /** The word rising in behind it. */
  next: string;
  /** The widest word the pool can produce, for sizing. */
  widest: string;
  /** The name, or null when the learner skipped it. */
  rest: string | null;
  /** 0 at rest, 1 when the swipe is complete. Somebody else drives it. */
  progress: Animated.Value;
}

type TabHeaderProps = {
  /** The tab's name, set large. */
  title: string;
  /** One plain line saying what the tab is for. Home is the one tab without one. */
  purpose?: string;
  /**
   * Draw the title as a moving word in a fixed slot with a still name beside
   * it. Given nothing, the title is the plain line it has always been.
   */
  titleSwap?: TitleSwap | null;
  /** An optional control on the title row — the learner's monogram on Home. */
  trailing?: ReactNode;
  /** Anything the tab wants under the purpose, still inside the header block. */
  children?: ReactNode;
};

/**
 * The one tab header. A tab opens with its name set at display size and left,
 * a plain purpose line beneath it where it has one, and an optional control on
 * the title row.
 *
 * It is the FIRST child of a tab's scroll body, not the frame's `header` slot:
 * a fixed display title over a purpose line is taller than the screen at the
 * largest reading size, so it has to scroll with the content rather than pin
 * to the top. Nothing here caps the reading size or truncates the title.
 *
 * Two of the props are optional for reasons Home gave them.
 *
 * `purpose` used to be required, and every tab still says what it is for in
 * one line. Home is the exception the founder asked for: its header is the
 * greeting alone, so the line is absent rather than empty. A tab that passes
 * one is drawn exactly as it was.
 *
 * `titleSwap` is the only way a title can move without `type.display` leaving
 * this file. Home's greeting changes through the day, and the alternative was a
 * tab spreading the display line into a stylesheet of its own, which is how
 * five tabs end up with five slightly different titles. Given a swap, the row
 * is `TitleSwapRow` below; given nothing, it is the plain `Text` it has always
 * been, which is what the other four tabs still render.
 */
export function TabHeader({ title, purpose, titleSwap, trailing, children }: TabHeaderProps) {
  return (
    <View style={{ marginBottom: space(5) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        {titleSwap != null ? (
          <TitleSwapRow title={title} swap={titleSwap} />
        ) : (
          <Text accessibilityRole="header" style={[type.display, { color: paper.ink, flex: 1 }]}>
            {title}
          </Text>
        )}
        {trailing != null ? trailing : null}
      </View>
      {purpose != null ? (
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{purpose}</Text>
      ) : null}
      {children != null ? children : null}
    </View>
  );
}

/**
 * The greeting: one word rising through a fixed slot, the name holding still.
 *
 * The slot is sized by a ghost — the widest word the pool can produce, drawn in
 * normal flow at zero opacity — so the slot is exactly one line tall and wide
 * enough for any word in the pool at any OS reading size, without measuring
 * anything. Nothing in this app calls `onLayout`, and adding one here would buy
 * a first frame at the wrong size and a remeasure every time the reading size
 * changed, to learn what the type already knows.
 *
 * Over the ghost sits an absolute strip holding both words stacked. `progress`
 * lifts it exactly one line and crosses the two opacities at the same time, so
 * what reads is one word replacing another rather than a strip sliding past.
 * The slot clips, so the arriving word does not exist until it arrives.
 *
 * The name is outside the slot, in flow after it, joined to the word by a
 * non-breaking space so the gap grows with the type rather than staying at
 * whatever a number said once. The row wraps, so at the largest reading size a
 * long name drops to a second line instead of breaking mid-word.
 *
 * A screen reader hears one greeting: the row is a single accessible heading
 * labelled with the still line, and the slot is hidden from assistive tech
 * outright. There is no live region anywhere near this row — a header that
 * renamed itself every few seconds and announced each one is the most hostile
 * thing this app could do to somebody listening to it.
 */
function TitleSwapRow({ title, swap }: { title: string; swap: TitleSwap }) {
  // One line, in the units a transform speaks. A translateY is device pixels
  // while the rendered line height grows with the OS reading size, so the two
  // only agree once the scale is multiplied back in; this is the only way to
  // move exactly one line without measuring one. Read at render, so a Dynamic
  // Type change corrects on the next render. It is 1 on the web, where browser
  // zoom scales the CSS pixel itself.
  const line = type.display.lineHeight * PixelRatio.getFontScale();
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={title}
      style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}
    >
      <View style={{ overflow: 'hidden' }} {...decorative}>
        <Text style={[type.display, { color: paper.ink, opacity: 0 }]}>{swap.widest}</Text>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: [
              {
                translateY: swap.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -line],
                }),
              },
            ],
          }}
        >
          <Animated.Text
            style={[
              type.display,
              {
                color: paper.ink,
                opacity: swap.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              },
            ]}
          >
            {swap.word}
          </Animated.Text>
          <Animated.Text
            style={[
              type.display,
              {
                color: paper.ink,
                opacity: swap.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              },
            ]}
          >
            {swap.next}
          </Animated.Text>
        </Animated.View>
      </View>
      {swap.rest != null ? (
        <Text style={[type.display, { color: paper.ink, flexShrink: 1 }]}>
          {'\u00A0' + swap.rest}
        </Text>
      ) : null}
    </View>
  );
}

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The one leave-confirmation. It asks before a learner abandons something the
 * meter is counting. The safe answer, staying, is the solid pill and comes
 * first; the leaving answer is the quiet outline, so the primary action on the
 * sheet is the one that keeps the room.
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  if (!visible) return null;
  return (
    <View style={st.overlay} accessibilityViewIsModal>
      <View style={st.scrim} />
      <Card style={st.sheet}>
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={[type.title, { color: paper.ink }]}
        >
          {title}
        </Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{body}</Text>
        <View style={{ marginTop: space(4), gap: space(2) }}>
          <PillButton label={cancelLabel} onPress={onCancel} />
          <OutlineButton label={confirmLabel} onPress={onConfirm} />
        </View>
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(6),
  },
  // The fade lives on its own layer so the sheet above it stays at full ink.
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: paper.ink, opacity: 0.32 },
  sheet: { width: '100%', maxWidth: 420 },
});
