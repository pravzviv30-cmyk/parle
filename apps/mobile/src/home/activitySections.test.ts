import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usefulFriends, usefulPace } from './activitySections.ts';
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
test('Today at your pace needs timed activity, not merely an optional target', () => {
  const m = momentumFrom({activity:[],deck:[],profile:null,now:Date.now()});
  assert.equal(usefulPace(m),false);
  assert.equal(usefulPace({...m,goal:{...m.goal,target:10}}),false);
  assert.equal(usefulPace({...m,goal:{...m.goal,minutes:3}}),true);
});
