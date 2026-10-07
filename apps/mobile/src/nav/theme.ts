/**
 * Navigation's own theme, and the linking map.
 *
 * NavigationContainer paints its background before any screen renders, and its
 * default light theme is white — so without this the pale lilac ground breaks
 * to white at every edge and, worse, flashes white through every transition.
 */

import type { LinkingOptions, Theme } from '@react-navigation/native';
import { DefaultTheme } from '@react-navigation/native';
import { paper, font } from '../theme.ts';
import type { RootStackParamList } from './types.ts';

export const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: paper.ground,
    card: paper.card,
    text: paper.ink,
    border: paper.line,
    primary: paper.ink,
    notification: paper.ink,
  },
  fonts: {
    ...DefaultTheme.fonts,
    regular: { fontFamily: font.regular, fontWeight: '400' },
    medium: { fontFamily: font.medium, fontWeight: '500' },
    bold: { fontFamily: font.bold, fontWeight: '700' },
    heavy: { fontFamily: font.bold, fontWeight: '700' },
  },
};

/**
 * Web only, and an explicit screen map rather than a catch-all.
 *
 * A wildcard prefix would swallow `luvani://auth/callback`, which
 * auth/oauth.native.ts relies on for the OAuth round trip — the deep link would
 * be handed to the navigator and the sign-in would silently never complete.
 * Native gets no linking config at all for exactly that reason.
 *
 * Explicit cuts both ways, and F493 is the half nobody had paid. Every root
 * screen the navigator can push needs a line here, because the address bar
 * shows whatever the map produces and the map is also what reads an address
 * back. A screen registered in `RootStackParamList` and left out of this list
 * writes an address on the way in that resolves to nothing on the way back, so
 * a reload or a shared link lands on Home. Settings was the one that had it,
 * and it is the screen holding delete account and the data export.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Tabs: {
        path: '',
        screens: {
          Home: 'home',
          Tutor: 'tutor',
          Practice: 'practice',
          MyFrench: 'my-french',
        },
      },
      Lesson: 'lesson',
      Convo: 'conversation',
      Drill: 'drill',
      Review: 'review',
      SoundCheck: 'sound-check',
      SoundJourney: 'sound-journey',
      GoalStep: 'goal-step',
      Missions: 'missions',
      FirstScene: 'first-scene/:missionId',
      Phrasebook: 'phrasebook',
      Conversations: 'conversations',
      SavedConversationText: 'saved-conversation-text',
      ConversationPractice: 'conversation-practice/:packId',
      Settings: 'settings',
      Profile: 'profile',
      Friends: 'friends',
      AddFriends: 'invite/:username?',
      SocialSettings: 'social-settings',
      DailyPractice: 'daily/:id',
      DailyLibrary: 'daily-library',
      Postcards: 'postcards',
      WeekWrapped: 'week-in-french',
      Streak: 'streak',
      RealMoment: 'real-moment',
      TutorMemory: 'tutor-memory',
      TutorIntro: 'tutor-guide',
      Wall: 'plans',
      Policy: 'privacy',
      Terms: 'terms',
    },
  },
};
