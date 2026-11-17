import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
  touchesFrontend,
  isDocPath,
  CHECK_NAMES,
} from './push-check-guard.mjs';

const SCRIPT = fileURLToPath(new URL('./push-check-guard.mjs', import.meta.url));
const SHA = 'a'.repeat(40);

const stampOf = (checks, result = 'pass', sha = SHA) => ({
  sha,
  result,
  checks: { gate: 'pass', playwright: 'n/a', backend: 'n/a', review: 'pass', security: 'n/a', impeccable: 'n/a', unslop: 'n/a', ...checks },
});

// A fake git. `refs` maps a ref to its sha (anything else resolves to SHA);
// `stamps` maps a sha to its stamp; `stamp` is shorthand for stamps[SHA];
// `missing` lists refs that do not exist; `tags` lists tag-only names.
function fakeGit({ stamp = null, stamps = {}, refs = {}, missing = [], tags = [], branch = 'claude/today-sky', frontend = false, codePaths = [], pr = null, local = false } = {}) {
  return {
    hasCommit: () => local,
    codePathsAt: () => codePaths,
    prInfo: (_dir, selector, repo) => {
      if (typeof pr === 'function') return pr(selector, repo);
      if (!pr) throw new Error('no PR');
      return pr;
    },
    resolveCommit: (_dir, rev) => {
      if (missing.includes(rev)) throw new Error('unknown revision');
      return refs[rev] ?? SHA;
    },
    currentBranch: () => branch,
    readStamp: (_dir, sha) => stamps[sha] ?? (sha === SHA ? stamp : null),
    isTagOnly: (_dir, name) => tags.includes(name),
    touchesFrontendAt: () => frontend,
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

test('wrapped pushes are still seen', () => {
  for (const c of ['timeout 60 git push origin feat', 'caffeinate git push origin feat', 'nice -n 5 git push origin feat']) {
    const pushes = findPushes(c, '/tmp');
    assert.equal(pushes.length, 1, c);
    assert.deepEqual(pushes[0].refspecs, ['feat'], c);
  }
});

test('ref rewrites before a push count as moving the branch', () => {
  for (const c of [
    'git update-ref refs/heads/feat other && git push origin feat',
    'git fetch . other:feat && git push origin feat',
    'git symbolic-ref HEAD refs/heads/other && git push',
  ]) {
    const decision = hookDecision({ tool_name: 'Bash', tool_input: { command: c }, cwd: '/tmp' }, fakeGit({ stamp: stampOf({}) }));
    assert.ok(decision && /own command/.test(decision.reason), c);
  }
  // A plain fetch is not a mover.
  assert.equal(hookDecision({ tool_name: 'Bash', tool_input: { command: 'git fetch origin --quiet' }, cwd: '/tmp' }, fakeGit()), null);
});

// ---- Impeccable design review for frontend pushes ----

test('touchesFrontend matches only the frontend prefixes', () => {
  assert.ok(touchesFrontend(['apps/mobile/x']));
  assert.ok(touchesFrontend(['docs/a.md', 'packages/core/x']));
  for (const paths of [['services/x'], ['docs/x'], ['apps/mobile-old/x'], []]) {
    assert.equal(touchesFrontend(paths), false, paths.join(','));
  }
});

test('frontend stamps need a passing Impeccable review', () => {
  assert.equal(checkStamp(stampOf({}), SHA, false, true).kind, 'impeccable');
  assert.equal(checkStamp(stampOf({ impeccable: undefined }), SHA, false, true).kind, 'impeccable');
  const failed = checkStamp(stampOf({ impeccable: 'fail' }, 'fail'), SHA, false, true);
  assert.equal(failed.kind, 'failed');
  assert.ok(failed.failed.includes('impeccable'));
  assert.ok(checkStamp(stampOf({ impeccable: 'pass', unslop: 'pass' }), SHA, false, true).ok);
  assert.ok(checkStamp(stampOf({}), SHA, false, false).ok);
  // main plus frontend needs both
  assert.equal(checkStamp(stampOf({ impeccable: 'pass' }), SHA, true, true).kind, 'security');
  assert.equal(checkStamp(stampOf({ security: 'pass' }), SHA, true, true).kind, 'impeccable');
  assert.ok(checkStamp(stampOf({ security: 'pass', impeccable: 'pass', unslop: 'pass' }), SHA, true, true).ok);
});

test('hook: frontend pushes need Impeccable, backend pushes do not', () => {
  const d = hookDecision(bash('git push origin HEAD'), fakeGit({ frontend: true, stamp: stampOf({}) }));
  assert.match(d.reason, /Impeccable/);
  assert.ok(!d.reason.includes('—'));
  assert.equal(hookDecision(bash('git push origin HEAD'), fakeGit({ frontend: true, stamp: stampOf({ impeccable: 'pass', unslop: 'pass' }) })), null);
  assert.equal(hookDecision(bash('git push origin HEAD'), fakeGit({ frontend: false, stamp: stampOf({}) })), null);
});

test('denyReason for a missing Impeccable review', () => {
  const r = denyReason({ kind: 'impeccable' }, SHA, 'feat');
  assert.match(r, /^Push blocked\. commit aaaaaaa for feat changes frontend files/);
  assert.match(r, /no passing Impeccable design review/);
  assert.match(r, /Run \/push-check/);
});

const commitFile = (dir, path) => {
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  mkdirSync(join(dir, dirname(path)), { recursive: true });
  writeFileSync(join(dir, path), 'x\n');
  g('add', path);
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', path);
};

const repoWithOriginMain = () => {
  const dir = tempRepo();
  execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: dir });
  return dir;
};

