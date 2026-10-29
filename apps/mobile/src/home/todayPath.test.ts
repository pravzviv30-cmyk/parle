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
    pathStep: (step: string, minutes?: number) => { title: string; line: string };
  };
  assert.deepEqual([...TODAY_PATH], ['fix', 'scene', 'phrase']);
  // The path leads; the quotas, Coming up and the week sit under it.
  assert.deepEqual([...TODAY_CARDS], ['greeting', 'stats', 'path', 'three', 'comingUp', 'week']);
  assert.deepEqual(pathStep('fix'), { title: 'Retry your last fix', line: 'About 30 seconds' });
  assert.deepEqual(pathStep('scene', 6.4), { title: 'The next scene', line: 'About 6 minutes' });
  assert.deepEqual(pathStep('scene', 0.2), { title: 'The next scene', line: 'About 1 minute' });
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
  for (const line of [todayView.TODAY_COPY.path, ...['fix', 'phrase'].flatMap(s => Object.values(pathStep(s)))]) assert.doesNotMatch(line, /[·—]/);
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
  assert.match(LOCAL, /\{OFFLINE_NOTICE\}/);
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
      assert.equal(lead, out ? 'plans' : 'scene', `${plan}/${reason}`);
    }
  }
});

test('the goal ring says under a minute aloud as it draws it', () => {
  const view = todayHeroView({ streak: { current: 0, today: 'open' }, goal: { minutes: 0, activeMs: 20_000, target: 5, met: false }, level: { level: 1, toNext: 50 }, xp: { total: 0 } } as never)!;
  assert.doesNotMatch(view.goal.label, /\b0 of 5/);
  assert.match(view.goal.label, /under 1 of 5 minutes/i);
});
