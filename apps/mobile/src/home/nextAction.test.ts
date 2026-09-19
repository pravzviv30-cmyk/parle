import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homeActionFor } from './nextAction.ts';
import { fallbackHero } from './homeMission.ts';
test('Home keeps one next action: resume, first conversation, recall, then a fresh scene', () => {
  const hero = fallbackHero(Date.now());
  assert.equal(homeActionFor({...hero,kind:'first'},12),'conversation');
  assert.equal(homeActionFor({...hero,kind:'resume'},12),'conversation');
  // Only the discriminant is read by this policy.
  assert.equal(homeActionFor({...hero,kind:'today'},12),'review');
  assert.equal(homeActionFor({...hero,kind:'today'},0),'conversation');
});
