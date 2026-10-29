import { evidence } from '../../test/evidence.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DEMO_COACHING, FIRST_LINE } from '../onboarding/firstRun.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test("actual guest practice connects the submitted reply, useful feedback, exact retry and durable keep", () => {
  const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
  const live = evidence('apps/mobile/src/onboarding/FirstLivePractice.tsx');
  assert.doesNotMatch(screen, /sendGuestAttempt|<GuestRecording/);
  assert.match(screen, /<FirstLivePractice guest=\{guest\}/);
  assert.match(screen, /if \(previewOnly\) return;/);
  assert.match(live, /await live\.sendSay\(text\)/);
  assert.match(live, /if \(sent\) setDraft\(''\); else setIssue/);
  assert.match(live, /await readGuestLiveResult\(held\.current\)/);
  assert.match(live, /completed: record\.outcome === 'completed'/);
  assert.ok(live.indexOf('await saveGuestPractice(next)') < live.indexOf('onFinished(next)'));
  assert.match(live, /Try connecting again/);
  assert.doesNotMatch(live, /pronunciationScore|awardXp/);
});

test("signup carries the actual starter and keeps guest work during sign-in", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); const signup = evidence('apps/mobile/src/auth/SignUpScreen.tsx'); assert.match(flow, /planDraft=\{refused \? null : signupDraft\}/); assert.match(flow, /onCreateAccount\(accountDraft\)/); assert.match(app, /onCreateAccount=\{keepPreAccountDraft\}/); assert.match(app, /savePreAccountDraft\(draft\)/); assert.match(app, /<PreAccountProfileBootstrap\s+draft=\{preAccountDraft\}/); assert.match(app, /firstRunScene\(preAccountDraft\)/); assert.doesNotMatch(signup, /plan\.starter\.title/, 'the account form repeats the starter subtitle instead of keeping its controls visible'); assert.match(flow, /switchScreen\('signin'\)/); assert.doesNotMatch(flow.slice(flow.indexOf('const signIn ='),flow.indexOf('if (!introducing)')), /clearGuestPractice|clearPreAccountDraft/); });

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
  const eventOwners: unknown[] = [];
  const bindings = {
    left: { current: false }, user: { id: 'owned-test' }, entry: 'profile', granted: false,
    scopeGeneration: () => 7, trackProductEvent: (event: unknown, owner: unknown) => { events.push(event); eventOwners.push(owner); },
    onStartSpeaking: () => exits.push('speak'), onLeave: () => exits.push('original'),
    onOpenPractice: () => exits.push('practice'),
  };
  new Function(...Object.keys(bindings), stripTypeScriptTypes(leave) + "\nleave('back', onOpenPractice); leave('back', onOpenPractice);")(...Object.values(bindings));
  assert.deepEqual(exits, ['practice']);
  assert.deepEqual(events, [{ name: 'wall_left', properties: { entry: 'profile', outcome: 'unchanged', destination: 'back' } }]);
  assert.deepEqual(eventOwners, [{ userId: 'owned-test', generation: 7 }], 'the consented event must retain the original account rather than acquire the next account');
  // 19 October 2026, "P2 · Luvani": the unavailable state keeps Try again and
  // one clear way back to free practice, both through the guarded `leave`.
  const unavailable = wall.slice(wall.indexOf('  if (unavailable || loading) {'), wall.indexOf('  return plansScreen();'));
  assert.match(unavailable, /\{PAYWALL_UNAVAILABLE_TITLE\}/);
  assert.match(unavailable, /<WallSecondary label=\{PAYWALL_TRY_AGAIN\}[^\n]+setRetry/);
  assert.match(unavailable, /<WallTextLink label=\{YOURS_DECLINE\} onPress=\{\(\) => leave\('back', onOpenPractice\)\} \/>/);
  assert.match(unavailable, /onPress=\{unavailable \? \(\) => leave\('back', onOpenPractice\) : \(\) => leave\(\)\}/);
  const plans = read('../wall/WallPlansPage.tsx');
  const view = read('../wall/trialPaywall.ts');
  // The plan line says the catalogue's actual minutes once, never an estimate.
  assert.match(plans, /planLine\(visibleRow, current, catalogue\)/);
  assert.match(view, /const minutes = offerMinutes\(row, offer\);/);
  assert.doesNotMatch(plans, /perWeekLine\(row.perWeek\)/, 'a second estimate repeats the actual minutes allowance');
  // The compact selector chooses a real product; the billed price and period
  // lead. The annual monthly equivalent is a separate, smaller line and never
  // replaces the yearly charge.
  const periods = read('../wall/WallPeriodSwitch.tsx');
  assert.match(plans, /<WallPeriodSwitch offers=\{visibleRow\.offers\} name=\{visibleRow\.name\} selected=\{selected\} onSelect=\{onSelect\}/);
  assert.match(view, /const billed = billedPrice\(offer\.price, offer\.period\);/);
  assert.match(view, /billedYearlyAbout\(offer\.perMonth\)/);
  assert.match(plans, /\{offer.billed\}[\s\S]*\{offer.detail\}/);
  assert.match(periods, /accessibilityLabel=\{\[name, period, billedPrice\(offer\.price, offer\.period\)\]\.join\(', '\)\}/, 'the period choice must announce the actual billed price');
  assert.match(periods, /onPress=\{\(\) => onSelect\(offer\)\}/);

  const navigator = read('../nav/RootNavigator.tsx');
  const route = navigator.slice(navigator.indexOf('function WallRoute()'), navigator.indexOf('function TutorMemoryRoute()'));
  const practiceLine = route.split('\n').find(line => line.includes('onOpenPractice={'));
  assert.ok(practiceLine, 'the unavailable-offer exit must have a real route callback');
  const practice = practiceLine.slice(practiceLine.indexOf('onOpenPractice={') + 'onOpenPractice={'.length, practiceLine.lastIndexOf('}'));
  // This base has no Explore collections: the unavailable-offer exit always
  // leads to free practice.
  const calls: unknown[] = [];
  const callback = new Function('nav', `return (${practice});`)({ replace: (...args: unknown[]) => calls.push(args) }) as () => void;
  callback();
  assert.deepEqual(calls, [['Tabs', { screen: 'Practice' }]], 'an unavailable offer leads to free practice');
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
