/**
 * The Atelier dock: five labelled SVG icons, 24pt marks and 60pt minimum
 * cells, with a chartreuse selected surface and a strong ink outline.
 * The safe-area inset sits outside the dock. Large reading sizes wrap the
 * labels and grow the bar; nothing truncates or caps font scaling.
 * Selection motion respects reduced motion, changes are announced to assistive
 * technology, and the practice badge comes from the real due deck.
 * Selection uses a surface and label weight; there is no dot beneath a tab.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, Pressable, StyleSheet, AccessibilityInfo, PixelRatio, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { accent, paper, radius, space, type, HAIRLINE, HIT } from '../theme.ts';
import { dueCount } from '../review/store.ts';
import { tapSettled } from '../motion/haptics.ts';
import { useReduceMotion } from '../motion.ts';
import { HomeIcon, TutorIcon, PracticeIcon, MyFrenchIcon, ProfileIcon, type TabIconProps } from './icons.tsx';
import { ACTIVE_TAB_OUTLINE, ACTIVE_TAB_SURFACE } from './tabSurface.ts';
import { navigationWidth } from '../responsiveLayout.ts';

const ICONS: Record<string, (p: TabIconProps) => React.ReactElement> = {
  Home: HomeIcon,
  Tutor: TutorIcon,
  Practice: PracticeIcon,
  MyFrench: MyFrenchIcon,
  Profile: ProfileIcon,
};

/** The word under each glyph, and what a screen reader announces for the tab. */
const LABELS: Record<string, string> = {
  Home: 'Home',
  Tutor: 'Tutor',
  Practice: 'Practice',
  MyFrench: 'My French',
  Profile: 'Profile',
};

/**
 * The reading size at which a word stops fitting beside its neighbours.
 *
 * Below it the cells share the bar by flex, which lets a long word borrow room
 * from a short one and keeps the five glyphs evenly spread. At and above it the
 * words are wide enough that borrowing pushes them into each other, so every
 * cell takes exactly a fifth and the long ones wrap.
 */
const WRAPS_UNDER_GLYPH = 1.6;

/** Whether the words have to wrap under their glyphs at this reading size. */
function labelsWrapUnderGlyph(fontScale: number): boolean {
  return fontScale >= WRAPS_UNDER_GLYPH;
}

export function LuvaniTabBar({ state, navigation, insets }: BottomTabBarProps) {
  // The badge is a fact about the review deck, so it is re-read whenever the
  // learner moves between tabs — finishing a sitting must be able to clear it.
  const [due, setDue] = useState(0);
  const reduced = useReduceMotion();
  // Initialising the selected route at one matters: the icon is already the
  // active violet on first paint, so its surface cannot arrive a frame late and
  // make the icon look as though it disappeared into a blank cell.
  const selection = useRef(state.routes.map((_, index) => new Animated.Value(index === state.index ? 1 : 0))).current;
  // The window is watched so the bar re-renders when the learner changes the OS
  // text size while the app is open; PixelRatio is what the text is actually
  // drawn at, and on the web the window reports 1 whatever the browser does.
  const { width } = useWindowDimensions();
  const wrapped = labelsWrapUnderGlyph(PixelRatio.getFontScale());
  useEffect(() => {
    if (reduced) {
      selection.forEach((value, index) => value.setValue(index === state.index ? 1 : 0));
      return;
    }
    const movement = Animated.parallel(
      selection.map((value, index) =>
        Animated.timing(value, {
          toValue: index === state.index ? 1 : 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );
    movement.start();
    return () => movement.stop();
  }, [reduced, selection, state.index]);

  useEffect(() => {
    let cancelled = false;
    void dueCount().then((n) => {
      if (!cancelled) setDue(n);
    });
    return () => {
      cancelled = true;
    };
  }, [state.index]);

  return (
    <View style={[st.bar, { width: navigationWidth(width, insets.left, insets.right), marginBottom: Math.max(insets.bottom, space(2)) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name];
        const label = LABELS[route.name] ?? route.name;
        const badged = route.name === 'Practice' && due > 0;
        const progress = selection[index]!;
        const lift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
        if (!Icon) return null;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            tapSettled();
            navigation.navigate(route.name as never);
            // A tab tap replaces the whole screen. VoiceOver gives no signal of
            // that on its own, so the destination is announced. The function was
            // written for exactly this and then never called.
            announceTab(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            // Counting out loud would be a number in the chrome; "ready" is the
            // fact the learner needs and matches the forward framing elsewhere.
            accessibilityLabel={badged ? `${label}, practice ready` : label}
            style={({ pressed }) => [st.cell, wrapped && st.cellWrapped, pressed && st.cellPressed]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                st.activeSurface,
                {
                  opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                  transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
                },
              ]}
            />
            <Animated.View style={[st.cellContent, { transform: [{ translateY: lift }] }]}>
              <View style={st.iconBox}>
                <Icon size={24} color={focused ? accent.primary : paper.inkSoft} />
                {badged ? <View style={st.badge} /> : null}
              </View>
              <Text
                style={[
                  st.label,
                  focused ? { color: accent.primary, fontFamily: type.button.fontFamily } : { color: paper.inkSoft },
                ]}
              >
                {label}
              </Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Announce a tab change for screen readers, which otherwise get no signal that
 * the whole screen replaced itself.
 */
export function announceTab(name: string): void {
  AccessibilityInfo.announceForAccessibility(`${LABELS[name] ?? name} tab`);
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: paper.card,
    borderWidth: HAIRLINE + 1,
    borderColor: paper.ink,
    borderRadius: radius.card,
    marginHorizontal: space(2),
    alignSelf: 'center',
    marginBottom: space(2),
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    position: 'relative',
    // A floor, not a height: a wrapped two-line label at large text grows the
    // cell rather than clipping, and the row grows with the tallest cell.
    minHeight: HIT + space(4),
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space(2),
    paddingBottom: space(2),
    minWidth: 0,
    gap: space(0.5),
  },
  cellWrapped: {
    // One fifth of the bar each, taken rather than shared: flexBasis fixes the
    // width, and neither growing nor shrinking can then borrow it back. A word
    // that no longer fits wraps inside its own fifth and the cell gets taller.
    flexBasis: '20%',
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: space(0.5),
  },
  cellPressed: { transform: [{ scale: 0.985 }] },
  cellContent: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: space(1), zIndex: 1 },
  iconBox: { width: HIT, height: 24, alignItems: 'center', justifyContent: 'center' },
  activeSurface: {
    position: 'absolute',
    top: space(1),
    right: space(1),
    bottom: space(1),
    left: space(1),
    borderRadius: radius.row,
    backgroundColor: ACTIVE_TAB_SURFACE,
    borderWidth: HAIRLINE,
    borderColor: ACTIVE_TAB_OUTLINE,
  },
  label: { ...type.tabLabel, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: paper.ink,
  },
});
