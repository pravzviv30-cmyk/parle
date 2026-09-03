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
 * Nothing here moves and nothing here draws its own glyphs: movement belongs to
 * the scenes and the pen already drew the chevron. The frame stays out of the way.
 */

import type { ReactNode } from 'react';
import {
  View,
  ScrollView,
  Text,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Card, PillButton, OutlineButton } from './components.tsx';
import { paper, space, type, HIT } from './theme.ts';

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
  | { back: { onPress: () => void; label?: string }; leave?: never }
  | { leave: { onPress: () => void; label: string; accessibilityLabel?: string }; back?: never }
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

type TabHeaderProps = {
  /** The tab's name, set large. */
  title: string;
  /** One plain line saying what the tab is for. */
  purpose: string;
  /** An optional control on the title row — the learner's monogram on Home. */
  trailing?: ReactNode;
  /** Anything the tab wants under the purpose, still inside the header block. */
  children?: ReactNode;
};

/**
 * The one tab header. A tab opens with its name set at display size and left,
 * a plain purpose line beneath it, and an optional control on the title row.
 *
 * It is the FIRST child of a tab's scroll body, not the frame's `header` slot:
 * a fixed display title over a purpose line is taller than the screen at the
 * largest reading size, so it has to scroll with the content rather than pin
 * to the top. Nothing here caps the reading size or truncates the title.
 */
export function TabHeader({ title, purpose, trailing, children }: TabHeaderProps) {
  return (
    <View style={{ marginBottom: space(5) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <Text accessibilityRole="header" style={[type.display, { color: paper.ink, flex: 1 }]}>
          {title}
        </Text>
        {trailing != null ? trailing : null}
      </View>
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{purpose}</Text>
      {children != null ? children : null}
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
