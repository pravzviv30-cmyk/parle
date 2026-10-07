/**
 * The recap's moment, decided apart from drawing it (come alive, core loop
 * 2.9; README Part 5.E "Recap"; decision D8: the fanfare the room held back
 * plays here).
 *
 * The recap is the conversation's end card. When the conversation won
 * something (a line said, a phrase kept) its result page plays the moment
 * (`celebrate/timelines.ts` `recap-result`: a sun glow, the `complete` sound
 * and a `celebrate()` haptic, the progress strip counting in), and when the
 * scene was finished on the learner's own this session, confetti too. Nothing
 * won, nothing played. A safety stop never reaches the recap at all.
 *
 * The recap draws inside the room it ended in, and the room holds the
 * learner's ears until the microphone has closed and the tutor is quiet (F763,
 * `live/recapAudio.ts`). So the moment waits for that, and no longer than
 * RECAP_AUDIO_WAIT_MS: a sound effect asked for while the room still holds the
 * audio would be refused, and the fanfare would be lost. Past the wait it plays
 * anyway, and a beat that still meets a held room is silent, never late.
 * The phrase, the headline and the recap line are on the page from the start;
 * only the glow, the confetti and the progress strip arrive with the moment,
 * and the strip is drawn at once, at rest, whenever there is no moment to play.
 */

/** The longest the recap's moment waits for the room to give back the audio. */
export const RECAP_AUDIO_WAIT_MS = 2000;

export interface RecapMoment {
  /** The result page plays its moment. */
  plays: boolean;
  /** With confetti: the scene was finished on the learner's own. */
  burst: boolean;
}

export function recapMoment(recap: { won: boolean; sceneFinished: boolean; independentFinish: boolean }): RecapMoment {
  const plays = recap.won || recap.sceneFinished;
  return { plays, burst: plays && recap.sceneFinished && recap.independentFinish };
}

/** The moment may start: the OS has said whether movement is reduced, and the room has let go of the audio or the wait is over. */
export function momentMayStart(now: { answered: boolean; audioFree: boolean; waitedOut: boolean }): boolean {
  return now.answered && (now.audioFree || now.waitedOut);
}
