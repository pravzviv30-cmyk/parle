#!/usr/bin/env node
// PreToolUse guard: refuse `git push` until the pushed commit has a passing
// "push check" stamp.
//
// Founder rule (2026-10-31): every push, frontend or backend, goes through
// /push-check first, and a push to main also needs /security-review. The
// /push-check command runs the checks, then calls `stamp` here to record the
// result for the exact commit it checked. This hook reads that stamp back.
//
// Subcommands (argv[2]):
//   hook    PreToolUse hook. Reads the tool-call JSON on stdin. Prints nothing
//           (allow) or one permissionDecision "deny" JSON line. Exits 0 always.
//   stamp   Write <git-common-dir>/push-check/<sha>.json for a commit.
//   status  Print the stamp for HEAD (or --sha), or "no stamp".
//
// Contract for `hook`: it only ever denies for the three known reasons (no
// stamp, failed stamp, main without a passing security review). Anything
// unexpected (not a git repo, git missing, unparsable stdin) allows the call,
// so a bug in this guard can never wedge a session. The stamp lives in the
// git common dir, so every worktree of a repo shares one stamp folder.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const CHECK_NAMES = ['gate', 'playwright', 'backend', 'review', 'security'];
const CHECK_VALUES = ['pass', 'fail', 'n/a'];

const NEXT_STEP =
  'Run /push-check (or /push-check --main before landing) in this checkout, then push again. ' +
  'The founder can still push from their own terminal.';

// ---------------------------------------------------------------------------
// Shell parsing (pure)
// ---------------------------------------------------------------------------

// Split a shell command line into simple commands, each an array of words
// with quotes removed. Separators: && || ; | & newline ( ) and backticks.
// Quotes are respected, so `echo "git push"` is one command with two words.
export function splitCommands(input) {
  const commands = [];
  let words = [];
  let word = '';
  let inWord = false;
  let quote = null;

  const endWord = () => {
    if (inWord) words.push(word);
    word = '';
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };

  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
      continue;
    }
    if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && '"\\$`'.includes(s[i + 1] ?? '')) word += s[++i];
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
    } else if (c === '\\') {
      if (s[i + 1] === '\n') i++;
      else if (i + 1 < s.length) {
        word += s[++i];
        inWord = true;
      }
    } else if (c === '#' && !inWord) {
      while (i + 1 < s.length && s[i + 1] !== '\n') i++;
    } else if (c === ' ' || c === '\t') {
      endWord();
    } else if (c === '\n' || c === ';' || c === '|' || c === '(' || c === ')' || c === '`') {
      endCommand();
    } else if (c === '&') {
      // `2>&1` and `>&2` are redirects, not separators.
      if (inWord && (word.endsWith('>') || word.endsWith('<'))) word += c;
      else endCommand();
    } else {
      word += c;
      inWord = true;
    }
  }
  endCommand();
  return commands;
}

// Drop shell redirects (`> file`, `2>&1`, `>>log`) so they are never read as
// git arguments.
function stripRedirects(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^\d*(>>?|<)/.test(w)) {
      if (/^\d*(>>?|<)$/.test(w)) i++; // bare operator: its target is the next word
      continue;
    }
    out.push(w);
  }
  return out;
}

const WRAPPERS = new Set(['env', 'command', 'time', 'nohup', 'exec']);
const SHELLS = new Set(['sh', 'bash', 'zsh']);
const GIT_GLOBAL_WITH_VALUE = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env',
]);
const PUSH_FLAG_WITH_VALUE = new Set([
  '-o', '--push-option', '--repo', '--receive-pack', '--exec',
]);

function afterCd(dir, args) {
  const target = args.find((a) => a === '-' || !a.startsWith('-'));
  if (target === undefined) return homedir();
  if (target === '-') return dir; // previous directory: unknown, keep going
  if (target === '~') return homedir();
  if (target.startsWith('~/')) return resolve(homedir(), target.slice(2));
  return resolve(dir, target);
}

// Parse the args after `git push` into a plain description.
export function parsePushArgs(args) {
  const push = {
    remote: null,
    refspecs: [],
    delete: false,
    dryRun: false,
    tags: false,
    all: false,
  };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('-') || a === '-') {
      positional.push(a);
    } else if (a.startsWith('--')) {
      const name = a.split('=')[0];
      if (name === '--delete') push.delete = true;
      else if (name === '--dry-run') push.dryRun = true;
      else if (name === '--tags') push.tags = true;
      else if (name === '--all' || name === '--mirror' || name === '--branches') push.all = true;
      if (PUSH_FLAG_WITH_VALUE.has(name) && !a.includes('=')) i++;
    } else {
      if (/^-[a-zA-Z]+$/.test(a)) {
        if (a.includes('d')) push.delete = true;
        if (a.includes('n')) push.dryRun = true;
      }
      if (PUSH_FLAG_WITH_VALUE.has(a)) i++;
    }
  }
  push.remote = positional.length ? positional[0] : null;
  const refspecs = positional.slice(1);
  // `git push origin tag v1.0` is the long spelling of a tag push.
  const tagAt = refspecs.indexOf('tag');
  push.refspecs = tagAt === -1 ? refspecs : refspecs.filter((_, i) => i !== tagAt && i !== tagAt + 1);
  if (tagAt !== -1) push.tags = true;
  return push;
}

