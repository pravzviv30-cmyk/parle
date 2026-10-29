/**
 * Every lock badge against the real standing (2026-10-20, lock seam wiring).
 *
 * The view models default to `featureAccess`, so a stubbed billing standing
 * here is what a free learner's surfaces would draw. Each locked item's tap
 * either lands on one of App.tsx's locked routes (main's guard replaces it
 * with `Wall { entry: 'locked' }`) or carries the feature its tab hands to
 * `tapThrough`, which opens the Wall. An unknown plan locks nothing.
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIRST_MISSION, missionStates, type ReviewCard } from '@luvani/core';
import { clearStanding, lockedRouteFeature, setStanding } from '../purchases/featureLocks.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { JOURNEY_TEASERS, canDoView, helpView, soundsView, thenNowCard, weekView, yourFrenchView, type StoredCompletion } from '../journey/journeyView.ts';
import { thenNowView } from '../journey/thenNowView.ts';
import { lessHelp, speakTiles } from '../tutor/speakTabView.ts';
import { fixesLocked } from '../practice/fixesView.ts';

const FREE: BillingStatus = { plan: 'trial', secondsRemaining: 300, periodEnd: null, lapsed: false, canStart: true, reason: null };
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 20, 12, 0, 0).getTime();
const stored: StoredCompletion[] = [{ id: 'mission:cafe', at: NOW - 3600_000, rung: 2 }];
const progress = missionStates(missionCompletionsFrom(stored), [], NOW);
const deck: ReviewCard[] = [{
  id: 'phrase:one', kind: 'vocab', front: 'je voudrais un croissant', back: 'I would like a croissant', context: '', ipa: '',
  addedAt: NOW - 10 * DAY, due: NOW + DAY, intervalDays: 6, ease: 2.5, reps: 3, lapses: 0,
  evidence: { retrievals: 1, convoUses: 1, transfers: 0 },
}];
const checks: SoundCheckEvidence[] = [{ missionId: 'mission:cafe', reference: 'Bonjour', at: NOW - DAY, kind: 'assessed-clear', focus: null, phoneme: null }];
const reflection = { improvement: 'Well done.', focus: null, next: null };

/** Every surface's badge flags, read through the default seam. */
function surfaces() {
  return {
    canDo: canDoView({ progress, completions: stored, now: NOW }),
    thenNow: thenNowCard(stored)!,
    used: yourFrenchView({ deck, checks, progress, now: NOW }).phrases!,
    help: helpView({ completions: stored, story: { sentences: [] }, now: NOW })!,
    sounds: soundsView({ checks, now: NOW, hasJourney: false })!,
    week: weekView(reflection)!,
    thenNowScreen: thenNowView({ progress, completions: stored }),
    replay: lessHelp([{ id: FIRST_MISSION, at: NOW - 1000, rung: 1 }])!,
    tiles: speakTiles('Sam'),
    fixes: fixesLocked(),
  };
}

afterEach(() => clearStanding());

describe('lock badges against the D24 standing', () => {
  test('an unknown plan fails open: no surface draws a badge or a teaser', () => {
    for (const status of [undefined, null]) {
      if (status === null) setStanding('u1', null);
      const s = surfaces();
      for (const key of ['canDo', 'thenNow', 'used', 'help', 'sounds', 'week'] as const) {
        assert.equal(s[key].locked, false, `${key} locked on an unknown plan`);
        assert.equal(s[key].teaser, null, `${key} teased on an unknown plan`);
      }
      assert.equal(s.canDo.rows.length > 0, true);
      assert.equal(s.thenNowScreen.locked, false);
      assert.equal(s.replay.locked, false);
      assert.deepEqual(s.tiles.map((t) => t.locked), [false, false, false]);
      assert.equal(s.fixes, false);
    }
  });

  test('a free learner sees every badge, and a Journey section shows its teaser, never its content', () => {
    setStanding('u1', FREE);
    const s = surfaces();
    assert.equal(s.canDo.locked, true);
    assert.deepEqual(s.canDo.rows, [], 'a locked ability list reveals the abilities');
    assert.equal(s.canDo.teaser, JOURNEY_TEASERS.canDo);
    assert.equal(s.thenNow.teaser, JOURNEY_TEASERS.thenNow);
    assert.deepEqual(s.used.chips, []);
    assert.equal(s.used.usedLine, null, 'a locked phrases part says no count');
    assert.equal(s.used.heldLine, null);
    assert.equal(s.used.featured, null);
    assert.equal(s.used.teaser, JOURNEY_TEASERS.used);
    assert.equal(s.help.line, JOURNEY_TEASERS.help, 'the locked help card says the week\'s help');
    assert.deepEqual(s.sounds.rows, []);
    assert.equal(s.sounds.teaser, JOURNEY_TEASERS.sounds);
    assert.deepEqual(s.week.rows, []);
    assert.equal(s.week.teaser, JOURNEY_TEASERS.week);
    for (const line of Object.values(JOURNEY_TEASERS)) assert.doesNotMatch(line, /—|·|\d/, 'a teaser carries an em dash, a middot or a count');
    assert.equal(s.thenNowScreen.locked, true);
    assert.equal(s.replay.locked, true);
    assert.deepEqual(s.tiles.map((t) => t.locked), [true, true, false]);
    assert.equal(s.fixes, true);
  });

  test('every locked tap opens the Wall: a locked route, or a route-less feature the tab gates', () => {
    setStanding('u1', FREE);
    const s = surfaces();
    // Route-less: the tab hands these to tapThrough or to the teaser's open.
    assert.equal(s.replay.feature, 'continueArc');
    for (const key of ['canDo', 'used', 'help', 'week'] as const) assert.equal(s[key].feature, 'fullJourney');
    assert.equal(s.thenNow.feature, 'thenAndNow');
    assert.equal(s.sounds.feature, 'sounds');
    // Routed: App.tsx's guard sends each to Wall { entry: 'locked', feature } (F910).
    for (const tile of s.tiles.filter((t) => t.locked)) assert.notEqual(lockedRouteFeature(tile.route.screen), null, `${tile.key} is badged but its route is free`);
    assert.notEqual(lockedRouteFeature(s.thenNow.route.screen), null);
    assert.notEqual(lockedRouteFeature(s.sounds.practise.screen), null);
    assert.equal(lockedRouteFeature('Fixes', { packId: 'p' }), 'fixes');
    assert.equal(lockedRouteFeature('ThenNow'), 'thenAndNow');
  });

  test('main\'s hook opens the locked door of the Wall, which access/ hands every surface', () => {
    const hook = readFileSync(new URL('../purchases/useFeatureLocks.ts', import.meta.url), 'utf8');
    assert.match(hook, /const open = useCallback\(\(feature: LockedFeature\) => nav\.navigate\('Wall', \{ entry: 'locked', feature \}\)/);
    const ours = readFileSync(new URL('./useFeatureAccess.ts', import.meta.url), 'utf8');
    assert.match(ours, /open: locks\.open/);
  });
});
