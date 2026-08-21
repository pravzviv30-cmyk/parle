/**
 * Refuse to register a worker that cannot do the job.
 *
 * The failure this prevents: every plugin the agent needs — the LLM, Deepgram,
 * ElevenLabs — is constructed inside the job entry, which runs AFTER a learner
 * has already been let into a room and the meter has started. A missing key
 * therefore threw at the worst possible moment and reached the learner as a
 * room that opened and then said nothing at all. Checking at startup turns a
 * silent mid-session failure into a message on the terminal of whoever
 * misconfigured it.
 */

import { DEFAULT_OPENAI_ANALYST_MODEL, DEFAULT_OPENAI_TURN_MODEL } from '@parle/brain';

export type Brain = 'anthropic' | 'openai' | 'groq' | 'claude-cli' | 'claude-cli-all';

type Env = Record<string, string | undefined>;

/**
 * Which brain the .env asks for.
 *
 * The subtle part is the empty string. This used to read
 * `process.env.TUTOR_LLM ?? 'anthropic'`, and `??` only falls back on null or
 * undefined — so the `TUTOR_LLM=` line shipped in .env.example selected
 * Anthropic while looking to a reader like "unset, take the default". Anyone
 * regenerating their .env from the example got Anthropic without an Anthropic
 * key, and the throw landed inside the job entry. Trim, then treat empty as
 * absent.
 */
export function selectedBrain(env: Env = process.env): Brain {
  const raw = (env.TUTOR_LLM ?? '').trim().toLowerCase();
  if (raw === 'groq') return 'groq';
  if (raw === 'openai') return 'openai';
  if (raw === 'claude-cli') return 'claude-cli';
  if (raw === 'claude-cli-all') return 'claude-cli-all';
  return 'anthropic';
}

/**
 * Which credential each brain cannot start without, and `null` for the one that
 * needs none.
 *
 * `claude-cli` wants GROQ_API_KEY rather than an Anthropic one, and that is not
 * a mistake: the subscription answers through the `claude` command, which needs
 * no key at all, but it costs about eight seconds a call and so cannot serve a
 * realtime turn. The turn stays on Groq. What claude-cli needs beyond this is a
 * binary on PATH, which is a filesystem question and is checked by the dev
 * supervisor rather than here.
 *
 * `claude-cli-all` takes the realtime turn too, so Groq drops out of the
 * picture entirely and there is no credential left to want. Demanding one would
 * refuse to boot a worker that was perfectly able to run.
 */
const BRAIN_KEY: Record<Brain, string | null> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  'claude-cli': 'GROQ_API_KEY',
  'claude-cli-all': null,
};

/** Without these the worker cannot serve a single turn. */
export function missingRequired(env: Env = process.env): string[] {
  const brainKey = BRAIN_KEY[selectedBrain(env)];
  const required = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'DEEPGRAM_API_KEY',
    'ELEVEN_API_KEY',
    ...(brainKey === null ? [] : [brainKey]),
  ];
  return required.filter((name) => (env[name] ?? '').trim() === '');
}

/**
 * Worth saying out loud but not worth refusing over. ELEVEN_VOICE_ID is
 * genuinely optional — voice.ts falls back to the vendor's default voice — but
 * a default-voice tutor is not the tutor anyone intended to ship, and the TTS
 * cache is keyed by voice, so discovering this later means re-warming it.
 */
