import { evidence } from '../../test/evidence.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DEMO_COACHING, FIRST_LINE } from '../onboarding/firstRun.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test("actual guest practice connects the submitted reply, useful feedback, exact retry and durable keep", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /sendGuestAttempt/); assert.match(screen, /result\.feedback\.accepted/); assert.match(screen, /label="Try it again"|label="Try again"|Retry/); assert.match(screen, /saveGuestPractice\(next\)/); assert.match(screen, /if \(saved\)/); assert.doesNotMatch(screen, /coachingOpen|pronunciationScore|awardXp/); });

test("signup carries the actual starter and keeps guest work during sign-in", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); const signup = evidence('apps/mobile/src/auth/SignUpScreen.tsx'); assert.match(flow, /onCreateAccount\(draft\)/); assert.match(app, /onCreateAccount=\{keepPreAccountDraft\}/); assert.match(app, /savePreAccountDraft\(draft\)/); assert.match(app, /<PreAccountProfileBootstrap\s+draft=\{preAccountDraft\}/); assert.match(app, /firstSceneFor\(preAccountDraft\.startLevel, preAccountDraft\.reason\)/); assert.doesNotMatch(signup, /plan\.starter\.title/, 'the account form repeats the starter subtitle instead of keeping its controls visible'); assert.match(flow, /setScreen\('signin'\)/); assert.doesNotMatch(flow.slice(flow.indexOf('const signIn ='),flow.indexOf('if (!introducing)')), /clearGuestPractice|clearPreAccountDraft/); });

test('memory and Settings put practical controls before processing details without inventing support', () => {
  const memory = read('../profile/TutorMemoryScreen.tsx');
  assert.ok(memory.indexOf('<SwitchRow first title={MEMORY_PAUSE_TITLE}') < memory.indexOf('{WHAT_LEAVES}'));
  assert.match(memory, /detailsOpen &&/);
  assert.match(memory, /commitMemory\(\(current\) => withMemoryPaused\(current, paused\)\)/);
  const settings = read('../settings/SettingsScreen.tsx');
  assert.match(settings, /label=\{DATA_USE_ROW\}[^\n]+setSheet\('policy'\)/);
  assert.match(settings, /label=\{LOCAL_PRACTICE_ROW\}[^\n]+navigate\('Tabs', \{ screen: 'Practice' \}\)/);
  assert.match(settings, /contact !== null/);
  assert.match(settings, /label=\{CONNECTION_HELP_ROW\}/);
});

test('unavailable plans return to free practice once and retain an accepted consented exit event', () => {
  const wall = read('../wall/WallScreen.tsx');
  const leave = wall.slice(wall.indexOf('  const leave = '), wall.indexOf('  const back = '));
  const exits: string[] = [];
  const events: unknown[] = [];
  const bindings = {
    left: { current: false }, user: { id: 'owned-test' }, entry: 'profile', granted: false,
    scopeGeneration: () => 7, trackProductEvent: (event: unknown) => events.push(event),
    onStartSpeaking: () => exits.push('speak'), onLeave: () => exits.push('original'),
    onOpenPractice: () => exits.push('practice'),
  };
  new Function(...Object.keys(bindings), stripTypeScriptTypes(leave) + "\nleave('back', onOpenPractice); leave('back', onOpenPractice);")(...Object.values(bindings));
  assert.deepEqual(exits, ['practice']);
  assert.deepEqual(events, [{ name: 'wall_left', properties: { entry: 'profile', outcome: 'unchanged', destination: 'back' } }]);
  assert.match(wall, /does not tell us whether you have a paid plan/);
  assert.match(wall, /IconAction layout="inline" icon="refresh" busy=\{busy\} label="Try again"[^\n]+setRetry/);
  const plans = read('../wall/WallPlansPage.tsx');
  assert.match(plans, /minutesAMonth\(row.minutes\)/);
  assert.doesNotMatch(plans, /perWeekLine\(row.perWeek\)/, 'a second estimate repeats the actual minutes allowance');
  // 7 October 2026, come alive README Part 5.G and Part 7 ("per month pins edited
  // for annual rows"): each way to pay is titled by its billed price with its
  // own period, yearly or monthly, and a screen reader hears the same.
  assert.match(plans, /const billed = billedPrice\(offer\.price, offer\.period\);/); assert.match(plans, /title=\{`\$\{period\} · \$\{offer.price\}`\}/);
  assert.match(plans, /monthlyPrice\(offer\.price\)/); assert.match(plans, /yearlyPrice\(offer\.price, offer\.perMonth\)/);
});

test('the research protocol defines evidence windows and denominators without adding pre-account tracking or a live experiment', () => {
  const protocol = read('../../../../docs/UX_ACCEPTANCE_REVIEW.md');
  for (const criterion of ['Denominator and window', 'within seven days', 'seven complete days', 'Reviewer-observed relevant learner', 'missing observations', 'No experiment is started', 'No pre-account telemetry']) {
    assert.ok(protocol.toLowerCase().includes(criterion.toLowerCase()), `missing measurement constraint: ${criterion}`);
  }
  const onboarding = read('../onboarding/PreAccountOnboarding.tsx');
  assert.doesNotMatch(onboarding, /trackProductEvent|fetch\(|recordActivity|requestRecordingPermissions/);
  assert.match(protocol, /Stop immediately for incorrect charge/);
  assert.match(protocol, /cannot establish conversion uplift or\s+calibrate pronunciation thresholds/);
});
