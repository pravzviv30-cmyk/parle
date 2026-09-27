import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homeActionFor } from './nextAction.ts';
import { fallbackHero } from './homeMission.ts';
// 2026-09-27 (notebook Phase 3): the hero is a spine scene or, once the whole
// spine is earned, the day's scene. Recall can only stand in for the day's.
test('Today keeps one next action: the next scene, recall, then a fresh scene', () => {
  const hero = fallbackHero();
  assert.equal(homeActionFor({ ...hero, kind: 'scene' }, 12), 'conversation', 'recall replaced the next scene on the spine');
  // Only the discriminant is read by this policy.
  assert.equal(homeActionFor({ ...hero, kind: 'today' }, 12), 'review');
  assert.equal(homeActionFor({ ...hero, kind: 'today' }, 0), 'conversation');
});
