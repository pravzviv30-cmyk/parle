/**
 * The web address map (split out of `theme.ts` on 2026-10-29 so it loads in
 * node without react-native; `theme.ts` re-exports it).
 */

import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types.ts';
import { parseSeedTopic, stringifySeedTopic } from '../tutor/convoStart.ts';
import { isLockedFeature } from '../purchases/featureLocks.ts';

/** F910: the lock's feature travels as text, and only a known feature comes back in. */
const parseLockedFeature = (value: string) => (isLockedFeature(value) ? value : undefined);

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
          // F907: any address the map does not know lands on Home, rather than
          // on no state at all (which left the navigator's initial route and an
          // armed launch wall to decide). Home still writes '/home'.
          Home: { path: 'home', alias: ['*'] },
          Explore: 'explore',
          Tutor: 'tutor',
          Practice: 'practice',
          MyFrench: 'my-french',
        },
      },
      ExploreCollection: 'explore/:id',
      ScenePreview: 'scene-preview/:missionId',
      Fixes: 'fixes/:packId',
      ThenNow: 'then-and-now',
      Lesson: 'lesson',
      // F923: the topic is an object, so it travels as JSON and is validated on the way back in.
      Convo: { path: 'conversation', parse: { seedTopic: parseSeedTopic }, stringify: { seedTopic: stringifySeedTopic } },
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
      LearningPreferences: 'learning-preferences',
      Subscription: 'subscription',
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
      Wall: { path: 'plans', parse: { feature: parseLockedFeature } },
      Policy: 'privacy',
      Terms: 'terms',
    },
  },
};
