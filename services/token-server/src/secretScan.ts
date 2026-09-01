/**
 * The secret scanner.
 *
 * What it is for: a leaked Supabase service-role key, LiveKit secret or vendor
 * token is not a data problem here, it is a **minutes** problem. Anyone holding
 * one can mint sessions, drain balances and spend real vendor money, and the
 * only thing standing between that and a push is somebody noticing a long
 * string in a diff.
 *
 * Three rules shape everything below.
 *
 *  1. **A finding reports a path and a line. Never the value.** A scanner that
 *     echoes the secret it found has copied it into CI logs, a terminal
 *     scrollback and whatever ships those somewhere else. `services/shared/
 *     speechace.ts` already keeps its key out of the multipart body for exactly
 *     this reason; this module extends the same habit. Nothing in here
 *     interpolates a matched value into a string, ever.
 *  2. **Blocked is not clean.** `--bundles` with no build output exits non-zero
 *     saying so, rather than reporting zero findings and looking green.
 *  3. **Placeholders are decided by shape, not by filename.** `.env.example` is
 *     scanned like anything else; it passes because `devsecret-...-0000000000`
 *     is recognisably not a credential, not because of where it lives.
 *
 * Modes:
 *   node --experimental-strip-types secretScan.ts              tracked files
 *   node --experimental-strip-types secretScan.ts --all        + untracked
 *   node --experimental-strip-types secretScan.ts --history    git log -p
 *   node --experimental-strip-types secretScan.ts --bundles    build output
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Severity = 'critical' | 'high';

export interface SecretPattern {
  /** Stable id used by findings and by the self-tests' coverage check. */
  id: string;
  /** What a reader needs to know, written without ever quoting the value. */
  what: string;
  severity: Severity;
  /**
   * Matched per line. A `value` capture group narrows the placeholder and
   * entropy judgement to the credential itself rather than the whole line.
   */
  pattern: RegExp;
  /**
   * True when the shape is recognised by the variable name rather than by the
   * credential's own prefix, so the captured value is "whatever followed the
   * equals sign" and may well be code. Only these consult `isCodeReference`;
   * a vendor-prefixed shape like `eyJ...` never should, because a JWT reads
   * exactly like a dotted identifier path.
   */
  contextAnchored?: boolean;
  /** Last word on a match. Receives the value; must never return or log it. */
  refine?: (value: string) => boolean;
}

export interface Finding {
  path: string;
  line: number;
  patternId: string;
  what: string;
  severity: Severity;
  /** `tree`, `bundle`, or `history <short sha>` — never the matched text. */
  origin: string;
}

/** A line carrying this marker is skipped, for the documented false positive. */
export const ALLOW_MARKER = 'luvani-secret-scan: allow';

/**
 * A Supabase key is a JWT whose payload names its role. The anon key is built
 * to ship inside a client; the service-role key is the whole treasury. Telling
 * them apart needs the payload, so this decodes it — in memory, returning a
 * boolean, never a string.
 */
function jwtRole(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: unknown };
    return typeof decoded.role === 'string' ? decoded.role : null;
  } catch {
    return null;
  }
}

/**
 * Shapes that mean "somebody wrote a placeholder here".
 *
 * Six identical characters in a row is the load-bearing one: every hand-written
 * filler in this repo and most others is `xxxxxx`, `000000` or `......`, and no
 * real credential looks like that.
 */
const PLACEHOLDER = new RegExp(
  [
    '(.)\\1{5,}',
    '\\$\\{',
    'process\\.env',
    '<[^>]{1,40}>',
    '\\b(?:changeme|change_me|replace[-_]?me|placeholder|redacted|todo)\\b',
    '\\byour[-_]?[a-z]',
    '\\b(?:example|sample|dummy|fake|specimen|devkey|devsecret|localhost)\\b',
    '\\bEXAMPLE\\b',
  ].join('|'),
  'i',
);

/**
 * Three or more short lowercase words joined by dashes or underscores is how a
 * person writes a stand-in — `legacy-auth-secret`, `test-key-never-sent`,
 * `a-unique-deployment-salt-at-least-32-chars`. No vendor issues a credential
 * that reads as English, so this is a safe shape to forgive and it keeps the
 * scanner quiet on the fixtures that already live in this repo's tests.
 */
