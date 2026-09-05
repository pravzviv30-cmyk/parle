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

import { useState, type ReactNode } from 'react';
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
export interface TitleSwap {
  /** The word showing now, comma included: 'Salut,' */
  word: string;
  /** The word rising in behind it. */
  next: string;
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
 * The greeting: one word rising through a slot, and a name that arrives with it.
 *
 * F418 sized this slot to a ghost of the widest word the pool could produce, so
 * the name never had to move. On screen that bought a hole: `Hello,` sat 47pt
 * from `Camille` at 375pt, about eight spaces. A gap-free line and a still name
 * are the same tradeoff seen from two sides — if the word is always tight against
 * the name, the name's resting place moves with the word's width — so the name
 * moves, and it moves as part of the swipe rather than as a jump.
 *
 * The slot is one line tall and clips, and holds both real words in normal flow,
 * one under the other. Two things follow from that and both matter. It is as wide
 * as the wider of the two words without measuring anything, so no ghost is needed;
 * and neither word is ever cut off, which an absolutely positioned one would be —
 * an absolute child is measured against its owner's width on purpose (Yoga does it
 * so text wraps to its owner, and react-native-web gives every Text
 * `word-wrap: break-word`), so `Bonjour,` rising into a `Hello,`-sized box would
 * arrive as `Bonjou`. The words are `flex-start` inside the strip so each hugs its
 * own text: stretched, they would both report the slot's width to `onLayout`, the
 * difference would go to zero, and the gap would come straight back.
 *
 * The name follows the slot in flow and is pulled back onto whichever word is
 * showing by a `translateX` that runs the difference between the two drawn widths
 * across the same `progress` the words ride. At the commit `progress` snaps to 0
 * with the arriving word already the current one: the slot's flow width changes by
 * exactly that difference while the transform returns from it to zero, and the two
 * cancel, so the name arrives rather than jumping.
 *
 * That cancellation only holds if the difference describes the pair that is on
 * screen now, which is why the widths are keyed by the string that drew them and
 * not by which line of the strip reported them (F428). Held by line they are one
 * render stale at the one frame that matters: the new pair has already rendered,
 * the flow width is already right because it comes from the real text, and
 * `onLayout` for that pair cannot have fired, because it fires after the render is
 * laid out. `Salut,` to `Bonjour,` at 375pt left the transform at -43 against a
 * slot that had already grown, and the name was drawn 43pt inside `Bonjour,` for a
 * frame. Keyed by text, both widths are already known: the word showing spent the
 * whole cycle before as the strip's lower line, and the word arriving went through
 * the slot on an earlier turn of the pool.
 *
 * Measuring is the one new mechanism here, and there is no other way to know how
 * far the name has to travel. It is self-correcting rather than fragile: a reading
 * size change or a web font landing late relays both words and reports both widths
 * again, under the same keys. A word's very first appearance is the one unmeasured
 * case, and there the difference is zero and the name simply does not travel that
 * once — the same honest answer as the first frame before anything is measured,
 * and a frame with no travel is a gap where a stale one was an overlap.
 *
 * The travel stands down once the name has wrapped to its own line, which is what
 * happens at the largest reading sizes. There it is not beside the word, so there
 * is no gap to close, and pulling it left would walk the learner's own name off the
 * edge of the screen.
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
  // Every word as drawn, under the text that drew it, and which line the name
  // landed on. An empty map and a 0 are the honest answers before a layout pass:
  // no difference, no travel, a still line at the right place.
  //
  // Keyed by text rather than by which line of the strip reported it, because a
  // width held by line belongs to the previous pair on the frame the words change
  // (F428). This map cannot grow without bound: its keys are the greetings
  // themselves, seven of them in `home/greeting.ts` and only the ones this hour
  // allows, so it settles at one entry per word rather than one per swipe.
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [nameTop, setNameTop] = useState(0);
  // `onLayout` fires on every relayout, so a write that always builds a fresh
  // object is a loop: the new map re-renders, the re-render relays out, the
  // layout writes again. Only a width that actually changed is worth a render,
  // and returning the same map is how React is told to stop.
  const measure = (text: string, drawn: number) =>
    setWidths((seen) => (seen[text] === drawn ? seen : { ...seen, [text]: drawn }));
  // The slot is the wider of the two words, so the name is pulled back onto the
  // one showing: by the difference when the word arriving is wider, and by
  // nothing when it is narrower. Either way the two ends are the difference
  // apart, which is exactly what the flow gives back at the commit. Until both
  // words have been drawn once there is no difference to run, and standing still
  // is better than travelling a number that is not about these two words.
  const shownWidth = widths[swap.word];
  const arrivingWidth = widths[swap.next];
  const grow = shownWidth != null && arrivingWidth != null ? arrivingWidth - shownWidth : 0;
  const beside = nameTop < line / 2;
  const nameFrom = beside ? -Math.max(grow, 0) : 0;
  const nameTo = beside ? Math.min(grow, 0) : 0;
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={title}
      style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}
    >
      <View style={{ height: line, overflow: 'hidden' }} {...decorative}>
        <Animated.View
          style={{
            alignItems: 'flex-start',
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
            onLayout={(e) => measure(swap.word, e.nativeEvent.layout.width)}
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
            onLayout={(e) => measure(swap.next, e.nativeEvent.layout.width)}
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
        <Animated.Text
          onLayout={(e) => setNameTop(e.nativeEvent.layout.y)}
          style={[
            type.display,
            {
              color: paper.ink,
              flexShrink: 1,
              transform: [
                {
                  translateX: swap.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [nameFrom, nameTo],
                  }),
                },
              ],
            },
          ]}
        >
          {'\u00A0' + swap.rest}
        </Animated.Text>
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
