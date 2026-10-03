import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Exercise the real supervisor with local fixture children and no keys or services. */
async function refusedBoot(kind: 'occupied' | 'timeout') {
  const root = await mkdtemp(join(tmpdir(), 'luvani-dev-shutdown-'));
  let childPid: number | undefined;
  const supervisorSource = await readFile(new URL('../../../scripts/dev.mjs', import.meta.url), 'utf8');
  try {
    await mkdir(join(root, 'scripts'));
    await mkdir(join(root, 'services/shared'), { recursive: true });
    await writeFile(join(root, 'scripts/dev.mjs'), supervisorSource);
    const pidFile = join(root, 'child.pid');
    const childFile = join(root, 'child.mjs');
    await writeFile(childFile, `
      import { writeFileSync } from 'node:fs';
      ${kind === 'occupied' ? "process.on('SIGTERM', () => {});" : ''}
      writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      console.log('fixture ready');
      setInterval(() => {}, 1000);
    `);
    // Only the plan is substituted. Launch, stream handling, readiness, refusal,
    // process groups and shutdown execute the checked-in supervisor unchanged.
    await writeFile(join(root, 'services/shared/devPlan.ts'), `
      export const parseEnvFile = () => ({});
      export const envGaps = () => [];
      export const sharedAgentSecret = () => ({ value: 'local-test', mismatch: false, generated: false });
      export const bootPlan = () => [
        { id: 'agent', label: 'fixture', command: ${JSON.stringify(process.execPath)}, args: [${JSON.stringify(childFile)}], port: null,
          ready: { kind: 'stdout', pattern: /${kind === 'occupied' ? 'fixture ready' : 'never ready'}/, timeoutMs: 1000, fatalOnTimeout: true }, identify: () => false },
        { id: 'app', label: 'app', command: 'must-not-start', args: [], port: 8082,
          ready: { kind: 'http', url: 'data:text/plain,existing-preview' }, identify: () => true }
      ];
      export const classifyPort = step => step.id === 'app'
        ? { kind: 'occupied', message: 'Existing preview checkout cannot be verified on 8082.' }
        : { kind: 'spawn' };
    `);
    const supervisor = spawn(process.execPath, ['--experimental-strip-types', join(root, 'scripts/dev.mjs')], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, LUVANI_DURABLE_PRACTICE: '0' },
    });
    let output = '';
    supervisor.stdout.on('data', chunk => { output += chunk; });
    supervisor.stderr.on('data', chunk => { output += chunk; });
    const code = await new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => { supervisor.kill('SIGKILL'); reject(new Error(output || 'Supervisor hung')); }, 12_000);
      supervisor.on('error', error => { clearTimeout(timer); reject(error); });
      supervisor.on('close', exitCode => { clearTimeout(timer); resolve(exitCode); });
    });
    childPid = Number(await readFile(pidFile, 'utf8'));
    assert.equal(code, 1, `a refused launch must report failure: ${output}`);
    assert.doesNotMatch(output, /Luvani is up/);
    assert.match(output, kind === 'occupied' ? /checkout cannot be verified/ : /did not come up/);
    assert.throws(() => process.kill(childPid!, 0), { code: 'ESRCH' }, 'the supervisor left its fixture service running');
  } finally {
    // Even the old broken supervisor must not leak a test process.
    if (childPid === undefined) {
      try { childPid = Number(await readFile(join(root, 'child.pid'), 'utf8')); } catch { /* child never started */ }
    }
    if (childPid) { try { process.kill(-childPid, 'SIGKILL'); } catch { /* already reaped */ } }
    await rm(root, { recursive: true, force: true });
  }
}

test('refusing an occupied preview reaps even a service that ignores SIGTERM', { timeout: 15_000 }, async () => {
  await refusedBoot('occupied');
});

test('a readiness timeout reports failure even when its service exits promptly', { timeout: 15_000 }, async () => {
  await refusedBoot('timeout');
});
