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

const stampOf = (checks, result = 'pass', sha = SHA) => ({
  sha,
  result,
  checks: { gate: 'pass', playwright: 'n/a', backend: 'n/a', review: 'pass', security: 'n/a', ...checks },
});

// A fake git. `refs` maps a ref to its sha (anything else resolves to SHA);
// `stamps` maps a sha to its stamp; `stamp` is shorthand for stamps[SHA];
// `missing` lists refs that do not exist; `tags` lists tag-only names.
function fakeGit({ stamp = null, stamps = {}, refs = {}, missing = [], tags = [], branch = 'claude/today-sky' } = {}) {
  return {
    resolveCommit: (_dir, rev) => {
      if (missing.includes(rev)) throw new Error('unknown revision');
      return refs[rev] ?? SHA;
    },
    currentBranch: () => branch,
    readStamp: (_dir, sha) => stamps[sha] ?? (sha === SHA ? stamp : null),
    isTagOnly: (_dir, name) => tags.includes(name),
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
  assert.deepEqual(pushTargets(parsePushArgs(['origin', 'HEAD:main']), 'feat'), [{ src: 'HEAD', dst: 'main', bare: false }]);
  assert.deepEqual(pushTargets(parsePushArgs(['origin', 'main']), 'feat'), [{ src: 'main', dst: 'main', bare: true }]);
  assert.deepEqual(pushTargets(parsePushArgs(['origin', '+feat:refs/heads/main']), 'x'), [
    { src: 'feat', dst: 'refs/heads/main', bare: false },
  ]);
  assert.deepEqual(pushTargets(parsePushArgs(['origin']), 'main'), [{ src: 'HEAD', dst: 'main' }]);
  assert.deepEqual(pushTargets(parsePushArgs(['origin', 'HEAD']), 'main'), [{ src: 'HEAD', dst: 'main', bare: false }]);
  assert.ok(isMainRef('heads/main'));
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

test('end to end: unparsable stdin allows, an unresolvable push denies', () => {
  assert.equal(runScript(['hook'], { input: 'not json' }).stdout, '');
  assert.equal(runScript(['hook'], { input: '' }).stdout, '');
  const notRepo = mkdtempSync(join(tmpdir(), 'push-check-norepo-'));
  const r = runScript(['hook'], { input: hookInput('git push origin x', notRepo) });
  assert.equal(r.status, 0);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /could not tell/);
});

test('end to end: commit then push in one call is denied, even with a stamp on HEAD', () => {
  const dir = tempRepo();
  runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--dir', dir]);
  const r = runScript(['hook'], {
    input: hookInput('git commit --allow-empty -m x && git push origin work', dir),
  });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /its own command/);
});

test('end to end: a glob refspec is denied', () => {
  const dir = tempRepo();
  runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--dir', dir]);
  const r = runScript(['hook'], { input: hookInput("git push origin 'refs/heads/*:refs/heads/*'", dir) });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /could not tell/);
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

test('heredoc bodies are data, never pushes', () => {
  assert.deepEqual(findPushes('cat <<EOF > notes.md\ngit push origin main\nEOF', '/tmp'), []);
  assert.deepEqual(findPushes("cat <<-'EOF'\n\tgit push origin main\n\tEOF\necho done", '/tmp'), []);
  // A real push after the body is still found.
  const pushes = findPushes("git commit -F - <<'EOF'\ngit push origin main\nEOF\ngit push origin claude/x", '/tmp');
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].refspecs, ['claude/x']);
});

test('a stamp that skips the gate or the review is not a pass', () => {
  assert.deepEqual(checkStamp(stampOf({ gate: 'n/a' }), SHA, false), { ok: false, kind: 'failed', failed: ['gate'] });
  assert.deepEqual(checkStamp(stampOf({ review: undefined }), SHA, false), { ok: false, kind: 'failed', failed: ['review'] });
  assert.deepEqual(checkStamp(stampOf({}), SHA, false), { ok: true });
});

// ---- review round ----

const reasonOf = (command, g = fakeGit({ stamp: stampOf({ security: 'pass' }) })) =>
  hookDecision(bash(command), g)?.reason ?? null;

test('an earlier git command that moves HEAD makes the push unjudgeable', () => {
  for (const cmd of [
    'git commit -m x && git push',
    'git switch main && git push',
    'git checkout main; git push origin',
    'git -C /w merge feat && git push origin HEAD',
    'git stash pop && git push',
    'git worktree add ../w && git push',
    'git branch -f main HEAD && git push',
    'bash -c "git reset --hard && git push"',
    'git rebase main\ngit push',
  ]) {
    assert.match(reasonOf(cmd), /its own command/, cmd);
  }
  // Harmless earlier commands, and a mover that comes after the push, are fine.
  for (const cmd of ['git status && git push', 'git fetch && git push', 'git push && git commit -m x', 'git stash && git push']) {
    assert.equal(reasonOf(cmd), null, cmd);
  }
  // A mover with a delete-only push publishes nothing.
  assert.equal(reasonOf('git switch x && git push origin --delete old'), null);
});

