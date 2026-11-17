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
// Contract for `hook`: it only ever denies for the known reasons (no
// stamp, failed stamp, main without a passing security review, frontend
// changes without passing Impeccable and unslop design reviews, code pushed
// straight to main, a `gh pr merge` it cannot verify, a git or gh command it
// cannot read). Anything
// unexpected (not a git repo, git missing, unparsable stdin) allows the call,
// so a bug in this guard can never wedge a session. The stamp lives in the
// git common dir, so every worktree of a repo shares one stamp folder.
//
// Limits. The guard reads the command text only, so it does not see:
//   - a push made by a script or an interpreter (`node -e`, a Makefile);
//   - an alias or config set outside the command: an edited config file,
//     GIT_CONFIG_GLOBAL, or a gh alias (F1213);
//   - a command with no readable git or gh word;
//   - config exported through `eval` or under a variable name the shell
//     builds (F1226);
//   - a command run by a program outside the wrapper table, such as
//     `find -exec`, `xcrun`, `trap` or a zsh precommand modifier (F1227);
//   - a GraphQL query read from a file (`gh api graphql -F query=@file`).
// The pre-push hook still runs the gate on any spelling of git push.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const CHECK_NAMES = ['gate', 'playwright', 'backend', 'review', 'security', 'impeccable', 'unslop'];
const CHECK_VALUES = ['pass', 'fail', 'n/a'];

// Paths that count as frontend. A push whose diff against origin/main touches
// one of these needs passing Impeccable (founder, 2026-10-31) and unslop
// (founder, 2026-11-15) design reviews.
export const FRONTEND_PREFIXES = ['apps/mobile/', 'packages/core/'];

// True when any path starts with a frontend prefix.
export function touchesFrontend(paths) {
  return paths.some((p) => FRONTEND_PREFIXES.some((prefix) => p.startsWith(prefix)));
}

// Paths that may still be pushed straight to main (founder, 2026-11-15):
// decision records, ledger notes and logs. Anything else goes through a PR.
export function isDocPath(p) {
  return p.startsWith('docs/') || /^[^/]+\.md$/.test(p);
}

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
  return tokenize(input).filter(Array.isArray);
}

