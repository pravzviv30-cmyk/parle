import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trackedEmailSignup } from './signupCompletion.ts';
import type { AuthResult } from './types.ts';

test('new email signup records authenticated ownership before releasing the routing hold', async () => {
  let creating = false;
  const events: string[] = [];
  const result = await trackedEmailSignup({
    signUpWithPassword: async () => { assert.equal(creating, true); events.push('session-event'); return {ok:true,createdUserId:'new-user'}; },
    getSession: async () => { assert.equal(creating, true); return {id:'new-user',email:'learner@example.com',provider:'password'}; },
  }, 'learner@example.com', 'example-only', {
    begin: () => { creating = true; events.push('begin'); },
    created: (id) => events.push(id),
    finish: () => { creating = false; events.push('finish'); },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(events, ['begin','session-event','new-user','finish']);
});

test('concurrent or existing provider sessions cannot adopt a new email signup plan', async () => {
  for (const session of [
    {id:'different-user',email:'learner@example.com',provider:'password' as const},
    {id:'new-user',email:'other@example.com',provider:'password' as const},
    {id:'new-user',email:'learner@example.com',provider:'google' as const},
  ]) {
    let claimed = false;
    await trackedEmailSignup({signUpWithPassword:async()=>({ok:true,createdUserId:'new-user'}),getSession:async()=>session},'learner@example.com','example-only',{begin:()=>{},created:()=>{claimed=true;},finish:()=>{}});
    assert.equal(claimed,false);
  }
});

test('failed or confirmation-pending signup never claims an authenticated new account', async () => {
  for (const result of [{ok:false,message:'Try again'},{ok:true,message:'Check your email'}] as AuthResult[]) {
    const events: string[] = [];
    await trackedEmailSignup({signUpWithPassword: async () => result,getSession: async () => {throw new Error('must not query a confirmation-pending session');}}, '', '', {begin:()=>events.push('begin'),created:()=>events.push('created'),finish:()=>events.push('finish')});
    assert.deepEqual(events,['begin','finish']);
  }
  const events: string[] = [];
  await assert.rejects(trackedEmailSignup({signUpWithPassword:async()=>{throw new Error('offline');},getSession:async()=>null},'','',{begin:()=>events.push('begin'),created:()=>events.push('created'),finish:()=>events.push('finish')}),/offline/);
  assert.deepEqual(events,['begin','finish']);
});
