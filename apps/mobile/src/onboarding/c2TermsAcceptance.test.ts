import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { freshPreAccountDraft } from './preAccountDraft.ts';
import { previousStep } from './flow.ts';

const source = readFileSync(new URL('./PreAccountOnboarding.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const start = async');
const end = source.indexOf('  const saveAccount =', start);
const handlerSource = stripTypeScriptTypes(source.slice(start, end));
const backStart = source.indexOf('  const back =');
const backEnd = source.indexOf('  useEffect(', backStart);
const backSource = stripTypeScriptTypes(source.slice(backStart, backEnd));
const showStart = source.indexOf('  const showPage =');
const showEnd = source.indexOf('  const go =', showStart);
const showSource = stripTypeScriptTypes(source.slice(showStart, showEnd));

function practice({ refused = false, previewOnly = false, locked = false } = {}) {
  const order: string[] = [];
  const operation = { current: false };
  const generation = { current: 0 };
  const refusedRef = { current: refused };
  let dismissals = 0;
  let complete!: () => void;
  const response = new Promise<void>(resolve => { complete = resolve; });
  const bindings = { operation, refused, previewOnly, pageMotion: { locked: { current: locked }, transition: (commit: () => void) => { commit(); return true; } }, generation, refusedRef,
    guest: null, current: { current: true }, setBusy: () => {}, setIssue: () => {}, setNeedsAccount: () => {}, continueWithAccount: async () => {},
    busy: false, surface: 'start', stopSound: () => {}, GUEST_PAGES: [], page: 'choose-tutor', questionOrder: [], go: () => {}, previousStep,
    setSurface: (value: string | null) => { if (value === null) dismissals++; },
    patch: (change: unknown) => { order.push('declaration'); return { ...freshPreAccountDraft(), reason: 'trip', ...change as object }; },
    startGuestPractice: async (plan: ReturnType<typeof freshPreAccountDraft>) => { assert.equal(plan.eligibilityConfirmed, true); assert.equal(plan.reason, 'trip'); order.push('admission'); await response; return { id: 'test-practice' }; },
    persist: async () => { order.push('durable save'); return true; }, metric: () => {},
    draftRef: { current: freshPreAccountDraft() }, setDraft: () => {}, onDraftChange: () => {}, signedIn: false,
    setPage: (page: string) => order.push(page) };
  const handlers = new Function(...Object.keys(bindings), showSource + handlerSource + backSource + '\nreturn { start, back };')(...Object.values(bindings)) as { start: () => Promise<void>; back: () => void };
  return { invoke: handlers.start, back: handlers.back, order, operation, complete, generation, refusedRef, get dismissals() { return dismissals; } };
}

test('Start followed by Android Back cannot dismiss consent or duplicate admission before busy rerenders', async () => {
  const page = practice();
  const pending = page.invoke();
  page.back();
  await page.invoke();
  assert.equal(page.dismissals, 0, 'Back closed consent while the admission ref was locked');
  assert.deepEqual(page.order, ['declaration', 'admission']);
  page.complete(); await pending;
  assert.equal(page.dismissals, 1, 'only successful admission should leave the consent page');
  assert.deepEqual(page.order, ['declaration', 'admission', 'durable save', 'practice']);
});

test('a deliberate Start records the declaration before admission and duplicate taps cannot create a second practice', async () => {
  const page = practice();
  const pending = page.invoke();
  await page.invoke();
  assert.deepEqual(page.order, ['declaration', 'admission']);
  assert.equal(page.operation.current, true);
  page.complete(); await pending;
  assert.deepEqual(page.order, ['declaration', 'admission', 'durable save', 'practice']);
  assert.equal(page.operation.current, false);
});

test('refusal, inert preview and a page transition prevent both declaration and admission', async () => {
  for (const condition of [{ refused: true }, { previewOnly: true }, { locked: true }]) {
    const page = practice(condition); await page.invoke(); assert.deepEqual(page.order, []);
  }
});

test('a refusal during admission cannot restore practice or enter its live screen', async () => {
  const page = practice(); const pending = page.invoke();
  page.refusedRef.current = true; page.generation.current++;
  page.complete(); await pending;
  assert.deepEqual(page.order, ['declaration', 'admission']);
});

test('opening Terms and Privacy cannot accept the declaration or start a service', () => {
  assert.equal((source.match(/patch\(\{ eligibilityConfirmed: true \}\)/g) ?? []).length, 1);
  const links = source.slice(source.indexOf('<TermsAcceptance context="practice"'), source.indexOf("<BoldButton label={needsAccount ? 'Create account to start' : 'Start live practice'}"));
  assert.match(links, /setSurface\('terms'\)/);
  assert.match(links, /setSurface\('policy'\)/);
  assert.doesNotMatch(links, /patch\(|start\(|startGuestPractice/);
});
