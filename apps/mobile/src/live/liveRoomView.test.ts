// 2026-10-21 UI-008, artboards B-Live and B-LiveHelp: the live room's rules as plain functions.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { goalStrip, helpLadder, ladderSpoken, liveBubbles, moreHelpOffered, paceLabel, askedLabel, typingNote, HELP_COPY } from './liveRoomView.ts';
import type { TurnLine } from './turns.ts';

describe('the pace pill', () => {
  test('says the scene pace, never a countdown or minutes left', () => {
    assert.equal(paceLabel(4), 'About 4 min');
    assert.equal(paceLabel(0.4), 'About 1 min');
    assert.equal(paceLabel(null), null);
    assert.equal(paceLabel(0), null);
    assert.equal(paceLabel(Number.NaN), null);
    assert.doesNotMatch(paceLabel(6)!, /left/);
  });
});

describe('the goals strip', () => {
  test('marks done, the first goal not reached as current, and the rest to do', () => {
    const chips = goalStrip([
      { id: 'a', goalEn: 'Order a drink', achieved: true },
      { id: 'b', goalEn: 'Ask one question', achieved: false },
      { id: 'c', goalEn: 'Pay', achieved: false },
    ]);
    assert.deepEqual(chips.map((chip) => chip.state), ['done', 'current', 'todo']);
    assert.equal(chips[1]!.spoken, 'Now: Ask one question');
  });
  test('a later goal reached out of order stays done, and nothing is current when all are done', () => {
    assert.deepEqual(goalStrip([
      { id: 'a', goalEn: 'A', achieved: false },
      { id: 'b', goalEn: 'B', achieved: true },
    ]).map((chip) => chip.state), ['current', 'done']);
    assert.deepEqual(goalStrip([{ id: 'a', goalEn: 'A', achieved: true }]).map((chip) => chip.state), ['done']);
    assert.deepEqual(goalStrip([]), []);
  });
});

describe('the help ladder', () => {
  test('reads Hint, Choices, Line given over the live rung', () => {
    assert.deepEqual(helpLadder('options').map((step) => [step.label, step.state]), [['Hint', 'given'], ['Choices', 'current'], ['Line given', 'ahead']]);
    assert.deepEqual(helpLadder('none').map((step) => step.state), ['ahead', 'ahead', 'ahead']);
    assert.deepEqual(helpLadder('hint').map((step) => step.state), ['current', 'ahead', 'ahead']);
    assert.deepEqual(helpLadder('full-line').map((step) => step.state), ['given', 'given', 'current']);
    assert.equal(ladderSpoken(helpLadder('options')), 'Help so far: Choices');
    assert.equal(ladderSpoken(helpLadder('none')), 'No help given yet');
  });
  test('offers more help until the line is given', () => {
    assert.equal(moreHelpOffered('none'), true);
    assert.equal(moreHelpOffered('options'), true);
    assert.equal(moreHelpOffered('full-line'), false);
  });
  test('the sheet copy is in words and never remarks on hesitation', () => {
    assert.equal(askedLabel('Camille'), 'Camille asked');
    for (const line of Object.values(HELP_COPY)) {
      assert.doesNotMatch(line, /take your time|sorry|—/i);
    }
  });
});

describe('the bubbles', () => {
  const turn = (id: string, who: TurnLine['who'], fr: string): TurnLine => ({ id, who, fr, frWritten: null, en: null });
  test('the tutor’s last line and the learner’s words since', () => {
    const turns = [turn('1', 'tutor', 'Bonjour'), turn('2', 'learner', 'Bonjour'), turn('3', 'tutor', 'Et avec ceci ?')];
    assert.deepEqual(liveBubbles(turns, null), { tutor: turns[2], you: null });
    assert.deepEqual(liveBubbles(turns, 'Oui, c’est quoi le'), { tutor: turns[2], you: 'Oui, c’est quoi le' });
    assert.deepEqual(liveBubbles([...turns, turn('4', 'learner', 'Un café')], '  '), { tutor: turns[2], you: 'Un café' });
    assert.deepEqual(liveBubbles([], null), { tutor: null, you: null });
  });
});

describe('the live mic is green', () => {
  // 2026-10-21 UI-008, founder decision: the live mic keeps the green signal
  // rule rather than the artboard's sun, with ink on it in both themes.
  test('the mic fills mint and draws its glyph in ink', () => {
    const parts = readFileSync(fileURLToPath(new URL('./LiveParts.tsx', import.meta.url)), 'utf8');
    assert.match(parts, /mic: \{[^}]*backgroundColor: t\.mint/, 'the live mic is not mint');
    assert.doesNotMatch(parts, /mic: \{[^}]*backgroundColor: t\.sun/, 'the live mic went back to sun');
    assert.match(parts, /<BMicHeavy color=\{t\.onMint\} \/>/, 'the mic glyph is not ink on mint');
  });
});

describe('the note under the controls while typing', () => {
  test('nothing while the learner is speaking', () => {
    assert.equal(typingNote(false, true, 'Celine'), null);
    assert.equal(typingNote(false, false, 'Celine'), null);
  });

  test('a typed session says it started typed', () => {
    assert.equal(typingNote(true, false, 'Celine'), 'This session started in typing mode.');
  });

  test('a voiced session with the mic off says the tutor still speaks, by name', () => {
    const note = typingNote(true, true, 'Celine');
    assert.equal(note, 'Your mic is off. Celine still speaks out loud.');
    assert.doesNotMatch(note ?? '', /\u2014|\u00b7/);
  });

  test('the room draws the note from this rule and nowhere else', () => {
    const room = readFileSync(fileURLToPath(new URL('./C2LiveRoom.tsx', import.meta.url)), 'utf8');
    assert.match(room, /typingNote\(typing, startedWithSpeech, tutorName\)/);
    assert.doesNotMatch(room, /started in typing mode/);
  });
});