function isHumanPhrase(value: string): boolean {
  const segments = value.split(/[-_]/);
  if (segments.length < 3) return false;
  return segments.every((segment) => /^[a-z]{1,12}$/.test(segment) || /^[0-9]{1,4}$/.test(segment));
}

/**
 * A camelCase name, read as the sequence of words a person actually typed.
 *
 * This is `isHumanPhrase` one level down. That helper forgives a stand-in
 * because a person joined short words with dashes; this one forgives a variable
 * name because a person joined short words with capital letters. Same idea,
 * same evidence: a name is built from words, and a credential is a random draw.
 *
 * Three properties separate `agentSecretForThisRun` from thirty-two letters of
 * base64, and all three are facts about English rather than guesses:
 *
 *  1. **A case rhythm.** Splitting at each capital gives whole words, so there
 *     is at least one boundary. A single unbroken run of letters long enough to
 *     reach a pattern's minimum is not a name, it is a value.
 *  2. **Every word carries a vowel**, or is a short all-caps acronym like `URL`.
 *     A random draw produces vowel-free runs constantly; English does not.
 *  3. **No word has five consonants in a row.** `strength` has four and is
 *     about the worst English offers.
 *
 * Measured against the 658 multi-word identifiers this repo actually contains,
 * this keeps 648 of them quiet, and scanning every tracked file and the whole
 * git history produces no new finding at all. The handful it would newly report
 * are the vowel-free unit suffix — `connectingMs`, `conversationXp` — none of
 * which has ever appeared as the value of a credential assignment.
 *
 * What it cannot do: tell a *single* dictionary word from a one-word password.
 * So a connection URL whose password is one English word is reported, and so is
 * a value like `configuration.livekit.apiSecret`, whose capture stops at the
 * first dot and leaves one long word behind. Both are deliberate, and this
 * comment is written without either shape spelled out because the scanner reads
 * its own source. A false positive costs someone thirty seconds; a false
 * negative costs a key.
 */
function isCamelCaseName(value: string): boolean {
  // Strictly narrower than the rule this replaced, which forgave every
  // `^[a-z][A-Za-z]*$`. Nothing newly *quiet* can get in through here.
  if (!/^[a-z][A-Za-z]*$/.test(value)) return false;
  const words = value.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
  if (words.length < 2) return false;
  return words.every(
    (word) => /^[A-Z]{2,5}$/.test(word) || (/[aeiouy]/i.test(word) && !/[^aeiouy]{5}/i.test(word)),
  );
}

/**
 * Code that *refers* to a credential rather than being one. Anchored patterns
 * like `LUVANI_AGENT_SECRET: agentSecret` and
 * `LUVANI_RATE_LIMIT_SALT: randomBytes(36).toString(...)` are the shape of a
 * server wiring itself up correctly, and flagging them is how a scanner teaches
 * people to ignore it. No issued credential contains a bracket, and none is a
 * dotted path.
 *
 * The third rule used to forgive *any* digit-free run of letters, which meant
 * `LIVEKIT_API_SECRET=` followed by thirty-two lower-case-leading letters was
 * never reported at all — and roughly one random base64 draw in 478 comes out
 * that way, so the scanner's own tests failed once in a few hundred runs
 * (F215). It now has to read as words, not merely as letters.
 */
function isCodeReference(value: string): boolean {
  if (/[()[\]]/.test(value)) return true;
  if (/^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)+$/.test(value)) return true;
  return isCamelCaseName(value);
}

function isPlaceholder(value: string): boolean {
  if (PLACEHOLDER.test(value)) return true;
  if (isHumanPhrase(value)) return true;
  // A credential is high-variety by construction. Six distinct characters is a
  // deliberately low bar: it clears `aaaa-bbbb-cccc` without clearing anything
  // a vendor would actually issue.
  return new Set(value).size < 6;
}

/**
 * The credential shapes this repo's vendors actually issue, plus the generic
 * shapes that would be catastrophic from anyone.
 *
 * Anything hex-shaped is anchored to a variable name on purpose: an unanchored
 * 40-hex rule matches every git sha in `git log -p` and every integrity hash in
 * the lockfile, and a scanner that cries wolf gets switched off.
 */
