import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privacyJobs } from './privacyJobs.ts';
const id = '11111111-1111-4111-8111-111111111111';
test('billing-disabled erasure skips processor and makes the admin delete retry-safe', async () => {
  const stages: string[] = [];
  const request: typeof fetch = async (url, init) => {
    const path = String(url);
    assert.ok(!path.includes('revenuecat'));
    if (path.includes('claim_account')) return Response.json({ kind: 'claimed', userId: id, lease: id, processorRequired: false, processorAccepted: false });
    if (path.includes('advance_account')) { stages.push(JSON.parse(String(init?.body)).p_stage); return Response.json({ kind: 'recorded' }); }
    assert.equal(init?.method, 'DELETE'); return new Response(null, { status: 404 });
  };
  assert.equal(await privacyJobs('https://db.test', 'secret', undefined, request, {record:async()=>{},complete:async()=>{}}).process(), 'complete');
  assert.deepEqual(stages, ['identity-deleted']);
});
test('processor refusal is durably retried without deleting the identity', async () => {
  const stages: string[] = [];
  const request: typeof fetch = async (url, init) => {
    const path = String(url);
    if (path.includes('claim_account')) return Response.json({ kind: 'claimed', userId: id, lease: id, processorRequired: true, processorAccepted: false });
    if (path.includes('advance_account')) { stages.push(JSON.parse(String(init?.body)).p_stage); return Response.json({ kind: 'recorded' }); }
    assert.ok(path.includes('revenuecat')); return new Response(null, { status: 503 });
  };
  assert.equal(await privacyJobs('https://db.test', 'secret', 'processor-secret', request, {record:async()=>{},complete:async()=>{}}).process(), 'retry');
  assert.deepEqual(stages, ['processor-failed']);
});
test('a missing or failed independent journal never erases a processor or login', async () => {
  for (const journal of [undefined,{record:async()=>{throw new Error('storage offline');},complete:async()=>assert.fail('never marked')}]) {
    const stages: string[]=[];
    const request: typeof fetch=async(url,init)=>{
      if (String(url).includes('claim_account')) return Response.json({kind:'claimed',userId:id,lease:id,processorRequired:true,processorAccepted:false});
      assert.ok(String(url).includes('advance_account'),'no vendor or identity call before journal acknowledgement');
      stages.push(JSON.parse(String(init?.body)).p_stage);return Response.json({kind:'recorded'});
    };
    assert.equal(await privacyJobs('https://db.test','secret','processor-secret',request,journal).process(),'retry');
    assert.deepEqual(stages,['storage-failed']);
  }
});
test('an erasure marks its journal entry complete after the identity is gone and before the job is', async () => {
  const events: string[] = [];
  const request: typeof fetch = async (url, init) => {
    const path = String(url);
    if (path.includes('claim_account')) return Response.json({ kind: 'claimed', userId: id, lease: id, processorRequired: false, processorAccepted: false });
    if (path.includes('advance_account')) { events.push(`stage:${JSON.parse(String(init?.body)).p_stage}`); return Response.json({ kind: 'recorded' }); }
    assert.equal(init?.method, 'DELETE'); events.push('identity'); return new Response(null, { status: 200 });
  };
  const journal = { record: async (user: string) => { events.push(`record:${user}`); }, complete: async (user: string) => { events.push(`complete:${user}`); } };
  assert.equal(await privacyJobs('https://db.test', 'secret', undefined, request, journal).process(), 'complete');
  assert.deepEqual(events, [`record:${id}`, 'identity', `complete:${id}`, 'stage:identity-deleted']);
});
test('a failed completion mark leaves the job retrying and never completes it', async () => {
  const events: string[] = [];
  const request: typeof fetch = async (url, init) => {
    const path = String(url);
    if (path.includes('claim_account')) return Response.json({ kind: 'claimed', userId: id, lease: id, processorRequired: false, processorAccepted: false });
    if (path.includes('advance_account')) { events.push(`stage:${JSON.parse(String(init?.body)).p_stage}`); return Response.json({ kind: 'recorded' }); }
    events.push('identity'); return new Response(null, { status: 200 });
  };
  const journal = { record: async () => {}, complete: async () => { throw new Error('journal-complete-unavailable'); } };
  assert.equal(await privacyJobs('https://db.test', 'secret', undefined, request, journal).process(), 'retry');
  assert.deepEqual(events, ['identity', 'stage:storage-failed']);
});
