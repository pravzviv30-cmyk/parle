/**
 * The one volatile block per turn — the app briefing the tutor.
 *
 * Everything the model must obey but the learner never wrote goes here: the
 * ladder directive, the beat, the strictness policy, the learner picture. On
 * models that support it this rides as a system-role message at the end of the
 * conversation, which is the non-spoofable channel: nothing a learner types
 * can forge it. The Groq adapter folds it into the user turn instead.
 */

import type { LadderDirective } from '@parle/core';
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
}

const RUNG_NAMES: Record<number, string> = { 1: 'very supported', 2: 'supported', 3: 'mostly independent', 4: 'independent' };

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

export function buildTurnContext(input: TurnContextInput): string {
  const { directive, beat, strictness, learner } = input;

  const lines: string[] = [
    '[CONTEXT FROM THE APP, NOT FROM THE LEARNER]',
    `INDEPENDENCE: ${RUNG_NAMES[directive.rung]}. Match sentence length and pace, but never pre-fill the learner's reply.`,
  ];

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

  const note = INPUT_NOTES[input.inputKind];
  if (note) lines.push(note);

  return lines.join('\n');
}