export function warnings(env: Env = process.env): string[] {
  const out: string[] = [];
  if ((env.ELEVEN_VOICE_ID ?? '').trim() === '') {
    out.push('ELEVEN_VOICE_ID is unset, so the tutor will speak in ElevenLabs’ default voice.');
  }
  if (selectedBrain(env) === 'groq') {
    out.push('TUTOR_LLM=groq selects the $0 fallback brain. Its coaching is visibly weaker than Claude’s.');
  }
  if (selectedBrain(env) === 'openai') {
    out.push(
      'TUTOR_LLM=openai uses GPT-5.6 Luna for live turns and scene design, and GPT-5.6 Terra for '
        + 'memory, practice and drill work after the session.',
    );
  }
  if (selectedBrain(env) === 'claude-cli') {
    out.push(
      'TUTOR_LLM=claude-cli runs memory, curation and drill authoring on your Claude subscription. ' +
        'Realtime turns stay on Groq, because a command-line call costs seconds a learner would spend in silence.',
    );
  }
  if (selectedBrain(env) === 'claude-cli-all') {
    out.push(
      'TUTOR_LLM=claude-cli-all puts your Claude subscription behind every call, the learner’s turn included. ' +
        'Expect eight to twelve seconds of silence per turn: this is for development only, never for anyone learning.',
    );
  }
  return out;
}

/**
 * A key that is present is not a key that works.
 *
 * Presence checks catch the empty .env. They do not catch the two failures
 * that actually reach a learner as silence: a key that the vendor now rejects,
 * and a model the vendor has retired. Both leave every required name filled
 * in, so the checks above pass, the worker registers, the room opens — and the
 * tutor never says a word, which is the exact outcome this module exists to
 * prevent.
 *
 * So the credentials get used once, cheaply, before the worker advertises
 * itself. A rejected credential or a missing model is fatal: the worker cannot
 * serve a turn and must not pretend otherwise. A vendor that is merely
 * unreachable is not — that is the network, it is usually momentary, and
 * refusing to boot over it would make a laptop on a bad connection undebuggable.
 */
export interface VendorCheck {
  vendor: string;
  fatal: boolean;
  detail: string;
}

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

async function probe(
  vendor: string,
  url: string,
  headers: Record<string, string>,
  fetchFn: FetchLike,
  onOk?: (body: unknown) => VendorCheck | null,
): Promise<VendorCheck | null> {
  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  try {
    response = await fetchFn(url, { method: 'GET', headers });
  } catch {
    return { vendor, fatal: false, detail: `could not be reached — check the network, not the key.` };
  }
  if (response.status === 401 || response.status === 403) {
    return { vendor, fatal: true, detail: `rejected the key (HTTP ${response.status}). It is wrong, expired, or revoked.` };
  }
  if (!response.ok) {
    return { vendor, fatal: false, detail: `answered HTTP ${response.status}; treating as a blip rather than a misconfiguration.` };
  }
  if (onOk === undefined) return null;
  try {
    return onOk(await response.json());
  } catch {
    return { vendor, fatal: false, detail: `returned a body this check could not read.` };
  }
}

