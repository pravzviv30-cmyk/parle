// 2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap: the end of a session's rules.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HEAR_IT_SAID, MAX_SMALL_FIXES, afterSessionStats, smallFixes, celebrateView, recapEyebrow, recapTitle, recapTiles, recapFocusRow, recapFooter } from './afterSessionView.ts';
import { KEEPSAKE_COPY } from '../live/keepsake.ts';
import { SOUND_FOCUS_LABEL } from '../tutor/soundExample.ts';

describe('the stat tiles', () => {
  test('draw minutes, new phrases and XP when each was measured, each with the number it counts up to', () => {
    assert.deepEqual(afterSessionStats({ activeSec: 7 * 60 + 20, phrases: 3, xp: 45 }).map((tile) => [tile.value, tile.label, tile.count, tile.ground]), [
      ['7', 'minutes', 7, 'sun'], ['3', 'new phrases', 3, 'card'], ['+45', 'XP', 45, 'mint'],
    ]);
  });
  test('leave a tile out rather than show a zero, and floor the minutes', () => {
    assert.deepEqual(afterSessionStats({ activeSec: null, phrases: 0, xp: null }), []);
    assert.equal(afterSessionStats({ activeSec: 30, phrases: 1, xp: null })[0]!.value, '<1');
    assert.equal(afterSessionStats({ activeSec: 30, phrases: 1, xp: null })[0]!.count, 0);
    assert.equal(afterSessionStats({ activeSec: 30, phrases: 1, xp: null })[1]!.label, 'new phrase');
    assert.equal(afterSessionStats({ activeSec: 119, phrases: 0, xp: 0 })[0]!.value, '1');
  });
});

describe('the recap band and the celebration', () => {
  test('the eyebrow uses a comma, never a middot', () => {
    assert.equal(recapEyebrow('Au café du coin', 7 * 60), 'Au café du coin, 7 min');
    assert.equal(recapEyebrow('Au café du coin', null), 'Au café du coin');
    assert.doesNotMatch(recapEyebrow('A', 600), /·/);
  });
  test('the speaker is labelled as the tutor’s voice, not the learner’s recording', () => {
    assert.equal(HEAR_IT_SAID, 'Hear it said');
  });
  test('the celebration names the ability, the postcard and the next can-do', () => {
    const view = celebrateView({ mission: { title: 'Au café du coin', canDoEn: 'Order food and drink, then pay' }, independent: true, stamp: 'first', next: { canDoEn: 'Check in and ask one question' } });
    assert.deepEqual(view, {
      eyebrow: 'You can now', ability: 'Order food and drink, then pay', line: 'Earned on your own in Au café du coin.',
      postcardEyebrow: 'New postcard', next: 'Next: Check in and ask one question',
    });
    const helped = celebrateView({ mission: { title: 'X', canDoEn: 'Y' }, independent: false, stamp: null, next: null });
    assert.equal(helped.line, null);
    assert.equal(helped.postcardEyebrow, 'Your postcard');
    assert.equal(helped.next, null);
  });
});

describe('small fixes', () => {
  const fix = (quote: string, better: string, weight: 'matters-now' | 'minor' = 'minor') => ({ quote, better, weight });
  test('are plural, matters-now first, never repeated or empty, and capped', () => {
    const list = smallFixes([fix('a', 'b'), fix('c', 'd', 'matters-now'), fix('a', 'b'), fix(' ', 'x'), fix('same', 'same'), fix('e', 'f'), fix('g', 'h')]);
    assert.deepEqual(list.map((item) => item.quote), ['c', 'a', 'e']);
    assert.equal(list.length, MAX_SMALL_FIXES);
    assert.deepEqual(smallFixes([]), []);
  });
});

// UI-020 (docs/changes/recap.md): the one-scroll recap's rules.
describe('the recap title', () => {
  test('with no reply the credit line is the title and there is no headline', () => {
    assert.deepEqual(recapTitle(false), { title: 'line', lineUnder: false });
  });
  test('after a reply the headline is the title, with the credit line under it', () => {
    assert.deepEqual(recapTitle(true), { title: 'headline', lineUnder: true });
  });
});

describe('the recap tiles', () => {
  test('map minutes, phrases and XP to their coins, never ticking', () => {
    const tiles = recapTiles(afterSessionStats({ activeSec: 250, phrases: 3, xp: 45 }));
    assert.deepEqual(tiles.map((tile) => [tile.id, tile.coin, tile.to, tile.format(tile.to), tile.word, tile.tick]), [
      ['minutes', 'time', 4, '4', 'minutes', 'none'], ['phrases', 'count', 3, '3', 'new phrases', 'none'], ['xp', 'xp', 45, '+45', 'XP', 'none'],
    ]);
  });
  test('under a minute prints <1, and nothing measured draws no tile', () => {
    const [minutes] = recapTiles(afterSessionStats({ activeSec: 30, phrases: 0, xp: null }));
    assert.equal(minutes!.format(0), '<1');
    assert.deepEqual(recapTiles([]), []);
  });
});

describe('the recap focus row', () => {
  const acoustic = { heading: '/y/ as in tu', cue: 'Round your lips.', pair: null } as never;
  test('a live sound says it was heard here, a saved check says so', () => {
    const live = recapFocusRow({ kind: 'sound', source: 'live', ipa: 'y', acoustic, example: 'tu' });
    assert.equal(live?.kind, 'sound');
    assert.equal(live?.label, SOUND_FOCUS_LABEL);
    assert.match(live!.line, /tu/);
    const check = recapFocusRow({ kind: 'sound', source: 'check', ipa: 'y', acoustic, missionId: 'mission:cafe', example: null });
    assert.equal(check?.label, KEEPSAKE_COPY.sound);
  });
  test('with no sound, one thing to tune names the clarity line or the French', () => {
    assert.deepEqual(recapFocusRow({ kind: 'clarity', line: 'Ask what they recommend.' }), { kind: 'other', label: 'One thing to tune', line: 'Ask what they recommend.' });
    assert.deepEqual(recapFocusRow({ kind: 'cadence', fr: 'Je voudrais', en: 'I would like', note: 'n' }), { kind: 'other', label: 'One thing to tune', line: 'Je voudrais' });
  });
  test('with neither there is no row', () => {
    assert.equal(recapFocusRow(null), null);
  });
});

describe('the recap footer', () => {
  test('a kept phrase with practice leads with practise, held until the save is durable, Done beside', () => {
    assert.deepEqual(recapFooter({ kept: true, practice: true, saved: false, earned: false, journey: true }), { primary: 'practise', practiseDisabled: true, journey: null });
    assert.deepEqual(recapFooter({ kept: true, practice: true, saved: true, earned: true, journey: true }), { primary: 'practise', practiseDisabled: false, journey: 'beside' });
  });
  test('otherwise Done leads, with the journey under it only on an earned scene', () => {
    assert.deepEqual(recapFooter({ kept: false, practice: true, saved: false, earned: true, journey: true }), { primary: 'done', practiseDisabled: false, journey: 'under' });
    assert.deepEqual(recapFooter({ kept: true, practice: false, saved: true, earned: false, journey: true }), { primary: 'done', practiseDisabled: false, journey: null });
    assert.deepEqual(recapFooter({ kept: false, practice: false, saved: false, earned: true, journey: false }), { primary: 'done', practiseDisabled: false, journey: null });
  });
});
