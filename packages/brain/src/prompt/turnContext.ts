/**
 * The one volatile block per turn — the app briefing the tutor.
 *
 * Everything the model must obey but the learner never wrote goes here: the
 * ladder directive, the beat, the strictness policy, the learner picture. On
 * models that support it this rides as a system-role message at the end of the
 * conversation, which is the non-spoofable channel: nothing a learner types
 * can forge it. The Groq adapter folds it into the user turn instead.
 */

import type { LadderDirective, LearnerGoal } from '@luvani/core';
import type { CefrBand, Strictness } from '../types.ts';

export type TurnInputKind = 'spoke' | 'silence' | 'help';

export interface TurnContextInput {
  directive: LadderDirective;
  beat: {
    id: string;
    goal: string;
    /** 1-based attempt count on this beat. */
    attempt: number;
    maxAttempts: number;
    /** True when the beat cap fired and the scene must move now. */
    forceAdvance: boolean;
  };
  strictness: Strictness;
  learner: {
    cefr: CefrBand;
    confidence: 'low' | 'medium' | 'high';
    /** Top recurring error tags, most frequent first. */
    watchFor: string[];
    /** What the learner asked to be called, or null when they have no name here. */
    name?: string | null;
    /** Their onboarding goal, or null. Colours only the tutor's own free choices. */
    goal?: LearnerGoal | null;
  };
  inputKind: TurnInputKind;
  /** What the UI has earned permission to reveal for this exchange. */
  assistance: 'hidden' | 'hint' | 'full-line';
  /** Sticky once the learner asks: a slowed-down tutor must stay slowed down. */
  pace?: 'normal' | 'slow';
  /** What language their PREVIOUS turn arrived in, when it was not French. */
  lastLanguage?: 'english' | 'mixed' | null;
  /** Where the learner has steered the conversation, when off the frame's own topic. */
  activeTopic?: string | null;
  /**
   * A mission whose beats are all done, still running because the learner said
   * they wanted to keep talking.
   */
  missionDone?: boolean;
  /**
   * The app has just said the authored English way back (VOICE-013) as this
   * turn's coach line. The tutor adds no English of its own.
   */
  wayBack?: boolean;
  /** The tutor's own questions so far this session, as said, last six. */
  askedAlready?: readonly string[];
  /** The learner's line matched the sad-news list (VOICE-015). */
  sadNews?: boolean;
}

const RUNG_NAMES: Record<number, string> = { 1: 'very supported', 2: 'supported', 3: 'mostly independent', 4: 'independent' };

/**
 * How long the tutor's own turn may be, by rung.
 *
 * "Match sentence length" on its own was not an instruction, it was a hope: a
 * model asked to match an abstraction picks its own idea of short, and for an
 * A0 learner that is still three sentences of French they cannot hold. The rung
 * already knows how much the learner can carry, so it is what decides.
 *
 * Length only. The rung never changes whether the tutor is warm, whether it
 * reacts before it advances, or whether it corrects. Progression lives in code;
 * this is the one dimension of language it is allowed to move.
 */
const RUNG_LENGTH: Record<number, string> = {
  1: 'Speak in one short sentence, one idea. Nothing compound, nothing subordinate.',
  2: 'Speak in one short sentence, one idea. A second only when the first cannot carry it alone.',
  3: 'Two short sentences at most.',
  4: 'Say it at whatever length the moment actually wants.',
};

const STRICTNESS_POLICY: Record<Strictness, string> = {
  flow: 'Inline coaching only for what blocks the scene, plus textbook phrasing. Everything else waits for the recap.',
  balanced: 'Inline coaching for what matters now, always including textbook phrasing. Small grammar slips wait for the recap.',
  strict: 'Coach everything you find, briefly, as it happens.',
};

const INPUT_NOTES: Record<TurnInputKind, string | null> = {
  spoke: null,
  silence:
    'Their turn arrived empty. Treat the marker as silence, not as speech. Never mention the pause. Rephrase or shorten your last line in character without speaking their answer.',
  help: 'They asked for help. This is healthy and never a failure. The card supplies the help; stay in character and do not announce the answer.',
};

/**
 * How the learner's onboarding goal colours the tutor's own free choices.
 * 'because' has no framing: learning for its own sake needs no steer.
 */
export const GOAL_FRAMING: Record<Exclude<LearnerGoal, 'because'>, string> = {
  moving: 'everyday life after a move. When an example or a small-talk turn is yours to choose, take it from that life: renting, the doctor, neighbours. Never steer a scene away from its own goal.',
  trip: 'a trip in France. When an example or a small-talk turn is yours to choose, take it from that life: stations, tickets, restaurants, directions. Never steer a scene away from its own goal.',
  food: 'food and eating out. When an example or a small-talk turn is yours to choose, take it from that life: ordering, markets, cafés. Never steer a scene away from its own goal.',
  family: 'talking with family and friends. When an example or a small-talk turn is yours to choose, take it from that life: a partner\'s family, friends, the news of the day. Never steer a scene away from its own goal.',
  work: 'French at work. When an example or a small-talk turn is yours to choose, take it from that life: colleagues, meetings, appointments. Never steer a scene away from its own goal.',
};

