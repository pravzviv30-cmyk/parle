import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  splitCommands,
  findPushes,
  parsePushArgs,
  pushTargets,
  isMainRef,
  checkStamp,
  denyReason,
  hookDecision,
} from './push-check-guard.mjs';

const SCRIPT = fileURLToPath(new URL('./push-check-guard.mjs', import.meta.url));
const SHA = 'a'.repeat(40);

const stampOf = (checks, result = 'pass') => ({
  sha: SHA,
  result,
  checks: { gate: 'pass', playwright: 'n/a', backend: 'n/a', review: 'pass', security: 'n/a', ...checks },
});

// A fake git: one commit, a branch, and an optional stamp.
function fakeGit({ stamp = null, branch = 'claude/today-sky' } = {}) {
  return {
    resolveCommit: () => SHA,
    currentBranch: () => branch,
    readStamp: () => stamp,
  };
}

const bash = (command, cwd = '/work') => ({ tool_name: 'Bash', tool_input: { command }, cwd });

// ---- parsing ----

test('non-push commands are not pushes', () => {
  for (const cmd of [
    'git status',
    'git ls-remote origin',
    'echo git push',
    'echo "git push origin main"',
    "git commit -m 'git push later'",
    'ls # git push',
    'git push-not-a-thing',
  ]) {
    assert.deepEqual(findPushes(cmd, '/work'), [], cmd);
  }
});

test('quoted text stays one word', () => {
  assert.deepEqual(splitCommands('echo "a && b" ; ls'), [['echo', 'a && b'], ['ls']]);
});

test('compound cd plus env assignment parses dir, remote and refspec', () => {
  const [p] = findPushes(
    'cd /x && GIT_SSH_COMMAND="ssh -o A=1" git push -u origin claude/today-sky',
    '/work',
  );
  assert.equal(p.dir, '/x');
  assert.equal(p.remote, 'origin');
  assert.deepEqual(p.refspecs, ['claude/today-sky']);
});

test('relative cd resolves against cwd', () => {
  const [p] = findPushes('cd sub && git push', '/work');
  assert.equal(p.dir, resolve('/work', 'sub'));
});

test('git -C dir push', () => {
  const [p] = findPushes('git -C /other/tree push origin HEAD:main', '/work');
  assert.equal(p.dir, '/other/tree');
  assert.deepEqual(p.refspecs, ['HEAD:main']);
});

test('push inside bash -c and after a pipe are found', () => {
  assert.equal(findPushes('bash -c "cd /y && git push origin foo"', '/work')[0].dir, '/y');
  assert.equal(findPushes('true | git push', '/work').length, 1);
});

test('push option values and redirects are not refspecs', () => {
  const [p] = findPushes('git push -o ci.skip origin feat 2>&1', '/work');
  assert.equal(p.remote, 'origin');
  assert.deepEqual(p.refspecs, ['feat']);
});

test('deletes, tags-only and dry runs publish nothing', () => {
  for (const cmd of [
    'git push origin --delete old',
    'git push -d origin old',
    'git push origin :old',
    'git push --tags',
    'git push origin tag v1.0',
    'git push --dry-run origin main',
    'git push -n origin main',
  ]) {
    const [p] = findPushes(cmd, '/work');
    assert.deepEqual(pushTargets(p, 'feat'), [], cmd);
  }
  // tags plus a branch still publishes the branch
  assert.equal(pushTargets(parsePushArgs(['--tags', 'origin', 'feat']), 'x').length, 1);
});

test('main destinations', () => {
  assert.ok(isMainRef('main'));
  assert.ok(isMainRef('refs/heads/main'));
  assert.ok(!isMainRef('mainline'));
  assert.deepEqual(pushTargets(parsePushArgs(['origin', 'HEAD:main']), 'feat'), [{ src: 'HEAD', dst: 'main' }]);
  assert.deepEqual(pushTargets(parsePushArgs(['origin', 'main']), 'feat'), [{ src: 'main', dst: 'main' }]);
  assert.deepEqual(pushTargets(parsePushArgs(['origin', '+feat:refs/heads/main']), 'x'), [
    { src: 'feat', dst: 'refs/heads/main' },
  ]);
  assert.deepEqual(pushTargets(parsePushArgs(['origin']), 'main'), [{ src: 'HEAD', dst: 'main' }]);
  assert.deepEqual(pushTargets(parsePushArgs(['origin', 'HEAD']), 'main'), [{ src: 'HEAD', dst: 'main' }]);
});

// ---- decisions ----

test('stamp checks', () => {
  assert.equal(checkStamp(null, SHA, false).kind, 'missing');
  assert.equal(checkStamp({ ...stampOf({}), sha: 'b'.repeat(40) }, SHA, false).kind, 'missing');
  assert.deepEqual(checkStamp(stampOf({ gate: 'fail' }, 'fail'), SHA, false), {
    ok: false,
    kind: 'failed',
    failed: ['gate'],
  });
  assert.equal(checkStamp(stampOf({ security: 'n/a' }), SHA, true).kind, 'security');
  assert.ok(checkStamp(stampOf({}), SHA, false).ok);
  assert.ok(checkStamp(stampOf({ security: 'pass' }), SHA, true).ok);
});