test('end to end: a frontend commit needs --impeccable pass or fail', () => {
  const dir = repoWithOriginMain();
  commitFile(dir, 'apps/mobile/a.tsx');
  for (const extra of [[], ['--impeccable', 'n/a']]) {
    const r = runScript(['stamp', '--gate', 'pass', '--review', 'pass', ...extra, '--dir', dir]);
    assert.equal(r.status, 1, extra.join(' '));
    assert.match(r.stderr, /changes frontend files .*--impeccable must be pass or fail, not n\/a/);
    assert.equal(runScript(['status', '--dir', dir]).stdout.trim(), 'no stamp');
  }
  const failed = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--impeccable', 'fail', '--unslop', 'pass', '--dir', dir]);
  assert.equal(failed.status, 0, failed.stderr);
  assert.match(failed.stdout, /result: fail/);
  // unslop is required too on a frontend commit, checked after impeccable.
  const denied = runScript(['hook'], { input: hookInput('git push origin work', dir) });
  assert.match(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecisionReason, /impeccable/);

  const passed = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--impeccable', 'pass', '--unslop', 'pass', '--dir', dir]);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(runScript(['hook'], { input: hookInput('git push origin work', dir) }).stdout, '');
});

test('end to end: a docs-only commit needs no Impeccable review', () => {
  const dir = repoWithOriginMain();
  commitFile(dir, 'docs/x.md');
  const r = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--dir', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(runScript(['hook'], { input: hookInput('git push origin work', dir) }).stdout, '');
});

test('end to end: without origin/main every file in the commit counts', () => {
  const dir = tempRepo();
  commitFile(dir, 'packages/core/x.ts');
  const r = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--impeccable', 'n/a', '--dir', dir]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--impeccable must be pass or fail/);
});

test('end to end: unusual names and moves out of the frontend still count', () => {
  const dir = repoWithOriginMain();
  commitFile(dir, 'apps/mobile/\u00e9t\u00e9 \u2603.tsx');
  let r = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--impeccable', 'n/a', '--dir', dir]);
  assert.equal(r.status, 1, 'a non-ASCII name under apps/mobile/ is frontend');

  const moved = repoWithOriginMain();
  commitFile(moved, 'apps/mobile/screen.tsx');
  execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: moved });
  execFileSync('git', ['mv', 'apps/mobile/screen.tsx', 'screen.tsx'], { cwd: moved });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'move'], { cwd: moved });
  r = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--impeccable', 'n/a', '--dir', moved]);
  assert.equal(r.status, 1, 'moving a file out of apps/mobile/ is frontend');
});

test('end to end: a sibling folder that only starts like the frontend is not frontend', () => {
  const dir = repoWithOriginMain();
  commitFile(dir, 'apps/mobile-old/x.tsx');
  const r = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--dir', dir]);
  assert.equal(r.status, 0, r.stderr);
});