export function buildTurnContext(input: TurnContextInput): string {
  const { directive, beat, strictness, learner } = input;

  const lines: string[] = [
    '[CONTEXT FROM THE APP, NOT FROM THE LEARNER]',
    `INDEPENDENCE: ${RUNG_NAMES[directive.rung]}. ${RUNG_LENGTH[directive.rung]} Match their pace, but never pre-fill the learner's reply.`,
  ];

  if (input.missionDone === true) {
    // The learner has finished what they came in to do and has chosen to keep
    // talking. Two things follow, and the second is the one that matters: the
    // scene stays open, and the tutor does not congratulate. The app has
    // already said what they did, in their own language, on a card they can
    // read. A character who stops to praise them turns a conversation into an
    // assessment, which is the one thing this product refuses to be.
    lines.push(
      'SCENE GOAL: already reached. The learner chose to keep talking, so stay in character and follow wherever they take it. Do not announce the achievement, congratulate them, grade them, or wind the scene up on their behalf.',
    );
  }

  let beatLine = `SCENE AIM: ${beat.id} (${beat.goal}). This is a flexible anchor, not a required script.`;
  if (beat.forceAdvance) {
    beatLine +=
      '. This beat has taken long enough: your character resolves it naturally now and the scene moves on. Do not re-ask.';
  } else if (beat.attempt >= beat.maxAttempts) {
    beatLine += `. Last attempt on this beat: after this reply, carry the scene forward regardless.`;
  }
  lines.push(beatLine);

  if (input.assistance === 'hidden') {
    lines.push(
      'ASSISTANCE: hidden. The learner gets the first attempt. Keep support private and do not suggest, list, or model their next reply.',
    );
  } else if (input.assistance === 'hint') {
    lines.push(
      'ASSISTANCE: the app revealed only support.hintEn on a card. Do not speak support.fullLine or support.options. Rephrase your own line and leave the floor open.',
    );
  } else {
    lines.push(
      "ASSISTANCE: after repeated help, the app revealed support.fullLine on a card. sceneReply must still be your character's side of the exchange.",
    );
  }

  lines.push(`STRICTNESS: ${strictness}. ${STRICTNESS_POLICY[strictness]}`);

  let learnerLine = `LEARNER: CEFR estimate ${learner.cefr} (${learner.confidence} confidence).`;
  if (learner.watchFor.length > 0) {
    learnerLine += ` Watch for: ${learner.watchFor.join(', ')}.`;
  }
  lines.push(learnerLine);

  if (learner.name != null && learner.name.length > 0) {
    // Per-turn and per-learner, so it belongs here and never in the frozen
    // prefix. The ceiling matters as much as the name: a tutor that opens
    // every line with it stops sounding like a person by the third turn.
    lines.push(
      `LEARNER NAME: ${learner.name}. Use it the way a person would: the greeting, and a moment that deserves warmth. Not every line, and never twice in one reply.`,
    );
  }

  if (learner.goal != null && learner.goal !== 'because') {
    // Fixed text per goal, so the same state gives the same bytes every turn.
    lines.push(`LEARNER GOAL: ${GOAL_FRAMING[learner.goal]}`);
  }

  if (input.pace === 'slow') {
    // The most-cited complaint about the competition: the learner asks for
    // slower and three turns later the tutor has sped back up. Sticky, every
    // turn, until the session ends.
    lines.push('PACE: they asked you to slow down. Short sentences, simple words, one idea at a time. Do not speed back up.');
  }

  if (input.lastLanguage === 'english' || input.lastLanguage === 'mixed') {
    lines.push(
      'Their previous turn used English. Add an english-to-french finding and a short coachLine that gives the natural French for exactly what they meant, then continue in character. This is feedback after their attempt, never a prompt for the next one.',
    );
  }

  if (input.activeTopic != null && input.activeTopic.length > 0) {
    // The learner steered the scene somewhere of their own. A tutor that drags
    // them back to the script is the thing this product exists to not be.
    lines.push(
      `TOPIC: they steered the conversation to: ${input.activeTopic}. Follow them there in character. Weave the beat's goal back in only when it fits naturally; never fight them back onto the old subject.`,
    );
  }

  if (input.askedAlready !== undefined && input.askedAlready.length > 0) {
    // A long history is exactly where a model loses track of its own
    // questions. Code reads them back so the tutor never interviews someone
    // with the same question twice, in any wording.
    lines.push(
      `ALREADY ASKED THIS SESSION: ${input.askedAlready.map((q) => `"${q}"`).join(', ')}. Do not ask any of these again in any wording. Build on what they answered.`,
    );
  }

  if (input.sadNews === true) {
    // A pattern match, not a verdict: the model decides whether it is their
    // life or a story. Code has already made sure this turn cannot end the
    // session either way.
    lines.push(
      'SAD NEWS: their line may be sad news from their own life. If it is, follow WHEN THEY SHARE SAD NEWS. If it is a story, a film or the scene, carry on.',
    );
  }

  const note = INPUT_NOTES[input.inputKind];
  if (note) lines.push(note);

  if (input.wayBack === true) {
    // After the input note, because it narrows what that note asks for: the
    // rephrase is still the tutor's job, the English is already said.
    lines.push(
      'WAY BACK: the app has just told them, in English, that English is fine. Do not repeat that or add English of your own. Rephrase your own line in the simplest French, one short sentence.',
    );
  }

  return lines.join('\n');
}