test('hook allows non-push and non-Bash calls silently', () => {
  assert.equal(hookDecision(bash('git status'), fakeGit()), null);
  assert.equal(hookDecision(bash('echo git push'), fakeGit()), null);
  assert.equal(hookDecision({ tool_name: 'Read', tool_input: {} }, fakeGit()), null);
});

test('hook denies a push with no stamp', () => {
  const d = hookDecision(bash('git push -u origin claude/today-sky'), fakeGit());
  assert.match(d.reason, /aaaaaaa/);
  assert.match(d.reason, /claude\/today-sky/);
  assert.match(d.reason, /no push check yet/);
  assert.match(d.reason, /Run \/push-check/);
  assert.match(d.reason, /founder can still push from their own terminal/);
  assert.ok(!d.reason.includes('—'));
});

test('hook denies a failed stamp and names the failed check', () => {
  const d = hookDecision(bash('git push origin HEAD'), fakeGit({ stamp: stampOf({ review: 'fail' }, 'fail') }));
  assert.match(d.reason, /failed: review/);
});

test('hook denies a main push without a security review', () => {
  const d = hookDecision(bash('git push origin HEAD:main'), fakeGit({ stamp: stampOf({}) }));
  assert.match(d.reason, /security review/);
  assert.match(d.reason, /main/);
});

test('hook allows a branch push with a pass stamp and security n/a', () => {
  assert.equal(hookDecision(bash('git push origin HEAD'), fakeGit({ stamp: stampOf({}) })), null);
});

test('hook allows a main push with a security pass', () => {
  const stamp = stampOf({ security: 'pass' });
  assert.equal(hookDecision(bash('git push origin main'), fakeGit({ stamp })), null);
});

test('hook allows deletes and dry runs without any stamp', () => {
  assert.equal(hookDecision(bash('git push origin --delete old'), fakeGit()), null);
  assert.equal(hookDecision(bash('git push --dry-run'), fakeGit()), null);
});

test('denyReason with failed list', () => {
  assert.match(denyReason({ kind: 'failed', failed: ['gate', 'backend'] }, SHA, 'b'), /gate, backend/);
});

// ---- end to end ----

function runScript(args, { input, cwd } = {}) {
  return spawnSync('node', [SCRIPT, ...args], { input, cwd, encoding: 'utf8' });
}

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'push-check-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q', '-b', 'work');
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'one');
  return dir;
}

const hookInput = (command, cwd) => JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd });

test('end to end: deny, stamp, allow, and main needs security', () => {
  const dir = tempRepo();

  const denied = runScript(['hook'], { input: hookInput('git push -u origin work', dir) });
  assert.equal(denied.status, 0);
  const lines = denied.stdout.trim().split('\n');
  assert.equal(lines.length, 1);
  const out = JSON.parse(lines[0]).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /work/);

  const status = runScript(['status', '--dir', dir]);
  assert.equal(status.stdout.trim(), 'no stamp');

  const stamped = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--notes', 'ok', '--dir', dir]);
  assert.equal(stamped.status, 0, stamped.stderr);
  assert.match(stamped.stdout, /result: pass/);
  assert.ok(existsSync(stamped.stdout.split('\n')[0]));

  const allowed = runScript(['hook'], { input: hookInput('git push -u origin work', dir) });
  assert.equal(allowed.status, 0);
  assert.equal(allowed.stdout, '');

  // via a different working directory and cd
  const viaCd = runScript(['hook'], { input: hookInput(`cd ${dir} && git push origin HEAD`, '/') });
  assert.equal(viaCd.stdout, '');

  const mainDenied = runScript(['hook'], { input: hookInput('git push origin HEAD:main', dir) });
  assert.match(JSON.parse(mainDenied.stdout).hookSpecificOutput.permissionDecisionReason, /security review/);

  runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--security', 'pass', '--dir', dir]);
  const mainAllowed = runScript(['hook'], { input: hookInput('git push origin HEAD:main', dir) });
  assert.equal(mainAllowed.stdout, '');

  assert.match(runScript(['status', '--dir', dir]).stdout, /"result": "pass"/);
});

test('end to end: a failed stamp denies and names the check', () => {
  const dir = tempRepo();
  runScript(['stamp', '--gate', 'fail', '--review', 'pass', '--dir', dir]);
  const r = runScript(['hook'], { input: hookInput('git push origin work', dir) });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /failed: gate/);
});

test('end to end: guard errors allow', () => {
  assert.equal(runScript(['hook'], { input: 'not json' }).stdout, '');
  assert.equal(runScript(['hook'], { input: '' }).stdout, '');
  const notRepo = mkdtempSync(join(tmpdir(), 'push-check-norepo-'));
  const r = runScript(['hook'], { input: hookInput('git push origin x', notRepo) });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('stamp rejects bad args with a usage line', () => {
  const dir = tempRepo();
  for (const args of [
    ['--gate', 'pass'],
    ['--gate', 'n/a', '--review', 'pass'],
    ['--gate', 'maybe', '--review', 'pass'],
    ['--gate', 'pass', '--review', 'pass', '--bogus', 'x'],
  ]) {
    const r = runScript(['stamp', ...args, '--dir', dir]);
    assert.equal(r.status, 1, args.join(' '));
    assert.match(r.stderr, /usage:/);
  }
});