test('end to end: run from a subfolder, a frontend commit still counts', () => {
  for (const withOrigin of [true, false]) {
    const dir = withOrigin ? repoWithOriginMain() : tempRepo();
    commitFile(dir, 'apps/mobile/a.tsx');
    commitFile(dir, 'docs/x.md');
    for (const sub of ['docs', 'apps/mobile']) {
      const r = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--impeccable', 'n/a', '--dir', join(dir, sub)]);
      assert.equal(r.status, 1, `${sub}, origin/main ${withOrigin}`);
    }
  }
});

test('end to end: the real hook refuses a passing stamp without Impeccable on a frontend commit', () => {
  const dir = repoWithOriginMain();
  commitFile(dir, 'apps/mobile/a.tsx');
  // A stamp the old guard could have written: everything passes, no Impeccable field.
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: dir, encoding: 'utf8' }).trim();
  mkdirSync(join(dir, common, 'push-check'), { recursive: true });
  writeFileSync(join(dir, common, 'push-check', `${sha}.json`), JSON.stringify(stampOf({}, 'pass', sha)));
  const r = runScript(['hook'], { input: hookInput('git push origin work', join(dir, 'apps/mobile')) });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /no passing Impeccable design review/);
});

// ---- unslop (founder, 2026-11-15) ----

test('frontend stamps need a passing unslop review', () => {
  assert.ok(CHECK_NAMES.includes('unslop'));
  assert.equal(checkStamp(stampOf({ impeccable: 'pass' }), SHA, false, true).kind, 'unslop');
  assert.equal(checkStamp(stampOf({ impeccable: 'pass', unslop: undefined }), SHA, false, true).kind, 'unslop');
  const failed = checkStamp(stampOf({ impeccable: 'pass', unslop: 'fail' }, 'fail'), SHA, false, true);
  assert.equal(failed.kind, 'failed');
  assert.ok(failed.failed.includes('unslop'));
  assert.ok(checkStamp(stampOf({ impeccable: 'pass', unslop: 'pass' }), SHA, false, true).ok);
  assert.ok(checkStamp(stampOf({}), SHA, false, false).ok);
  const r = denyReason({ kind: 'unslop' }, SHA, 'feat');
  assert.match(r, /changes frontend files, and its push check has no passing unslop design review/);
});

test('end to end: a frontend commit needs --unslop pass or fail', () => {
  const dir = repoWithOriginMain();
  commitFile(dir, 'apps/mobile/a.tsx');
  for (const extra of [[], ['--unslop', 'n/a']]) {
    const r = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--impeccable', 'pass', ...extra, '--dir', dir]);
    assert.equal(r.status, 1, extra.join(' '));
    assert.match(r.stderr, /--unslop must be pass or fail, not n\/a/);
  }
  const ok = runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--impeccable', 'pass', '--unslop', 'pass', '--dir', dir]);
  assert.equal(ok.status, 0, ok.stderr);
  const usage = runScript(['stamp', '--bogus']);
  assert.match(usage.stderr, /--unslop pass\|fail\|n\/a/);
});

// ---- docs-only direct pushes to main (founder, 2026-11-15) ----

test('isDocPath allows docs/ and root markdown only', () => {
  for (const p of ['docs/a.md', 'docs/x/y.png', 'DECISIONS.md', 'README.md', 'CLAUDE.md']) assert.ok(isDocPath(p), p);
  for (const p of ['scripts/a.mjs', 'apps/mobile/README.md', 'package.json', 'docsx/a.md', '.claude/commands/land.md', 'README.mdx']) {
    assert.equal(isDocPath(p), false, p);
  }
});

test('hook: code pushed straight to main is refused, docs-only is not', () => {
  const stamp = stampOf({ security: 'pass' });
  for (const cmd of ['git push origin HEAD:main', 'git push origin main', 'git push --all', 'git push --mirror origin']) {
    const d = hookDecision(bash(cmd), fakeGit({ stamp, codePaths: ['scripts/x.mjs'] }));
    assert.match(d?.reason ?? '', /pull request/, cmd);
    assert.match(d.reason, /\/land/);
  }
  assert.equal(hookDecision(bash('git push origin HEAD:main'), fakeGit({ stamp, codePaths: [] })), null);
  // docs-only still needs security
  assert.match(hookDecision(bash('git push origin HEAD:main'), fakeGit({ stamp: stampOf({}) })).reason, /security review/);
  // branch pushes are unchanged
  assert.equal(hookDecision(bash('git push origin feat'), fakeGit({ stamp: stampOf({}), codePaths: ['scripts/x.mjs'] })), null);
});

