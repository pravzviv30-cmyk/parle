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

export type Brain = 'anthropic' | 'groq';

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
  return raw === 'groq' ? 'groq' : 'anthropic';
}

const BRAIN_KEY: Record<Brain, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
};

/** Without these the worker cannot serve a single turn. */
export function missingRequired(env: Env = process.env): string[] {
  const required = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'DEEPGRAM_API_KEY',
    'ELEVEN_API_KEY',
    BRAIN_KEY[selectedBrain(env)],
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
  return out;
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
