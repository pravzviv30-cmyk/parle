import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertDevelopmentPaidTool } from './standalonePaidTool.ts';

test('standalone tools refuse production even when development flags are present', () => {
  assert.throws(() => assertDevelopmentPaidTool({NODE_ENV:'production',LUVANI_LOCAL_DEVELOPMENT:'1'}), /refused in production/);
  assert.doesNotThrow(() => assertDevelopmentPaidTool({NODE_ENV:'development'}));
});
test('actual warm-cache, sample generator and native worker entry points stop before any network effect', () => {
  const intercept = 'import net from "node:net"; import tls from "node:tls"; const fail=()=>{throw new Error("NETWORK_TRIPWIRE");}; net.Socket.prototype.connect=fail; tls.connect=fail; globalThis.fetch=fail;';
  for(const file of ['warmCache.ts','voiceSamples.ts','nativeEvalAgent.ts']) {
    const result=spawnSync(process.execPath,['--import',`data:text/javascript,${encodeURIComponent(intercept)}`,fileURLToPath(new URL(file,import.meta.url))],{
      env:{PATH:process.env.PATH,NODE_ENV:'production'},encoding:'utf8',timeout:15000,maxBuffer:128*1024,
    });
    assert.equal(result.error,undefined,`${file} must exit promptly`);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Standalone paid tool refused in production/);
    assert.doesNotMatch(result.stderr,/NETWORK_TRIPWIRE/);
  }
});