test('end to end: a code commit pushed to main is refused, a docs commit is allowed', () => {
  const dir = repoWithOriginMain();
  commitFile(dir, 'scripts/x.mjs');
  runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--security', 'pass', '--dir', dir]);
  const r = runScript(['hook'], { input: hookInput('git push origin HEAD:main', dir) });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /pull request/);

  const docs = repoWithOriginMain();
  commitFile(docs, 'docs/x.md');
  commitFile(docs, 'DECISIONS.md');
  runScript(['stamp', '--gate', 'pass', '--review', 'pass', '--security', 'pass', '--dir', docs]);
  assert.equal(runScript(['hook'], { input: hookInput('git push origin HEAD:main', docs) }).stdout, '');
});

// ---- gh pr merge (founder, 2026-11-15) ----

const PR_SHA = 'b'.repeat(40);
const prOf = (files = ['scripts/x.mjs']) => ({ headRefOid: PR_SHA, files, headRefName: 'claude/feat' });

test('hook: gh pr merge needs a stamp with security on the PR head', () => {
  const seen = [];
  const pr = (selector, repo) => (seen.push([selector, repo]), prOf());
  const good = { [PR_SHA]: stampOf({ security: 'pass' }, 'pass', PR_SHA) };
  assert.equal(hookDecision(bash('gh pr merge 12 --merge --delete-branch'), fakeGit({ pr, stamps: good })), null);
  assert.deepEqual(seen[0], ['12', null]);
  for (const cmd of [
    'gh pr merge 12 --merge',
    'cd /x && gh pr merge --merge',
    'env GH_DEBUG=0 gh pr merge feat -m',
    "sh -c 'gh pr merge 12 --merge'",
    'git status && gh pr merge -R o/r 12 --body "hi there" --merge',
  ]) {
    const d = hookDecision(bash(cmd), fakeGit({ pr: prOf(), stamps: { [PR_SHA]: stampOf({}, 'pass', PR_SHA) } }));
    assert.match(d?.reason ?? '', /security review/, cmd);
  }
  hookDecision(bash('gh pr merge -R o/r --body "x y" 12'), fakeGit({ pr, stamps: good }));
  assert.deepEqual(seen.at(-1), ['12', 'o/r']);
  hookDecision(bash('gh pr merge --merge'), fakeGit({ pr, stamps: good }));
  assert.deepEqual(seen.at(-1), [null, null]);
  // no stamp at all
  assert.match(hookDecision(bash('gh pr merge 12'), fakeGit({ pr: prOf() })).reason, /no push check/);
});

test('hook: help words as flag values are still a merge', () => {
  for (const cmd of ['gh pr merge 5 --merge --subject --help', 'gh pr merge 5 -t -h', 'gh pr merge 5 -b -h', 'gh pr merge --help']) {
    assert.match(hookDecision(bash(cmd), fakeGit({ pr: prOf() }))?.reason ?? '', /no push check/, cmd);
  }
});

test('hook: gh pr merge --auto needs --match-head-commit equal to the PR head', () => {
  const g = fakeGit({ pr: prOf(), stamps: { [PR_SHA]: stampOf({ security: 'pass' }, 'pass', PR_SHA) } });
  for (const cmd of ['gh pr merge 12 --auto --merge', `gh pr merge 12 --auto --match-head-commit ${'c'.repeat(40)}`]) {
    assert.match(hookDecision(bash(cmd), g)?.reason ?? '', /without --auto/, cmd);
  }
  assert.equal(hookDecision(bash(`gh pr merge 12 --auto --match-head-commit ${PR_SHA}`), g), null);
});

