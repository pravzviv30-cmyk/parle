import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { usefulFriends } from './activitySections.ts';
import { DEFAULT_SOCIAL_SETTINGS, type SocialSnapshot } from '../friends/socialModel.ts';
import { momentumFrom } from '../progress/momentum.ts';
test('Home hides empty social sections and only offers actionable or genuine activity', () => {
  const s: SocialSnapshot = {self:{id:'me',name:'Me',username:'me',points:0,days:0,conversations:0},friends:[],requests:[],challenges:[],notices:[],blocked:[],settings:{...DEFAULT_SOCIAL_SETTINGS},week:'2026-09-21',resets:''};
  assert.equal(usefulFriends(null),null); assert.equal(usefulFriends(s),null);
  s.settings.enabled=true; assert.equal(usefulFriends(s),null);
  s.requests=[{id:'r',name:'Friend',username:'friend',direction:'incoming'}]; assert.match(usefulFriends(s)!,/1 update/);
  s.settings.requests=false; assert.equal(usefulFriends(s),null);
  s.challenges=[{id:'c',partner:'Friend',partnerId:'f',status:'active',incoming:true,count:1,target:4,expires:''}]; assert.match(usefulFriends(s)!,/1 of 4/);
});
// Rewritten 2026-09-25 (whole-app Stage 3A). The separate "Today, at your
// pace" card left Home: it opened the same Profile target as the Practice
// time tile, so it was a second door to one setting. The tile carries the same
// measured amount, so nothing the card said is lost; this now holds the tile
// as the one door and keeps the pace card, and its gate, from coming back.
test('the optional target has one door on Home, the Practice time tile', () => {
  const home = readFileSync(fileURLToPath(new URL('../tabs/HomeTab.tsx', import.meta.url)), 'utf8');
  const tile = readFileSync(fileURLToPath(new URL('./HomeMomentum.tsx', import.meta.url)), 'utf8');
  assert.ok(!home.includes('Today, at your pace'), 'the pace card is back beside the tile that already opens the target');
  assert.ok(!home.includes('usefulPace'), 'Home gates a second target card again');
  assert.match(tile, /onPress=\{onTarget\}/, 'the Practice time tile no longer opens the target');
  // The tile still says the measured amount the card used to repeat.
  const m = momentumFrom({activity:[],deck:[],profile:null,now:Date.now()});
  assert.match(tile, /goal\.measured/, 'the tile stopped drawing the measured practice time');
  assert.equal(m.goal.measured, null, 'a day with no timed practice claims a measured amount');
});
