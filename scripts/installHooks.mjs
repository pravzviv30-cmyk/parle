#!/usr/bin/env node
/**
 * Point git at .githooks/.
 *
 * Nothing mechanical enforced the gate before this: no CI, no hooks, just CLAUDE.md asking
 * politely. The hooks live in a tracked directory rather than .git/hooks/ so they survive a
 * clone, and `core.hooksPath` is how git is told to look there.
 *
 * This runs from postinstall, so it fails open on purpose. A repo that cannot be installed
 * because a hook could not be configured is a worse outcome than an unhooked repo.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS_DIR = '.githooks';

if (process.env.PARLE_SKIP_HOOKS === '1') {
  console.log('hooks: skipped (PARLE_SKIP_HOOKS=1)');
  process.exit(0);
}

if (!existsSync(path.join(ROOT, '.git'))) {
  // A tarball, a vendored copy, or CI with no history. Nothing to hook.
  process.exit(0);
}

try {
  const current = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  if (current === HOOKS_DIR) {
    process.exit(0);
  }
  if (current && current !== HOOKS_DIR) {
    // Somebody chose a different hooks directory deliberately. Say so and leave it alone.
    console.log(`hooks: core.hooksPath is already ${current}, leaving it alone`);
    process.exit(0);
  }
} catch {
  // Unset is an error exit from `git config --get`, and unset is the common case.
}

try {
  execFileSync('git', ['config', 'core.hooksPath', HOOKS_DIR], { cwd: ROOT, stdio: 'ignore' });
  console.log(`hooks: core.hooksPath -> ${HOOKS_DIR} (pre-commit runs the fast gate, pre-push runs the full one)`);
} catch (err) {
  console.log(`hooks: could not set core.hooksPath (${err.message}). The gate still runs with npm run gate.`);
}
