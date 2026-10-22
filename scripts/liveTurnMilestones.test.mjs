import assert from 'node:assert/strict';
import { test } from 'node:test';

import { atOffset, deltasBefore, milestones, summarise } from './liveTurnMilestones.mjs';

const turn = {
  assessment: { quality: 'ok', note: 'a "quoted" note with a brace } and a bracket ]' },
  coach: [
    { kind: 'gender', quote: 'une café', better: 'un café', betterWritten: null, betterEn: 'a coffee', why: 'Café is masculine, so "un" fits: un\\café.', weight: 'matters-now' },
    { kind: 'polite', quote: 'je veux', better: 'je voudrais', betterWritten: null, betterEn: 'I would like', why: 'Softer at a counter.', weight: 'minor' },
  ],
  coachLine: null,
  narration: null,
  sceneReply: { speaker: 'Karim', fr: 'Très bien ! Sur place ou à emporter ?', frWritten: null, en: 'Very well! Here or to go?' },
  support: { hint: 'Say it.' },
  newPhrases: [],
  scene: { beat: 'say-where', beatDone: false, goalMet: null, sceneDone: false },
};
const text = JSON.stringify(turn);
const after = (needle) => text.indexOf(needle) + needle.length;

test('finds every milestone in a realistic turn', () => {
  const m = milestones(text);
  assert.equal(m.coachEnd, after(`"weight":"minor"}]`));
  assert.equal(m.coachLineEnd, after('"coachLine":null'));
  assert.equal(m.narrationEnd, after('"narration":null'));
  assert.equal(m.sceneReplyStart, text.indexOf('{"speaker"'));
  assert.equal(m.frFirstSentenceEnd, after('Très bien !'));
  assert.equal(m.frEnd, after('à emporter ?"'));
  assert.equal(m.sceneReplyEnd, after('"en":"Very well! Here or to go?"}'));
  assert.equal(m.end, text.length);
  assert.ok(m.coachEnd < m.sceneReplyStart && m.sceneReplyStart < m.frFirstSentenceEnd);
  assert.ok(m.frFirstSentenceEnd < m.frEnd && m.frEnd < m.sceneReplyEnd);
});

test('escaped quotes, backslashes and braces inside strings do not move depth', () => {
  const m = milestones(text);
  assert.equal(text.slice(m.coachEnd - 2, m.coachEnd), '}]');
  assert.ok(text.slice(0, m.sceneReplyEnd).endsWith('Here or to go?"}'));
});

test('a null coachLine ends after the null; an absent key stays null', () => {
  const withNull = milestones('{"coach":[],"coachLine": null ,"sceneReply":{"fr":"Oui.","en":"Yes."}}');
  assert.equal(withNull.coachLineEnd, '{"coach":[],"coachLine": null'.length);
  const missing = milestones('{"coach":[],"narration":null,"sceneReply":{"fr":"Oui.","en":"Yes."}}');
  assert.equal(missing.coachLineEnd, null);
  assert.equal(missing.narrationEnd, '{"coach":[],"narration":null'.length);
});

test('first sentence: mid-sentence exclamation, abbreviation-free two sentences, end of string', () => {
  const two = '{"sceneReply":{"fr":"Bien sûr. Voici votre café.","en":"x"}}';
  assert.equal(milestones(two).frFirstSentenceEnd, two.indexOf('Bien sûr.') + 'Bien sûr.'.length);
  // "!" mid-sentence with no following space is not a sentence end; the final "?" is.
  const bang = '{"sceneReply":{"fr":"Oh!la la, vous voulez quoi ?","en":"x"}}';
  assert.equal(milestones(bang).frFirstSentenceEnd, bang.indexOf('quoi ?') + 'quoi ?'.length);
  const alone = '{"sceneReply":{"fr":"Merci…","en":"x"}}';
  assert.equal(milestones(alone).frFirstSentenceEnd, alone.indexOf('…') + 1);
  const none = '{"sceneReply":{"fr":"Un café","en":"x"}}';
  assert.equal(milestones(none).frFirstSentenceEnd, null);
});

