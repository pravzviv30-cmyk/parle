/**
 * The bottom bar — icon only, five cells.
 *
 * It is the page's edge, not a card sitting on the page: `paper.ground` with a
 * single hairline rule along the top, no white, no shadow. The app's only
 * shadow belongs to the live microphone and nothing else may borrow it.
 *
 * Saying which tab is active without a filled-icon variant: ink colour, plus a
 * small solid dot beneath the glyph. That is ProgressDots' existing grammar
 * rather than a new signal, and it keeps every mark in the app at one stroke
 * weight. The Practice badge is a dot too, but it sits on the glyph's shoulder,
 * so the two never occupy the same place or read as the same thing.
 *
 * Icon-only navigation is unreadable to a screen reader without help, so every
 * cell carries an explicit label and selected state.
 */

import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, AccessibilityInfo } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { paper, space, HAIRLINE, HIT } from '../theme.ts';
import { dueCount } from '../review/store.ts';
import { HomeIcon, TutorIcon, PracticeIcon, LeaderboardIcon, ProfileIcon, type TabIconProps } from './icons.tsx';

const ICONS: Record<string, (p: TabIconProps) => React.ReactElement> = {
  Home: HomeIcon,
  Tutor: TutorIcon,
  Practice: PracticeIcon,
  Leaderboard: LeaderboardIcon,
  Profile: ProfileIcon,
};

/** What a screen reader announces. The visible UI has no words at all. */
const LABELS: Record<string, string> = {
  Home: 'Home',
  Tutor: 'Tutor',
  Practice: 'Practice',
  Leaderboard: 'Leaderboard',
  Profile: 'Profile',
};

export function ParleTabBar({ state, navigation, insets }: BottomTabBarProps) {
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
            <View style={[st.dot, focused && st.dotActive]} />
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
    minHeight: HIT + space(3),
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space(2.5),
    paddingBottom: space(1.5),
    gap: space(1.5),
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  dotActive: { backgroundColor: paper.ink },
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
