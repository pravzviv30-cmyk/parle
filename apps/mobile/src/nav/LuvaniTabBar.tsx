/**
 * The tab bar, Figma C2/Main2/Navigation (292:1103; UI-008, 2026-10-20): an ink
 * capsule 12pt in from each edge, radius 32, holding five equal cells of an
 * Iconsax glyph over its word. Selected is the violet pill with the Linear glyph
 * in sun and the word in cream at Outfit Bold; unselected is the Linear glyph
 * and the word in cream at Outfit Medium on the ink. There is no dot beneath a
 * tab, no shadow, no chartreuse and no wash; the only dot is the Practice one,
 * which is the real due deck. The capsule is the same ink in both themes. The
 * bar floats over the screen (UI-017, founder 2026-11-01): the strip around the
 * capsule is clear and lets touches through, so only the capsule covers
 * content, and it reports its height so a tab screen pads its scroll past it.
 *
 * Each cell presses through the one spring with no haptic of its own, because
 * the tap that changes tab is the one that ticks. Large reading sizes wrap the
 * labels and grow the capsule; nothing truncates or caps font scaling. Changes
 * are announced to assistive technology. The decisions (words, drawings, width,
 * wrapping, the dot) live in `tabBarModel.ts`; the one movement, the selected
 * glyph's pop, lives in `TabGlyph.tsx` (F737). The only other movement is the
 * violet selection pill in `TabPill.tsx` (item 7, founder 2026-11-02): it slides
 * to a tapped tab, and any tab can be held and dragged sideways to another,
 * ticking as it crosses each cell and landing like a tap. A still long press is
 * never claimed, so the Large Content Viewer keeps working (F947).
 */

import { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo, PanResponder, PixelRatio, useWindowDimensions } from 'react-native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { boldType, font, space } from '../theme.ts';
import { Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { dueCount } from '../review/store.ts';
import { tapSettled, tick } from '../motion/haptics.ts';
import { TabGlyph } from './TabGlyph.tsx';
import { TabPill } from './TabPill.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { CAPSULE_HEIGHT, MAIN_TABS, TAB_ICONS, TAB_LABELS, labelsWrapUnderGlyph, tabAccessibilityLabel, tabCapsuleWidth, tabCellUnderFinger, tabDot, tabPillLeft, tabLabelsShown } from './tabBarModel.ts';

/** Figma 292:1103: the capsule is 74 tall, a cell 62 inside 6pt of capsule padding. */
const CELL_HEIGHT = CAPSULE_HEIGHT - 2 * space(1.5);
/** The capsule's side padding, `space(2)`: where the first cell starts. */
const CAPSULE_SIDE = 8;

export function LuvaniTabBar({ state, navigation, insets }: BottomTabBarProps) {
  // The badge is a fact about the review deck, so it is re-read whenever the
  // learner moves between tabs; finishing a sitting must be able to clear it.
  const due = useDueCount(state.index);

  return (
    <TabStrip
      insets={insets}
      due={due}
      routes={state.routes.map((route, index) => {
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            tapSettled();
            navigation.navigate(route.name as never);
            // A tab tap replaces the whole screen; VoiceOver gives no signal of
            // that on its own, so the destination is announced.
            announceTab(route.name);
          }
        };
        return { key: route.key, name: route.name, focused, onPress };
      })}
    />
  );
}

/**
 * The bar outside the tab navigator, with no tab selected (2026-10-20 UI-008,
 * artboard B-Profile: "Tab bar present with no active tab"). Profile is a
 * pushed screen, so it draws the same capsule itself, and a tap goes to that
 * tab inside `Tabs`.
 */
export function DetachedTabBar({ onTab }: { onTab: (route: string) => void }) {
  const insets = useSafeAreaInsets();
  const due = useDueCount(0);
  return (
    <TabStrip
      insets={insets}
      due={due}
      routes={MAIN_TABS.map((name) => ({
        key: name,
        name,
        focused: false,
        onPress: () => {
          tapSettled();
          onTab(name);
          announceTab(name);
        },
      }))}
    />
  );
}