test('escapes inside fr map back to raw offsets', () => {
  const raw = '{"sceneReply":{"fr":"Il dit \\"oui\\". Puis \\u00e7a.","en":"x"}}';
  const m = milestones(raw);
  assert.equal(m.frFirstSentenceEnd, raw.indexOf('\\". Puis') + 3);
  assert.equal(m.frEnd, raw.indexOf('.","en"') + 2);
});

test('null frWritten and null sceneReply are tolerated', () => {
  const m = milestones('{"sceneReply":{"speaker":"K","fr":"Salut","frWritten":null,"en":"Hi"}}');
  assert.equal(m.frEnd, '{"sceneReply":{"speaker":"K","fr":"Salut"'.length);
  const nullReply = milestones('{"coach":[],"sceneReply":null}');
  assert.equal(nullReply.sceneReplyStart, '{"coach":[],"sceneReply":'.length);
  assert.equal(nullReply.sceneReplyEnd, '{"coach":[],"sceneReply":null'.length);
  assert.equal(nullReply.frEnd, null);
});

test('a truncated turn reports only what closed', () => {
  const cut = text.slice(0, text.indexOf('"frWritten"'));
  const m = milestones(cut);
  assert.ok(m.coachEnd !== null && m.sceneReplyStart !== null && m.frEnd !== null);
  assert.equal(m.sceneReplyEnd, null);
  assert.equal(m.end, cut.length);
  assert.deepEqual(milestones(''), { coachEnd: null, coachLineEnd: null, narrationEnd: null, sceneReplyStart: null, frFirstSentenceEnd: null, frEnd: null, sceneReplyEnd: null, end: 0 });
});

test('atOffset and deltasBefore follow the arrivals', () => {
  const arrivals = [{ offset: 5, t: 100 }, { offset: 12, t: 130 }, { offset: 15, t: 131 }, { offset: 20, t: 200 }];
  assert.equal(atOffset(arrivals, 1), 100);
  assert.equal(atOffset(arrivals, 5), 100);
  assert.equal(atOffset(arrivals, 6), 130);
  assert.equal(atOffset(arrivals, 13), 131);
  assert.equal(atOffset(arrivals, 16), 200);
  assert.equal(atOffset(arrivals, 20), 200);
  assert.equal(atOffset(arrivals, 21), null);
  assert.equal(atOffset(arrivals, null), null);
  assert.equal(atOffset([], 3), null);
  // Deltas begin at 0, 5, 12, 15.
  assert.equal(deltasBefore(arrivals, 1), 1);
  assert.equal(deltasBefore(arrivals, 5), 1);
  assert.equal(deltasBefore(arrivals, 6), 2);
  assert.equal(deltasBefore(arrivals, 13), 3);
  assert.equal(deltasBefore(arrivals, 99), 4);
  assert.equal(deltasBefore(arrivals, null), null);
});

test('milestones and arrivals agree on a streamed turn', () => {
  const arrivals = []; let offset = 0, t = 50;
  for (let i = 0; i < text.length; i += 7) { offset = Math.min(text.length, i + 7); t += 10; arrivals.push({ offset, t }); }
  const m = milestones(text);
  const tReply = atOffset(arrivals, m.sceneReplyEnd);
  const tFr = atOffset(arrivals, m.frEnd);
  assert.ok(tReply >= tFr);
  assert.ok(deltasBefore(arrivals, m.frEnd) <= deltasBefore(arrivals, m.sceneReplyEnd));
});

test('summarise uses nearest-rank percentiles and ignores nulls', () => {
  assert.deepEqual(summarise([null, 5, 1, 3, undefined, 2, 4]), { n: 5, p50: 3, p95: 5, min: 1, max: 5 });
  const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.deepEqual(summarise(twenty), { n: 20, p50: 10, p95: 19, min: 1, max: 20 });
  assert.deepEqual(summarise([7]), { n: 1, p50: 7, p95: 7, min: 7, max: 7 });
  assert.deepEqual(summarise([null]), { n: 0, p50: null, p95: null, min: null, max: null });
});
