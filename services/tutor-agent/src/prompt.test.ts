import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CAFE_LESSON, directiveFor, RUNGS } from '@parle/core';
import { buildSystemBlocks } from '@parle/brain';
import { baseInstructions, buildPrompt, turnInstructions } from './prompt.ts';

const lesson = CAFE_LESSON;
const turn = lesson.turns[0]!; // Bonjour

describe('base instructions encode the behavioural commitments', () => {
  const base = baseInstructions(lesson);

  test('forbids commenting on hesitation — the complaint that defined this product', () => {
    assert.match(base, /never remark on the learner hesitating/i);
    assert.match(base, /take your time/i, 'should name the specific phrases to avoid');
    assert.match(base, /are you still there/i);
  });

  test('forbids saying scores out loud', () => {
    assert.match(base, /never say a score/i);
  });

  test('forbids the word "wrong"', () => {
    assert.match(base, /never say "wrong"/i);
  });

  test('keeps the tutor in the scene', () => {
    assert.match(base, /stay inside the scene/i);
    assert.match(base, /do not break character/i);
  });

  test('rules out the babyish register that makes adults quit', () => {
    assert.match(base, /never use a sing-song or babyish register/i);
    assert.match(base, /intelligent adult/i);
  });

  test('carries the lesson scenario and role, not a generic persona', () => {
    assert.ok(base.includes(lesson.tutorRole));
    assert.ok(base.includes(lesson.scenario.slice(0, 40)));
  });

  test('bans em dashes and filler in anything the learner reads', () => {
    assert.match(base, /never use an em dash/i);
    assert.match(base, /short plain sentences/i);
  });
});

describe('per-turn instructions follow the ladder, not the model’s mood', () => {
  test('the echo rung hands over the whole line', () => {
    const p = turnInstructions(turn, directiveFor(RUNGS.ECHO));
    assert.ok(p.includes(turn.target));
    assert.match(p, /do not ask them to produce anything new/i);
  });

  test('the cued rung lists exactly the options, capped at three', () => {
    const p = turnInstructions(turn, directiveFor(RUNGS.CUED));
    assert.match(p, /offer exactly these replies/i);
    const listed = p.split('\n').filter((l) => l.trim().startsWith('- "'));
    assert.ok(listed.length <= 3 && listed.length >= 2, `expected 2–3 options, got ${listed.length}`);
  });

  test('the prompted rung explicitly withholds the French', () => {
    const p = turnInstructions(turn, directiveFor(RUNGS.PROMPTED));
    assert.match(p, /do not give them any French words/i);
    assert.ok(p.includes(turn.hint));
  });

  test('the free rung offers no scaffolding', () => {
    const p = turnInstructions(turn, directiveFor(RUNGS.FREE));
    assert.match(p, /offer no scaffolding/i);
    assert.doesNotMatch(p, /offer exactly these replies/i);
  });

  test('a rescue instructs the tutor to say the line for them and stay silent about it', () => {
    const p = turnInstructions(turn, directiveFor(RUNGS.CUED, true));
    assert.match(p, /step in now/i);
    assert.match(p, /do not mention that they went quiet/i);
  });

  test('acceptable alternatives are always passed through, so a valid answer is never refused', () => {
    const p = turnInstructions(turn, directiveFor(RUNGS.FREE));
    for (const a of turn.accepts) assert.ok(p.includes(a), `missing acceptable answer "${a}"`);
  });
});

describe('the assembled prompt', () => {
  test('combines the standing rules with the current turn', () => {
    const p = buildPrompt(lesson, turn, directiveFor(RUNGS.ECHO));
    assert.match(p, /never say a score/i);
    assert.ok(p.includes(turn.tutor));
  });

  test('every rung produces a usable prompt for every turn in the lesson', () => {
    for (const t of lesson.turns) {
      for (const rung of [RUNGS.ECHO, RUNGS.CUED, RUNGS.PROMPTED, RUNGS.FREE]) {
        const p = buildPrompt(lesson, t, directiveFor(rung));
        assert.ok(p.length > 400, `prompt too thin for ${t.id} at rung ${rung}`);
        assert.ok(p.includes(t.tutor), `prompt for ${t.id} lost the tutor's line`);
      }
    }
  });

  test('the hint never leaks into a rung that should not have it', () => {
    // At Echo the learner is repeating, not composing — an English instruction
    // telling them what to convey would contradict the line they were just given.
    const p = buildPrompt(lesson, turn, directiveFor(RUNGS.ECHO));
    assert.doesNotMatch(p, /Tell them in English/);
  });
});

describe('one tutor, two pipelines', () => {
  /**
   * The scripted lesson and the free conversation are separate prompts because
   * they are separate pipelines, and that is fine. Two different PEOPLE would
   * not be: a learner who does a lesson and then a conversation is talking to
   * the same tutor and would hear it if they were not.
   *
   * This couples the two prompts' answers rather than their implementations,
   * the same way devPlan and preflight are coupled over TUTOR_LLM.
   */
  const NAME = /\bLuc\b/;

  test('both prompts introduce the same person', () => {
    assert.match(baseInstructions(lesson), NAME, 'the scripted lesson tutor is anonymous again');
    assert.match(buildSystemBlocks().persona, NAME, 'the conversation tutor is anonymous again');
  });

  test('both say he is not a teacher, because that is the whole posture', () => {
    assert.match(baseInstructions(lesson), /not a teacher/i);
    assert.match(buildSystemBlocks().persona, /not a teacher/i);
  });

  test('both ask him to talk like a person rather than read off a page', () => {
    for (const [where, text] of [
      ['lesson', baseInstructions(lesson)],
      ['conversation', buildSystemBlocks().persona],
    ] as const) {
      assert.ok(text.includes('du coup') && text.includes('en fait'), `${where} never asks for the fillers`);
    }
  });

  test('neither lets him perform himself at the learner', () => {
    assert.match(baseInstructions(lesson), /never go on about yourself/i);
    assert.match(buildSystemBlocks().persona, /never go on about yourself/i);
  });
});
