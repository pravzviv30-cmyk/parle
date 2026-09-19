import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankedFriends, utcWeek, socialPreview, socialUpdateCount, DEFAULT_SOCIAL_SETTINGS, type SocialSnapshot } from './socialModel.ts';
import { friendUsernameFromUrl } from './invite.ts';
const person=(id:string,points:number|null)=>({id,username:id,name:id,points,days:0,conversations:0});
test('Friends ranking respects ties, private scores and unchanged inputs',()=>{
 const input=[person('c',10),person('b',20),person('a',20),person('hidden',null)];
 assert.deepEqual(rankedFriends(input).map(p=>[p.id,p.rank]),[['a',1],['b',1],['c',3]]);
 assert.equal(input[0]!.id,'c');
});
test('everyone shares the same Monday UTC reset, including year boundaries',()=>{
 assert.equal(utcWeek(Date.parse('2027-01-03T23:59:59Z')).key,'2026-12-28');
 assert.equal(utcWeek(Date.parse('2027-01-04T00:00:00Z')).key,'2027-01-04');
});
test('friend invitations cannot intercept OAuth or navigate arbitrary URLs',()=>{
 assert.equal(friendUsernameFromUrl('luvani://invite/alice_7'),'alice_7');
 for(const url of ['luvani://auth/callback?code=test','https://evil.test/invite/alice','luvani://invite/a','luvani://invite/alice?token=secret']) assert.equal(friendUsernameFromUrl(url),null);
});
test('preview copy distinguishes sole first from tied first and badges honour privacy preferences',()=>{
 const s:SocialSnapshot={self:person('me',20),friends:[person('friend',10)],requests:[],challenges:[],notices:[],blocked:[],settings:{...DEFAULT_SOCIAL_SETTINGS,enabled:true},week:'2026-09-14',resets:'2026-09-21'};
 assert.match(socialPreview(s),/You are first/);
 s.friends[0]!.points=20; assert.match(socialPreview(s),/joint first/);
 s.notices=[{id:'n',actor:'Friend',actorId:'friend',kind:'milestone',body:'Practised',read:false,week:s.week,reactions:[]}];
 assert.equal(socialUpdateCount(s),0); s.settings.milestones=true; assert.equal(socialUpdateCount(s),1);
 s.notices[0]!.read=true; assert.equal(socialUpdateCount(s),0);
});
