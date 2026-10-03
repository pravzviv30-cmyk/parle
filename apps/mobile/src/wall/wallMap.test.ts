import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { MISSIONS } from '@luvani/core';
import { WELCOME_PATH, beyondWelcomePath, onWelcomePath, welcomeMissions } from './welcomePath.ts';

// The map UI retired on 2026-09-27. Its surviving catalogue invariants still run.
test('every situation is either on the path or beyond it, and none is both', () => {
  const beyond = beyondWelcomePath().map(mission => mission.id);
  assert.equal(WELCOME_PATH.length, 4);
  assert.equal(beyond.length, MISSIONS.length - WELCOME_PATH.length);
  assert.deepEqual([...WELCOME_PATH, ...beyond].sort(), MISSIONS.map(mission => mission.id).sort());
  for (const id of WELCOME_PATH) assert.equal(onWelcomePath(id), true);
  for (const id of beyond) assert.equal(onWelcomePath(id), false);
});
test('the two held back are authored, so the wall can name what it is offering', () => {
  for (const mission of beyondWelcomePath()) {
    assert.ok(mission.goalEn.length > 0);
    assert.ok(mission.winEn.length > 0);
  }
});
test('the path opens on the cafe, for the reason the catalogue gives about itself', () => {
  assert.equal(WELCOME_PATH[0], 'mission:cafe');
  assert.equal(welcomeMissions()[0]?.id, 'mission:cafe');
  assert.deepEqual(welcomeMissions().map(mission => mission.id), [...WELCOME_PATH]);
});
test('the path climbs, rather than putting both A1 rooms first', () => {
  assert.deepEqual(welcomeMissions().map(mission => mission.cefr), ['A0', 'A0', 'A1', 'A1']);
});
test('the retired map and French wall pages have no source, renderer or analytics page', () => {
  for (const name of ['wallMap.ts', 'wallFrench.ts', 'WallMapPage.tsx', 'WallFrenchPage.tsx']) {
    assert.equal(existsSync(new URL(name, import.meta.url)), false, `${name} must stay retired`);
  }
  const screen = readFileSync(new URL('WallScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(screen, /WallMapPage|WallFrenchPage|wallMap\(|wallFrench\(/);
  const pages = readFileSync(new URL('wallPages.ts', import.meta.url), 'utf8');
  assert.match(pages, /export type WallPage = 'yours' \| 'plans';/);
  const events = readFileSync(new URL('../analytics/track.ts', import.meta.url), 'utf8');
  assert.match(events, /name: 'wall_page_seen'; properties: \{ page: 'yours' \| 'plans'; index: number \}/);
});
