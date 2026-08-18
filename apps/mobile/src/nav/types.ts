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
 * No route carries a payload. The lesson renders its own end card in place,
 * exactly as ConvoScreen already renders its recap in place, so nothing
 * non-serialisable is ever put into navigation state.
 */

export type TabParamList = {
  Home: undefined;
  Tutor: undefined;
  Practice: undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  /** The guided café lesson, and the summary it ends on. */
  Lesson: undefined;
  /** Free conversation. `textMode` opens it with the voice pipeline dark. */
  Convo: { textMode?: boolean } | undefined;
  /**
   * One node of the practice path, or the whole deck when omitted. The node
   * is plain data — id, title and phrase keys — so navigation state stays
   * serialisable.
   */
  Drill: { node?: { id: string; title: string; phraseKeys: readonly string[] } } | undefined;
  Review: undefined;
};
