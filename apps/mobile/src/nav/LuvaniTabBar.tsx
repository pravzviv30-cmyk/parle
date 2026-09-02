/**
 * The bottom bar — a glyph and a word, five cells.
 *
 * It is the page's edge, not a card sitting on the page: `paper.ground` with a
 * single hairline rule along the top, no white, no shadow. The app's only
 * shadow belongs to the live microphone and nothing else may borrow it.
 *
 * Saying which tab is active without a filled-icon variant: the word and glyph
 * both go ink, and the word takes the heavier sans. That keeps every mark in
 * the app at one stroke weight and needs no second signal, so there is no dot.
 * The Practice badge is the one dot left, and it sits on the glyph's shoulder.
 *
 * A long label wraps and the bar grows to hold it rather than truncating, and
 * nothing here caps the reading size. The label is also the screen reader's
 * name for the cell, alongside its selected state.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, AccessibilityInfo } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { paper, space, type, HAIRLINE, HIT } from '../theme.ts';
import { dueCount } from '../review/store.ts';
import { HomeIcon, TutorIcon, PracticeIcon, MyFrenchIcon, ProfileIcon, type TabIconProps } from './icons.tsx';

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

export function LuvaniTabBar({ state, navigation, insets }: BottomTabBarProps) {
  // The badge is a fact about the review deck, so it is re-read whenever the
  // learner moves between tabs — finishing a sitting must be able to clear it.
  const [due, setDue] = useState(0);
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
    <View style={[st.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name];
        const label = LABELS[route.name] ?? route.name;
        const badged = route.name === 'Practice' && due > 0;
        if (!Icon) return null;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
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
            style={({ pressed }) => [st.cell, pressed && { opacity: 0.55 }]}
          >
            <View>
              <Icon size={26} color={focused ? paper.ink : paper.inkFaint} />
              {badged ? <View style={st.badge} /> : null}
            </View>
            <Text
              style={[
                st.label,
                focused ? { color: paper.ink, fontFamily: type.button.fontFamily } : { color: paper.inkSoft },
              ]}
            >
              {label}
            </Text>
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
    backgroundColor: paper.ground,
    borderTopWidth: HAIRLINE,
    borderTopColor: paper.line,
  },
  cell: {
    flex: 1,
    // A floor, not a height: a wrapped two-line label at large text grows the
    // cell rather than clipping, and the row grows with the tallest cell.
    minHeight: HIT + space(6),
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space(2.5),
    paddingBottom: space(1.5),
    gap: space(0.5),
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
