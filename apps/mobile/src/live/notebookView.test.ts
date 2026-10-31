// UI-014, direction D: the notebook sheet's lines as a plain function.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { notebookLines } from './notebookView.ts';
import { ROLE_TURN_ID } from './roleLine.ts';
import type { TurnLine } from './turns.ts';

const line = (id: string, who: TurnLine['who'], fr: string, en: string | null = null, extra: Partial<TurnLine> = {}): TurnLine =>
  ({ id, who, fr, frWritten: null, en, ...extra });

const fix = { quote: 'un café', better: 'Je voudrais un café', betterEn: 'I would like a coffee', why: '' };
const turns: TurnLine[] = [
  line('t0', 'learner', 'le café', null, { topic: true }),
  line(ROLE_TURN_ID, 'narration', 'Émilie plays Karim, the barista.', 'Émilie plays Karim, the barista.'),
  line('n1', 'narration', 'Un café à Paris.', 'A café in Paris.'),
  line('a1', 'tutor', 'Bonjour !', 'Hello!'),
  line('b1', 'learner', 'Un café', null, { recasts: [fix] }),
  line('a2', 'tutor', 'Sur place ?', 'For here?'),
  line('b2', 'learner', 'Oui'),
];

describe('the notebook', () => {
  test('marks the newest tutor and learner lines, and keeps English only on the newest tutor line', () => {
    const items = notebookLines(turns, null, 'all');
    assert.deepEqual(items.map((item) => [item.id, item.emphasis]), [
      [ROLE_TURN_ID, 'older'], ['n1', 'older'], ['a1', 'older'], ['b1', 'older'], ['a2', 'newest'], ['b2', 'newest'],
    ]);
    assert.equal(items.find((item) => item.id === 'a1')!.en, null);
    assert.equal(items.find((item) => item.id === 'a2')!.en, 'For here?');
    assert.deepEqual(items.find((item) => item.id === 'b1')!.recasts, [fix]);
  });
  test('keeps the role line and narration in English, and leaves the topic line out (F905)', () => {
    const items = notebookLines(turns, null, 'all');
    assert.equal(items[0]!.kind, 'narration');
    assert.equal(items[0]!.fr, 'Émilie plays Karim, the barista.');
    assert.equal(items[1]!.fr, 'A café in Paris.');
    assert.equal(items.some((item) => item.id === 't0'), false);
  });
  test('a partial is the newest learner line while it is heard', () => {
    const items = notebookLines(turns, '  Pour emporter ', 'all');
    const last = items[items.length - 1]!;
    assert.deepEqual(last, { id: 'partial', kind: 'learner', fr: 'Pour emporter', en: null, emphasis: 'newest', recasts: [], partial: true });
    assert.equal(items.find((item) => item.id === 'b2')!.emphasis, 'older');
    assert.equal(notebookLines(turns, '   ', 'all').some((item) => item.partial), false);
  });
  test('newest mode keeps only the newest tutor line and the learner partial or last line', () => {
    assert.deepEqual(notebookLines(turns, null, 'newest').map((item) => item.id), ['a2', 'b2']);
    assert.deepEqual(notebookLines(turns, 'Pour', 'newest').map((item) => item.id), ['a2', 'partial']);
    assert.deepEqual(notebookLines(turns.slice(0, 4), null, 'newest').map((item) => item.id), ['a1']);
    assert.deepEqual(notebookLines([], null, 'newest'), []);
  });
  // Re-pins the retired bubbles test: the tutor's last line and the
  // learner's newest words, the live partial first and a blank one ignored.
  // Unlike the old bubble, the notebook keeps the learner's last line in view
  // even when the tutor has spoken since, so the exchange reads as a pair.
  test('newest mode reads the tutor’s last line and the learner’s newest words', () => {
    const tail = [line('x1', 'tutor', 'Bonjour'), line('y1', 'learner', 'Salut'), line('x2', 'tutor', 'Et avec ceci ?')];
    assert.deepEqual(notebookLines(tail, null, 'newest').map((item) => item.fr), ['Salut', 'Et avec ceci ?']);
    assert.deepEqual(notebookLines(tail, 'Oui, c’est quoi le', 'newest').map((item) => [item.fr, item.partial === true]), [['Et avec ceci ?', false], ['Oui, c’est quoi le', true]]);
    assert.deepEqual(notebookLines([...tail, line('y2', 'learner', 'Un café')], '  ', 'newest').map((item) => item.fr), ['Et avec ceci ?', 'Un café']);
  });
});
