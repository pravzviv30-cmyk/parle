/**
 * Which routes may draw dark (DECISIONS.md UI-008, 2026-10-20).
 *
 * Dark mode is on, but a screen only follows it once it has been rebuilt to
 * its canvas artboard in both themes. Until then it is pinned light: the
 * navigator wraps it in `<PinLight>`, so every shared part inside it reads
 * `b.light` and the screen looks exactly as it did before dark mode existed.
 * A rebuild step adds its route here, and nothing else changes.
 *
 * Some routes are light by rule, not by schedule: the first scene belongs to
 * onboarding, which stays light (the founder's decision). It is in `ALWAYS_LIGHT`, which wins
 * over `DARK_READY`. Onboarding, sign up and the launch screen are not routes;
 * App.tsx mounts them under `<PinLight>` directly.
 *
 * This file imports nothing so the rule is testable without React Native.
 */

export type ThemeMode = 'light' | 'dark';

/** Routes rebuilt for dark. Starts empty; each rebuild step adds its route. */
export const DARK_READY: ReadonlySet<string> = new Set<string>([
  // 2026-10-20 UI-008, artboard B-Today: Today in light and dark.
  'Home',
  // 2026-10-20 UI-008, artboard B-Explore: Explore in light and dark.
  'Explore',
  // 2026-10-20 UI-008, artboard B-ScenePreview: Scene preview in light and dark.
  'ScenePreview',
  // 2026-10-20 UI-008, artboard B-Speak: Speak in light and dark.
  'Tutor',
  // 2026-10-20 UI-008, artboards B-Journey, B-ThenNow and the Journey block of
  // B-Empty-States: Journey and Then and now in light and dark.
  'MyFrench',
  'ThenNow',
  // 2026-10-21 UI-008, artboards B-Practice, B-Empty-Practice and B-Fixes: Practice and Your fixes in light and dark.
  'Practice',
  'Fixes',
  // 2026-10-21 UI-008, artboards B-Review, B-ReviewReveal, B-Drill and the
  // Review block of B-Empty-States: Review and the Drill in light and dark.
  'Review',
  'Drill',
  // 2026-10-21 UI-008, artboards B-Streak, B-Profile and B-Settings: Streak,
  // Profile and Settings (with its Appearance row) in light and dark.
  'Streak',
  'Profile',
  'Settings',
  // 2026-10-21 UI-008: the paywall keeps its C2 design and gains a dark variant
  // (the founder's decision). The launch wall opens this same route.
  'Wall',
  // 2026-10-21 UI-008, step 12b: the screens with no artboard, converted to the
  // theme's tokens with layout and copy unchanged. The live room keeps its blue
  // ground in both themes; its waiting, error, recap and lesson screens follow.
  'Convo',
  'Lesson',
  'LearningPreferences',
  'Subscription',
  'TutorMemory',
  'Friends',
  'AddFriends',
  'SocialSettings',
  'Phrasebook',
  'Conversations',
  'SavedConversationText',
  'ConversationPractice',
  'WeekWrapped',
  'Postcards',
  'RealMoment',
  'Missions',
  'SoundCheck',
  'SoundJourney',
  'ExploreCollection',
  'DailyPractice',
  'DailyLibrary',
  'GoalStep',
  'TutorIntro',
  'Policy',
  'Terms',
]);

/** Routes that stay light whatever DARK_READY says. */
export const ALWAYS_LIGHT: ReadonlySet<string> = new Set<string>(['FirstScene']);

/** Whether a route is pinned light, given the ready set (injectable for tests). */
export function pinnedLight(route: string, ready: ReadonlySet<string> = DARK_READY): boolean {
  return ALWAYS_LIGHT.has(route) || !ready.has(route);
}

/** The mode a route draws in when the provider resolves `mode`. */
export function routeMode(route: string | undefined, mode: ThemeMode, ready: ReadonlySet<string> = DARK_READY): ThemeMode {
  if (route === undefined) return 'light';
  return pinnedLight(route, ready) ? 'light' : mode;
}
