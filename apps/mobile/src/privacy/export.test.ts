import assert from 'node:assert/strict';
import { beforeEach,test } from 'node:test';
import {createHash} from 'node:crypto';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { setActiveUser, USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { downloadAccountData, downloadVerifiedAccountData } from './export.ts';

const exportId='11111111-1111-4111-8111-111111111111';
const sha256=async(bytes:Uint8Array)=>new Uint8Array(createHash('sha256').update(bytes).digest());
beforeEach(()=>setActiveUser('learner-1'));
const user: AuthUser = { id: 'learner-1', email: 'l@example.com', provider: 'password' };

function adapter(kind: 'supabase' | 'mock', token: string | null): AuthAdapter {
  return {
    kind,
    getSession: async () => user,
    onAuthStateChange: () => () => {},
    signUpWithPassword: async () => ({ ok: true }),
    signInWithPassword: async () => ({ ok: true }),
    signInWithGoogle: async () => ({ ok: true }),
    signInWithApple: async () => ({ ok: true }),
    sendPasswordReset: async () => ({ ok: true }),
    reauthenticateForDeletion: async () => ({ ok: true }),
    deleteAccount: async () => ({ ok: true }),
    signOut: async () => {},
    getAccessToken: async () => token,
  };
}

test('the data export combines every user-scoped device key with the verified streamed server copy', async () => {
  const data=Buffer.from('{"kind":"manifest","server":"snapshot"}\n');const partHash=createHash('sha256').update(data).digest();
  const root=createHash('sha256').update(Buffer.concat([createHash('sha256').update(Buffer.alloc(0)).digest(),partHash])).digest('hex');
  const written:Uint8Array[]=[];let shared=false;let discarded=false;let purged=false;const keysSeen:string[]=[];
  const result = await downloadAccountData(user, adapter('supabase', 'bearer-secret'), {
    exportId:()=>exportId,sha256,
    request: (async (input, init) => {
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer bearer-secret');
      if(init?.method==='DELETE'){purged=true;return Response.json({kind:'purged'});}
      if(init?.method==='POST')return Response.json({kind:'ready',version:2,exportId,format:'luvani-account-export-ndjson-v2',hashAlgorithm:'sha256-chain-v1',totalBytes:data.length,totalParts:1,rootSha256:root,expiresAt:new Date(Date.now()+60000).toISOString()});
      assert.match(String(input),/\/account\/export-v2\/.*\?part=0$/);
      return Response.json({kind:'part',version:2,exportId,part:0,totalParts:1,bytes:data.length,sha256:partHash.toString('hex'),dataBase64:data.toString('base64'),nextPart:null});
    }) as typeof fetch,
    readDevice: async (keys) => {
      assert.equal(keys.length,1);keysSeen.push(...keys);assert.ok(keys[0]!.startsWith('luvani.u.learner-1.'));
      return keys.map(key=>[key,key.endsWith('.profile')?'{"name":"Ada"}':null] as const);
    },
    createFile:async expected=>{assert.equal(expected,data.length);return {append:async bytes=>{written.push(new Uint8Array(bytes));},share:async()=>{shared=true;},discard:async()=>{discarded=true;}};},
    save:async()=>assert.fail('server export must stream'),
  });
  assert.deepEqual(result,{ok:true});assert.equal(shared,true);assert.equal(discarded,true);assert.equal(purged,true);
  assert.equal(keysSeen.length,USER_KEY_SUFFIXES.length);
  const lines=Buffer.concat(written).toString().trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(lines[0].server,'snapshot');assert.deepEqual(lines.slice(1).map(row=>row.key),[...USER_KEY_SUFFIXES]);
  assert.deepEqual(lines[1].value,{name:'Ada'});assert.equal(Buffer.concat(written).includes('bearer-secret'),false);
});

test('a device-only development account exports without pretending there is a server copy', async () => {
  let requested = false;
  let saved = '';
  const result = await downloadAccountData(user, adapter('mock', null), {
    request: (async () => { requested = true; return new Response(); }) as typeof fetch,
    readDevice: async (keys) => keys.map((key) => [key, null] as const),
    save: async (_filename, content) => { saved = content; },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(requested, false);
  assert.equal(JSON.parse(saved).serverData, null);
});

test('a signed-out server export fails before sending a request', async () => {
  let requested = false;
  const result = await downloadAccountData(user, adapter('supabase', null), {
    request: (async () => { requested = true; return new Response(); }) as typeof fetch,
    readDevice: async (keys) => keys.map((key) => [key, null] as const),
    save: async () => {},
  });
  assert.deepEqual(result, { ok: false, message: 'Sign in again, then ask for your data.' });
  assert.equal(requested, false);
});


test('a changed account cannot share an earlier account export', async () => {
  setActiveUser(user.id);
  let saved = false;
  const result = await downloadAccountData(user, adapter('supabase', 'token'), {
    exportId:()=>exportId,sha256,
    readDevice: async keys => keys.map(key => [key, null] as const),
    request: (async () => { setActiveUser('other-account'); return new Response('{}'); }) as typeof fetch,
    save: async () => { saved = true; },
  });
  assert.equal(result.ok, false);
  assert.equal(saved, false);
});

test('a refused export reauthentication sends no request and writes no file', async () => {
  const auth = adapter('supabase', 'token');
  let requested = false;
  let saved = false;
  auth.reauthenticateForDeletion = async (secret, purpose) => {
    assert.equal(secret, 'entered-password'); assert.equal(purpose, 'export');
    return { ok: false, message: 'Please check your password.' };
  };
  assert.deepEqual(await downloadVerifiedAccountData(user, auth, 'entered-password', {
    request: (async () => { requested = true; return new Response('{}'); }) as typeof fetch,
    save: async () => { saved = true; },
  }), { ok: false, message: 'Please check your password.' });
  assert.equal(requested, false); assert.equal(saved, false);
});

test('a stale sign-in export asks for confirmation instead of hiding the recovery', async () => {
  const result = await downloadAccountData(user, adapter('supabase', 'token'), {
    exportId:()=>exportId,sha256,
    readDevice: async () => [], request: (async () => new Response('', { status: 403 })) as typeof fetch,
    save: async () => { assert.fail('refused export shared a file'); },
  });
  assert.deepEqual(result, { ok: false, message: 'Sign in again to confirm it is you, then download your data.' });
});