export const SECRET_PATTERNS: readonly SecretPattern[] = [
  {
    id: 'private-key-block',
    what: 'a PEM private key block',
    severity: 'critical',
    pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/,
  },
  {
    id: 'supabase-service-role-jwt',
    what: 'a Supabase service-role JWT — full database authority',
    severity: 'critical',
    pattern: /(?<value>\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/,
    refine: (value) => jwtRole(value) === 'service_role',
  },
  {
    id: 'signed-jwt',
    what: 'a signed JWT (a session or api token unless its payload says otherwise)',
    severity: 'high',
    pattern: /(?<value>\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/,
    // The anon key is designed to ship in a client. Everything else is not.
    refine: (value) => jwtRole(value) !== 'anon' && jwtRole(value) !== 'service_role',
  },
  {
    id: 'supabase-secret-key',
    what: 'a Supabase secret or publishable key in the new sb_ format',
    severity: 'critical',
    pattern: /(?<value>\bsb(?:p_|_secret_|_publishable_)[A-Za-z0-9_-]{16,})/,
  },
  {
    id: 'anthropic-key',
    what: 'an Anthropic API key',
    severity: 'critical',
    pattern: /(?<value>\bsk-ant-[a-z0-9]{3,}[0-9]{2}-[A-Za-z0-9_-]{20,})/,
  },
  {
    id: 'openai-key',
    what: 'an OpenAI API key',
    severity: 'critical',
    pattern: /(?<value>\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,})/,
  },
  {
    id: 'elevenlabs-key',
    what: 'an ElevenLabs API key',
    severity: 'critical',
    pattern: /(?<value>\bsk_[0-9a-f]{32,})/,
  },
  {
    id: 'groq-key',
    what: 'a Groq API key',
    severity: 'critical',
    pattern: /(?<value>\bgsk_[A-Za-z0-9]{20,})/,
  },
  {
    id: 'stripe-key',
    what: 'a Stripe live or test secret key',
    severity: 'critical',
    pattern: /(?<value>\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,})/,
  },
  {
    id: 'aws-access-key-id',
    what: 'an AWS access key id',
    severity: 'critical',
    pattern: /(?<value>\bAKIA[0-9A-Z]{16})\b/,
  },
  {
    id: 'google-api-key',
    what: 'a Google API key',
    severity: 'critical',
    pattern: /(?<value>\bAIza[0-9A-Za-z_-]{35})\b/,
  },
  {
    id: 'github-token',
    what: 'a GitHub personal or app token',
    severity: 'critical',
    pattern: /(?<value>\bgh[pousr]_[A-Za-z0-9]{30,})/,
  },
  {
    id: 'slack-token',
    what: 'a Slack token',
    severity: 'critical',
    pattern: /(?<value>\bxox[abposr]-[A-Za-z0-9-]{12,})/,
  },
  {
    id: 'livekit-credential',
    contextAnchored: true,
    what: 'a LiveKit API key or secret assigned inline',
    severity: 'critical',
    pattern: /LIVEKIT_API_(?:KEY|SECRET)\s*[:=]\s*["']?(?<value>[A-Za-z0-9+/_-]{12,})/,
  },
  {
    id: 'deepgram-key',
    contextAnchored: true,
    what: 'a Deepgram API key assigned inline',
    severity: 'critical',
    pattern: /DEEPGRAM[A-Z_]*\s*[:=]\s*["']?(?<value>[0-9a-zA-Z]{32,})/,
  },
  {
    id: 'upstash-token',
    contextAnchored: true,
    what: 'an Upstash REST token assigned inline',
    severity: 'critical',
    pattern: /UPSTASH_REDIS_REST_TOKEN\s*[:=]\s*["']?(?<value>[A-Za-z0-9+/=_-]{16,})/,
  },
  {
    id: 'assigned-server-secret',
    contextAnchored: true,
    what: 'a server-only credential assigned inline',
    severity: 'critical',
    pattern: new RegExp(
      `\\b(?:${[
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_JWT_SECRET',
        'LUVANI_AGENT_SECRET',
        'LUVANI_RATE_LIMIT_SALT',
        'SPEECHACE_API_KEY',
        'ELEVEN_API_KEY',
        // fish.audio, under both names that exist in the wild: the plugin reads
        // FISH_API_KEY, and a live .env in this repo still holds the key under
        // the misspelling. Name-anchored only, deliberately — fish's key format
        // is unverified, and a guessed shape is worse than a missed one because
        // false positives are how a scanner gets switched off.
        'FISH_API_KEY',
        'FISH_AUDIO_API_KEY',
        'OPENAI_API_KEY',
        'OPEN_AI_KEY',
        'ANTHROPIC_API_KEY',
        'GROQ_API_KEY',
      ].join('|')})\\s*[:=]\\s*["']?(?<value>[^\\s"'\`,;}]{16,})`,
    ),
  },
  {
    id: 'url-embedded-credential',
    contextAnchored: true,
    what: 'a password embedded in a connection URL',
    severity: 'critical',
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@"']+:(?<value>[^\s/@"']{8,})@/,
  },
  {
    id: 'hardcoded-bearer',
    contextAnchored: true,
    what: 'a bearer token written into source rather than read from the environment',
    severity: 'high',
    pattern: /[Bb]earer\s+(?<value>[A-Za-z0-9._~+/=-]{24,})/,
  },
];

/** Ids of every shape the library knows. The self-tests must cover all of them. */
export function patternIds(): string[] {
  return SECRET_PATTERNS.map((p) => p.id);
}

/** Which shapes a single line carries. Returns ids; never the matched text. */
export function scanLine(line: string): string[] {
  if (line.includes(ALLOW_MARKER)) return [];
  const hits: string[] = [];
  for (const candidate of SECRET_PATTERNS) {
    const match = candidate.pattern.exec(line);
    if (!match) continue;
    const value = match.groups?.value ?? match[0];
    if (isPlaceholder(value)) continue;
    if (candidate.contextAnchored && isCodeReference(value)) continue;
    if (candidate.refine && !candidate.refine(value)) continue;
    hits.push(candidate.id);
  }
  return hits;
}

export function scanText(text: string, filePath: string, origin = 'tree'): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    for (const id of scanLine(lines[index] ?? '')) {
      const known = SECRET_PATTERNS.find((p) => p.id === id);
      if (!known) continue;
      findings.push({
        path: filePath,
        line: index + 1,
        patternId: known.id,
        what: known.what,
        severity: known.severity,
        origin,
      });
    }
  }
  return findings;
}

const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.expo',
  '.expo-shared',
  '.tts-cache',
  '.loop',
  'coverage',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.icns', '.pdf',
  '.wav', '.mp3', '.m4a', '.ogg', '.mp4', '.webm', '.mov',
  '.ttf', '.otf', '.woff', '.woff2', '.zip', '.gz', '.tgz', '.jar', '.keystore',
]);

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function scannable(filePath: string): boolean {
  if (BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return false;
  try {
    return statSync(filePath).size <= MAX_FILE_BYTES;
  } catch {
    return false;
  }
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** Files git is actually carrying — which is what a push would publish. */
export function trackedFiles(root: string): string[] {
  return git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
}

function untrackedFiles(root: string): string[] {
  return git(root, ['ls-files', '-z', '--others', '--exclude-standard']).split('\0').filter(Boolean);
}

export function scanFiles(root: string, relativePaths: readonly string[], origin = 'tree'): Finding[] {
  const findings: Finding[] = [];
  for (const relative of relativePaths) {
    const absolute = path.join(root, relative);
    if (!scannable(absolute)) continue;
    let text: string;
    try {
      text = readFileSync(absolute, 'utf8');
    } catch {
      continue;
    }
    findings.push(...scanText(text, relative, origin));
  }
  return findings;
}

/**
 * A tracked `.env` is its own finding: whatever is inside it, the file itself is
 * a deployment input that should never have entered history.
 */
export function trackedEnvFiles(root: string): string[] {
  return trackedFiles(root).filter((file) => {
    const name = path.basename(file);
    return name === '.env' || (name.startsWith('.env.') && !name.endsWith('.example'));
  });
}

export function scanWorkingTree(root: string, options: { includeUntracked?: boolean } = {}): Finding[] {
  const files = [...trackedFiles(root), ...(options.includeUntracked ? untrackedFiles(root) : [])];
  const findings = scanFiles(root, files);
  for (const envFile of trackedEnvFiles(root)) {
    findings.push({
      path: envFile,
      line: 1,
      patternId: 'tracked-env-file',
      what: 'an environment file is tracked by git',
      severity: 'critical',
      origin: 'tree',
    });
  }
  return findings;
}

/**
 * History is where a rotated secret still lives. `git log -p` is walked as a
 * stream of added lines with their post-image line numbers, so a finding points
 * at the commit and line that introduced it.
 */
export function scanDiffStream(diff: string): Finding[] {
  const findings: Finding[] = [];
  let commit = 'unknown';
  let filePath = 'unknown';
  let lineNumber = 0;
  for (const raw of diff.split('\n')) {
    const commitLine = raw.match(/^commit ([0-9a-f]{7,40})/);
    if (commitLine) {
      commit = (commitLine[1] ?? 'unknown').slice(0, 8);
      continue;
    }
    if (raw.startsWith('+++ ')) {
      filePath = raw.startsWith('+++ b/') ? raw.slice(6) : raw.slice(4);
      continue;
    }
    if (raw.startsWith('--- ')) continue;
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      lineNumber = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith('+')) {
      for (const finding of scanText(raw.slice(1), filePath, `history ${commit}`)) {
        findings.push({ ...finding, line: lineNumber });
      }
      lineNumber += 1;
      continue;
    }
    if (raw.startsWith(' ')) lineNumber += 1;
  }
  return findings;
}

export function scanHistory(root: string, options: { maxCommits?: number } = {}): Finding[] {
  const diff = git(root, [
    'log',
    '-p',
    '-U0',
    '--all',
    '--no-color',
    `--max-count=${options.maxCommits ?? 2000}`,
  ]);
  return scanDiffStream(diff);
}

export const BUNDLE_DIRECTORIES = [
  'apps/mobile/dist',
  'apps/mobile/web-build',
  'apps/mobile/.expo/web-build',
  'dist',
  'build',
  'web-build',
] as const;

function walk(directory: string, root: string, out: string[]): void {
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) walk(full, root, out);
    else out.push(path.relative(root, full));
  }
}