// Find every `git push` in a shell command. Each result has the directory it
// runs in (tracking an earlier `cd` and `git -C`) plus the parsed push args.
export function findPushes(command, baseCwd) {
  const pushes = [];
  let dir = resolve(baseCwd);

  for (const raw of splitCommands(command)) {
    let words = stripRedirects(raw);
    let afterWrapper = false;
    while (words.length) {
      const w = words[0];
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) {
        words = words.slice(1);
      } else if (WRAPPERS.has(w)) {
        afterWrapper = true;
        words = words.slice(1);
      } else if (afterWrapper && w.startsWith('-')) {
        words = words.slice(1); // flags of env/command/etc.
      } else {
        break;
      }
    }
    if (!words.length) continue;

    const [head, ...rest] = words;
    if (head === 'cd' || head === 'pushd') {
      dir = afterCd(dir, rest);
    } else if (SHELLS.has(head) && rest.includes('-c') && rest[rest.indexOf('-c') + 1] !== undefined) {
      pushes.push(...findPushes(rest[rest.indexOf('-c') + 1], dir));
    } else if (head === 'git') {
      let gitDir = dir;
      let i = 0;
      for (; i < rest.length && rest[i].startsWith('-'); i++) {
        const flag = rest[i];
        if (flag === '-C') {
          if (rest[i + 1] !== undefined) gitDir = resolve(gitDir, rest[++i]);
        } else if (GIT_GLOBAL_WITH_VALUE.has(flag)) {
          i++;
        }
      }
      if (rest[i] === 'push') {
        pushes.push({ dir: gitDir, ...parsePushArgs(rest.slice(i + 1)) });
      }
    }
  }
  return pushes;
}

// ---------------------------------------------------------------------------
// Decisions (pure)
// ---------------------------------------------------------------------------

export function isMainRef(ref) {
  return ref === 'main' || ref === 'refs/heads/main';
}

const stripHeads = (ref) => (ref ?? '').replace(/^refs\/heads\//, '');

// Which commits does this push publish? Returns [{ src, dst }] where src is
// what to resolve and dst is the branch it lands on (null when unknown).
// Pushes that publish no commits (delete, dry run, tags only) return [].
export function pushTargets(push, currentBranch) {
  if (push.delete || push.dryRun) return [];
  if (push.tags && push.refspecs.length === 0) return [];
  if (push.all) return [{ src: 'HEAD', dst: 'main', all: true }];
  if (push.refspecs.length === 0) return [{ src: 'HEAD', dst: currentBranch ?? null }];

  const targets = [];
  for (const spec of push.refspecs) {
    const bare = spec.replace(/^\+/, '');
    if (bare.startsWith(':')) continue; // deletes a remote ref
    const colon = bare.indexOf(':');
    const src = colon === -1 ? bare : bare.slice(0, colon);
    let dst = colon === -1 ? src : bare.slice(colon + 1);
    if (!src) continue;
    if (src.startsWith('refs/tags/') || dst.startsWith('refs/tags/')) continue;
    if (colon === -1 && src === 'HEAD') dst = currentBranch ?? null;
    targets.push({ src, dst });
  }
  return targets;
}

// Judge one stamp for one commit. { ok: true } or { ok: false, kind, failed }.
//   kind 'missing'  no usable stamp for this commit
//   kind 'failed'   the stamp says a check failed (failed lists their names)
//   kind 'security' going to main without a passing security review
export function checkStamp(stamp, sha, toMain) {
  if (!stamp || typeof stamp !== 'object' || stamp.sha !== sha) {
    return { ok: false, kind: 'missing', failed: [] };
  }
  const checks = stamp.checks && typeof stamp.checks === 'object' ? stamp.checks : {};
  const failed = CHECK_NAMES.filter((name) => checks[name] === 'fail');
  if (stamp.result !== 'pass' || failed.length) {
    return { ok: false, kind: 'failed', failed };
  }
  if (toMain && checks.security !== 'pass') {
    return { ok: false, kind: 'security', failed: [] };
  }
  return { ok: true };
}

export function denyReason({ kind, failed = [] }, sha, branch) {
  const where = `commit ${sha.slice(0, 7)}${branch ? ` for ${branch}` : ''}`;
  let what;
  if (kind === 'failed') {
    what = failed.length
      ? `The push check for ${where} failed: ${failed.join(', ')}.`
      : `The push check for ${where} did not pass.`;
  } else if (kind === 'security') {
    what = `${where} is going to main, and its push check has no passing security review.`;
  } else {
    what = `${where} has no push check yet.`;
  }
  return `Push blocked. ${what} ${NEXT_STEP}`;
}

// The whole hook decision, with git access injected so it can be tested.
// Returns null to allow, or { reason } to deny.
//   git.resolveCommit(dir, rev) -> full sha (throws when rev does not resolve)
//   git.currentBranch(dir)      -> branch name or null
//   git.readStamp(dir, sha)     -> parsed stamp or null
export function hookDecision(input, git) {
  if (!input || input.tool_name !== 'Bash') return null;
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || !/\bpush\b/.test(command)) return null;

  const cwd = input.cwd || process.cwd();
  for (const push of findPushes(command, cwd)) {
    const current = git.currentBranch(push.dir);
    for (const target of pushTargets(push, current)) {
      const sha = git.resolveCommit(push.dir, target.src);
      const toMain = Boolean(target.all) || isMainRef(target.dst);
      const verdict = checkStamp(git.readStamp(push.dir, sha), sha, toMain);
      if (!verdict.ok) {
        const branch = stripHeads(target.dst) || current;
        return { reason: denyReason(verdict, sha, branch) };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Git access
// ---------------------------------------------------------------------------

function git(dir, args) {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export function resolveCommit(dir, rev) {
  return git(dir, ['rev-parse', '--verify', `${rev}^{commit}`]);
}

export function currentBranch(dir) {
  try {
    const name = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    return name && name !== 'HEAD' ? name : null;
  } catch {
    return null;
  }
}

export function stampPath(dir, sha) {
  const common = resolve(dir, git(dir, ['rev-parse', '--git-common-dir']));
  return resolve(common, 'push-check', `${sha}.json`);
}

export function readStamp(dir, sha) {
  const path = stampPath(dir, sha);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const realGit = { resolveCommit, currentBranch, readStamp };

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function runHook() {
  let reason = null;
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const decision = hookDecision(input, realGit);
    if (decision) reason = decision.reason;
  } catch {
    return; // a guard bug never blocks work
  }
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
        },
      }) + '\n',
    );
  }
}

