/**
 * The route map.
 *
 * Two levels: a root stack whose first screen is the tab navigator, and the
 * metered or focused screens as siblings ABOVE it. Sitting above the tabs is
 * what hides the bar during a lesson or a drill without any per-screen
 * plumbing, and it makes leaving a live session an explicit act rather than a
 * tab switch — which matters, because a room that survives a tab switch is a
 * room the meter is still counting.
 *
 * Route params stay to plain serialisable flags. The lesson renders its own
 * end card in place,
 * exactly as ConvoScreen already renders its recap in place, so nothing
 * non-serialisable is ever put into navigation state.
 */

import type { PracticeRouteOrigin } from '../practice/practiceRoute.ts';

export type TabParamList = {
  Home: undefined;
  Tutor: undefined;
  Practice: undefined;
  MyFrench: undefined;
};

export type RootStackParamList = {
  Friends: undefined;
  Profile: { sheet?: 'tutorVoice' } | undefined;
  AddFriends: { username?: string } | undefined;
  SocialSettings: undefined;
  DailyPractice: { id: string; mode?: 'shadowing' };
  DailyLibrary: undefined;
  Postcards: undefined;
  WeekWrapped: undefined;
  /**
   * The streak (come alive Phase 4, F770): the run, the week, the month, the
   * freezes and the milestones, opened from Home's flame and ring and from
   * Progress and Profile. No params: it reads the game layer itself.
   */
  Streak: undefined;
  Tabs: undefined;
  /**
   * The guided café lesson, and the summary it ends on. `textMode` opens it
   * with the voice pipeline dark, for a learner who cannot speak aloud right
   * now — the same door the conversation has always had.
   */
  Lesson: { textMode?: boolean } | undefined;
  /**
   * Free conversation. `textMode` opens it with the voice pipeline dark.
   * `seedTopic` is what the learner asked to talk about again, in both
   * languages, and rides the start body into the join token. Plain strings, so
   * navigation state stays serialisable; a malformed one is dropped by the
   * server and the session simply opens generic.
   *
   * `missionId` rides the same pipe as `seedTopic`, all the way to the agent,
   * and names an authored scene the tutor does not have to write first. A
   * plain string for the same reason: an id this build does not know degrades
   * to the ordinary conversation rather than failing.
   *
   * `continuationPackId` asks the server to load owner-scoped learning context.
   * It also names the conversation being carried on, so it can be retired only
   * after the room publishes its first real view. Keeping it in navigation
   * state rather than stamping it on the Tutor-tab tap means an offline or
   * refused start cannot erase a thread the learner never reached.
   *
   * `goalRef` and `goalTask` say this conversation was opened from one of the
   * learner's goals (Stage 4): the goal's opaque route key (`goals/rows.ts`
   * `goalRouteKey`) and the task id, two flat strings. Never the goal's words,
   * because on the web a route's params are the address bar; the route looks
   * the goal up again from the profile. It is recorded only once the room is
   * real, and it never rides to the agent; a goal is not a seed topic.
   */
  Convo: {
    walkMode?: boolean;
    textMode?: boolean;
    seedTopic?: { fr: string; en: string };
    missionId?: string;
    continuationPackId?: string;
    goalRef?: string;
    goalTask?: string;
  } | undefined;
  /**
   * The mission chooser. A stack screen rather than a tab or an onboarding
   * page, because the same surface is needed from three doors: the first run
   * (which opens straight onto it), Home's mission card, and the Tutor tab.
   * Inside onboarding it could not exist at all, since onboarding mounts
   * INSTEAD of the navigator and so has nothing to navigate to.
   */
  Missions: { focus?: string; textMode?: boolean } | undefined;
  /**
   * The first scene after a brand-new account, behind a microphone primer
   * (notebook Phase 5). `missionId` is the scene the plan put first, a plain
   * string; an id this build does not know opens the default first scene. The
   * primer hands over to `Convo` with the same id, so the live session is the
   * ordinary one.
   */
  FirstScene: { missionId: string };
  /**
   * One node of the practice path, or the whole deck when omitted. The node
   * is plain data — id, title and phrase keys — so navigation state stays
   * serialisable. `mix` asks for the unscoped sitting interleaved across
   * topics rather than played in due order, which is one topic at a time.
   */
  Drill:
    | {
        node?: { id: string; title: string; phraseKeys: readonly string[]; moment?: { quote: string; better: string; why: string } };
        mix?: boolean;
        /**
         * One phrase to say again in the learner's own French, and the
         * situation it belongs to. Three plain strings, so the sitting can be
         * asked for from Practice without anything non-serialisable going into
         * navigation state, and a build that does not know the phrase simply
         * opens the ordinary deck.
         */
        ownWords?: { fr: string; en: string; situation: string };
        /**
         * A practice-now sitting, as flat strings only (`practice/practiceRoute.ts`).
         * On the web these are the address bar, so nothing here is an object:
         * the screen rebuilds the selection from the learner's stores and reads
         * these back through `parsePracticeRoute`, which refuses what it cannot
         * read. Absent, the drill is the ordinary scheduled sitting, unchanged.
         */
        practice?: PracticeRouteOrigin;
        packId?: string;
        exposed?: '1';
      }
    | undefined;
  Review: undefined;
  /** A known-reference pronunciation check after a completed situation. */
  /**
   * Optional because the web route can be opened cold (`/sound-check`) with no
   * params at all. The route validates it and never invents a situation.
   */
  SoundCheck: { missionId?: string } | undefined;
  /**
   * The focused sound journey (Stage 4): one sound across the measured checks
   * that called it out. No params: it reads the sound-check store itself, so a
   * cold link and a tap from My French draw the same thing.
   */
  SoundJourney: undefined;
  /**
   * One goal, its next task and what came of it (Stage 4). `key` is the goal's
   * opaque route key (`goals/rows.ts` `goalRouteKey`), never the learner's own
   * words, because on the web a route's params are the address bar. The screen
   * looks the goal up from the profile by it, and says a goal is gone when no
   * goal the profile holds has that key.
   */
  GoalStep: { key: string };
  /**
   * The account, the subscription, the documents and the phone's permissions.
   *
   * A stack sibling above the tabs rather than a sixth tab or a sheet inside
   * Profile. Above the tabs is what takes the bar away while somebody is in
   * their account, which is what every other pushed screen here already does,
   * and it is what lets the delete sheet own the whole screen while it asks.
   * It carries no params: `onSignOut` and `onDeleteAccount` reach it through
   * the navigator's children function, the way Profile used to take them, so
   * nothing non-serialisable is put into navigation state.
   */
  Settings: undefined;
  /**
   * The standing choices about how a conversation goes, pushed from Profile's
   * Learning group (P2, 2026-10-19). No params: it reads and writes the live
   * profile through the store's own doors.
   */
  LearningPreferences: undefined;
  /**
   * The plan and the store's own rows, pushed from the plan row on Profile
   * and on Settings (P2, 2026-10-19). No params: it reads the plan on focus.
   */
  Subscription: undefined;
  /**
   * The subscription wall, as a stack sibling above the tabs.
   *
   * Above the tabs for the same reason Settings is: the bar goes with the push,
   * so the wall owns the whole screen while it makes its case. `entry` says
   * which door was used, which decides how long the wall is and is also the
   * property the `wall_shown` event carries, so the funnel is split by the same
   * doors the code has. It is a string union and stays serialisable.
   */
  Wall: { entry: 'path-complete' | 'refused' | 'settings' | 'recap' | 'launch' | 'locked'; resumeRouteKey?: string };
  /**
   * The two documents, as routes rather than sheets inside Settings.
   *
   * They were early returns inside SettingsScreen, reachable only from there,
   * which was fine until something else had to link to them. Apple asks a
   * purchase surface for working links to both (Guideline 3.1.2), and a sheet
   * that only one screen can open is not a link. They keep their `onBack`
   * callback shape; the route wrappers hand them a goBack.
   */
  Policy: undefined;
  Terms: undefined;
  /**
   * Bring a real moment (F548): a pushed screen above the tabs, like the
   * chooser, because it is reached from the Tutor tab and leads into the
   * conversation with a seed of its own. No params: everything it needs is
   * chosen or typed on the screen, and the seed rides to `Convo` from there.
   */
  RealMoment: { textMode?: boolean } | undefined;
  TutorIntro: undefined;
  /**
   * What the tutor remembers (F562): a pushed screen above the tabs, reached
   * from Profile's memory card, where each remembered fact can be forgotten
   * and a goal written. No params: it reads and writes the live profile.
   */
  TutorMemory: undefined;
  /**
   * Real progress: the week told back, what the learner can now do, the four
   * momentum cards and the day's word.
   *
   * A pushed screen rather than a tab, because none of it is something to do.
   * Home opens on the one conversation worth having tonight and keeps a single
   * row that says how far this has come; a learner who wants the evidence asks
   * for it, and gets a whole screen of it rather than a tab they scroll past.
   * No params: every block is read from the stores on focus.
   */
  /**
   * Every line that has become the learner's, and one to say right now.
   *
   * It was an early return inside My French, reachable from one screen only,
   * which is the same shape the two legal documents were in before F473. A
   * route means Settings, My French and a shared address can all reach it.
   */
  Phrasebook: undefined;
  /**
   * The conversations the learner has had, to return to.
   *
   * The pack library, the filters, the counts in words and the feed, all in one
   * place. Data and privacy in Settings points here too, because the screen
   * that lists saved conversations is also the screen that deletes them.
   */
  /**
   * `packId` opens straight onto that saved conversation, which is how My
   * French's recent conversations reach the one a row names. A pack that is no
   * longer here simply opens the list.
   */
  Conversations: { packId?: string } | undefined;
  SavedConversationText: undefined;
  ConversationPractice: { packId: string };
};
