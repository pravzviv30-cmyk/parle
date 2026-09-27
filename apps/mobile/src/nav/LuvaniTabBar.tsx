/**
 * The notebook tab bar: five labelled SVG icons, 24pt marks and 60pt minimum
 * cells, flat on the paper with one top hairline. No inset dock, no outline,
 * no chartreuse, no wash and no animation: selected is an ink glyph and a
 * DM Sans Medium word, unselected is a faint glyph over a soft-ink word, and
 * there is no dot beneath a tab. The safe-area inset is paid inside the bar.
 * Large reading sizes wrap the labels and grow the bar; nothing truncates or
 * caps font scaling. Changes are announced to assistive technology, and the
 * practice badge comes from the real due deck.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, AccessibilityInfo, PixelRatio, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { font, paper, space, type, HAIRLINE, HIT } from '../theme.ts';
import { dueCount } from '../review/store.ts';
import { tapSettled } from '../motion/haptics.ts';
import { HomeIcon, TutorIcon, PracticeIcon, MyFrenchIcon, FriendsIcon, type TabIconProps } from './icons.tsx';
import { readSocial, onSocialChange } from '../friends/social.ts';
import { socialUpdateCount } from '../friends/socialModel.ts';
import { navigationWidth } from '../responsiveLayout.ts';

const ICONS: Record<string, (p: TabIconProps) => React.ReactElement> = {
  Home: HomeIcon,
  Tutor: TutorIcon,
  Practice: PracticeIcon,
  MyFrench: MyFrenchIcon,
  Friends: FriendsIcon,
};

/**
 * The word under each glyph, and what a screen reader announces for the tab.
 * The route names are unchanged; only the words the learner reads moved.
 */
const LABELS: Record<string, string> = {
  Home: 'Today',
  Tutor: 'Speak',
  Practice: 'Practice',
  MyFrench: 'My French',
  Friends: 'Friends',
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
  const [friendRequests, setFriendRequests] = useState(0);
  useEffect(() => {
    let live = true;
    const refresh = () => { void readSocial().then(s => { if (live) setFriendRequests(socialUpdateCount(s)); }).catch(() => { if (live) setFriendRequests(0); }); };
    refresh();
    const unsubscribe = onSocialChange(refresh);
    return () => { live = false; unsubscribe(); };
  }, [state.index]);
  // The window is watched so the bar re-renders when the learner changes the OS
  // text size while the app is open; PixelRatio is what the text is actually
  // drawn at, and on the web the window reports 1 whatever the browser does.
  const { width } = useWindowDimensions();
  const wrapped = labelsWrapUnderGlyph(PixelRatio.getFontScale());

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
    // The rule and the paper run the full width; the five cells keep the
    // responsive column so they do not drift apart on a wide window.
    <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, space(2)) }]}>
      <View style={[st.cells, { width: navigationWidth(width, insets.left, insets.right) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name];
        const label = LABELS[route.name] ?? route.name;
        const badged = (route.name === 'Practice' && due > 0) || (route.name === 'Friends' && friendRequests > 0);
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
            accessibilityLabel={badged ? `${label}, ${route.name === 'Friends' ? 'new social updates' : 'practice ready'}` : label}
            style={({ pressed }) => [st.cell, wrapped && st.cellWrapped, pressed && st.cellPressed]}
          >
            <View style={st.iconBox}>
              <Icon size={24} color={focused ? paper.ink : paper.inkFaint} />
              {badged ? <View style={st.badge} /> : null}
            </View>
            <Text
              style={[
                st.label,
                focused ? { color: paper.ink, fontFamily: font.sansMedium } : { color: paper.inkSoft },
              ]}
            >
              {label}
            </Text>
          </Pressable>
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
  AccessibilityInfo.announceForAccessibility(`${LABELS[name] ?? name} tab`);
}

const st = StyleSheet.create({
  bar: {
    backgroundColor: paper.ground,
    borderTopWidth: HAIRLINE,
    borderTopColor: paper.line,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  cells: { flexDirection: 'row' },
  cell: {
    flex: 1,
    // A floor, not a height: a wrapped two-line label at large text grows the
    // cell rather than clipping, and the row grows with the tallest cell.
    minHeight: HIT + space(4),
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space(2),
    paddingBottom: space(2),
    minWidth: 0,
    gap: space(1),
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
  iconBox: { width: HIT, height: 24, alignItems: 'center', justifyContent: 'center' },
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
