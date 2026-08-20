/**
 * What `npm run dev` decides, separated from what it does.
 *
 * Until this existed, running Parle meant four terminals started by hand in the
 * right order, which is the whole reason the founder's own app reported "there
 * is no server available": nothing was wrong with the code, the token server
 * simply was not running. README documented the four commands, `.claude/launch.json`
 * started only Expo, and the root package.json had no orchestration at all.
 *
 * The split here is deliberate. Everything that is a *judgement* — what order to
 * start in, what to do about a port that already answers, whether the .env files
 * can serve a session at all — is a pure function in this file and is tested.
 * Everything that is *machinery* — spawning, streaming labelled logs, reaping
 * process groups — lives in scripts/dev.mjs, and is verified by running it. A
 * test of that half would be a test of the operating system wearing our name.
 *
 * It lives in services/shared/ for the same reason speechace.ts does: more than
 * one workspace is involved, and neither owns it. It is tested from the
 * tutor-agent workspace, exactly as speechace.ts is.
 */

type Env = Record<string, string | undefined>;

// ─────────────────────────────────────────────── reading a .env file

/**
 * The smallest .env reader that handles the files this repo actually has.
 *
 * dotenv is a dependency of three workspaces but not of the root, and the
 * supervisor runs from the root. Rather than lean on npm hoisting to make an
 * undeclared dependency resolve, this is a dozen lines. It only ever reads
 * files to *report* on them; the child processes still load their own .env
 * through dotenv exactly as before, so there is no second source of truth
 * about what a value is.
 */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const name = line.slice(0, eq).trim();
    if (name === '') continue;
    let value = line.slice(eq + 1).trim();
    const quoted = value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);
    out[name] = value;
  }
  return out;
}

// ─────────────────────────────────────────────── the plan

export type StepId = 'livekit' | 'token' | 'agent' | 'app';

/** How the supervisor knows a step is up and it is safe to start the next one. */
export interface Readiness {
  /** An HTTP probe, or a line on the child's own stdout. */
  kind: 'http' | 'stdout';
  /** For 'http'. */
  url?: string;
  /** For 'stdout'. */
  pattern?: RegExp;
  timeoutMs: number;
  /**
   * Whether a timeout is fatal. The agent's is not: its own preflight is the
   * authority on why it could not start, and it prints a better message than a
   * supervisor guessing from silence would.
   */
  fatalOnTimeout: boolean;
}

export interface BootStep {
  id: StepId;
  /** Prefixes every line this child prints, so four log streams stay legible. */
  label: string;
  command: string;
  args: string[];
  /** null for the agent, which registers outward rather than listening. */
  port: number | null;
  ready: Readiness;
  /**
   * Whether a response on this step's port is this step, rather than a stranger
   * who happens to hold it. LiveKit answers `OK`; the token server answers its
   * own health JSON. Guessing from "something replied" is how a dev session ends
   * up handing the agent someone else's server.
   */
  identify: (probe: ReachableProbe) => boolean;
}

export const LIVEKIT_PORT = 7880;
export const TOKEN_PORT = 8787;
export const APP_PORT = 8082;

/**
 * The order, and why it is the only correct one: the token server signs join
 * tokens *for* LiveKit, the agent registers *with* LiveKit, and the app calls
 * the token server. Start any of them before what it depends on and the failure
 * is a race that reads like a flake.
 */
export function bootPlan(env: Env = process.env): BootStep[] {
  const livekitBin = (env.LIVEKIT_SERVER_BIN ?? '').trim();
  return [
    {
      id: 'livekit',
      label: 'livekit',
      command: livekitBin === '' ? 'livekit-server' : livekitBin,
      args: ['--dev'],
      port: LIVEKIT_PORT,
      ready: { kind: 'http', url: `http://127.0.0.1:${LIVEKIT_PORT}/`, timeoutMs: 15_000, fatalOnTimeout: true },
      identify: (p) => p.status === 200 && p.body.trim() === 'OK',
    },
    {
      id: 'token',
      label: 'token',
      command: 'npm',
      args: ['run', 'start', '--workspace=@parle/token-server'],
      port: TOKEN_PORT,
      ready: { kind: 'http', url: `http://127.0.0.1:${TOKEN_PORT}/health`, timeoutMs: 15_000, fatalOnTimeout: true },
      identify: (p) => p.status === 200 && p.body.includes('"ok":true'),
    },
    {
      id: 'agent',
      label: 'agent',
      command: 'npm',
      args: ['run', 'dev', '--workspace=@parle/tutor-agent'],
      port: null,
      // Not fatal on timeout: preflight.ts exits 1 with a specific reason when
      // it cannot serve, and that message is worth more than "the agent did not
      // say anything in thirty seconds".
      ready: { kind: 'stdout', pattern: /registered worker/i, timeoutMs: 30_000, fatalOnTimeout: false },
      identify: () => false,
    },
    {
      id: 'app',
      label: 'app',
      command: 'npm',
      args: ['run', 'web', '--workspace=@parle/mobile', '--', '--port', String(APP_PORT)],
      port: APP_PORT,
      ready: { kind: 'http', url: `http://127.0.0.1:${APP_PORT}/`, timeoutMs: 90_000, fatalOnTimeout: true },
      identify: (p) => p.status === 200,
    },
  ];
}