/** The review deck's due count, read again whenever `key` changes; null until read. */
function useDueCount(key: number): number | null {
  const [due, setDue] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void dueCount().then((n) => {
      if (!cancelled) setDue(n);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return due;
}

/** The strip and its capsule: the one drawing both bars share. */
function TabStrip({ routes, insets, due }: {
  routes: readonly { key: string; name: string; focused: boolean; onPress: () => void }[];
  insets: { bottom: number; left: number; right: number };
  due: number | null;
}) {
  // Watched so the bar re-renders when the OS text size changes while open.
  const { width } = useWindowDimensions();
  const fontScale = PixelRatio.getFontScale();
  const wrapped = labelsWrapUnderGlyph(fontScale);
  const capsule = tabCapsuleWidth(width, insets.left, insets.right);
  // F947: icons only when the widest word cannot fit whole in its cell.
  const shown = tabLabelsShown(fontScale, capsule);
  const t = useB();
  const st = useThemedStyles(makeStyles);
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);

  // Item 7 (founder, 2026-11-02): hold any tab and drag the pill sideways to another.
  const cell = Math.max(0, (capsule - 2 * CAPSULE_SIDE) / routes.length);
  const selected = routes.findIndex((r) => r.focused);
  const [dragX, setDragX] = useState<number | null>(null);
  const capsuleRef = useRef<View>(null);
  const capsuleX = useRef(0);
  const over = useRef(0);
  const routesRef = useRef(routes);
  routesRef.current = routes;
  const geo = useRef({ cell, selected });
  geo.current = { cell, selected };
  const drag = useRef(PanResponder.create({
    // Only sideways movement claims it, so a still long press keeps the Large Content Viewer (F947).
    onMoveShouldSetPanResponderCapture: (_, g) => geo.current.selected >= 0 && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: (_, g) => {
      tick();
      over.current = tabCellUnderFinger(g.moveX, capsuleX.current, CAPSULE_SIDE, geo.current.cell, routesRef.current.length);
    },
    onPanResponderMove: (_, g) => {
      const { cell } = geo.current;
      const n = routesRef.current.length;
      setDragX(tabPillLeft(g.moveX, capsuleX.current, CAPSULE_SIDE, cell, n));
      const now = tabCellUnderFinger(g.moveX, capsuleX.current, CAPSULE_SIDE, cell, n);
      if (now !== over.current) { over.current = now; tick(); }
    },
    onPanResponderRelease: () => {
      const { selected } = geo.current;
      const to = over.current;
      setDragX(null);
      if (to !== selected) routesRef.current[to]?.onPress(); else tapSettled();
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => setDragX(null),
  })).current;

  return (
    <View pointerEvents="box-none" onLayout={(e) => reportHeight?.(e.nativeEvent.layout.height)} style={[st.bar, { paddingBottom: Math.max(insets.bottom, space(2)) }]}>
      <View ref={capsuleRef} {...drag.panHandlers} onLayout={() => capsuleRef.current?.measureInWindow((x) => { capsuleX.current = x; })} style={[st.capsule, { width: capsule }]}>
      {selected >= 0 && <TabPill to={dragX ?? selected * cell} width={cell} left={CAPSULE_SIDE} following={dragX !== null} />}
      {routes.map((route) => {
        const focused = route.focused;
        const icon = TAB_ICONS[route.name];
        const label = TAB_LABELS[route.name] ?? route.name;
        const dot = tabDot(route.name, due);
        if (!icon) return null;

        return (
          <Press
            haptic="none"
            frame={[st.cell, wrapped && st.cellWrapped]}
            style={st.face}
            key={route.key}
            onPress={route.onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            aria-selected={focused}
            accessibilityLabel={tabAccessibilityLabel(route.name, dot)}
            // iOS: with the word hidden, a long press shows it large (F947).
            accessibilityShowsLargeContentViewer={!shown}
            accessibilityLargeContentTitle={shown ? undefined : label}
          >
            <TabGlyph focused={focused} badged={dot}>
              {() => <Icon name={icon} variant="linear" size={22} color={focused ? t.tabGlyphSelected : t.tabLabel} />}
            </TabGlyph>
            {shown && <Text selectable={false} style={[st.label, { fontFamily: focused ? font.bold : font.medium }]}>{label}</Text>}
          </Press>
        );
      })}
      </View>
    </View>
  );
}

/**
 * Announce a tab change for screen readers, which otherwise get no signal that
 * the whole screen replaced itself.
 */
export function announceTab(name: string): void {
  AccessibilityInfo.announceForAccessibility(`${TAB_LABELS[name] ?? name} tab`);
}

function makeStyles(t: B) {
  return StyleSheet.create({
    bar: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      alignItems: 'center',
      paddingTop: space(2),
    },
    capsule: {
      flexDirection: 'row',
      backgroundColor: t.tabCapsule,
      borderRadius: 32,
      paddingHorizontal: space(2),
      paddingVertical: space(1.5),
    },
    cell: {
      flex: 1,
      // A floor, not a height: a wrapped two-line word grows the cell, and the
      // capsule grows with the tallest one.
      minHeight: CELL_HEIGHT,
      minWidth: 0,
    },
    cellWrapped: {
      // One fifth of the capsule each, taken rather than shared, so a long word
      // wraps inside its own fifth. At 320pt a fifth is about 55pt, over 44.
      flexBasis: '20%',
      flexGrow: 0,
      flexShrink: 0,
    },
    /** What the spring shrinks; the violet under the selected one is TabPill. */
    face: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space(1),
      padding: space(1),
      borderRadius: 20,
    },
    label: { ...boldType.small, color: t.tabLabel, textAlign: 'center' },
  });
}
