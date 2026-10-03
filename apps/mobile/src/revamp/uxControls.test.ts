import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DEMO_COACHING, FIRST_LINE } from '../onboarding/firstRun.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the authored teaching preview connects attempt, useful feedback, model retry and saved practice without assessing playback', () => {
  assert.equal(DEMO_COACHING.alternative, FIRST_LINE.reply);
  assert.match(DEMO_COACHING.scope, /authored example, not an assessment/);
  assert.match(DEMO_COACHING.feedback, /"bonjour" to greet/);
  assert.ok(DEMO_COACHING.alternative.fr.startsWith('Bonjour'));
  assert.match(DEMO_COACHING.retry, /microphone stays off/);
  assert.match(DEMO_COACHING.kept, /After a real conversation/);
  const screen = read('../onboarding/PreAccountOnboarding.tsx');
  assert.match(screen, /useState\(false\)/);
  assert.match(screen, /coachingOpen && <Card/);
  assert.match(screen, /play\(clipFor\(DEMO_COACHING.alternative\), null\)/);
  assert.doesNotMatch(screen, /SceneMark|recordActivity|recordMissionCompletion/);
});

test('signup carries the current plan summary and clears it before an existing-account sign-in', () => {
  const flow = read('../auth/AuthFlow.tsx');
  assert.match(flow, /planDraft=\{refused \? null : signupDraft\}/);
  assert.match(flow, /if \(!refused\) \{\s*setSignupDraft\(draft\);\s*onCreateAccount\(draft\)/);
  assert.match(flow, /onSignIn=\{\(\) => \{\s*setSignupDraft\(null\);\s*onSignIn\(\)/);
  const screen = read('../auth/SignUpScreen.tsx');
  assert.match(screen, /planDraft === null \? null : planFor\(planDraft\)/);
  assert.match(screen, /plan.minutes === 'none'/);
  assert.doesNotMatch(screen, /Saved to your account|plan is saved/);
});

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
  assert.match(wall, /GhostButton label="Try again"[^\n]+setRetry/);
  const plans = read('../wall/WallPlansPage.tsx');
  assert.ok(plans.indexOf('{minutesAMonth(row.minutes)}</Text>') < plans.indexOf('{perWeekLine(row.perWeek)}</Text>'));
  assert.match(plans, />per month<\/Text>/);
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
