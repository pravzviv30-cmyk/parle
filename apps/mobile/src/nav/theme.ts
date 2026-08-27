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
    regular: { fontFamily: font.sans, fontWeight: '400' },
    medium: { fontFamily: font.sansMedium, fontWeight: '500' },
    bold: { fontFamily: font.sansBold, fontWeight: '700' },
    heavy: { fontFamily: font.sansBold, fontWeight: '700' },
  },
};

/**
 * Web only, and an explicit screen map rather than a catch-all.
 *
 * A wildcard prefix would swallow `parle://auth/callback`, which
 * auth/oauth.native.ts relies on for the OAuth round trip — the deep link would
 * be handed to the navigator and the sign-in would silently never complete.
 * Native gets no linking config at all for exactly that reason.
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
          Profile: 'profile',
        },
      },
      Lesson: 'lesson',
      Convo: 'conversation',
      Drill: 'drill',
      Review: 'review',
      SoundCheck: 'sound-check',
      Missions: 'missions',
    },
  },
};