test('hook: gh pr merge with frontend files needs Impeccable and unslop', () => {
  const pr = prOf(['apps/mobile/a.tsx']);
  const at = (checks) => fakeGit({ pr, stamps: { [PR_SHA]: stampOf({ security: 'pass', ...checks }, 'pass', PR_SHA) } });
  assert.match(hookDecision(bash('gh pr merge 3'), at({})).reason, /Impeccable/);
  assert.match(hookDecision(bash('gh pr merge 3'), at({ impeccable: 'pass' })).reason, /unslop/);
  assert.equal(hookDecision(bash('gh pr merge 3'), at({ impeccable: 'pass', unslop: 'pass' })), null);
});

test('hook: a failed or odd gh lookup denies', () => {
  const d = hookDecision(bash('gh pr merge 12'), fakeGit({ pr: null }));
  assert.match(d.reason, /could not look up the pull request/);
  assert.match(hookDecision(bash('gh pr merge 12'), fakeGit({ pr: { files: [] } })).reason, /could not look up/);
});

test('hook: opaque gh merges are denied, other gh commands are not', () => {
  for (const cmd of [
    'gh api repos/o/r/pulls/12/merge -X PUT',
    'gh api -X PUT "repos/o/r/pulls/12/merge"',
    'eval "gh pr merge 12"',
    'echo 12 | xargs gh pr merge',
  ]) {
    assert.ok(hookDecision(bash(cmd), fakeGit({ pr: prOf() })), cmd);
  }
  for (const cmd of ['gh pr view 12', 'gh pr create --base main', 'gh pr checks 12 --watch', 'gh api repos/o/r/pulls/12', 'git merge feat']) {
    assert.equal(hookDecision(bash(cmd), fakeGit()), null, cmd);
  }
});

// ---- push-check review findings (2026-11-15) ----

test('hook: a repo flag before merge still finds the merge', () => {
  for (const [cmd, repo] of [
    ['gh pr -R owner/repo merge 12', 'owner/repo'],
    ['gh pr --repo owner/repo merge 12', 'owner/repo'],
    ['gh pr --repo=owner/repo merge 12', 'owner/repo'],
    ['gh --repo x pr merge 12', 'x'],
    ['gh -R x pr merge 12', 'x'],
  ]) {
    const seen = [];
    const d = hookDecision(bash(cmd), fakeGit({ pr: (sel, r) => (seen.push([sel, r]), prOf()) }));
    assert.match(d?.reason ?? '', /no push check/, cmd);
    assert.deepEqual(seen[0], ['12', repo], cmd);
  }
});

test('hook: an error reading the stamp for a merge denies', () => {
  const g = { ...fakeGit({ pr: prOf() }), readStamp: () => { throw new Error('not a git repo'); } };
  assert.ok(hookDecision(bash('gh pr merge 12'), g));
});

test('hook: the merge deny names the head branch, not the base', () => {
  const d = hookDecision(bash('gh pr merge 12'), fakeGit({ pr: prOf() }));
  assert.match(d.reason, /for claude\/feat/);
  assert.doesNotMatch(d.reason, /for main/);
});

test('hook: a local head commit decides frontend with git, not gh files', () => {
  const g = fakeGit({ pr: prOf(['scripts/moved.ts']), local: true, frontend: true, stamps: { [PR_SHA]: stampOf({ security: 'pass' }, 'pass', PR_SHA) } });
  assert.match(hookDecision(bash('gh pr merge 3'), g)?.reason ?? '', /Impeccable/);
  const remote = fakeGit({ pr: prOf(['scripts/moved.ts']), local: false, frontend: true, stamps: { [PR_SHA]: stampOf({ security: 'pass' }, 'pass', PR_SHA) } });
  assert.equal(hookDecision(bash('gh pr merge 3'), remote), null);
});

test('hook: gh api writes that merge or move refs deny, reads allow', () => {
  for (const cmd of [
    'gh api graphql -f query="mutation { mergePullRequest(input: {}) { clientMutationId } }"',
    'gh api graphql -F query=@q.graphql -f x=updateRef',
    'gh api repos/o/r/merges -f base=main -f head=feat',
    'gh api --method POST repos/o/r/git/refs/heads/main',
    'gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=abc',
    'gh api repos/o/r/contents/a.txt --input body.json',
    'gh api --method=PUT repos/o/r/pulls/3/merge',
  ]) {
    assert.ok(hookDecision(bash(cmd), fakeGit()), cmd);
  }
  for (const cmd of ['gh api repos/o/r/pulls/3/merge', 'gh api repos/o/r/git/refs/heads/main', 'gh api repos/o/r/contents/a.txt']) {
    assert.equal(hookDecision(bash(cmd), fakeGit()), null, cmd);
  }
});