// Same split, but `(`, `)` and backticks also leave a { paren } marker between
// commands so a caller can scope `cd` to its subshell.
// With `nested`, `from` is the `(` of a `$(`: reading stops at its closing paren
// and the index of that paren is left on the result as `.end`.
function tokenize(input, from = 0, nested = false) {
  const commands = [];
  let backtickOpen = false;
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

  // Here-document delimiters waiting for the end of the current line. A
  // heredoc body is data (a commit message, a doc), never a command.
  const heredocs = [];
  // Paren depth, and the depth where an `((` arithmetic opened (null outside
  // one): there `<<` is a shift, not a here-document.
  let depth = 0;
  let arithAt = null;

  // A `$(` or backtick substitution at text[at], inside double quotes or a
  // here-document body. The shell runs it, so its commands are read here, ahead of
  // the command that holds it. Returns the index of its last character, or -1.
  const substitution = (text, at) => {
    if (text[at] === '$' && text[at + 1] === '(') {
      const inner = tokenize(text, at + 1, true);
      commands.push(...inner);
      return inner.end;
    }
    if (text[at] !== '`') return -1;
    let end = at + 1;
    while (end < text.length && text[end] !== '`') end += text[end] === '\\' ? 2 : 1;
    commands.push({ paren: '(' }, ...tokenize(text.slice(at + 1, end).replace(/\\([$`\\])/g, '$1')), { paren: ')' });
    return end;
  };

  const s = String(input);
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
      continue;
    }
    if (quote === '"') {
      const end = substitution(s, i);
      if (end !== -1) {
        word += s.slice(i, end + 1);
        i = end;
      } else if (c === '"') quote = null;
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
    } else if (c === '<' && s[i + 1] === '<' && s[i + 2] !== '<' && !inWord && arithAt === null) {
      // `<<EOF`, `<<-EOF`, `<<'EOF'`, `<< "EOF"`: remember the delimiter.
      let j = i + 2;
      const strip = s[j] === '-';
      if (strip) j++;
      while (s[j] === ' ' || s[j] === '\t') j++;
      let delim = '';
      // A quoted delimiter makes the body plain text; an unquoted one lets the shell expand it.
      let quoted = false;
      while (j < s.length && !/[\s;&|<>()]/.test(s[j])) {
        if (s[j] !== "'" && s[j] !== '"' && s[j] !== '\\') delim += s[j];
        else quoted = true;
        j++;
      }
      if (delim) heredocs.push({ delim, strip, quoted });
      i = j - 1;
    } else if (c === '\n' && heredocs.length) {
      endCommand();
      // Skip each pending body up to and including its delimiter line.
      while (heredocs.length && i < s.length) {
        const { delim, strip, quoted } = heredocs.shift();
        const bodyStart = i + 1;
        let bodyEnd = s.length;
        for (;;) {
          const start = i + 1;
          if (start >= s.length) { i = s.length; break; }
          const end = s.indexOf('\n', start);
          const line = s.slice(start, end === -1 ? s.length : end);
          i = end === -1 ? s.length : end;
          if ((strip ? line.replace(/^\t+/, '') : line) === delim) { bodyEnd = start; break; }
        }
        const body = quoted ? '' : s.slice(bodyStart, bodyEnd);
        for (let k = 0; k < body.length; k++) {
          if (body[k] === '\\') k++;
          else k = Math.max(k, substitution(body, k));
        }
      }
    } else if (c === '(' || c === ')' || c === '`') {
      if (c === '(' && s[i + 1] === '(' && arithAt === null) arithAt = depth;
      if (c === '(') depth++;
      if (c === ')' && --depth <= arithAt) arithAt = null;
      // An opening backtick leaves a mark in the word it interrupts, so
      // `git pu\`echo sh\`` is seen as unreadable, the way `$(` already is.
      if (c === '`' && !backtickOpen) {
        word += c;
        inWord = true;
      }
      endCommand();
      if (c === '`') {
        commands.push({ paren: backtickOpen ? ')' : '(' });
        backtickOpen = !backtickOpen;
      } else {
        commands.push({ paren: c });
        if (nested && depth === 0) {
          commands.end = i;
          return commands;
        }
      }
    } else if (c === '\n' || c === ';' || c === '|') {
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
  commands.end = s.length;
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

const WRAPPERS = new Set([
  'env', 'command', 'time', 'nohup', 'exec', 'sudo', 'timeout', 'gtimeout', 'nice', 'caffeinate', 'stdbuf', 'setsid',
]);
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}']);
const SHELLS = new Set(['sh', 'bash', 'zsh']);
const GIT_GLOBAL_WITH_VALUE = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env',
]);
// Wrapper flags whose value is the next word. A value that changes directory
// makes the command's directory unknown.
const WRAPPER_FLAG_WITH_VALUE = {
  env: new Set(['-u', '--unset', '-C', '--chdir']),
  sudo: new Set(['-u', '--user', '-g', '--group', '-h', '--host', '-p', '--prompt', '-C', '--close-from', '-D', '--chdir', '-r', '--role', '-t', '--type', '-U', '--other-user', '-T', '--command-timeout']),
  timeout: new Set(['-s', '--signal', '-k', '--kill-after']),
  gtimeout: new Set(['-s', '--signal', '-k', '--kill-after']),
  nice: new Set(['-n', '--adjustment']),
  stdbuf: new Set(['-i', '--input', '-o', '--output', '-e', '--error']),
};
const WRAPPER_CHDIR = { env: new Set(['-C', '--chdir']), sudo: new Set(['-D', '--chdir']) };
// Something only a shell can turn into a word.
const SHELL_EXPANDS = /[$`]/;
// Environment variables that hand git config entries, an alias among them.
const GIT_CONFIG_ENV = /^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+|PARAMETERS)=/;
// Builtins that set a variable the rest of the call can hand to git.
const DECLARES = new Set(['export', 'declare', 'typeset', 'readonly', 'local']);
// A refspec that asks git for the current branch, which HEAD already names.
const CURRENT_BRANCH = /^\$\(git (branch --show-current|rev-parse --abbrev-ref HEAD)\)$/;
// An alias value that can publish, read as the command line it is: a shell alias (`!`)
// runs its text, any other runs `git <value>`. Anything the reading finds counts.
const aliasPublishes = (value, dir) => {
  const v = value.trimStart();
  return analyzeCommand(v.startsWith('!') ? v.slice(1) : `git ${v}`, dir).length > 0;
};
const PUSH_FLAG_WITH_VALUE = new Set([
  '-o', '--push-option', '--repo', '--receive-pack', '--exec',
]);
// Git subcommands that move HEAD, make commits or move branches.
const HEAD_MOVERS = new Set([
  'commit', 'merge', 'switch', 'checkout', 'rebase', 'reset', 'cherry-pick', 'revert', 'pull', 'am',
  'update-ref', 'symbolic-ref', 'filter-branch', 'filter-repo', 'replace', 'commit-tree',
]);

// Does `git <sub> <args>` move HEAD or a branch?
function movesHead(sub, args) {
  if (HEAD_MOVERS.has(sub)) return true;
  if (sub === 'stash') return args[0] === 'pop' || args[0] === 'apply';
  if (sub === 'worktree') return args[0] === 'add';
  // `git fetch . other:feat` rewrites a local branch.
  if (sub === 'fetch') return args.some((a) => !a.startsWith('-') && a.includes(':'));
  if (sub === 'branch') {
    return args.some((a) => a === '--force' || a === '--move' || /^-[a-zA-Z]*[fmM][a-zA-Z]*$/.test(a));
  }
  return false;
}

// A path the guard cannot resolve without running a shell.
const UNRESOLVABLE = /[$`*?[{]/;

// `cd` target -> { dir, known }.
function afterCd(dir, known, args) {
  const target = args.find((a) => a === '-' || !a.startsWith('-'));
  if (target === undefined) return { dir: homedir(), known: true };
  if (target === '-' || UNRESOLVABLE.test(target)) return { dir, known: false };
  if (target === '~') return { dir: homedir(), known: true };
  if (target.startsWith('~/')) return { dir: resolve(homedir(), target.slice(2)), known: true };
  // An absolute path restores certainty; a relative one stays as unsure as before.
  return { dir: resolve(dir, target), known: known || target.startsWith('/') };
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
  let repo = null;
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
      if (name === '--repo') {
        repo = a.includes('=') ? a.slice(a.indexOf('=') + 1) : (args[i + 1] ?? null);
      }
      if (PUSH_FLAG_WITH_VALUE.has(name) && !a.includes('=')) i++;
    } else {
      if (/^-[a-zA-Z]+$/.test(a)) {
        if (a.includes('d')) push.delete = true;
        if (a.includes('n')) push.dryRun = true;
      }
      if (PUSH_FLAG_WITH_VALUE.has(a)) i++;
    }
  }
  // With --repo, every positional argument is a refspec.
  let refspecs;
  if (repo !== null) {
    push.remote = repo;
    refspecs = positional;
  } else {
    push.remote = positional.length ? positional[0] : null;
    refspecs = positional.slice(1);
  }
  // `git push origin tag v1.0` is the long spelling of a tag push.
  const tagAt = refspecs.indexOf('tag');
  push.refspecs = tagAt === -1 ? refspecs : refspecs.filter((_, i) => i !== tagAt && i !== tagAt + 1);
  if (tagAt !== -1) push.tags = true;
  return push;
}

// `gh pr merge` flags that take a value, so the PR selector is not mistaken.
const MERGE_FLAG_WITH_VALUE = new Set([
  '-b', '--body', '-F', '--body-file', '-t', '--subject', '-R', '--repo', '-A', '--author-email', '--match-head-commit',
]);

// `gh pr merge <args>` -> { selector, repo, auto, matchHead }; a null selector means the current branch's PR.
export function parseMergeArgs(args) {
  let selector = null;
  let repo = null;
  let auto = false;
  let matchHead = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-R' || a === '--repo') repo = args[++i] ?? null;
    else if (a.startsWith('--repo=')) repo = a.slice(7);
    else if (a === '--match-head-commit') matchHead = args[++i] ?? null;
    else if (a.startsWith('--match-head-commit=')) matchHead = a.slice(20);
    else if (a === '--auto') auto = true;
    else if (MERGE_FLAG_WITH_VALUE.has(a)) i++;
    else if (!a.startsWith('-') && selector === null) selector = a;
  }
  return { selector, repo, auto, matchHead };
}

const baseName = (word) => word.split('/').pop();

// Returned by findMerge when the word where `pr` or `merge` belongs is built by the shell.
const UNREADABLE_MERGE = Symbol('unreadable merge');

// `gh [flags] pr [flags] merge <args>` -> the merge args, with any repo flag
// seen before `merge` put in front; null when the command is not a merge, and
// UNREADABLE_MERGE when the shell decides whether it is.
function findMerge(rest) {
  const repo = [];
  let i = 0;
  for (const sub of ['pr', 'merge']) {
    for (; i < rest.length && rest[i].startsWith('-'); i++) {
      if (rest[i] === '-R' || rest[i] === '--repo') repo.push('-R', rest[++i] ?? '');
      else if (rest[i].startsWith('--repo=')) repo.push(rest[i]);
    }
    if (rest[i] !== sub) return SHELL_EXPANDS.test(rest[i] ?? '') ? UNREADABLE_MERGE : null;
    i++;
  }
  return [...repo, ...rest.slice(i)];
}

// True when `gh api <args>` writes a merge or a ref: a GraphQL merge or ref
// mutation, or a writing method on a merge, ref or contents endpoint. Field
// flags make gh POST unless a method is named.
const API_FIELD = /^(-f|-F|--field|--raw-field|--input)(=|$)|^-[fF]./;
function apiWrites(args) {
  if (args.includes('graphql')) return args.some((a) => /mergePullRequest|updateRef|createRef|createCommitOnBranch|mergeBranch|enablePullRequestAutoMerge/.test(a));
  let method = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-X' || a === '--method') method = args[++i] ?? '';
    else if (a.startsWith('--method=')) method = a.slice(9);
    else if (/^-X./.test(a)) method = a.slice(2);
  }
  const writes = method ? /^(PUT|POST|PATCH|DELETE)$/i.test(method) : args.some((a) => API_FIELD.test(a));
  return writes && args.some((a) => /\/pulls\/[^/]+\/merge\b|\/merges\b|\/git\/refs\b|\/contents\//.test(a));
}

// Walk a shell command and report what the hook needs to judge:
//   { kind: 'push', dir, dirKnown, movedBefore, ...parsed push args }
//   { kind: 'opaque' }  eval/xargs wrapped around git push, or a git alias or
//                       shell expansion that may be one, which cannot be read
// `dir` tracks earlier `cd` and `git -C`; `dirKnown` is false once a directory
// depends on the shell (`cd $(mktemp -d)`). `movedBefore` is true when an
// earlier git command in the same call can move HEAD or a branch, which makes
// HEAD and the current branch at hook time the wrong thing to judge.
export function analyzeCommand(command, baseCwd, parent = null) {
  const events = [];
  const state = {
    dir: resolve(baseCwd),
    known: parent ? parent.known : true,
    moved: parent ? parent.moved : false,
    configEnv: parent ? Boolean(parent.configEnv) : false,
  };
  const scopes = [];
  // Depth of a command that was only `$(` or a backtick: the next command at
  // that depth is the argument list of whatever the substitution prints.
  let substAt = null;

  for (const item of tokenize(command)) {
    if (!Array.isArray(item)) {
      if (item.paren === '(') scopes.push({ dir: state.dir, known: state.known });
      else if (scopes.length) Object.assign(state, scopes.pop());
      continue;
    }

    let words = stripRedirects(item);
    let wrapper = null;
    let wrapperMovedDir = false;
    // True when the last wrapper word read was a flag the tables give no value.
    let looseFlag = false;
    // Config handed to this one command; a bare assignment stays set for the call.
    let configHere = false;
    while (words.length) {
      const w = words[0];
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || KEYWORDS.has(w)) {
        if (GIT_CONFIG_ENV.test(w)) configHere = true;
        words = words.slice(1);
      } else if (WRAPPERS.has(baseName(w))) {
        wrapper = baseName(w);
        looseFlag = false;
        words = words.slice(1);
      } else if (wrapper === 'env' && /^-[^-]/.test(w)) {
        // A short cluster such as `-iS"git push"`: walk its letters. `u`, `C`, `P` and `S`
        // take the rest of the cluster, or the next word, as their value.
        let consumed = 1;
        let split = null;
        for (let k = 1; k < w.length; k++) {
          if (!'uCPS'.includes(w[k])) continue;
          const attached = w.slice(k + 1);
          if (!attached) consumed = 2;
          if (w[k] === 'C') wrapperMovedDir = true;
          // `env -S "git push"`: the value is a command line of its own.
          if (w[k] === 'S') split = attached || (words[1] ?? '');
          break;
        }
        words = [...(split === null ? [] : splitCommands(split).flat()), ...words.slice(consumed)];
      } else if (wrapper === 'env' && (w === '--split-string' || w.startsWith('--split-string='))) {
        // `env -S "git push"`: the value is a command line of its own.
        const line = w.includes('=') ? w.slice(w.indexOf('=') + 1) : (words[1] ?? '');
        words = [...splitCommands(line).flat(), ...words.slice(w.includes('=') ? 1 : 2)];
      } else if (wrapper && (w.startsWith('-') || /^\d+(\.\d+)?[smhd]?$/.test(w))) {
        // flags of env/sudo/command/etc., and timeout's duration
        const takesValue = WRAPPER_FLAG_WITH_VALUE[wrapper]?.has(w);
        if (WRAPPER_CHDIR[wrapper]?.has(w)) wrapperMovedDir = true;
        looseFlag = w.startsWith('-') && !takesValue;
        words = words.slice(takesValue ? 2 : 1);
      } else {
        break;
      }
    }
    // A wrapper flag the tables do not know may take the head as its value (`sudo -nu me
    // sh -c "git push"`). Start at the next word the guard reads: the one right after
    // the head, or a later one when the head is not such a word itself.
    if (looseFlag) {
      const reads = (w) => ['git', 'gh', 'eval', 'xargs'].includes(baseName(w)) || SHELLS.has(baseName(w));
      const at = words.findIndex((w, k) => k > 0 && reads(w));
      if (at === 1 || (at > 1 && !reads(words[0]))) words = words.slice(at);
    }
    if (configHere && !words.length) state.configEnv = true;
    const configEnv = state.configEnv || configHere;
    if (substAt !== null && scopes.length === substAt) {
      substAt = null;
      if (words.includes('push') || words.includes('merge')) events.push({ kind: 'opaque', unreadable: true });
    }
    if (words.length === 1 && (words[0] === '$' || words[0] === '`')) substAt = scopes.length;
    if (!words.length) continue;

    const [head, ...rest] = words;
    const name = baseName(head);
    // `$G push`, `g${E}it push`: a command name the shell builds may be git.
    if (SHELL_EXPANDS.test(name) && (rest.includes('push') || rest.includes('merge'))) {
      events.push({ kind: 'opaque', unreadable: true });
    }
    if (DECLARES.has(head) && rest.some((a) => GIT_CONFIG_ENV.test(a))) {
      state.configEnv = true;
    }
    if (head === 'cd' || head === 'pushd') {
      const next = afterCd(state.dir, state.known, rest);
      state.dir = next.dir;
      state.known = next.known;
    } else if (head === 'popd') {
      state.known = false;
    } else if (SHELLS.has(name) && rest.some((a) => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a))) {
      const at = rest.findIndex((a) => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a));
      if (rest[at + 1] !== undefined) {
        const inner = { dir: state.dir, known: state.known, moved: state.moved, configEnv };
        events.push(...analyzeCommand(rest[at + 1], state.dir, inner));
        state.moved = state.moved || inner.moved;
      }
    } else if (name === 'eval' || name === 'xargs') {
      const tokens = rest.flatMap((w) => w.split(/\s+/)).map(baseName);
      if (tokens.includes('git') && tokens.includes('push')) events.push({ kind: 'opaque' });
      if (tokens.includes('gh') && tokens.includes('merge')) events.push({ kind: 'opaque' });
    } else if (name === 'gh') {
      if (rest[0] === 'api' && apiWrites(rest.slice(1))) events.push({ kind: 'opaque' });
      const merge = findMerge(rest);
      if (merge === UNREADABLE_MERGE) {
        events.push({ kind: 'opaque', unreadable: true });
      } else if (merge) {
        events.push({ kind: 'merge', dir: state.dir, dirKnown: state.known, ...parseMergeArgs(merge) });
      }
    } else if (name === 'git') {
      // Config from the environment can define an alias the guard never sees.
      if (configEnv) events.push({ kind: 'opaque', unreadable: true });
      let gitDir = state.dir;
      let gitKnown = state.known && !wrapperMovedDir;
      let aliased = false;
      let i = 0;
      for (; i < rest.length && rest[i].startsWith('-'); i++) {
        const flag = rest[i];
        // `--config-env` names a variable, so its alias value cannot be read at all.
        const alias = /^alias\./i.test(rest[i + 1] ?? '');
        if (alias && (flag === '--config-env' || (flag === '-c' && aliasPublishes(rest[i + 1].slice(rest[i + 1].indexOf('=') + 1 || rest[i + 1].length), gitDir)))) aliased = true;
        if (/^--config-env=alias\./i.test(flag)) aliased = true;
        // A config key the shell builds may be an alias.
        const configKey = flag === '-c' || flag === '--config-env' ? (rest[i + 1] ?? '') : flag.startsWith('--config-env=') ? flag.slice(13) : '';
        if (SHELL_EXPANDS.test(configKey.split('=')[0])) aliased = true;
        if (flag === '-C') {
          if (rest[i + 1] !== undefined) {
            const next = afterCd(gitDir, gitKnown, [rest[++i]]);
            gitDir = next.dir;
            gitKnown = next.known;
          }
        } else if (GIT_GLOBAL_WITH_VALUE.has(flag)) {
          i++;
        }
      }
      const sub = rest[i];
      const args = rest.slice(i + 1);
      const aliasAt = sub === 'config' ? args.findIndex((a) => /^alias\./i.test(a)) : -1;
      if (aliased || (sub && SHELL_EXPANDS.test(sub)) || (aliasAt !== -1 && aliasPublishes(args.slice(aliasAt + 1).join(' '), gitDir))) {
        // An alias or a shell expansion can turn into `push`; the guard cannot read which.
        events.push({ kind: 'opaque', unreadable: true });
      } else if (sub === 'send-pack' || (sub === 'subtree' && args.includes('push'))) {
        // These publish commits without `push` in the subcommand place.
        events.push({ kind: 'opaque', unreadable: true });
      } else if (sub === 'push' && /[$`]$/.test(rest[rest.length - 1])) {
        // `git push $(echo origin) main`: the substitution cuts the arguments short.
        events.push({ kind: 'opaque', unreadable: true });
      } else if (sub === 'push') {
        events.push({
          kind: 'push',
          dir: gitDir,
          dirKnown: gitKnown,
          movedBefore: state.moved,
          ...parsePushArgs(args.map((a) => (gitDir === state.dir && CURRENT_BRANCH.test(a) ? 'HEAD' : a))),
        });
      } else if (sub && movesHead(sub, rest.slice(i + 1))) {
        state.moved = true;
      }
    }
  }
  if (parent) parent.moved = state.moved;
  return events;
}

// Every `git push` in a shell command (see analyzeCommand).
export function findPushes(command, baseCwd) {
  return analyzeCommand(command, baseCwd).filter((e) => e.kind === 'push');
}

// ---------------------------------------------------------------------------
// Decisions (pure)
// ---------------------------------------------------------------------------

export function isMainRef(ref) {
  return ref === 'main' || ref === 'refs/heads/main' || ref === 'heads/main';
}

const stripHeads = (ref) => (ref ?? '').replace(/^(refs\/)?heads\//, '');

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
    targets.push({ src, dst, bare: colon === -1 && src !== 'HEAD' });
  }
  return targets;
}

// Judge one stamp for one commit. { ok: true } or { ok: false, kind, failed }.
//   kind 'missing'  no usable stamp for this commit
//   kind 'failed'   the stamp says a check failed (failed lists their names)
//   kind 'security' going to main without a passing security review
//   kind 'impeccable' frontend changes without a passing Impeccable review
//   kind 'unslop'   frontend changes without a passing unslop review
export function checkStamp(stamp, sha, toMain, frontend = false) {
  if (!stamp || typeof stamp !== 'object' || stamp.sha !== sha) {
    return { ok: false, kind: 'missing', failed: [] };
  }
  const checks = stamp.checks && typeof stamp.checks === 'object' ? stamp.checks : {};
  const failed = CHECK_NAMES.filter((name) => checks[name] === 'fail');
  // The gate and the review always apply; a stamp that skips them is not a pass.
  for (const name of ['gate', 'review']) if (checks[name] !== 'pass' && !failed.includes(name)) failed.push(name);
  if (stamp.result !== 'pass' || failed.length) {
    return { ok: false, kind: 'failed', failed };
  }
  if (toMain && checks.security !== 'pass') {
    return { ok: false, kind: 'security', failed: [] };
  }
  if (frontend && checks.impeccable !== 'pass') {
    return { ok: false, kind: 'impeccable', failed: [] };
  }
  if (frontend && checks.unslop !== 'pass') {
    return { ok: false, kind: 'unslop', failed: [] };
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
  } else if (kind === 'impeccable') {
    what = `${where} changes frontend files, and its push check has no passing Impeccable design review.`;
  } else if (kind === 'unslop') {
    what = `${where} changes frontend files, and its push check has no passing unslop design review.`;
  } else {
    what = `${where} has no push check yet.`;
  }
  return `Push blocked. ${what} ${NEXT_STEP}`;
}

const MOVED_REASON =
  'Push blocked. Run the push as its own command, after the commit or branch change, ' +
  'so the guard can check the exact commit being pushed.';
const UNREADABLE_REASON =
  'Blocked: the guard could not read what this git or gh command runs. ' +
  'Write it as a plain command, such as git push or gh pr merge 12, with nothing built by the shell.';
const UNKNOWN_REASON =
  'Push blocked: the guard could not tell which commit this push publishes. ' +
  'Run git push as a plain command from the checkout.';

const CODE_TO_MAIN_REASON =
  'Push blocked. Only docs (docs/ and root *.md files) may be pushed straight to main. ' +
  'Code goes through a pull request: /land pushes the branch and opens it.';
const GH_REASON =
  'Merge blocked: the guard could not look up the pull request (gh missing, not signed in, or no PR). ' +
  'Run gh pr merge with the PR number from the checkout, after /push-check --main on its head commit.';

const AUTO_REASON =
  'Merge blocked: gh pr merge --auto merges whatever head the PR has later, not the one checked now. ' +
  'Merge without --auto after the checks are green, as /land does (or pass --match-head-commit with the checked head).';

// The whole hook decision, with git access injected so it can be tested.
// Returns null to allow, or { reason } to deny. Unparsable input and non-Bash
// calls allow; once a command clearly contains a push, anything the guard
// cannot resolve denies, and every push in the command is still examined.
//   git.resolveCommit(dir, rev) -> full sha (throws when rev does not resolve)
//   git.currentBranch(dir)      -> branch name or null
//   git.readStamp(dir, sha)     -> parsed stamp or null
//   git.isTagOnly(dir, name)    -> true when name is a tag and not a branch
//   git.touchesFrontendAt(dir, sha) -> true when the commit changes frontend files
//   git.codePathsAt(dir, sha)   -> changed paths outside the docs allowlist
//   git.prInfo(dir, selector, repo) -> { headRefOid, files: [path], headRefName } (throws on failure)
//   git.hasCommit(dir, sha)     -> true when the commit exists locally
export function hookDecision(input, git) {
  if (!input || input.tool_name !== 'Bash') return null;
  const command = input.tool_input?.command;
  // Quotes and backslashes are gone by the time the shell runs it: `pu""sh` is `push`.
  // A line continuation joins its two halves: `git p\<newline>ush` is `git push`.
  if (typeof command !== 'string' || !/\b(git|gh|push|merge)\b/.test(command.replace(/\\\n/g, '').replace(/["'\\]/g, ''))) return null;

  const cwd = input.cwd || process.cwd();
  let denial = null;
  const deny = (reason) => {
    denial ??= reason;
  };

  for (const ev of analyzeCommand(command, cwd)) {
    if (ev.kind === 'opaque') {
      deny(ev.unreadable ? UNREADABLE_REASON : MOVED_REASON);
      continue;
    }
    if (ev.kind === 'merge') {
      try {
        if (!ev.dirKnown) throw new Error('unknown dir');
        const pr = git.prInfo(ev.dir, ev.selector, ev.repo);
        const sha = pr?.headRefOid ?? '';
        if (!/^[0-9a-f]{40}$/.test(sha) || !Array.isArray(pr.files)) throw new Error('bad PR');
        if (ev.auto && ev.matchHead !== sha) {
          deny(AUTO_REASON);
          continue;
        }
        // gh lists only a rename's new path, so a local commit is judged by git (--no-renames).
        const frontend = git.hasCommit(ev.dir, sha) ? git.touchesFrontendAt(ev.dir, sha) : touchesFrontend(pr.files);
        const verdict = checkStamp(git.readStamp(ev.dir, sha), sha, true, frontend);
        if (!verdict.ok) deny(denyReason(verdict, sha, pr.headRefName));
      } catch {
        deny(GH_REASON);
      }
      continue;
    }
    try {
      const current = ev.dirKnown ? git.currentBranch(ev.dir) : null;
      const targets = pushTargets(ev, current);
      if (!targets.length) continue;
      if (!ev.dirKnown) {
        deny(UNKNOWN_REASON);
        continue;
      }
      if (ev.movedBefore) {
        deny(MOVED_REASON);
        continue;
      }
      for (const target of targets) {
        if (/[*?[]/.test(target.src)) throw new Error('glob refspec');
        if (target.bare && git.isTagOnly?.(ev.dir, target.src)) continue;
        const sha = git.resolveCommit(ev.dir, target.src);
        const toMain = Boolean(target.all) || isMainRef(target.dst);
        if (toMain && git.codePathsAt(ev.dir, sha).length) {
          deny(CODE_TO_MAIN_REASON);
          continue;
        }
        const frontend = git.touchesFrontendAt(ev.dir, sha);
        const verdict = checkStamp(git.readStamp(ev.dir, sha), sha, toMain, frontend);
        if (!verdict.ok) deny(denyReason(verdict, sha, stripHeads(target.dst) || current));
        // `git push origin HEAD:$B`: the shell picks the branch, so the stamp cannot vouch for where it lands.
        else if (SHELL_EXPANDS.test(`${target.src}${target.dst ?? ''}`)) deny(UNREADABLE_REASON);
      }
    } catch {
      deny(UNKNOWN_REASON);
    }
  }
  return denial ? { reason: denial } : null;
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

function refExists(dir, ref) {
  try {
    git(dir, ['rev-parse', '--verify', '-q', ref]);
    return true;
  } catch {
    return false;
  }
}

export function isTagOnly(dir, name) {
  return refExists(dir, `refs/tags/${name}`) && !refExists(dir, `refs/heads/${name}`);
}

// Files the commit changes against origin/main, limited to `paths` when given.
// Without origin/main there is no base, so every file in the commit counts as
// new. `-z` keeps unusual names unquoted (git would print
// "apps/mobile/\303\251.tsx" in quotes), and --no-renames lists both sides of
// a move, so moving a file out of the frontend still counts as touching it.
// Git runs from the top of the checkout, because pathspecs and ls-tree are
// relative to the working directory (a push from apps/mobile/ must still see
// apps/mobile/). With no merge base (unrelated history, a shallow clone) the
// diff throws, and the hook then denies as unresolvable: fail closed. The
// base is the full ref, so a local tag or branch named origin/main cannot stand in.
export function changedPaths(dir, sha, paths = []) {
  const top = git(dir, ['rev-parse', '--show-toplevel']);
  const limit = paths.length ? ['--', ...paths] : [];
  const out = refExists(top, 'refs/remotes/origin/main')
    ? git(top, ['diff', '--name-only', '--no-renames', '-z', `refs/remotes/origin/main...${sha}`, ...limit])
    : git(top, ['ls-tree', '-r', '--full-tree', '--name-only', '-z', sha, ...limit]);
  return out.split('\0').filter(Boolean);
}

// Asks git for frontend paths only, so the hook stays cheap on a large tree.
export function touchesFrontendAt(dir, sha) {
  return touchesFrontend(changedPaths(dir, sha, FRONTEND_PREFIXES));
}

// Changed paths a direct push to main may not carry (see isDocPath).
export function codePathsAt(dir, sha) {
  return changedPaths(dir, sha).filter((p) => !isDocPath(p));
}

// Looks the PR up with gh. Throws on any failure, so the hook denies. gh is
// found on the hook's PATH; the timeout keeps a hung network call short.
// gh lists at most 100 files, so a PR at that cap counts as frontend.
export function prInfo(dir, selector, repo) {
  const args = ['pr', 'view', ...(selector ? [selector] : []), ...(repo ? ['--repo', repo] : [])];
  const out = execFileSync('gh', [...args, '--json', 'headRefOid,files,headRefName'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 15000,
  });
  const json = JSON.parse(out);
  const files = (json.files ?? []).map((f) => f.path);
  if (files.length >= 100) files.push(FRONTEND_PREFIXES[0]);
  return { headRefOid: json.headRefOid, files, headRefName: json.headRefName };
}

export function hasCommit(dir, sha) {
  try {
    git(dir, ['cat-file', '-e', `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

const realGit = { hasCommit, resolveCommit, currentBranch, readStamp, isTagOnly, touchesFrontendAt, codePathsAt, prInfo };

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
  '[--impeccable pass|fail|n/a] [--unslop pass|fail|n/a] ' +
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
        impeccable: { type: 'string' },
        unslop: { type: 'string' },
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
    if (values.checks.impeccable === 'n/a' && touchesFrontendAt(dir, sha)) {
      process.stderr.write(
        'This commit changes frontend files (apps/mobile/, packages/core/), so --impeccable must be pass or fail, not n/a. ' +
          'Run the Impeccable design review step of /push-check.\n',
      );
      process.exit(1);
    }
    if (values.checks.unslop === 'n/a' && touchesFrontendAt(dir, sha)) {
      process.stderr.write(
        'This commit changes frontend files (apps/mobile/, packages/core/), so --unslop must be pass or fail, not n/a. ' +
          'Run the unslop design review step of /push-check.\n',
      );
      process.exit(1);
    }
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