const STAMP_USAGE =
  'usage: push-check-guard.mjs stamp --gate pass|fail --review pass|fail ' +
  '[--playwright pass|fail|n/a] [--backend pass|fail|n/a] [--security pass|fail|n/a] ' +
  '[--notes "text"] [--sha rev] [--dir path]';

function runStamp(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        sha: { type: 'string' },
        dir: { type: 'string' },
        notes: { type: 'string' },
        gate: { type: 'string' },
        playwright: { type: 'string' },
        backend: { type: 'string' },
        review: { type: 'string' },
        security: { type: 'string' },
      },
      strict: true,
    }));
    const checks = {};
    for (const name of CHECK_NAMES) {
      const value = values[name] ?? (name === 'gate' || name === 'review' ? undefined : 'n/a');
      if (!CHECK_VALUES.includes(value)) throw new Error(`bad --${name}`);
      if ((name === 'gate' || name === 'review') && value === 'n/a') throw new Error(`--${name} is required`);
      checks[name] = value;
    }
    values.checks = checks;
  } catch (err) {
    process.stderr.write(`${err.message}\n${STAMP_USAGE}\n`);
    process.exit(1);
  }

  try {
    const dir = resolve(values.dir ?? process.cwd());
    const sha = resolveCommit(dir, values.sha ?? 'HEAD');
    const result = Object.values(values.checks).includes('fail') ? 'fail' : 'pass';
    const stamp = {
      sha,
      branch: currentBranch(dir),
      createdAt: new Date().toISOString(),
      result,
      checks: values.checks,
      notes: values.notes ?? '',
    };
    const path = stampPath(dir, sha);
    mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(path, JSON.stringify(stamp, null, 2) + '\n');
    process.stdout.write(`${path}\nresult: ${result}\n`);
  } catch (err) {
    process.stderr.write(`Could not write the stamp: ${err.message}\n`);
    process.exit(1);
  }
}

function runStatus(argv) {
  let values = {};
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { sha: { type: 'string' }, dir: { type: 'string' } },
      strict: false,
    }));
    const dir = resolve(values.dir ?? process.cwd());
    const stamp = readStamp(dir, resolveCommit(dir, values.sha ?? 'HEAD'));
    process.stdout.write(stamp ? JSON.stringify(stamp, null, 2) + '\n' : 'no stamp\n');
  } catch {
    process.stdout.write('no stamp\n');
  }
}

function main() {
  const [sub, ...rest] = process.argv.slice(2);
  if (sub === 'hook') runHook();
  else if (sub === 'stamp') runStamp(rest);
  else if (sub === 'status') runStatus(rest);
  else {
    process.stderr.write('usage: push-check-guard.mjs hook | stamp | status\n');
    process.exit(sub === undefined ? 0 : 1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