/** Reaches each vendor the selected pipeline needs. Empty means all is well. */
export async function verifyVendors(
  env: Env = process.env,
  model: string = '',
  fetchFn: FetchLike = globalThis.fetch as unknown as FetchLike,
): Promise<VendorCheck[]> {
  const checks: Promise<VendorCheck | null>[] = [];

  // claude-cli probes Groq, not Anthropic. The subscription needs no key and so
  // has nothing to verify here, while Groq is genuinely serving its realtime
  // turns — probing Anthropic instead would send an empty key, take the 401 as
  // fatal, and refuse to start a worker that was perfectly able to run.
  //
  // claude-cli-all probes neither, for that same reason twice over: it holds no
  // key for either vendor and calls neither. The one thing it needs is a binary
  // on PATH, which no HTTP probe can answer.
  const brain = selectedBrain(env);
  if (brain === 'claude-cli-all') {
    // nothing to ask
  } else if (brain === 'openai') {
    checks.push(
      probe(
        'OpenAI',
        'https://api.openai.com/v1/models',
        { Authorization: `Bearer ${env.OPENAI_API_KEY ?? ''}` },
        fetchFn,
        (body) => {
          const ids = ((body as { data?: { id?: string }[] }).data ?? [])
            .map((entry) => entry.id)
            .filter((id): id is string => typeof id === 'string');
          const required = [
            env.OPENAI_TURN_MODEL?.trim() || DEFAULT_OPENAI_TURN_MODEL,
            env.OPENAI_ANALYST_MODEL?.trim() || DEFAULT_OPENAI_ANALYST_MODEL,
          ];
          const missing = [...new Set(required)].filter((id) => !ids.includes(id));
          if (missing.length === 0) return null;
          return {
            vendor: 'OpenAI',
            fatal: true,
            detail:
              `does not list the configured model${missing.length === 1 ? '' : 's'} ${missing.map((id) => `"${id}"`).join(', ')} for this key.\n` +
              `          Check OPENAI_TURN_MODEL and OPENAI_ANALYST_MODEL in services/tutor-agent/.env.`,
          };
        },
      ),
    );
  } else if (brain !== 'anthropic') {
    checks.push(
      probe('Groq', 'https://api.groq.com/openai/v1/models', { Authorization: `Bearer ${env.GROQ_API_KEY ?? ''}` }, fetchFn, (body) => {
        const ids = ((body as { data?: { id?: string }[] }).data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string');
        if (model === '' || ids.includes(model)) return null;
        return {
          vendor: 'Groq',
          fatal: true,
          detail:
            `does not serve "${model}" — it has been retired, and a request for it returns a bare 404.\n` +
            `          Set GROQ_MODEL in services/tutor-agent/.env to one of: ${ids.slice(0, 6).join(', ')}`,
        };
      }),
    );
  } else {
    checks.push(
      probe(
        'Anthropic',
        'https://api.anthropic.com/v1/models',
        { 'x-api-key': env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
        fetchFn,
      ),
    );
  }

  checks.push(probe('ElevenLabs', 'https://api.elevenlabs.io/v1/user', { 'xi-api-key': env.ELEVEN_API_KEY ?? '' }, fetchFn));
  checks.push(probe('Deepgram', 'https://api.deepgram.com/v1/projects', { Authorization: `Token ${env.DEEPGRAM_API_KEY ?? ''}` }, fetchFn));

  return (await Promise.all(checks)).filter((c): c is VendorCheck => c !== null);
}

/** Prints what the vendors said, and refuses to start on anything fatal. */
export function reportVendors(checks: readonly VendorCheck[], exit: (code: number) => never = process.exit): void {
  for (const check of checks.filter((c) => !c.fatal)) console.warn(`[parle:agent] ${check.vendor} ${check.detail}`);

  const fatal = checks.filter((c) => c.fatal);
  if (fatal.length === 0) {
    console.info('[parle:agent] vendors ok — brain, voice and transcription all answered.');
    return;
  }
  console.error(
    `\n[parle:agent] Cannot start. The keys are present but the vendors disagree:\n` +
      fatal.map((c) => `        - ${c.vendor} ${c.detail}`).join('\n') +
      `\n\n        Every one of these reaches a learner the same way: a room that opens\n` +
      `        and a tutor that never speaks. Fix them in services/tutor-agent/.env.\n`,
  );
  exit(1);
}

/** Called once at startup, before the worker registers with LiveKit. */
export function preflight(env: Env = process.env, exit: (code: number) => never = process.exit): void {
  for (const line of warnings(env)) console.warn(`[parle:agent] ${line}`);

  const missing = missingRequired(env);
  if (missing.length === 0) {
    console.info(`[parle:agent] preflight ok — brain: ${selectedBrain(env)}`);
    return;
  }

  console.error(
    `\n[parle:agent] Cannot start. Missing in services/tutor-agent/.env:\n` +
      missing.map((name) => `        - ${name}`).join('\n') +
      `\n\n        Copy services/tutor-agent/.env.example to .env and fill it in.\n` +
      `        The brain is selected by TUTOR_LLM (currently: ${selectedBrain(env)}).\n` +
      `        Set TUTOR_LLM=groq to use the free-tier fallback instead.\n`,
  );
  exit(1);
}
