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
  assert.match(app, /if \(startupFailed \|\| restoreUnavailable\) return/);
  assert.match(app, /label="Try again" onPress=\{\(\) => setStartupRead/);
});
test('an account switch during startup cannot backfill or start sync for the next learner', async () => {
  assert.deepEqual(await open(false, true), [], 'a departed startup must not read the next account before checking its owner');
});

/** Run the actual startup hook with controlled native-storage completions. */
function startupLifecycle(waitFor: 'migration' | 'history' | 'journal', fails = false) {
  const marker = '    let cancelled = false;\n    let engine: SyncEngine | null = null;';
  const at = app.indexOf(marker);
  const begin = app.lastIndexOf('\n  use', at);
  const end = app.indexOf('  }, [user.id, startupRead]);', at);
  assert.ok(at > 0 && begin > 0 && end > at, 'execute the hook that owns account startup');
  const registration = app.slice(begin, end + '  }, [user.id, startupRead]);'.length);
  const calls: string[] = [], warnings: string[] = [];
  let phase = '', active: string | null = null, generation = 0, effect!: () => () => void;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const world = {
    useEffect: (run: typeof effect) => { phase = 'passive'; effect = run; },
    useLayoutEffect: (run: typeof effect) => { phase = 'layout'; effect = run; },
    user: { id: 'startup-owner' }, startupRead: 0,
    setReady: (value: boolean) => { if (value) calls.push('ready'); }, setStartupFailed: (value: boolean) => { if (value) calls.push('failed'); },
    setActiveUser: (value: string | null) => { active = value; generation++; }, scopeGeneration: () => generation,
    migrateLegacyStores: async () => { if (waitFor === 'migration') await pending; },
    loadHistory: async () => { calls.push('history'); if (waitFor === 'history') { await pending; if (fails) throw new Error('history unreadable'); } return []; },
    backfillFrom: async () => calls.push('backfill'), lessonXp: () => 0,
    recoverJournal: async () => { calls.push('journal'); if (waitFor === 'journal') { await pending; if (fails) throw new Error('journal unreadable'); } return 0; },
    startAccountSync: async () => { calls.push('sync'); return null; },
    loadProfile: async () => ({}), adoptBeforeReady: async () => ({ waited: false, kind: 'has-local' }),
    setFreshStart: () => calls.push('fresh'), resetSyncRegistry: () => {},
    console: { warn: (message: string) => warnings.push(message), info: () => {} },
  };
  new Function(...Object.keys(world), stripTypeScriptTypes(registration))(...Object.values(world));
  return { calls, warnings, phase: () => phase, mount: () => effect(), release,
    switchAccount: () => world.setActiveUser('next-account'),
    focusRead: (store: string) => { if (active !== 'startup-owner') throw new Error(`${store}: no signed-in user`); calls.push(`focus-${store}`); },
    settle: () => new Promise<void>(resolve => setImmediate(resolve)),
  };
}

test('a cancelled migration never starts account recovery or reads the next account', async () => {
  for (const switched of [false, true]) {
    const h = startupLifecycle('migration'); const cleanup = h.mount(); cleanup();
    if (switched) h.switchAccount();
    h.release(); await h.settle();
    assert.deepEqual(h.calls, []); assert.deepEqual(h.warnings, []);
  }
});

test('startup restores its account scope before descendant passive focus reads during effect replay', async () => {
  const h = startupLifecycle('migration');
  // Native focus subscriptions run in passive effects. A replay can retain
  // the visible Home state, so the account owner must be established first.
  let cleanup: (() => void) | undefined;
  if (h.phase() === 'layout') cleanup = h.mount();
  const failures: string[] = [];
  for (const store of ['activity', 'review']) {
    try { h.focusRead(store); } catch (error) { failures.push((error as Error).message); }
  }
  if (h.phase() === 'passive') cleanup = h.mount();
  cleanup?.(); h.release(); await h.settle();
  assert.deepEqual(failures, [], 'replayed focus reads must not run in the cleared account scope');
  assert.deepEqual(h.calls, ['focus-activity', 'focus-review']);
});

test('late optional recovery failures from a departed account are silent and cannot open another startup', async () => {
  for (const waitFor of ['history', 'journal'] as const) {
    const h = startupLifecycle(waitFor, true); const cleanup = h.mount(); await h.settle();
    const before = [...h.calls]; cleanup(); h.switchAccount(); h.release(); await h.settle();
    assert.deepEqual(h.calls, before); assert.deepEqual(h.warnings, []);
  }
});

test('current-account optional recovery failures remain visible and do not block startup', async () => {
  for (const waitFor of ['history', 'journal'] as const) {
    const h = startupLifecycle(waitFor, true); const cleanup = h.mount(); await h.settle();
    h.release(); await h.settle();
    assert.deepEqual(h.calls, ['history', 'journal', 'sync', 'fresh', 'ready']);
    assert.deepEqual(h.warnings, [waitFor === 'history' ? '[luvani] startup history recovery unavailable' : '[luvani] startup phrase recovery unavailable']);
    cleanup();
  }
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
