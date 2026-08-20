#!/usr/bin/env node
/**
 * One command that brings Parle up.
 *
 * Before this, running the app meant four terminals started by hand in the right
 * order, and forgetting one of them is exactly how the app came to report "there
 * is no server available" to its own author: nothing was broken, the token server
 * simply was not running.
 *
 * This file is only the machinery — spawn, stream, wait, reap. Every decision it
 * makes lives in services/shared/devPlan.ts as a pure function, and is tested
 * there. That split is the point: what order to start in and what to do about an
 * occupied port are judgements worth pinning down, while "does SIGTERM reach a
 * grandchild" is the operating system's business, verified by running this.
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootPlan, classifyPort, envGaps, parseEnvFile, sharedAgentSecret } from '../services/shared/devPlan.ts';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const AGENT_ENV_FILE = join(ROOT, 'services/tutor-agent/.env');
const TOKEN_ENV_FILE = join(ROOT, 'services/token-server/.env');

// One colour per stream so four interleaved logs stay readable. Dim rather than
// bright: the children's own output is the content, these are just margins.
const COLOURS = { livekit: '\x1b[36m', token: '\x1b[33m', agent: '\x1b[35m', app: '\x1b[32m', dev: '\x1b[34m' };
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

const say = (label, line, stream = process.stdout) => {
  const colour = COLOURS[label] ?? '';
  stream.write(`${colour}${label.padEnd(7)}${RESET} ${DIM}|${RESET} ${line}\n`);
};

const readEnvFile = (path) => (existsSync(path) ? parseEnvFile(readFileSync(path, 'utf8')) : {});

/** One HTTP probe, shaped for classifyPort. Unreachable is an answer, not an error. */
async function probe(url, timeoutMs = 1200) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: control.signal });
    return { reachable: true, status: response.status, body: (await response.text()).slice(0, 400) };
  } catch {
    return { reachable: false };
  } finally {
    clearTimeout(timer);
  }
}

const children = [];
let shuttingDown = false;

/**
 * npm run <script> forks a grandchild, so killing the pid we hold leaves the
 * real process orphaned and the port still bound. Spawning detached puts each
 * child in its own process group, and killing the negated pid reaps the group.
 */
function launch(step, env) {
  const child = spawn(step.command, step.args, {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  children.push({ step, child });

  const stream = (source, out) => {
    let held = '';
    source.setEncoding('utf8');
    source.on('data', (chunk) => {
      held += chunk;
      const lines = held.split('\n');
      held = lines.pop() ?? '';
      for (const line of lines) if (line.trim() !== '') say(step.label, line, out);
    });
  };
  stream(child.stdout, process.stdout);
  stream(child.stderr, process.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    say('dev', `${step.label} exited (${signal ?? `code ${code}`}). Bringing the rest down.`, process.stderr);
    shutdown(code === 0 ? 1 : (code ?? 1));
  });

  return child;
}

/** Resolve when the step says it is up, or when its own timeout runs out. */
function waitForReady(step, child) {
  const { ready } = step;
  if (ready.kind === 'stdout') {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), ready.timeoutMs);
      const watch = (chunk) => {
        if (!ready.pattern.test(String(chunk))) return;
        clearTimeout(timer);
        child.stdout.off('data', watch);
        child.stderr.off('data', watch);
        resolve(true);
      };
      child.stdout.on('data', watch);
      child.stderr.on('data', watch);
    });
  }
  const deadline = Date.now() + ready.timeoutMs;
  return (async () => {
    for (;;) {
      const result = await probe(ready.url);
      if (result.reachable && step.identify(result)) return true;
      if (Date.now() > deadline) return false;
      await new Promise((r) => setTimeout(r, 400));
    }
  })();
}

/**
 * SIGTERM the group, give it three seconds to close its listeners, then SIGKILL.
 * Anything we chose to reuse rather than start is left strictly alone: it was
 * here before this process and has no reason to leave with it.
 */
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (children.length > 0) say('dev', 'stopping.');
  for (const { child } of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => {
    for (const { child } of children) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
    process.exit(code);
  }, 3000).unref();
}

function die(lines) {
  process.stderr.write(`\n${lines}\n\n`);
  process.exit(1);
}