// ─────────────────────────────────────────────── a port that already answers

export type ReachableProbe = { reachable: true; status: number; body: string };
export type ProbeResult = { reachable: false } | ReachableProbe;

export type PortVerdict =
  | { kind: 'spawn' }
  | { kind: 'reuse'; note: string }
  | { kind: 'occupied'; message: string };

/**
 * Three outcomes, and the middle one is the common case on a developer's
 * machine: livekit-server has been up for days and there is no reason to fight
 * it. The third is the one worth being strict about — a stranger on the port
 * would otherwise be handed to the agent as if it were ours.
 */
export function classifyPort(step: BootStep, probe: ProbeResult): PortVerdict {
  if (step.port === null || !probe.reachable) return { kind: 'spawn' };
  if (step.identify(probe)) {
    return {
      kind: 'reuse',
      note:
        `${step.label} is already answering on ${step.port}, so it is left alone. ` +
        `It is running the env it started with, so a change to .env needs that process restarted, not this one.`,
    };
  }
  return {
    kind: 'occupied',
    message:
      `Port ${step.port} is held by something that is not ${step.label}.\n` +
      `        Find it with:  lsof -i :${step.port}\n` +
      `        Then stop it, or start ${step.label} elsewhere.`,
  };
}

// ─────────────────────────────────────────────── what the .env files are missing

export interface EnvGap {
  name: string;
  file: string;
  why: string;
}

/** The brain the agent's .env asks for. Mirrors preflight.ts, empty means absent. */
function brainOf(env: Env): 'anthropic' | 'groq' | 'claude-cli' {
  const raw = (env.TUTOR_LLM ?? '').trim().toLowerCase();
  if (raw === 'groq') return 'groq';
  if (raw === 'claude-cli') return 'claude-cli';
  return 'anthropic';
}

const AGENT_FILE = 'services/tutor-agent/.env';
const TOKEN_FILE = 'services/token-server/.env';

const set = (env: Env, name: string): boolean => (env[name] ?? '').trim() !== '';

/**
 * Everything that would otherwise fail later, checked before anything spawns.
 *
 * The point is *when*. A missing Deepgram key currently surfaces as a room that
 * opens and a tutor that never speaks, three processes deep, after a learner has
 * already tapped start. Named here, it is one line on a terminal before the boot
 * begins, and it says which variable and which file.
 */
export function envGaps(agentEnv: Env, tokenEnv: Env): EnvGap[] {
  const gaps: EnvGap[] = [];
  const need = (env: Env, name: string, file: string, why: string) => {
    if (!set(env, name)) gaps.push({ name, file, why });
  };

  for (const name of ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']) {
    need(tokenEnv, name, TOKEN_FILE, 'the token server cannot sign a join token without it.');
    need(agentEnv, name, AGENT_FILE, 'the agent cannot register with LiveKit without it.');
  }
  need(agentEnv, 'DEEPGRAM_API_KEY', AGENT_FILE, 'nothing would transcribe the learner.');
  need(agentEnv, 'ELEVEN_API_KEY', AGENT_FILE, 'the tutor would have no voice.');

  const brain = brainOf(agentEnv);
  if (brain === 'groq') {
    need(agentEnv, 'GROQ_API_KEY', AGENT_FILE, 'TUTOR_LLM=groq selects it, so it has to be there.');
  } else if (brain === 'anthropic') {
    need(agentEnv, 'ANTHROPIC_API_KEY', AGENT_FILE, 'TUTOR_LLM is anthropic, so the brain has no credential.');
  } else {
    // claude-cli needs no key. It needs the binary, which is checked by the
    // supervisor against the filesystem rather than against an env file.
    need(agentEnv, 'GROQ_API_KEY', AGENT_FILE, 'TUTOR_LLM=claude-cli still answers realtime turns on Groq.');
  }
  return gaps;
}

// ─────────────────────────────────────────────── the shared agent secret

export interface AgentSecret {
  value: string;
  /** True when the supervisor made one up for this boot. */
  generated: boolean;
  /** True when the two files disagree, which refuses every debit. */
  mismatch: boolean;
}

/**
 * `/session/end` debits the learner's minutes and is guarded by a secret both
 * processes have to share. Unset, the token server boots with a warning and the
 * endpoint is open to anyone — the griefing hole B6 closed, quietly reopened by
 * a missing line. Neither .env carries one today.
 *
 * So dev generates one per boot and hands it to both children. It costs nothing,
 * it needs no file to be edited, and it cannot leak into a commit because it
 * never touches disk.
 */
export function sharedAgentSecret(agentEnv: Env, tokenEnv: Env, generate: () => string): AgentSecret {
  const fromAgent = (agentEnv.PARLE_AGENT_SECRET ?? '').trim();
  const fromToken = (tokenEnv.PARLE_AGENT_SECRET ?? '').trim();
  if (fromAgent !== '' && fromToken !== '') {
    return { value: fromAgent, generated: false, mismatch: fromAgent !== fromToken };
  }
  const configured = fromAgent !== '' ? fromAgent : fromToken;
  if (configured !== '') return { value: configured, generated: false, mismatch: false };
  return { value: generate(), generated: true, mismatch: false };
}