/** Build output present on disk. Empty means nothing was built, not nothing found. */
export function bundleFiles(root: string): string[] {
  const files: string[] = [];
  for (const directory of BUNDLE_DIRECTORIES) {
    const absolute = path.join(root, directory);
    if (existsSync(absolute) && statSync(absolute).isDirectory()) walk(absolute, root, files);
  }
  return files;
}

/** `path:line  id  description`. There is no code path that adds the value. */
export function formatFinding(finding: Finding): string {
  return `  ${finding.path}:${finding.line}  [${finding.severity}] ${finding.patternId} — ${finding.what} (${finding.origin})`;
}

export function report(findings: readonly Finding[], scannedLabel: string): string[] {
  if (findings.length === 0) return [`secret scan: clean — ${scannedLabel}`];
  const lines = [`secret scan: ${findings.length} finding${findings.length === 1 ? '' : 's'} — ${scannedLabel}`];
  for (const finding of findings) lines.push(formatFinding(finding));
  lines.push('  Values are never printed. Open the path and line to see what matched.');
  return lines;
}

export function repositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

/**
 * One run, as data. The CLI only prints what this returns, so the blocked path
 * and the exit codes are testable without a subprocess.
 */
export function runScan(argv: readonly string[], root: string): { code: number; lines: string[] } {
  if (argv.includes('--history')) {
    const findings = scanHistory(root);
    return { code: findings.length === 0 ? 0 : 1, lines: report(findings, 'git history') };
  }
  if (argv.includes('--bundles')) {
    const files = bundleFiles(root);
    if (files.length === 0) {
      // Nothing scanned is not the same as nothing found, and a release check
      // that cannot see the artefact has to say so.
      return {
        code: 1,
        lines: [
          'BLOCKED: no build output found. Run `npm run build:web`, then scan again.',
          `         Looked in: ${BUNDLE_DIRECTORIES.join(', ')}`,
        ],
      };
    }
    const findings = scanFiles(root, files, 'bundle');
    return { code: findings.length === 0 ? 0 : 1, lines: report(findings, `${files.length} bundle files`) };
  }
  const includeUntracked = argv.includes('--all');
  const findings = scanWorkingTree(root, { includeUntracked });
  return {
    code: findings.length === 0 ? 0 : 1,
    lines: report(findings, includeUntracked ? 'working tree' : 'tracked files'),
  };
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const outcome = runScan(process.argv.slice(2), repositoryRoot());
  for (const line of outcome.lines) (outcome.code === 0 ? console.log : console.error)(line);
  process.exit(outcome.code);
}