async function main() {
  const agentEnv = readEnvFile(AGENT_ENV_FILE);
  const tokenEnv = readEnvFile(TOKEN_ENV_FILE);

  // Everything that would otherwise fail three processes deep, said here first.
  const gaps = envGaps(agentEnv, tokenEnv);
  if (gaps.length > 0) {
    die(
      `Parle cannot start. These are missing:\n\n` +
        gaps.map((g) => `        ${g.name}\n          in ${g.file}\n          ${g.why}`).join('\n\n') +
        `\n\n        Each file has a .env.example beside it to copy from.`,
    );
  }

  const brain = (agentEnv.TUTOR_LLM ?? '').trim().toLowerCase();
  if (brain === 'claude-cli' && !hasClaudeCli()) {
    die(
      `TUTOR_LLM=claude-cli, but the claude command is not on PATH.\n` +
        `        Install it, or set TUTOR_LLM=groq in ${AGENT_ENV_FILE.replace(`${ROOT}/`, '')}.`,
    );
  }

  const secret = sharedAgentSecret(agentEnv, tokenEnv, () => randomBytes(24).toString('hex'));
  if (secret.mismatch) {
    die(
      `PARLE_AGENT_SECRET differs between the two .env files.\n` +
        `        Every debit would be refused, and sessions would stop metering silently.\n` +
        `        Make them the same, or remove both and let dev generate one.`,
    );
  }

  const childEnv = { ...process.env, PARLE_AGENT_SECRET: secret.value, FORCE_COLOR: '1' };
  say('dev', `brain: ${brain === '' ? 'anthropic (default)' : brain}`);
  if (secret.generated) say('dev', 'generated a PARLE_AGENT_SECRET for this run, so /session/end is closed.');

  for (const step of resolvedPlan()) {
    const result = step.port === null ? { reachable: false } : await probe(step.ready.url ?? `http://127.0.0.1:${step.port}/`);
    const verdict = classifyPort(step, result);

    if (verdict.kind === 'occupied') {
      shutdown(1);
      die(verdict.message);
    }
    if (verdict.kind === 'reuse') {
      say('dev', verdict.note);
      continue;
    }

    say('dev', `starting ${step.label}...`);
    // Deliberately no CI=1 here. It does stop Expo waiting on its interactive
    // prompt, but it also puts Metro in CI mode, which disables reloads — and a
    // dev command that kills hot reload is not a dev command. Spawning with
    // stdin ignored is enough: Expo only goes interactive on a TTY.
    const child = launch(step, childEnv);
    const ready = await waitForReady(step, child);
    if (ready) {
      say('dev', `${step.label} is up.`);
      continue;
    }
    if (step.ready.fatalOnTimeout) {
      say('dev', `${step.label} did not come up in ${step.ready.timeoutMs / 1000}s.`, process.stderr);
      shutdown(1);
      return;
    }
    say('dev', `${step.label} has not registered yet. Carrying on; watch its lines above for why.`);
  }

  say('dev', '');
  say('dev', `Parle is up. Open http://localhost:8082`);
  say('dev', 'For the microphone, use a real browser rather than an embedded pane.');
  say('dev', 'Ctrl-C stops everything this started.');
}

/** livekit-server is usually built into ~/.local/bin rather than installed globally. */
function resolvedPlan() {
  const plan = bootPlan(process.env);
  const fallback = join(homedir(), '.local/bin/livekit-server');
  return plan.map((step) => {
    if (step.id !== 'livekit' || step.command !== 'livekit-server') return step;
    return existsSync(fallback) ? { ...step, command: fallback } : step;
  });
}

/**
 * Presence, not a live call. `claude -p` costs seconds and subscription quota,
 * which is far too much to spend on every boot just to learn what `--version`
 * answers for free. A login that has expired surfaces on the first post-session
 * call, where it degrades to the deterministic fallback rather than losing the
 * session.
 */
function hasClaudeCli() {
  const out = spawnSync('claude', ['--version'], { stdio: 'ignore' });
  return !out.error && out.status === 0;
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0));

main().catch((err) => {
  say('dev', String(err?.stack ?? err), process.stderr);
  shutdown(1);
});
