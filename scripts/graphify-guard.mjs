#!/usr/bin/env node
// PreToolUse guard: route codebase questions to the right graphify command.
//
// Replaces `graphify hook-guard`, whose message is baked into the graphify
// binary and always demands a bare `graphify query` first. On this repo that
// is the wrong default: bare `query` truncates (304 nodes found, 61 shown),
// while `affected` / `explain` answer pinpoint questions exactly and
// `--context call` keeps a subsystem query whole. See CLAUDE.md § graphify.
//
// Contract: read the tool-call JSON on stdin, print a hookSpecificOutput
// envelope with additionalContext. Never blocks — any error or non-matching
// call prints nothing and exits 0.

import { existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, extname, basename } from 'node:path';

const KIND = process.argv[2] === 'read' ? 'read' : 'search';
const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const GRAPH = resolve(ROOT, 'graphify-out/graph.json');

// Same set the graphify guard matched, so behaviour is unchanged apart from wording.
const SOURCE_EXTS = new Set([
  '.py', '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.astro', '.vue', '.svelte',
  '.go', '.rs', '.java', '.rb', '.c', '.h', '.cpp', '.hpp', '.cc', '.cs', '.kt',
  '.swift', '.php', '.scala', '.lua', '.sh', '.md', '.rst', '.txt', '.mdx',
]);

const ROUTING = [
  'graphify: a knowledge graph covers this repo. Route by question shape rather than',
  'defaulting to a bare query, and seed on symbol names rather than a sentence:',
  '  what breaks if I change X / who uses X  ->  graphify affected "X"',
  '  what is X                               ->  graphify explain "X"',
  '  how do these symbols connect            ->  graphify query "sym1 sym2" --context call --budget 3000',
  '  relationship between A and B            ->  graphify path "A" "B" --undirected',
  '  broad architecture                      ->  graphify-out/wiki/index.md, then GRAPH_REPORT.md',
  'Bare `query` truncates on this repo; --context call keeps the result whole. Seeding',
  'is lexical, so a prose question finds the wrong nodes and returns no edges. `path`',
  'needs --undirected because the graph is undirected. Going straight to the file to',
  'edit or debug specific lines is fine — this is orientation, not a gate.',
].join('\n');

const STALE_NOTE =
  '\nNote: this file changed after the last graph build, so the graph may be stale ' +
  'for it. Reading it directly is the right call; run `graphify update .` to refresh.';

function emit(text) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: text },
    }) + '\n',
  );
}

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

try {
  if (!existsSync(GRAPH)) process.exit(0);

  const payload = readStdin();
  if (!payload || typeof payload !== 'object') process.exit(0);
  const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : payload;

  if (KIND === 'search') {
    const cmd = String(input.command || '');
    // The Grep tool carries `pattern` and no command; Bash carries `command`.
    const isGrepTool = !cmd && Boolean(input.pattern);
    const isBashSearch = ['grep', 'ripgrep', 'rg ', 'find ', 'fd ', 'ack ', 'ag '].some((t) => cmd.includes(t));
    if (isGrepTool || isBashSearch) emit(ROUTING);
    process.exit(0);
  }

  // kind === 'read'
  const filePath = String(input.file_path || '');
  const pathVals = [filePath, String(input.path || '')].filter(Boolean);
  const all = [filePath, String(input.pattern || ''), String(input.path || '')].filter(Boolean);
  const joined = all.join(' ').toLowerCase().replace(/\\/g, '/');

  if (joined.includes('graphify-out/')) process.exit(0);
  if (!all.some((v) => SOURCE_EXTS.has(extname(basename(v)).toLowerCase()))) process.exit(0);

  // Skip files outside this project.
  if (pathVals.length) {
    const inProject = pathVals.some((v) => {
      if (!isAbsolute(v)) return true;
      const rel = relative(ROOT, resolve(v));
      return rel && !rel.startsWith('..');
    });
    if (!inProject) process.exit(0);
  }

  let stale = false;
  try {
    const gmtime = statSync(GRAPH).mtimeMs;
    if (filePath) stale = statSync(filePath).mtimeMs > gmtime;
  } catch {
    stale = false;
  }
  if (existsSync(resolve(ROOT, 'graphify-out/needs_update'))) stale = true;

  emit(stale ? ROUTING + STALE_NOTE : ROUTING);
} catch {
  // fail open
}
process.exit(0);