// ---- the guard reads past spelling tricks (F1057) ----

test('a quoted, variable or aliased push subcommand is denied', () => {
  for (const cmd of [
    'git pu""sh',
    "git p''ush origin claude/feat",
    'git p\\ush',
    'P=push; git $P',
    'P=push; git "$P" origin main',
    'git $(echo push)',
    'git `echo push`',
    'git "`echo push`" origin main',
    'git -c alias.p=push p',
    "git -c alias.ship='!git push' ship",
    'git config alias.p push && git p',
    'git config --global alias.ship "push origin HEAD" && git ship',
  ]) {
    // The plain `git push` here would be refused for having no stamp, so any spelling of it must be too.
    assert.ok(hookDecision(bash(cmd), fakeGit()), `${cmd} hides a push the guard cannot read, so it must deny`);
  }
});

test('a wrapper flag that takes a value does not hide the push behind it', () => {
  for (const cmd of [
    'env -u FOO git push',
    'env --unset FOO git push',
    'sudo -u me git push',
    'sudo -g staff git push origin claude/feat',
    'timeout -s KILL 10 git push',
    'nice -n 5 git push',
    'env -C /elsewhere git push',
  ]) {
    assert.ok(hookDecision(bash(cmd), fakeGit()), `${cmd} is a git push with no stamp, so it must deny`);
  }
  const [p] = findPushes('sudo -u me git push origin claude/feat', '/work');
  assert.equal(p?.remote, 'origin', 'the value of -u is the user, not the command');
  assert.deepEqual(p?.refspecs, ['claude/feat']);
});

test('a shift inside arithmetic does not hide the next command', () => {
  for (const cmd of ['(( x << 2 ))\ngit push', 'echo $(( 1 << 2 ))\ngit push', '(( (1 + 2) << 3 )); git push']) {
    // `<<` inside (( )) is a shift, so the next line is a command, not a here-document body.
    assert.ok(hookDecision(bash(cmd), fakeGit()), JSON.stringify(cmd));
  }
  // A real here-document after the arithmetic is still data.
  assert.equal(hookDecision(bash('(( x << 2 )); cat <<EOF\ngit push\nEOF'), fakeGit()), null);
});

test('git commands that only mention push are still allowed', () => {
  for (const cmd of [
    'git stash push -m x',
    'git log --grep push',
    'git commit -m "push later"',
    'git status && echo push',
    'git -c core.pager=cat log --grep push',
    'git config alias.lg "log --oneline" && echo push',
    'git config alias.lg "log --graph"',
    'git -c alias.lg=log lg && echo push',
  ]) {
    assert.equal(hookDecision(bash(cmd), fakeGit()), null, `${cmd} never publishes a commit, so it must not wedge the session`);
  }
});

test('env -S with a push inside is judged as a push', () => {
  for (const cmd of ['env -S "git push origin main"', "env --split-string='git push origin main'", 'env -S "FOO=1 git push" origin main']) {
    const d = hookDecision(bash(cmd), fakeGit());
    assert.match(d?.reason ?? '', /no push check/, `${cmd} runs git push, so it is decided like the plain push`);
  }
  const [p] = findPushes('env -S "git push origin main"', '/work');
  assert.equal(p?.remote, 'origin', 'the split string is read as the command line it is');
  assert.deepEqual(p?.refspecs, ['main']);
  assert.equal(hookDecision(bash('env -S "git push origin main"'), fakeGit({ stamp: stampOf({ security: 'pass' }) })), null, 'a checked push through env -S still goes');
});

test('an alias whose value merges a pull request is denied', () => {
  for (const cmd of [
    "git config alias.m '!gh pr merge 5' && git m",
    "git -c alias.m='!gh pr merge 5' m",
    'git config --global alias.land "!gh pr merge --merge" && git land',
  ]) {
    assert.ok(hookDecision(bash(cmd), fakeGit()), `${cmd} hides a merge the guard cannot read, so it must deny`);
  }
});