test('shell keywords, sudo, git by path and shell flag clusters', () => {
  const noStamp = fakeGit();
  for (const cmd of [
    'if true; then git push; fi',
    'for b in a b; do git push origin $b; done',
    'while true; do git push; done',
    '! git push',
    '{ git push; }',
    'sudo git push',
    '/usr/bin/git push',
    'bash -lc "git push"',
    'sh -ec "git push origin foo"',
    '/bin/zsh -c "git push"',
  ]) {
    assert.match(reasonOf(cmd, noStamp), /no push check yet/, cmd);
  }
});

test('eval and xargs around git push are denied', () => {
  for (const cmd of ['eval "git push origin main"', 'eval git push', 'echo origin | xargs git push']) {
    assert.match(reasonOf(cmd), /its own command/, cmd);
  }
  assert.equal(reasonOf('eval "echo hi"'), null);
  assert.equal(reasonOf('echo x | xargs echo'), null);
});

test('unresolvable directories and refs deny with the plain-command reason', () => {
  for (const cmd of [
    'cd $(mktemp -d) && git push',
    'cd "$DIR" && git push origin foo',
    'cd - && git push',
    'git -C "$DIR" push',
    'git push origin refs/heads/*:refs/heads/*',
    'git push origin nope',
  ]) {
    assert.match(reasonOf(cmd, fakeGit({ missing: ['nope'], stamp: stampOf({}) })), /could not tell/, cmd);
  }
  // An absolute cd restores certainty.
  assert.equal(reasonOf('cd $(mktemp -d); cd /abs && git push', fakeGit({ stamp: stampOf({}) })), null);
});

test('a failing first push does not stop later pushes being checked', () => {
  const g = fakeGit({ missing: ['nope'], stamp: null });
  assert.match(reasonOf('git push origin nope; git push origin ok', g), /could not tell/);
  // The second push alone is judged on its own.
  assert.match(reasonOf('git push origin ok', g), /no push check yet/);
  // And a bad first push cannot hide a stamped second one from being allowed alone.
  const withStamp = fakeGit({ stamp: stampOf({}) });
  assert.equal(reasonOf('git push origin ok', withStamp), null);
});

test('a subshell cd does not leak past the closing paren', () => {
  const [inside, after] = findPushes('(cd /sub && git push a); git push b', '/work');
  assert.equal(inside.dir, '/sub');
  assert.equal(after.dir, resolve('/work'));
  const [p] = findPushes('echo $(cd /sub) && git push', '/work');
  assert.equal(p.dir, resolve('/work'));
  // an unknown directory inside a subshell does not spoil the outer one
  const [q] = findPushes('(cd $X); git push', '/work');
  assert.ok(q.dirKnown);
});

test('--repo names the remote, so every positional arg is a refspec', () => {
  const a = parsePushArgs(['--repo=origin', 'feat']);
  assert.equal(a.remote, 'origin');
  assert.deepEqual(a.refspecs, ['feat']);
  const b = parsePushArgs(['--repo', 'origin', 'feat', 'main']);
  assert.equal(b.remote, 'origin');
  assert.deepEqual(b.refspecs, ['feat', 'main']);
  // so a lone positional is a refspec that must be checked, not skipped as the remote
  const d = hookDecision(bash('git push --repo origin main'), fakeGit({ stamp: stampOf({}) }));
  assert.match(d.reason, /security review/);
});

test('a bare tag name publishes no branch', () => {
  const g = fakeGit({ tags: ['v1.0'] });
  assert.equal(hookDecision(bash('git push origin v1.0'), g), null);
  // not tag-only: it is a branch, so it is judged
  assert.match(hookDecision(bash('git push origin v2.0'), g).reason, /no push check yet/);
  // an explicit refspec to a branch is still judged
  assert.match(hookDecision(bash('git push origin v1.0:release'), g).reason, /no push check yet/);
});

test('a non-HEAD ref is judged by its own stamp', () => {
  const OTHER = 'c'.repeat(40);
  const g = fakeGit({ refs: { feat: OTHER }, stamps: { [SHA]: stampOf({}) } });
  // HEAD has a stamp, feat does not
  assert.equal(hookDecision(bash('git push origin HEAD'), g), null);
  assert.match(hookDecision(bash('git push origin feat'), g).reason, /ccccccc/);
  const both = fakeGit({
    refs: { feat: OTHER },
    stamps: { [OTHER]: stampOf({}, 'pass', OTHER) },
  });
  assert.equal(hookDecision(bash('git push origin feat'), both), null);
  assert.match(hookDecision(bash('git push origin HEAD'), both).reason, /aaaaaaa/);
});
