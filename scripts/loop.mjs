#!/usr/bin/env node
/** Local, sequential Claude runner. Leaves every edit for review; never stages or rolls back. */
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = ['Read', 'Edit', 'Write', 'Grep', 'Glob', 'Bash'];
const ALLOWED = ['Read', 'Edit', 'Write', 'Grep', 'Glob', 'Bash(npm run:*)', 'Bash(npm test:*)', 'Bash(node --test:*)', 'Bash(git diff:*)', 'Bash(git status:*)', 'Bash(git log:*)'];
const digest = (value) => createHash('sha256').update(value).digest('hex');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();

export function options(argv) {
  const result = { max: 10, minutes: 60, patience: 2, 'permission-mode': 'dontAsk' };
  const valued = new Set(['max', 'minutes', 'patience', 'branch', 'model', 'plan', 'resume', 'files', 'permission-mode', 'max-budget-usd']);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (['dry-run', 'help'].includes(key) && argv[i].startsWith('--')) result[key] = true;
    else if (argv[i].startsWith('--') && valued.has(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) result[key] = argv[++i];
    else throw new Error(`Unknown or incomplete option: ${argv[i]}`);
  }
  for (const key of ['max', 'minutes', 'patience', 'max-budget-usd']) {
    if (result[key] === undefined) continue;
    result[key] = Number(result[key]);
    if (!Number.isFinite(result[key]) || result[key] <= 0 || (['max', 'patience'].includes(key) && !Number.isInteger(result[key]))) throw new Error(`--${key} must be a positive ${key === 'minutes' || key === 'max-budget-usd' ? 'number' : 'integer'}`);
  }
  if (!['dontAsk', 'acceptEdits'].includes(result['permission-mode'])) throw new Error('Use dontAsk or acceptEdits; this runner does not bypass permissions.');
  if (result.resume && !/^[a-zA-Z0-9_-]+$/.test(result.resume)) throw new Error('Invalid resume ID');
  return result;
}

export function safePath(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') || /[\0\r\n]/.test(value)) throw new Error(`Unsafe path: ${value}`);
  const parts = value.replace(/\/$/, '').split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || ['.git', '.loop', 'node_modules', '.env', '.codex', '.agents'].includes(p) || p.startsWith('.env.'))) throw new Error(`Unsafe path: ${value}`);
  return value;
}

export function parsePlan(text) {
  const blocks = [...text.matchAll(/^```luvani-loop\s*\n([\s\S]*?)^```\s*$/gm)];
  if (blocks.length !== 1) throw new Error('Plan needs exactly one fenced luvani-loop JSON block. See docs/LOOP.md.');
  const plan = JSON.parse(blocks[0][1]);
  if (plan.version !== 1 || !Array.isArray(plan.tasks) || !plan.tasks.length) throw new Error('Plan requires version 1 and non-empty tasks');
  const ids = new Set();
  for (const task of plan.tasks) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(task.id ?? '') || ids.has(task.id)) throw new Error(`Invalid or duplicate task ID: ${task.id}`);
    ids.add(task.id);
    if (typeof task.goal !== 'string' || !task.goal.trim()) throw new Error(`${task.id} needs a goal`);
    if (!Array.isArray(task.files) || !task.files.length) throw new Error(`${task.id} needs allowed files`);
    task.files.forEach(safePath);
    if (!Array.isArray(task.dependsOn)) throw new Error(`${task.id} needs dependsOn`);
    if (!Array.isArray(task.checks) || !task.checks.length || task.checks.some((c) => !Array.isArray(c) || !c.length || c.some((s) => typeof s !== 'string' || !s || s.includes('\0')))) throw new Error(`${task.id} needs command argument arrays in checks`);
  }
  const visited = new Set(), active = new Set();
  const visit = (task) => {
    if (active.has(task.id)) throw new Error(`Dependency cycle at ${task.id}`);
    if (visited.has(task.id)) return;
    active.add(task.id);
    for (const id of task.dependsOn) {
      const parent = plan.tasks.find((t) => t.id === id);
      if (!parent) throw new Error(`Unknown dependency ${id}`);
      visit(parent);
    }
    active.delete(task.id); visited.add(task.id);
  };
  plan.tasks.forEach(visit);
  return plan;
}

