import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const start = app.indexOf('      .then(async () => {', app.indexOf('void migrateLegacyStores(user.id)'));
const body = app.slice(start + '      .then(async () => {'.length, app.indexOf('\n      })\n      .catch', start));
async function open(unread: boolean, changed = false) {
  const calls: string[] = [];
  const bindings = { cancelled: false, owner: 1, scopeGeneration: () => changed ? 2 : 1, user: { id: 'owner' }, engine: null,
    loadHistory: async () => { calls.push('history'); if (unread) throw new Error('disk'); return []; },
    backfillFrom: async () => calls.push('backfill'), lessonXp: () => 0,
    recoverJournal: async () => { calls.push('journal'); if (unread) throw new Error('disk'); return 0; },
    startAccountSync: async () => { calls.push('sync'); return null; },
    loadProfile: async () => ({}), adoptBeforeReady: async () => ({ waited: false, kind: 'has-local' }),
    setFreshStart: () => calls.push('fresh'), setReady: () => calls.push('ready'),
    console: { warn: () => {}, info: () => {} },
  };
  const code = stripTypeScriptTypes('async function run() {' + body + '\n}') + '\nreturn run();';
  await new Function(...Object.keys(bindings), code)(...Object.values(bindings)); return calls;
}
test('unread optional launch history and phrase recovery cannot trap the app or fabricate a backfill', async () => {
  assert.deepEqual(await open(true), ['history', 'journal', 'sync', 'fresh', 'ready']);
  assert.deepEqual(await open(false), ['history', 'journal', 'sync', 'fresh', 'ready']);
  assert.match(app, /if \(startupFailed\) return/);
  assert.match(app, /label="Try again" onPress=\{\(\) => setStartupRead/);
});
test('an account switch during startup cannot backfill or start sync for the next learner', async () => {
  assert.deepEqual(await open(false, true), ['history']);
});
const nav = readFileSync(new URL('../nav/RootNavigator.tsx', import.meta.url), 'utf8');
const lesson = nav.slice(nav.indexOf('function LessonRoute()'), nav.indexOf('function ConvoRoute()'));
test('an unread prior lesson has retry and leave routes without guessing the opening support', async () => {
  const body = lesson.slice(lesson.indexOf('    let cancelled = false;'), lesson.indexOf('    return () => {'));
  const states: unknown[] = [];
  const bindings = { lastSummaryFor: async () => { throw new Error('unread'); }, CAFE_LESSON: { id: 'cafe' },
    ownsLesson: () => true, asRung: () => 1, setStartRung: (v: unknown) => states.push(v),
    setHistoryFailed: (v: unknown) => states.push(v),
  };
  new Function(...Object.keys(bindings), stripTypeScriptTypes(body))(...Object.values(bindings));
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(states, [false, true]);
  assert.match(lesson, /if \(historyFailed\) return/);
  assert.match(lesson, /label="Try again"/); assert.match(lesson, /label="Back to Home"/);
  assert.match(lesson, /historySaveFailed=\{historySaveFailed\}/);
});
