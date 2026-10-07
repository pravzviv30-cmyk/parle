import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { adjacentRecapPage, recapPages } from './pages.ts';

const empty = { lines: false, phrase: false, repair: false, sound: false, ability: false, next: false };

test('a partial recap skips unmeasured sound and unearned ability without an empty story step', () => {
  assert.deepEqual(recapPages(empty), ['result']);
  assert.deepEqual(recapPages({ ...empty, lines: true, phrase: true, next: true }), ['result', 'lines', 'next']);
  assert.deepEqual(recapPages({ ...empty, repair: true }), ['result', 'lines']);
});

test('late recap evidence cannot turn the current page into a different numeric step', () => {
  const before = recapPages({ ...empty, phrase: true, next: true });
  const after = recapPages({ ...empty, phrase: true, sound: true, ability: true, next: true });
  assert.equal(adjacentRecapPage(before, 'lines', 1), 'next');
  assert.equal(adjacentRecapPage(after, 'next', -1), 'ability');
  assert.equal(adjacentRecapPage(after, 'next', 1), null);
  assert.equal(adjacentRecapPage(after, 'result', -1), null);
});

test('recap page navigation leaves saving independent and retries the exact kept phrase only after durable save', () => {
  const source = readFileSync(new URL('../RecapScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState<RecapPage>\('result'\)/);
  assert.match(source, /ProgressDots total=\{pages\.length\}/);
  assert.match(source, /saveState === 'saved' && onPractice !== undefined/);
  assert.match(source, /onPractice\(\{ fr: keptPhrase\.fr, en: keptPhrase\.en, situation \}\)/);
  const save = source.slice(source.indexOf('useEffect(() => {\n    if (keptPhrase'), source.indexOf('const acceptReminder'));
  assert.doesNotMatch(save, /page ===|page,/);
  assert.match(source, /RoundButton kind="close" accessibilityLabel="Finish conversation"[^>]+onPress=\{onDone\}/);
});


test('a partial recap with no actionable content never adds an empty next page', () => {
  const source = readFileSync(new URL('../RecapScreen.tsx', import.meta.url), 'utf8');
  const projection = source.slice(source.indexOf('  const savableText ='), source.indexOf('  const pageIndex ='));
  function read(conversationText: unknown, currentOwner = true) {
    const bindings = { ownerScope: 1, scopeGeneration: () => currentOwner ? 1 : 2,
      adapter: { kind: 'supabase' }, user: { id: 'learner' }, conversationText, recapPages,
      lines: [], keptPhrase: null, closure: { repair: null }, sound: null, canDo: null,
      nextTime: null, offer: null, hasMore: false,
    };
    return new Function(...Object.keys(bindings), stripTypeScriptTypes(projection) + '\nreturn pages;')(...Object.values(bindings));
  }
  assert.deepEqual(read(undefined), ['result']);
  assert.deepEqual(read({ ownerId: 'learner', conversation: null }), ['result']);
  assert.deepEqual(read({ ownerId: 'learner', conversation: { lines: [] } }), ['result']);
  assert.deepEqual(read({ ownerId: 'other', conversation: { lines: [{}] } }), ['result']);
  assert.deepEqual(read({ ownerId: 'learner', conversation: { lines: [{}] } }, false), ['result']);
  assert.deepEqual(read({ ownerId: 'learner', conversation: { lines: [{}] } }), ['result', 'next']);
});
