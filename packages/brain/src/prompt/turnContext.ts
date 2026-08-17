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
  /** Sticky once the learner asks: a slowed-down tutor must stay slowed down. */
  pace?: 'normal' | 'slow';
  /** What language their PREVIOUS turn arrived in, when it was not French. */
  lastLanguage?: 'english' | 'mixed' | null;
}

const RUNG_NAMES: Record<number, string> = { 1: 'Echo', 2: 'Cued', 3: 'Prompted', 4: 'Free' };

const STRICTNESS_POLICY: Record<Strictness, string> = {
  flow: 'Inline coaching only for what blocks the scene, plus textbook phrasing. Everything else waits for the recap.',
  balanced: 'Inline coaching for what matters now, always including textbook phrasing. Small grammar slips wait for the recap.',
  strict: 'Coach everything you find, briefly, as it happens.',
};

const INPUT_NOTES: Record<TurnInputKind, string | null> = {
  spoke: null,
  silence:
    'Their turn arrived empty. Treat the bracketed marker as silence, not as words they said, and follow the ladder instruction above.',
  help: 'They asked for help. A healthy act, never counted against them. Follow the ladder instruction above.',
};

export function buildTurnContext(input: TurnContextInput): string {
  const { directive, beat, strictness, learner } = input;

  const lines: string[] = [
    '[CONTEXT FROM THE APP, NOT FROM THE LEARNER]',
    `LADDER: rung ${directive.rung} of 4 (${RUNG_NAMES[directive.rung]}). ${directive.tutorInstruction}`,
  ];

  let beatLine = `BEAT: ${beat.id} (${beat.goal})`;
  if (beat.forceAdvance) {
    beatLine +=
      '. This beat has taken long enough: your character resolves it naturally now and the scene moves on. Do not re-ask.';
  } else if (beat.attempt >= beat.maxAttempts) {
    beatLine += `. Last attempt on this beat: after this reply, carry the scene forward regardless.`;
  }
  lines.push(beatLine);

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
      'Their previous turn reached for English. Hand back the French for exactly what they tried to say: support.fullLine is that French. Your reply shows you understood and invites the same moment again, in character.',
    );
  }

  const note = INPUT_NOTES[input.inputKind];
  if (note) lines.push(note);

  return lines.join('\n');
}
