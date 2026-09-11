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

export type TabParamList = {
  Home: undefined;
  Tutor: undefined;
  Practice: undefined;
  MyFrench: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
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
   */
  Convo: { textMode?: boolean; seedTopic?: { fr: string; en: string }; missionId?: string } | undefined;
  /**
   * The mission chooser. A stack screen rather than a tab or an onboarding
   * page, because the same surface is needed from three doors: the first run
   * (which opens straight onto it), Home's mission card, and the Tutor tab.
   * Inside onboarding it could not exist at all, since onboarding mounts
   * INSTEAD of the navigator and so has nothing to navigate to.
   */
  Missions: { focus?: string } | undefined;
  /**
   * One node of the practice path, or the whole deck when omitted. The node
   * is plain data — id, title and phrase keys — so navigation state stays
   * serialisable. `mix` asks for the unscoped sitting interleaved across
   * topics rather than played in due order, which is one topic at a time.
   */
  Drill:
    | { node?: { id: string; title: string; phraseKeys: readonly string[] }; mix?: boolean }
    | undefined;
  Review: undefined;
  /** A known-reference pronunciation check after a completed situation. */
  SoundCheck: { missionId: string };
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
   * The subscription wall, as a stack sibling above the tabs.
   *
   * Above the tabs for the same reason Settings is: the bar goes with the push,
   * so the wall owns the whole screen while it makes its case. `entry` says
   * which door was used, which decides how long the wall is and is also the
   * property the `wall_shown` event carries, so the funnel is split by the same
   * doors the code has. It is a string union and stays serialisable.
   */
  Wall: { entry: 'path-complete' | 'refused' | 'settings' | 'recap' };
};
