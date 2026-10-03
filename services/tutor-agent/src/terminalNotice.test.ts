import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

test('terminal settlement still runs if publishing its failure notice throws', async () => {
  const source = readFileSync(new URL('./agent.ts', import.meta.url), 'utf8');
  const start = source.indexOf('      void Promise.resolve', source.indexOf('const prefix = recoverable'));
  assert.ok(start >= 0);
  const end = source.indexOf('.catch(() => {});', start) + '.catch(() => {});'.length;
  const js = stripTypeScriptTypes(`async function lifted() { ${source.slice(start, end).trim().replace(/^void /, 'return ')} }`);
  const body = js.slice(js.indexOf('{') + 1, js.lastIndexOf('}'));
  for (const how of ['throw', 'reject', 'success']) {
    const events: string[] = [];
    class LuvaniConversation { cancelCanDoEvidence() { events.push('cancel-evidence'); } cancelLiveReplies() { events.push('cancel'); } async finish() { events.push('settle'); } }
    const execute = new Function('publish', 'serviceFailure', 'kind', 'recoverable', 'hardStop', 'clearTimeout', 'tutor', 'LuvaniConversation', 'ctx', body);
    await execute(() => { events.push('notice'); if (how === 'throw') throw new Error('Synthetic publish failure'); return how === 'reject' ? Promise.reject(new Error('Synthetic rejection')) : Promise.resolve(); }, 'tts_error', 'tts_error', false, null, () => {}, new LuvaniConversation(), LuvaniConversation, { room: { disconnect: () => events.push('disconnect') } });
    assert.ok(events.includes('settle'), how);
    assert.ok(events.indexOf('cancel-evidence') >= 0 && events.indexOf('cancel-evidence') < events.indexOf('settle'));
    assert.ok(events.indexOf('disconnect') > events.indexOf('settle'), 'disconnect cannot precede settlement');
  }
});
