import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { usefulFriends } from './activitySections.ts';
import { DEFAULT_SOCIAL_SETTINGS, type SocialSnapshot } from '../friends/socialModel.ts';
test('Home hides empty social sections and only offers actionable or genuine activity', () => {
  const s: SocialSnapshot = {self:{id:'me',name:'Me',username:'me',points:0,days:0,conversations:0},friends:[],requests:[],challenges:[],notices:[],blocked:[],settings:{...DEFAULT_SOCIAL_SETTINGS},week:'2026-09-21',resets:''};
  assert.equal(usefulFriends(null),null); assert.equal(usefulFriends(s),null);
  s.settings.enabled=true; assert.equal(usefulFriends(s),null);
  s.requests=[{id:'r',name:'Friend',username:'friend',direction:'incoming'}]; assert.match(usefulFriends(s)!,/1 update/);
  s.settings.requests=false; assert.equal(usefulFriends(s),null);
  s.challenges=[{id:'c',partner:'Friend',partnerId:'f',status:'active',incoming:true,count:1,target:4,expires:''}]; assert.match(usefulFriends(s)!,/1 of 4/);
});
// Rewritten 2026-09-27 (notebook Phase 3, B1). The four momentum tiles left
// Today with the seven-dot rail: a first run met four empty tiles, and the
// "Practice time" tile said "Ready when you are". The optional target keeps its
// door on Profile, and the week is two plain sentences instead.
test('the four tiles and the seven-dot rail are gone from Today, and no pace card came back in their place', () => {
  const home = readFileSync(fileURLToPath(new URL('../tabs/HomeTab.tsx', import.meta.url)), 'utf8');
  assert.ok(!existsSync(fileURLToPath(new URL('./HomeMomentum.tsx', import.meta.url))), 'the four-tile block still ships and nothing on Today draws it');
  for (const gone of ['HomeMomentum', 'momentumFrom', 'WeekRail', 'Today, at your pace', 'usefulPace', 'Ready when you are']) {
    assert.ok(!home.includes(gone), `Today still carries ${gone}`);
  }
});
