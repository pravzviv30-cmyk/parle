/**
 * The access seam (B0, 2026-10-20). Rewritten 2026-10-20, lock seam wiring:
 * the seam now answers main's D24 standing, opens when the plan is unknown,
 * shares main's one feature list, and imports only `purchases/featureLocks`.
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { featureAccess, tapThrough, LOCKED_FEATURES, type LockedFeature } from './featureAccess.ts';
import { LOCKED_FEATURES as MAIN_FEATURES, clearStanding, setStanding } from '../purchases/featureLocks.ts';
import { TAB_ROOTS } from '../wall/launchWall.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';

const FREE: BillingStatus = { plan: 'trial', secondsRemaining: 300, periodEnd: null, lapsed: false, canStart: true, reason: null };
const CORE: BillingStatus = { plan: 'starter', secondsRemaining: 10800, periodEnd: '2026-11-05T00:00:00.000Z', lapsed: false, canStart: true, reason: null };

afterEach(() => clearStanding());

describe('featureAccess, the one lock seam', () => {
  test('it lists exactly the D24 locked features, and it is main\'s list', () => {
    assert.deepEqual([...LOCKED_FEATURES].sort(), [
      'continueArc', 'conversationPractice', 'fixes', 'fullJourney', 'realMoment', 'sounds', 'thenAndNow', 'tutorMemory',
    ]);
    assert.equal(LOCKED_FEATURES, MAIN_FEATURES, 'two feature lists that can drift');
  });

  // 2026-10-20, lock seam wiring: was "every feature is unlocked for everyone until D5".
  test('an unknown plan fails open: nothing is locked', () => {
    for (const feature of LOCKED_FEATURES) assert.equal(featureAccess(feature), 'unlocked', `${feature} locked before the plan was read`);
    setStanding('u1', null);
    for (const feature of LOCKED_FEATURES) assert.equal(featureAccess(feature), 'unlocked', `${feature} locked on an unreadable plan`);
  });

  test('a free learner sees every feature locked; Core opens all but the two Max doors', () => {
    setStanding('u1', FREE);
    for (const feature of LOCKED_FEATURES) assert.equal(featureAccess(feature), 'locked', `${feature} open on the free plan`);
    setStanding('u1', CORE);
    const locked = LOCKED_FEATURES.filter((f) => featureAccess(f) === 'locked');
    assert.deepEqual([...locked].sort(), ['continueArc', 'realMoment']);
  });

  test('a locked tap opens the Wall and does not go on; an open tap goes on', () => {
    setStanding('u1', FREE);
    const walls: LockedFeature[] = [];
    let went = 0;
    tapThrough(featureAccess, 'continueArc', (f) => walls.push(f), () => { went += 1; });
    assert.deepEqual(walls, ['continueArc']);
    assert.equal(went, 0);
    clearStanding();
    tapThrough(featureAccess, 'continueArc', (f) => walls.push(f), () => { went += 1; });
    assert.deepEqual(walls, ['continueArc']);
    assert.equal(went, 1);
  });

  // 2026-10-20, lock seam wiring: was "imports nothing from purchases/ or wall/ before D5".
  test('the seam imports only purchases/featureLocks, nothing else in purchases/ or wall/', () => {
    const src = readFileSync(new URL('./featureAccess.ts', import.meta.url), 'utf8');
    const imports = [...src.matchAll(/^\s*import[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!);
    assert.deepEqual(imports, ['../purchases/featureLocks.ts']);
    assert.doesNotMatch(src, /require\(|import\(/);
  });

  test('the hook re-renders on the standing and opens the Wall through main\'s hook', () => {
    const src = readFileSync(new URL('./useFeatureAccess.ts', import.meta.url), 'utf8');
    const imports = [...src.matchAll(/^\s*import[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!);
    assert.deepEqual(imports, ['react', '../purchases/useFeatureLocks.ts', './featureAccess.ts']);
    const main = readFileSync(new URL('../purchases/useFeatureLocks.ts', import.meta.url), 'utf8');
    assert.match(main, /onStandingChange\(/);
    assert.match(main, /navigate\('Wall', \{ entry: 'locked' \}\)/);
  });

  test('only access/ talks to purchases/featureLocks from a surface', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const root = new URL('../', import.meta.url);
    const walk = (dir: URL, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const url = new URL(name, dir);
        if (statSync(url).isDirectory()) walk(new URL(`${name}/`, dir), out);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(url.pathname);
      }
      return out;
    };
    for (const dir of ['tabs/', 'journey/', 'practice/', 'tutor/', 'main/']) {
      for (const file of walk(new URL(dir, root))) {
        // Main's NextTaskCard reads useFeatureLocks itself for offeredReview; it predates the seam.
        if (file.endsWith('/practice/NextTaskCard.tsx')) continue;
        assert.doesNotMatch(readFileSync(file, 'utf8'), /purchases\/(featureLocks|useFeatureLocks)/, `${file} reads the lock standing past access/`);
      }
    }
  });

  test('every tab the navigator draws is a root the launch wall can open over', () => {
    const nav = readFileSync(new URL('../nav/RootNavigator.tsx', import.meta.url), 'utf8');
    const tabs = [...nav.matchAll(/<Tab\.Screen name="([^"]+)"/g)].map((m) => m[1]!);
    assert.ok(tabs.includes('Explore'));
    assert.deepEqual([...TAB_ROOTS].sort(), [...tabs].sort());
  });
});