export const inScope = (file, allowed) => allowed.some((p) => file === p || (p.endsWith('/') && file.startsWith(p)));

function noSymlinks(root, file) {
  let current = root;
  for (const part of file.replace(/\/$/, '').split('/')) {
    current = path.join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Scope cannot cross a symlink: ${file}`);
  }
}

/** Only changed, non-ignored Git paths; hashes bind resume to the actual edits. */
function snapshot(root) {
  const paths = new Set([...git(root, 'diff', '--name-only', '-z', 'HEAD').split('\0'), ...git(root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0')].filter(Boolean));
  return Object.fromEntries([...paths].sort().map((file) => {
    const full = path.join(root, file);
    return [file, !existsSync(full) ? 'deleted' : lstatSync(full).isSymbolicLink() ? `link:${readlinkSync(full)}` : digest(readFileSync(full))];
  }));
}
const altered = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((p) => a[p] !== b[p]);

/** Deadline and Ctrl-C stop the entire child process group on macOS/Linux. */
export function runCommand(root, command, deadline, signal, log) {
  return new Promise((resolve) => {
    if (signal.aborted || deadline <= Date.now()) return resolve({ code: 1, output: 'Run cancelled or time limit reached', stopped: true });
    let output = '', stopped = false, finished = false, killTimer;
    const child = spawn(command[0], command.slice(1), { cwd: root, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const collect = (chunk) => { const text = chunk.toString(); if (log) appendFileSync(log, text); output = (output + text).slice(-32000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const kill = (sig) => { try { process.platform === 'win32' ? child.kill(sig) : process.kill(-child.pid, sig); } catch { /* already exited */ } };
    const stop = () => { if (stopped) return; stopped = true; kill('SIGTERM'); killTimer = setTimeout(() => kill('SIGKILL'), 750); };
    const timer = setTimeout(stop, Math.min(deadline - Date.now(), 2 ** 31 - 1));
    signal.addEventListener('abort', stop, { once: true });
    const finish = (code) => {
      if (finished) return;
      finished = true; clearTimeout(timer); if (!stopped) clearTimeout(killTimer); signal.removeEventListener('abort', stop);
      resolve({ code: stopped ? 1 : code ?? 1, output, stopped });
    };
    child.on('error', (error) => { collect(`${error.message}\n`); finish(1); });
    child.on('close', finish);
  });
}

function promptFor(task, planText, feedback) {
  return `Work in this Luvani checkout. Read AGENTS.md, CONTEXT.md and any nested instructions first.\n\nTask ${task.id}: ${task.goal}\nAllowed paths: ${task.files.join(', ')}\nAcceptance commands: ${JSON.stringify(task.checks)}\n\n${planText}\n\nPrevious attempt evidence:\n${feedback || 'None.'}\n\nComplete only this task. Reuse the current owner and existing patterns. Add meaningful regression proof for a defect. Never weaken assertions or test floors. Do not edit this plan, commit, stage, push, change branches, reset, clean, delegate, or edit outside the allowed paths. Preserve partial work and report remaining failures. The runner executes acceptance commands and the full gate independently. Your reply cannot mark a task complete.\n`;
}

function bugTask(root, gate, files) {
  const target = gate.open?.find((o) => o.severity === 'P0') ?? gate.open?.find((o) => o.severity === 'P1');
  const ledger = readFileSync(path.join(root, 'docs/KNOWN_ISSUES.md'), 'utf8');
  const block = target ? ledger.split(/(?=^### )/m).find((b) => b.startsWith(`### ${target.id} `)) ?? '' : '';
  const where = block.match(/^- where: (.+)$/m)?.[1] ?? '';
  const inferred = where.split(/,\s*/).map((p) => p.trim().replace(/:\d+(?:-\d+)?$/, '')).filter((p) => /^(apps|packages|services|scripts)\//.test(p) && !p.includes(' '));
  const allowed = files ? files.split(',') : inferred;
  if (!allowed.length) throw new Error('Cannot infer a bounded bug scope. Pass --files path1,path2 or use --plan.');
  for (let i = 0; i < allowed.length; i++) {
    safePath(allowed[i]);
    const full = path.join(root, allowed[i]);
    if (existsSync(full) && lstatSync(full).isDirectory() && !allowed[i].endsWith('/')) allowed[i] += '/';
  }
  if (!allowed.includes('docs/KNOWN_ISSUES.md')) allowed.push('docs/KNOWN_ISSUES.md');
  return { id: target?.id ?? 'gate', goal: `${target ? `${target.id}: ${target.title}` : 'Repair the failing gate checks'}\n${block}\n${JSON.stringify(gate.failures)}`, files: allowed, checks: [[process.execPath, 'scripts/gate.mjs', '--json']] };
}

export async function runLoop({ root = ROOT, argv = process.argv.slice(2), print = console.log } = {}) {
  const opts = options(argv);
  if (opts.help) { print('npm run loop -- --plan docs/changes/example.md [--dry-run] [--max 10 --minutes 60 --patience 2]\nResume: npm run loop -- --resume <run-id>\nBug mode: npm run loop -- --files <comma-separated-paths>\nOptional: --branch codex/name --model <model> --max-budget-usd <per-attempt-cap>'); return 0; }
  const runId = opts.resume ?? `${Date.now()}-${process.pid}`;
  const runDir = path.join(root, '.loop', runId), stateFile = path.join(runDir, 'state.json');
  const old = opts.resume ? JSON.parse(readFileSync(stateFile, 'utf8')) : null;
  if (old && (old.version !== 1 || old.root !== root)) throw new Error('Resume belongs to a different checkout or runner version');
  opts.model ??= old?.model;
  opts['max-budget-usd'] ??= old?.budget;
  const planPath = opts.plan ?? old?.planPath ?? null;
  if (planPath) { safePath(planPath); noSymlinks(root, planPath); }
  const planText = planPath ? readFileSync(path.join(root, planPath), 'utf8') : '';
  const plan = planPath ? parsePlan(planText) : null;
  if (plan) for (const task of plan.tasks) {
    task.files.forEach((p) => { noSymlinks(root, p); if (inScope(planPath, [p])) throw new Error('The runner plan must be outside task write scopes'); });
  }
  const hash = digest(planText);
  if (old && (old.planHash !== hash || old.planPath !== planPath || old.head !== git(root, 'rev-parse', 'HEAD') || old.branch !== git(root, 'branch', '--show-current') || JSON.stringify(old.snapshot) !== JSON.stringify(snapshot(root)))) throw new Error('Resume refused: plan, Git revision, branch or working files changed since the checkpoint. Review the edits before starting a new run.');
  if (old?.status === 'scope-violation') throw new Error('Resume refused after a scope violation; review and reconcile the saved edits first.');
  if (opts['dry-run']) {
    const task = plan?.tasks.find((t) => !old?.done.includes(t.id) && t.dependsOn.every((id) => old?.done.includes(id))) ?? plan?.tasks.find((t) => t.dependsOn.length === 0);
    print(plan ? promptFor(task ?? plan.tasks[0], planText, old?.feedback) : 'Bug mode will run the full gate, select an open P0/P1 or failing check, and restrict edits to --files or the ledger paths. No commands or model calls ran.');
    print(`Dry run: ${plan?.tasks.length ?? 'bug'} tasks; max ${opts.max} attempts, ${opts.minutes} minutes. No files or Git state changed.`); return 0;
  }
  if (!old && Object.keys(snapshot(root)).length) throw new Error('Start from a clean checkout on a dedicated branch. Existing edits are preserved; --dry-run works with a dirty tree.');
  if (opts.branch && !old && opts.branch !== git(root, 'branch', '--show-current')) {
    if (!opts.branch.startsWith('codex/')) throw new Error('Use a codex/ branch name');
    git(root, 'switch', '-c', opts.branch);
  }
  const branch = git(root, 'branch', '--show-current');
  if (!branch || ['main', 'master'].includes(branch)) throw new Error('Use a dedicated branch, or pass --branch codex/<name> to create one.');
  git(root, 'diff', '--cached', '--quiet');
  mkdirSync(runDir, { recursive: true });
  const controller = new AbortController(), interrupt = () => controller.abort();
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  const deadline = Date.now() + opts.minutes * 60000;
  const state = old ?? { version: 1, root, planPath: planPath ?? null, planHash: hash, head: git(root, 'rev-parse', 'HEAD'), branch, model: opts.model, budget: opts['max-budget-usd'], done: [], attempts: 0, feedback: '', status: 'running' };
  state.model = opts.model; state.budget = opts['max-budget-usd'];
  const note = (value) => { appendFileSync(path.join(runDir, 'journal.md'), `${new Date().toISOString()} ${value}\n`); print(value); };
  const save = () => { state.snapshot = snapshot(root); writeFileSync(`${stateFile}.tmp`, JSON.stringify(state, null, 2)); renameSync(`${stateFile}.tmp`, stateFile); };
  const execute = async (command, label) => {
    note(command[0] === 'claude' ? `Agent attempt ${state.attempts}` : `Check: ${JSON.stringify(command)}`);
    const result = await runCommand(root, command, deadline, controller.signal, path.join(runDir, `${label}.log`));
    appendFileSync(path.join(runDir, 'iterations.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), command, code: result.code, stopped: result.stopped })}\n`);
    return result;
  };
  const gate = async () => {
    const result = await execute([process.execPath, 'scripts/gate.mjs', '--json'], `gate-${state.attempts}`);
    let data; try { data = JSON.parse(result.output); } catch { data = { ok: false, failures: [{ check: 'gate', detail: result.output }], open: [] }; }
    return { ...data, ok: result.code === 0 && data.ok === true, stopped: result.stopped };
  };
  const stableGit = () => state.head === git(root, 'rev-parse', 'HEAD') && branch === git(root, 'branch', '--show-current') && git(root, 'diff', '--cached', '--name-only') === '';
  try {
    note(`Run ${runId} on ${branch}. Checkpoint: .loop/${runId}/state.json`); save();
    // Previous check results are evidence, but are rerun before trusting dependencies.
    if (plan && old) for (const id of [...state.done]) {
      const task = plan.tasks.find((t) => t.id === id);
      for (const command of task.checks) {
        const before = snapshot(root);
        const result = await execute(command, `resume-${id}`);
        if (altered(before, snapshot(root)).length || !stableGit()) throw new Error('Resume checks changed working files or Git state; review before continuing.');
        if (result.code !== 0) { state.done = []; state.feedback = `${id} revalidation failed:\n${result.output}`; break; }
      }
      if (!state.done.length) break;
    }
    const initial = snapshot(root);
    let current = plan ? null : await gate(), stale = 0, previousTask;
    if (altered(initial, snapshot(root)).length || !stableGit()) throw new Error('Initial gate changed working files or Git state; review before continuing.');
    let used = 0;
    while (used < opts.max && Date.now() < deadline && !controller.signal.aborted) {
      if (!plan && current.ok) { state.status = 'complete'; note('Gate is green.'); break; }
      const task = plan ? plan.tasks.find((t) => !state.done.includes(t.id) && t.dependsOn.every((id) => state.done.includes(id))) : bugTask(root, current, opts.files);
      if (!task) break;
      if (task.id !== previousTask) { stale = 0; previousTask = task.id; }
      if (stale >= opts.patience) { note(`${task.id} needs review after ${stale} failed attempts.`); break; }
      task.files.forEach((p) => noSymlinks(root, p));
      const before = snapshot(root), prompt = promptFor(task, planText, state.feedback);
      state.attempts++; used++; state.status = 'running';
      const promptFile = path.join(runDir, `prompt-${state.attempts}.md`); writeFileSync(promptFile, prompt);
      note(`Attempt ${state.attempts}: ${task.id}`);
      const args = ['claude', '-p', prompt, '--permission-mode', opts['permission-mode'], '--tools', TOOLS.join(','), '--allowedTools', ALLOWED.join(',')];
      if (opts.model) args.push('--model', opts.model);
      if (opts['max-budget-usd']) args.push('--max-budget-usd', String(opts['max-budget-usd']));
      const agent = await execute(args, `agent-${state.attempts}`);
      task.files.forEach((p) => noSymlinks(root, p));
      const violations = altered(before, snapshot(root)).filter((p) => !inScope(p, task.files));
      if (violations.length || !stableGit()) { state.status = 'scope-violation'; state.feedback = `Out-of-scope or Git changes: ${violations.join(', ')}`; note(state.feedback); break; }
      if (agent.stopped) { state.status = 'stopped'; state.feedback = 'Agent interrupted or time limit reached. Partial edits preserved.'; break; }
      let failure = agent.code !== 0 ? `Agent exited ${agent.code}:\n${agent.output}` : '';
      if (!failure) for (const command of task.checks) {
        const result = await execute(command, `${task.id}-${state.attempts}`);
        if (result.code !== 0) { failure = `Check ${JSON.stringify(command)} exited ${result.code}:\n${result.output}`; break; }
      }
      const checkViolations = altered(before, snapshot(root)).filter((p) => !inScope(p, task.files));
      if (checkViolations.length || !stableGit()) { state.status = 'scope-violation'; state.feedback = `Checks changed out-of-scope files or Git state: ${checkViolations.join(', ')}`; note(state.feedback); break; }
      if (plan) {
        if (!failure) { state.done.push(task.id); state.feedback = ''; note(`${task.id}: acceptance passed.`); stale = 0; }
        else { state.feedback = failure; note(`${task.id}: failed; edits preserved for the next attempt.`); stale++; }
      } else {
        const after = await gate();
        if (altered(before, snapshot(root)).some((p) => !inScope(p, task.files)) || !stableGit()) { state.status = 'scope-violation'; state.feedback = 'Bug gate changed out-of-scope files or Git state.'; break; }
        const score = (g) => (g.open?.filter((o) => ['P0', 'P1'].includes(o.severity)).length ?? 0) * 10000 + (g.failures?.length ?? 1);
        const improved = !failure && score(after) < score(current);
        stale = improved ? 0 : stale + 1; current = failure ? { ...after, ok: false } : after;
        state.feedback = failure || JSON.stringify(after.failures);
      }
      save();
    }
    if (plan && state.done.length === plan.tasks.length && !controller.signal.aborted && Date.now() < deadline) {
      const before = snapshot(root), final = await gate();
      if (altered(before, snapshot(root)).length || !stableGit()) { state.status = 'scope-violation'; state.feedback = 'Final gate changed working files or Git state.'; }
      else { state.status = final.ok ? 'complete' : 'gate-failed'; state.feedback = final.ok ? '' : JSON.stringify(final.failures); }
    } else if (state.status === 'running') state.status = 'stopped';
    save(); note(`${state.status}. ${state.done.length} task(s) accepted. Edits and logs remain in this checkout for review.`);
    return state.status === 'complete' ? 0 : 1;
  } catch (error) { state.status = 'stopped'; state.feedback = error.message; save(); throw error; }
  finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runLoop().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
