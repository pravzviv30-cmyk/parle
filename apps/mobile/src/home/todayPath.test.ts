/**
 * Today's path (F934, LR-17, founder decision 6), the offline lead (F924), the
 * out-of-time lead (F936, F651) and Home's plans door (F935).
 *
 * No renderer in this suite (docs/TESTING.md): the rules are pure and tested
 * as such; the screen is read as source, which proves order and wiring, never
 * that a phone drew it.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PLANS, newCard, type Plan, type ReviewCard, type ReviewSource } from '@luvani/core';

import * as todayView from './todayView.ts';
import * as nextAction from './nextAction.ts';
import { todayLead, offersPlans } from '../practice/nextTask.ts';
import { watchLive } from '../app/liveWatch.ts';
import { OFFLINE_NOTICE, offlineOffer } from '../practice/localPractice.ts';
import { dealForTier } from '../review/freeTier.ts';
import { todayHeroView } from '../game/todayHeroView.ts';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const HOME = read('../tabs/HomeTab.tsx');
const TASK = read('../practice/NextTaskCard.tsx');
const STARTER = read('../onboarding/StarterContinuation.tsx');
const ROUTE = read('./RoutePath.tsx');
const LOCAL = read('../practice/LocalPracticeCard.tsx');
const LIVE = read('../app/LiveContext.tsx');

const NOW = Date.parse('2026-10-29T10:00:00Z');
const card = (id: string, source: ReviewSource): ReviewCard => ({ ...newCard({ id, kind: 'vocab', front: id, back: 'x', context: '', ipa: '' }, NOW - 1000), sources: [source] });

test('Today leads with one ordered path of three steps', () => {
  const { TODAY_CARDS, TODAY_PATH, pathStep } = todayView as unknown as {
    TODAY_CARDS: readonly string[]; TODAY_PATH: readonly string[];
    pathStep: (step: string) => { title: string; line: string | null };
  };
  assert.deepEqual([...TODAY_PATH], ['fix', 'scene', 'phrase']);
  // The path leads; the quotas, Coming up and the week sit under it.
  assert.deepEqual([...TODAY_CARDS], ['greeting', 'stats', 'path', 'three', 'comingUp', 'week']);
  assert.deepEqual(pathStep('fix'), { title: 'Retry your last fix', line: 'About 30 seconds' });
  // Founder, 2026-10-29: the scene's time is on its card only.
  assert.deepEqual(pathStep('scene'), { title: 'The next scene', line: null });
  assert.deepEqual(pathStep('phrase'), { title: "Say today's phrase", line: 'About 2 minutes' });
  assert.equal(todayView.TODAY_COPY.path, "Today's path");

  // Source order on the screen: the path heading, the fix stop, the lead, the
  // phrase, then the three, Coming up and the week.
  const at = (needle: string) => { const i = HOME.indexOf(needle); assert.ok(i >= 0, `HomeTab has no ${needle}`); return i; };
  const order = ['<TodayHero />', '{TODAY_COPY.path}', "pathStep('fix')", '<NextTaskCard vivid', "pathStep('phrase')", '<DailyCard', '{three}', '{event !== null', '{week !== null'];
  for (let i = 1; i < order.length; i += 1) assert.ok(at(order[i - 1]!) < at(order[i]!), `${order[i]} is drawn before ${order[i - 1]}`);
  assert.doesNotMatch(HOME, /<Columns>\{three\}\{fixCard\}<\/Columns>/, 'the fix still shares a row with the quotas');

  // One route drawing, shared with the wall's trial route.
  assert.match(ROUTE, /export function RouteNode/);
  // The wall keeps its own copy until its Apple 3.1.2 price pin is repointed (a money pin, left alone).
  assert.match(HOME, /<RouteNode /);
  assert.match(TASK, /<RouteNode /);
  for (const line of [todayView.TODAY_COPY.path, ...['fix', 'phrase'].flatMap(s => Object.values(pathStep(s)) as string[])]) assert.doesNotMatch(line, /[·—]/);
});

test('Today offers review when Review would deal cards', () => {
  const { reviewRow } = todayView as unknown as { reviewRow: (deck: readonly ReviewCard[], now: number, lock: 'locked' | 'unlocked' | 'unknown') => { title: string; line: string; count: number } | null };
  const talk = [card('a', 'conversation'), card('b', 'conversation')];
  // A locked learner with only conversation phrases due: Review deals nothing, so no row.
  assert.equal(reviewRow(talk, NOW, 'locked'), null);
  assert.equal(reviewRow([], NOW, 'unlocked'), null);
  const open = reviewRow(talk, NOW, 'unlocked');
  assert.deepEqual(open, { title: 'Review 2 phrases', line: 'About 2 minutes', count: 2 });
  const mixed = [...talk, card('c', 'curated')];
  assert.equal(reviewRow(mixed, NOW, 'locked')?.title, 'Review 1 phrase');
  // The count is what Review itself deals, for every standing.
  for (const lock of ['locked', 'unlocked', 'unknown'] as const) {
    assert.equal(reviewRow(mixed, NOW, lock)?.count ?? 0, dealForTier(mixed, NOW, lock).due.length);
  }
  assert.match(HOME, /reviewRow\(/);
  assert.match(HOME, /nav\.navigate\('Review'\)/);
});

test('Today restores the scene card when the connection returns', async () => {
  let up = false;
  let probes = 0;
  const handlers: { online?: () => void; foreground?: () => void } = {};
  const timers = new Map<number, () => void>();
  let id = 0;
  let live = false;
  const stop = watchLive({
    probe: async () => { probes += 1; live = up; return up; },
    isLive: () => live,
    onOnline: (fn) => { handlers.online = fn; return () => { handlers.online = undefined; }; },
    onForeground: (fn) => { handlers.foreground = fn; return () => { handlers.foreground = undefined; }; },
    every: 30_000,
    setRepeat: (fn) => { id += 1; timers.set(id, fn); return id; },
    clearRepeat: (n) => { timers.delete(n as number); },
  });
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  await flush();
  assert.equal(live, false);
  assert.equal(timers.size, 1, 'offline, nothing probes again');
  // A slow probe while offline stays offline and keeps polling.
  [...timers.values()][0]!();
  await flush();
  assert.equal(timers.size, 1);
  // The connection comes back: the browser's online event probes, live turns
  // true, and the polling stops.
  up = true;
  handlers.online!();
  await flush();
  assert.equal(live, true);
  assert.equal(timers.size, 0, 'it keeps polling once live');
  assert.equal(todayLead({ live, billing: null, starter: false }), 'scene');
  assert.equal(todayLead({ live: false, billing: null, starter: false }), 'local');
  // Foreground probes too.
  const before = probes;
  handlers.foreground!();
  await flush();
  assert.equal(probes, before + 1);
  stop();
  assert.equal(handlers.online, undefined);
  assert.equal(handlers.foreground, undefined);
  assert.match(LIVE, /watchLive\(/);
  assert.match(LIVE, /AppState/);
});

test('the offline card says the learner is offline', () => {
  assert.equal(OFFLINE_NOTICE, "You're offline. Here's something you can do without a connection.");
  // Fix-verifier 2026-10-29: said only when the device is offline (next test).
  assert.match(LOCAL, /offlineNotice\(/);
  assert.match(LOCAL, /name="state-offline"/);
  // The café line is a Starter line: a learner past Starter is not handed it as their lead.
  assert.equal(offlineOffer(0), 'cafe');
  assert.equal(offlineOffer(3), 'below');
  assert.match(LOCAL, /A Starter line/);
});

test('an out-of-time learner is led to plans, not to a live scene', () => {
  for (const reason of ['exhausted', 'insufficient-for-session'] as const) {
    for (const starter of [false, true]) {
      assert.equal(todayLead({ live: true, billing: { plan: 'trial', reason }, starter }), 'plans', `${reason}, starter ${starter}`);
    }
  }
  assert.equal(todayLead({ live: true, billing: { plan: 'trial', reason: null }, starter: true }), 'starter');
  assert.equal(todayLead({ live: false, billing: null, starter: true }), 'starter');
  // The starter card is drawn by the lead rule, never ahead of billing.
  assert.doesNotMatch(HOME, /<StarterContinuation/);
  assert.match(TASK, /lead === 'starter' && starter !== null/);
  assert.match(TASK, /if \(lead === 'plans'\) return onStop\(lead, null, plansCard\);/);
  assert.match(STARTER, /onTutor !== undefined &&/);
});

test('a paid learner is never offered See plans on Home', () => {
  for (const plan of Object.keys(PLANS) as Plan[]) {
    for (const reason of [null, 'exhausted', 'insufficient-for-session', 'subscription-lapsed'] as const) {
      assert.equal(offersPlans({ plan, reason }), plan === 'trial', `${plan}/${reason}`);
    }
  }
  assert.equal(offersPlans(null), false, 'an unknown plan is offered no purchase door');
  assert.match(STARTER, /onPlans !== undefined &&/);
  assert.match(TASK, /onPlans=\{offersPlans\(billing\)/);
});

test('a trial with too little time for a session leads Home the way the plans pass decides, and every plan in the catalogue is walked', () => {
  assert.equal('homeActionFor' in nextAction, false, 'a second lead rule production never calls is still exported');
  const plans = Object.keys(PLANS) as Plan[];
  assert.ok(plans.includes('trial') && plans.length > 1);
  for (const plan of plans) {
    for (const reason of [null, 'exhausted', 'insufficient-for-session', 'subscription-lapsed'] as const) {
      const lead = todayLead({ live: true, billing: { plan, reason }, starter: false });
      const out = plan === 'trial' && (reason === 'exhausted' || reason === 'insufficient-for-session');
      // A paid plan out of minutes leads to its out-of-time words (fix-verifier, 2026-10-29).
      const paidOut = plan !== 'trial' && (reason === 'exhausted' || reason === 'insufficient-for-session');
      // A lapsed plan is told it ended (fix-verifier round 2).
      assert.equal(lead, reason === 'subscription-lapsed' ? 'lapsed' : out ? 'plans' : paidOut ? 'outOfTime' : 'scene', `${plan}/${reason}`);
    }
  }
});

test('the goal ring says under a minute aloud as it draws it', () => {
  const view = todayHeroView({ streak: { current: 0, today: 'open' }, goal: { minutes: 0, activeMs: 20_000, target: 5, met: false }, level: { level: 1, toNext: 50 }, xp: { total: 0 } } as never)!;
  assert.doesNotMatch(view.goal.label, /\b0 of 5/);
  assert.match(view.goal.label, /under 1 of 5 minutes/i);
});

// Fix-verifier round, 2026-10-29: four claims refuted in 3c8ebd7b.
import * as lp from '../practice/localPractice.ts';
import * as nt from '../practice/nextTask.ts';

test('the offline card says offline only when the device is offline, and otherwise that the tutor cannot be reached', () => {
  const { offlineNotice, TUTOR_UNREACHABLE } = lp as unknown as { offlineNotice: (onLine: boolean | undefined) => string; TUTOR_UNREACHABLE: string };
  assert.equal(offlineNotice(false), OFFLINE_NOTICE);
  assert.equal(TUTOR_UNREACHABLE, "We can't reach your tutor right now. Here's something you can do while we try again.");
  assert.equal(offlineNotice(true), TUTOR_UNREACHABLE);
  assert.equal(offlineNotice(undefined), TUTOR_UNREACHABLE, 'a platform that cannot say is not called offline');
  assert.match(LOCAL, /offlineNotice\(deviceOnLine\(\)\)/);
  assert.doesNotMatch(LOCAL, /\{OFFLINE_NOTICE\}/);
});

test('a live learner with no next scene gets a way forward, not the offline card', () => {
  const { sceneOrExplore } = nt as unknown as { sceneOrExplore: (lead: string, hasHero: boolean) => string };
  assert.equal(sceneOrExplore('scene', true), 'scene');
  assert.equal(sceneOrExplore('scene', false), 'explore');
  assert.equal(sceneOrExplore('local', false), 'local');
  assert.match(TASK, /sceneOrExplore\(todayLead\(\{ live, billing, starter: starter !== null, answered: billingAnswered \}\), value\.hero !== null\)/);
  assert.match(TASK, /nav\.navigate\('Explore'\)/);
});

test('a paid learner out of minutes is led to the out-of-time words, not a scene or a plans pitch', () => {
  for (const plan of Object.keys(PLANS) as Plan[]) {
    if (plan === 'trial') continue;
    for (const reason of ['exhausted', 'insufficient-for-session'] as const) {
      assert.equal(todayLead({ live: true, billing: { plan, reason }, starter: false }), 'outOfTime', `${plan}/${reason}`);
      assert.equal(todayLead({ live: true, billing: { plan, reason }, starter: true }), 'outOfTime');
    }
    assert.equal(todayLead({ live: true, billing: { plan, reason: null }, starter: false }), 'scene');
  }
  assert.match(TASK, /lead === 'outOfTime'/);
  // The words come from heldWords, tested by behaviour below (round 2).
  assert.match(TASK, /heldWords\(billing, Date\.now\(\)\)/);
});

test('Speak with my tutor waits until billing has answered', () => {
  const { starterTutorOpen } = nt as unknown as { starterTutorOpen: (i: { live: boolean; billing: unknown; answered: boolean }) => boolean };
  assert.equal(starterTutorOpen({ live: true, billing: null, answered: false }), false, 'shown while billing loads');
  assert.equal(starterTutorOpen({ live: true, billing: { plan: 'trial', reason: null }, answered: true }), true);
  assert.equal(starterTutorOpen({ live: true, billing: { plan: 'trial', reason: 'exhausted' }, answered: true }), false);
  assert.equal(starterTutorOpen({ live: false, billing: { plan: 'trial', reason: null }, answered: true }), false);
  assert.match(TASK, /onTutor=\{starterTutorOpen\(/);
});

test('the review row depends only on what Review would deal', () => {
  assert.doesNotMatch(HOME, /fixFrom === null \? null : reviewRow/);
  assert.match(HOME, /reviewDeck === null \? null : reviewRow\(reviewDeck, Date\.now\(\), locks\.access\('conversationPractice'\)\)/);
  assert.match(HOME, /loadDeck\(\)\.then\(\(deck\) => \{ if \(!cancelled && scopeGeneration\(\) === scope\) setReviewDeck\(deck\); \}\)/);
});

// Fix-verifier round 2, 2026-10-29.
test('an out-of-time or lapsed lead still offers practice that needs no minutes', () => {
  const { afterHeld } = nt as unknown as { afterHeld: (starter: boolean) => string };
  assert.equal(afterHeld(true), 'starter', 'the typed starter continuation is lost behind the out-of-time words');
  assert.equal(afterHeld(false), 'local');
});

test('a lapsed plan is told it has ended and may see plans, never led to a refused scene', () => {
  const { heldWords } = nt as unknown as { heldWords: (billing: { plan: Plan; reason: string | null; periodEnd?: string | null }, now: number) => { title: string; message: string; plans: boolean } };
  for (const plan of Object.keys(PLANS) as Plan[]) {
    const billing = { plan, reason: 'subscription-lapsed' as const };
    assert.equal(todayLead({ live: true, billing, starter: false }), 'lapsed', plan);
    assert.equal(todayLead({ live: true, billing, starter: true }), 'lapsed', plan);
    const words = heldWords(billing, NOW);
    assert.equal(words.title, 'Your paid plan has ended.');
    assert.equal(words.plans, true, 'a lapsed learner holds no plan, so may see plans');
  }
  const paid = heldWords({ plan: 'starter', reason: 'exhausted', periodEnd: '2026-11-27T12:00:00.000Z' }, NOW);
  assert.equal(paid.plans, false, 'a paying learner is pitched plans');
  assert.match(paid.message, /Fresh minutes on 27 November\./);
});

test('while billing loads the lead is held, and a failed read falls back to the scene', () => {
  const out = { plan: 'starter' as Plan, reason: 'exhausted' as const };
  assert.equal(todayLead({ live: true, billing: null, starter: false, answered: false } as never), 'loading');
  assert.equal(todayLead({ live: true, billing: out, starter: false, answered: true } as never), 'outOfTime');
  // A billing read that failed answers with null: the scene, as before.
  assert.equal(todayLead({ live: true, billing: null, starter: false, answered: true } as never), 'scene');
  // Offline nothing waits on billing.
  assert.equal(todayLead({ live: false, billing: null, starter: false, answered: false } as never), 'local');
});

test('the offline stop is titled truly whether the device or the tutor is away', () => {
  const { leadStop } = nt as unknown as { leadStop: (lead: string, minutes: number | null) => { title: string; line: string } };
  assert.equal(leadStop('local', null).title, 'Something you can do now');
  assert.doesNotMatch(leadStop('local', null).title, /offline/i);
  assert.equal(leadStop('lapsed', null).line, 'When you choose a plan');
});

test("Today's scene card shows only how long the scene takes", () => {
  const { sceneTime } = todayView as unknown as { sceneTime: (hero: { minutes: number }) => string };
  assert.equal(sceneTime({ minutes: 3.2 }), 'About 3 minutes');
  assert.equal(sceneTime({ minutes: 0.4 }), 'About 1 minute');
  const hero = read('./MissionHero.tsx');
  assert.match(hero, /french=\{null\} rest=\{time\}/, 'the card still draws the French name and the tutor under the title');
  // The screen reader hears the scene and its time on the Start.
  assert.match(hero, /accessibilityLabel: `\$\{label\}: \$\{hero\.title\}, \$\{time\}`/);
  // The time is said once: the path's scene stop names the step only.
  const { leadStop } = nt as unknown as { leadStop: (lead: string, minutes: number | null) => { title: string; line: string | null } };
  assert.deepEqual(leadStop('scene', 3), { title: 'The next scene', line: null });
  assert.equal(todayView.pathStep('fix').line, 'About 30 seconds');
  assert.equal(todayView.pathStep('phrase').line, 'About 2 minutes');
});
