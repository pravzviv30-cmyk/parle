/** Authored nonpersonal speech shared by runtime caching and the warm-cache script. */
import { tokenize } from '@livekit/agents';
import { LESSONS, directiveFor, type Rung } from '@luvani/core';
import { APERO_FRAME, CAFE_FRAME } from '@luvani/brain';
import { scriptedSpeech } from './scriptedSpeech.ts';
import { CLOSE_LINE, HEADS_UP_LINE } from './sessionEnd.ts';

export const CONVO_LINES = {
  opener: { fr: "Alors, de quoi on parle aujourd'hui ?", en: 'So, what do you want to talk about today?' },
  /**
   * fr and en are the pair the screen shows. `spoken` is what the learner
   * actually hears, and it is the only one of the three that has to do two
   * jobs: the French stays, because by now they have answered and "Ah, très
   * bien" is lesson-zero vocabulary earning its place, but designing a scene
   * takes ten to twenty five seconds and across all of it this was the only
   * thing they heard. A line that says what is happening is the difference
   * between waiting and being abandoned.
   */
  bridge: {
    fr: 'Ah, très bien. Alors…',
    en: 'Ah, very good. So…',
    spoken: "Ah, très bien. Give me a moment, I'm setting the scene.",
  },
  suggest: {
    fr: 'Tout marche. Votre journée, vos projets, un café à Paris. Dites-le en anglais ou en français.',
    en: "Anything goes. Your day, your plans, ordering coffee in Paris. Say it in English or French and we're off.",
  },
  /**
   * What the scene says instead, when the output guard takes a tutor line out.
   *
   * The learner did nothing, so nothing is said to them about it: no apology,
   * no notice, no hint that anything was removed. It hands the floor straight
   * back, because the one thing a suppressed line must never do is leave
   * somebody sitting in front of a scene that has stopped answering.
   */
  carryOn: {
    fr: "On continue. Vas-y, je t'écoute.",
    en: "Let's keep going. Go ahead, I'm listening.",
  },
} as const;

const splitter = new tokenize.basic.SentenceTokenizer();
const lines = new Set<string>();
const add = (text: string) => { for (const sentence of splitter.tokenize(text)) lines.add(sentence.replace(/\s+/g, ' ').trim()); };
for (const lesson of LESSONS) for (const turn of lesson.turns) {
  add(turn.tutor); add(turn.target); for (const option of turn.options) add(option.text);
  // Every way the script itself says this turn, so a scripted reply is a
  // cache hit on every rung and on the rescue (see scriptedSpeech.ts).
  for (const rung of [1, 2, 3, 4] as Rung[]) for (const rescued of [false, true]) for (const newTurn of [false, true]) add(scriptedSpeech(turn, directiveFor(rung, rescued), { newTurn }));
}
add(CONVO_LINES.opener.en); add(CONVO_LINES.suggest.en); add(CONVO_LINES.bridge.spoken);
add(CONVO_LINES.carryOn.fr); add(CONVO_LINES.carryOn.en);
// The end-of-session heads-up and close (sessionEnd.ts), said in every timed session.
add(HEADS_UP_LINE); add(CLOSE_LINE);
for (const frame of [CAFE_FRAME, APERO_FRAME]) { add(frame.openingNarration.en); add(frame.openingLine.fr); add(frame.openingSupport.fullLine.fr); }
export const AUTHORED_SPEECH_LINES: readonly string[] = Object.freeze([...lines]);
