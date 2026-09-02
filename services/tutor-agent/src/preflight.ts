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

import { DEFAULT_OPENAI_ANALYST_MODEL, DEFAULT_OPENAI_TURN_MODEL } from '@luvani/brain';
import { DEFAULT_TUTOR_VOICE } from '@luvani/core';
import { ELEVEN_VOICES, MODEL, PROBE_LINE, VOICE_KEY, selectedVoiceVendor, synthesisProbeRequest } from './voice.ts';
import { fishModel, fishSynthesisProbeRequest, fishVoiceId } from './voiceFish.ts';

export type Brain = 'anthropic' | 'openai' | 'groq' | 'claude-cli' | 'claude-cli-all';

/**
 * When ElevenLabs stops serving its premade catalogue.
 *
 * A date rather than a boolean, because "this will break" is ignorable and
 * "this breaks on this day" is plannable. None of the eight voices should be
 * premade — they were chosen from the library — but a voice can be recategorised
 * under us, and the failure that follows is a learner who picked that one
 * meeting silence while everyone else's tutor works.
 */
const PREMADE_RETIREMENT = '2026-12-31';

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

/**
 * Every credential name this worker actually looks up.
 *
 * Only ever read as a set of NAMES. Nothing here reads, prints or forwards a
 * value: what a preflight check is allowed to know about a secret is that a
 * variable by that name is set.
 */
export const REAL_KEY_NAMES: readonly string[] = [
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'DEEPGRAM_API_KEY',
  'ELEVEN_API_KEY',
  'FISH_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
];

/**
 * Names that look like a credential and are read by nothing.
 *
 * A missing key is a loud failure: preflight refuses to start and says which
 * name is empty. A MISTYPED key is the quiet one. The .env looks full, every
 * required name may even be present, and the value under the wrong name is a
 * real credential that will never be used — so the next person to rotate it
 * rotates the dead one and cannot work out why nothing changed. Worse, a
 * `.env` that carries `OPEN_AI_KEY` and nothing else reads as "OpenAI is
 * configured" to every human who opens it, and as an empty account to the
 * worker.
 *
 * Deliberately a short hand-written table rather than an edit-distance guess.
 * A fuzzy matcher would start volunteering opinions about variables that are
 * not ours, and being wrong about somebody's unrelated secret is a worse
 * failure than missing a typo.
 */
export const NEAR_MISS_KEYS: Record<string, string> = {
  OPEN_AI_KEY: 'OPENAI_API_KEY',
  OPEN_AI_API_KEY: 'OPENAI_API_KEY',
  OPENAI_KEY: 'OPENAI_API_KEY',
  ANTHROPIC_KEY: 'ANTHROPIC_API_KEY',
  CLAUDE_API_KEY: 'ANTHROPIC_API_KEY',
  GROQ_KEY: 'GROQ_API_KEY',
  DEEPGRAM_KEY: 'DEEPGRAM_API_KEY',
  ELEVENLABS_API_KEY: 'ELEVEN_API_KEY',
  ELEVEN_LABS_API_KEY: 'ELEVEN_API_KEY',
  ELEVENLABS_KEY: 'ELEVEN_API_KEY',
  // Not hypothetical. This is the name in the live .env today, and the plugin
  // reads FISH_API_KEY, so under LUVANI_TTS_VENDOR=fish the worker would refuse
  // to boot next to a perfectly good key sitting under the wrong name.
  FISH_AUDIO_API_KEY: 'FISH_API_KEY',
};

/** Without these the worker cannot serve a single turn. */
export function missingRequired(env: Env = process.env): string[] {
  const brainKey = BRAIN_KEY[selectedBrain(env)];
  const required = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'DEEPGRAM_API_KEY',
    // The voice key follows LUVANI_TTS_VENDOR exactly as the brain key follows
    // TUTOR_LLM. Demanding ElevenLabs' key under fish would refuse to boot a
    // worker that was never going to call ElevenLabs.
    VOICE_KEY[selectedVoiceVendor(env)],
    ...(brainKey === null ? [] : [brainKey]),
  ];
  return required.filter((name) => (env[name] ?? '').trim() === '');
}

/**
 * Worth saying out loud but not worth refusing over: a setting that is wrong in
 * a way the worker can survive, and that somebody will otherwise discover from
 * an invoice or a learner.
 *
 * Every line added here has to be CONDITIONAL. Sixteen assertions across
 * preflight.test.ts pin the exact length or the exact contents of this list,
 * which is the point rather than an obstacle: a startup that warns about
 * something on every single boot teaches everyone to stop reading the warnings,
 * and then the one that mattered scrolls past unread.
 */
export function warnings(env: Env = process.env): string[] {
  const out: string[] = [];
  for (const [typo, real] of Object.entries(NEAR_MISS_KEYS)) {
    if ((env[typo] ?? '').trim() === '') continue;
    out.push(
      `${typo} is set and nothing reads it. It looks like ${real}, which is the name the worker uses. ` +
        `Rename it, or delete it so nobody trusts it.`,
    );
  }
  const vendor = selectedVoiceVendor(env);
  // Retired by the voice chooser. Not a near-miss — there is no correctly
  // spelled variable to point at, because the voice is not an env decision any
  // more — but the same failure shape as OPEN_AI_KEY and one step worse: this
  // one holds a REAL vendor id, so a .env carrying it reads as "the tutor
  // speaks with this voice" to every human who opens it, and the next person to
  // change the tutor's voice edits this line and hears nothing change.
  //
  // Ungated by vendor on purpose. It is read by nothing under either one.
  if ((env.ELEVEN_VOICE_ID ?? '').trim() !== '') {
    out.push(
      'ELEVEN_VOICE_ID is set and nothing reads it. The tutor’s voice is chosen by the learner in ' +
        'Profile, from the catalogue in packages/core/src/protocol/voices.ts. Delete the line, so nobody ' +
        'trusts it.',
    );
  }
  if (vendor === 'fish' && (env.FISH_VOICE_ID ?? '').trim() === '') {
    // Not the same warning with a different variable name. fish's default voice
    // is "Sarah", a young American woman, which is precisely the voice this
    // vendor was added to escape — so an unset id here does not merely miss the
    // intended tutor, it reproduces the original bug under a new vendor.
    out.push(
      'FISH_VOICE_ID is unset, so the tutor will speak in fish.audio’s default voice: “Sarah”, ' +
        'a young American woman. That is the exact voice this vendor was added to replace. ' +
        'Set FISH_VOICE_ID to a French voice before a learner hears it.',
    );
  }
  const asked = (env.LUVANI_TTS_VENDOR ?? '').trim();
  if (asked !== '' && asked.toLowerCase() !== 'fish' && asked.toLowerCase() !== 'elevenlabs') {
    out.push(
      `LUVANI_TTS_VENDOR is set to “${asked}”, which is not a vendor this worker knows, so ElevenLabs ` +
        'will be used. The two it knows are elevenlabs and fish.',
    );
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
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * A 401 that proves the key is real.
 *
 * ElevenLabs issues scoped keys, and a key granted only what the tutor needs
 * does not carry `user_read` or `voices_read`. The vendor answers 401 with
 * `status: "missing_permissions"`, which is authentication succeeding and
 * authorisation failing — the opposite of a dead key. Reading the two the same
 * way stopped the worker booting on a perfectly good key and pushed a real
 * rotation off least privilege (F273).
 *
 * Only the vendor's own word counts. A bare 401 carries none of this and stays
 * fatal, which is what `a bare 401 is still a dead key` holds.
 */
function scopeGap(body: unknown): boolean {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail !== 'object' || detail === null) return false;
  const { status, message } = detail as { status?: unknown; message?: unknown };
  if (status === 'missing_permissions') return true;
  return typeof message === 'string' && /missing the permission/i.test(message);
}

async function probe(
  vendor: string,
  url: string,
  headers: Record<string, string>,
  fetchFn: FetchLike,
  onOk?: (body: unknown) => VendorCheck | null,
  // When set, a 401/403 the vendor explains as a missing scope is not a fault:
  // the caller has another way to prove the credential. Absent, every refusal
  // is fatal exactly as before.
  allowScopeGap = false,
): Promise<VendorCheck | null> {
  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  try {
    response = await fetchFn(url, { method: 'GET', headers });
  } catch {
    return { vendor, fatal: false, detail: `could not be reached — check the network, not the key.` };
  }
  if (response.status === 401 || response.status === 403) {
    if (allowScopeGap) {
      // Read the refusal before judging it. An unreadable body is not evidence
      // of a scope gap, so it falls through to fatal.
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (scopeGap(body)) return null;
    }
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

/**
 * Ask the vendor to say one word, in the exact configuration the tutor uses.
 *
 * The catalogue check above answers "does this account have this voice". This
 * one answers the question that actually matters, "is this account allowed to
 * SAY anything with it", and they are not the same question. A library voice on
 * a free plan is listed and then refused with 402; an unverified voice/model
 * pair can be refused too. Either way the catalogue says yes, the worker boots,
 * and the learner meets a room that opens and a tutor that never speaks.
 *
 * Which refusals are fatal follows the rule the rest of this file uses: a
 * deterministic "no" about the configuration stops the worker, and anything
 * that might be weather does not. A 402 or a 400 will still be there on the
 * next boot; a 500 or a 429 will not, and refusing to start over a vendor blip
 * is its own outage.
 */
async function probeSynthesis(voiceId: string, apiKey: string, fetchFn: FetchLike): Promise<VendorCheck | null> {
  const { url, body } = synthesisProbeRequest(voiceId);
  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      body,
    });
  } catch {
    return { vendor: 'ElevenLabs', fatal: false, detail: `could not be reached — check the network, not the key.` };
  }
  if (response.ok) return null;
  if (response.status >= 500 || response.status === 429) {
    return {
      vendor: 'ElevenLabs',
      fatal: false,
      detail: `answered HTTP ${response.status} to a test line; treating as a blip rather than a misconfiguration.`,
    };
  }

  // The vendor explains itself far better than this file could guess, so say
  // what it said. An unreadable body is not a reason to stay quiet: the refusal
  // is the finding, the message is the detail.
  let said = '';
  try {
    const parsed = (await response.json()) as { detail?: { message?: string } | string };
    const detail = parsed?.detail;
    said = typeof detail === 'string' ? detail : (detail?.message ?? '');
  } catch {
    said = '';
  }

  return {
    vendor: 'ElevenLabs',
    fatal: true,
    detail:
      `lists voice "${voiceId}" but refused to speak with it (HTTP ${response.status}).\n` +
      (said ? `          The vendor said: ${said}\n` : '') +
      `          The tutor asks for this voice on ${MODEL}, and it is the COMBINATION that is refused.\n` +
      `          Being in the catalogue is not permission to synthesize. Check the plan allows this\n` +
      `          voice, and that the vendor lists the voice as verified on this model.`,
  };
}

/**
 * The same question of fish, and it has to be asked on EVERY boot.
 *
 * ElevenLabs' synthesis probe is skipped when no voice is configured, because
 * the vendor default is the vendor's problem. fish is different: the thing most
 * likely to refuse is not the voice, it is the MODEL. `s2.1-pro-free` is the
 * only model fish's free tier serves and its free window was published to end
 * 2026-08-31, so the failure this probe exists to catch is a 402 appearing one
 * morning on a configuration nobody touched. A probe that only ran when a voice
 * id was set would miss it exactly when it mattered.
 *
 * Fatality follows the rule the rest of this file uses: a deterministic no
 * about the configuration stops the worker, weather does not.
 */
async function probeFishSynthesis(env: Env, fetchFn: FetchLike): Promise<VendorCheck | null> {
  const { url, headers, body } = fishSynthesisProbeRequest(env.FISH_API_KEY ?? '', PROBE_LINE, env);
  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  try {
    response = await fetchFn(url, { method: 'POST', headers, body });
  } catch {
    return { vendor: 'fish.audio', fatal: false, detail: `could not be reached — check the network, not the key.` };
  }
  if (response.ok) return null;
  if (response.status >= 500 || response.status === 429) {
    return {
      vendor: 'fish.audio',
      fatal: false,
      detail: `answered HTTP ${response.status} to a test line; treating as a blip rather than a misconfiguration.`,
    };
  }

  // The vendor explains itself better than this file could guess. fish answers
  // in more than one shape, so read the likely ones and stay quiet rather than
  // paraphrase if none of them fits.
  let said = '';
  try {
    const parsed = (await response.json()) as { detail?: { message?: string } | string; message?: string };
    const detail = parsed?.detail;
    said = (typeof detail === 'string' ? detail : detail?.message) ?? parsed?.message ?? '';
  } catch {
    said = '';
  }

  return {
    vendor: 'fish.audio',
    fatal: true,
    detail:
      `refused to speak a test line (HTTP ${response.status}).\n` +
      (said ? `          The vendor said: ${said}\n` : '') +
      `          The tutor asks for voice "${fishVoiceId(env) ?? 'the vendor default'}" on ${fishModel(env)},\n` +
      `          and it is the COMBINATION that is refused. A 402 here usually means the free window on\n` +
      `          that model has closed: set FISH_MODEL in services/tutor-agent/.env to a paid model, or\n` +
      `          set LUVANI_TTS_VENDOR back to elevenlabs.`,
  };
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

  // Only the selected voice vendor is asked anything. Probing the other one
  // would send an empty key, read the 401 as fatal, and refuse to start a worker
  // that was perfectly able to run — the same trap claude-cli-all showed above.
  if (selectedVoiceVendor(env) === 'fish') {
    checks.push(
      (async (): Promise<VendorCheck | null> => {
        // The cheapest authenticated GET fish offers, verified live: 401 with no
        // key, 200 with one.
        //
        // `allowScopeGap` stays FALSE here, and that is not an oversight. The
        // missing_permissions parse is ElevenLabs' wire shape and ElevenLabs'
        // scoped-key model (F273). Extending it to a vendor whose refusals have
        // never been read would turn a real dead key into a silent pass on a
        // guess about somebody else's API.
        const auth = await probe(
          'fish.audio',
          'https://api.fish.audio/wallet/self/api-credit',
          { Authorization: `Bearer ${env.FISH_API_KEY ?? ''}` },
          fetchFn,
        );
        if (auth !== null) return auth;
        return probeFishSynthesis(env, fetchFn);
      })(),
    );
  } else {
    // Two questions, two endpoints, because neither can answer the other's.
    //
    // /v1/user refuses an absent key. /v1/voices does NOT — it serves the premade
    // catalogue to anonymous callers and answers 200 with no header at all — so
    // the key check cannot live there, though a *wrong* key does get a 401. That
    // asymmetry is worth stating: putting authentication on /v1/voices looks like
    // it works, passes every test written against a fake, and quietly stops
    // catching the one case it most needs to.
    //
    // The catalogue is still the only thing that can settle the voice id. A voice
    // belongs to the account that made it, so a key rotated onto a new account
    // leaves an id that passes every other check and then 404s at synthesis —
    // reaching the learner as a room that opens and a tutor that never speaks.
    // Asked second, and only once the key is known good, so one broken vendor
    // produces one message.
    checks.push(
      (async (): Promise<VendorCheck | null> => {
        const headers = { 'xi-api-key': env.ELEVEN_API_KEY ?? '' };
        // `undefined` for onOk, `true` for allowScopeGap: a key scoped to
        // synthesis alone cannot read the account, and that is not a bad key.
        const auth = await probe('ElevenLabs', 'https://api.elevenlabs.io/v1/user', headers, fetchFn, undefined, true);
        if (auth !== null) return auth;

        // EVERY voice in the catalogue, not the one an env var named. The
        // learner picks, so a voice this account cannot speak with is not a
        // misconfiguration waiting for someone to select it — it is a room that
        // opens and a tutor that never speaks, for whoever chose that one, on a
        // worker where the other seven are fine and every other check is green.
        const catalogue = await probe('ElevenLabs', 'https://api.elevenlabs.io/v1/voices', headers, fetchFn, (body) => {
          const voices = (body as { voices?: { voice_id?: string; name?: string; category?: string }[] }).voices ?? [];
          const listed = new Map<string, { name?: string; category?: string }>();
          for (const v of voices) if (typeof v.voice_id === 'string') listed.set(v.voice_id, v);
          // An unreadable or empty list is not evidence anything is missing.
          // Better to let a working setup boot than to refuse over a body this
          // check did not understand.
          if (listed.size === 0) return null;

          const entries = Object.entries(ELEVEN_VOICES);
          const missing = entries.filter(([, id]) => !listed.has(id));
          if (missing.length > 0) {
            // Named by KEY, because the key is what a reader acts on: either the
            // voice goes back on the account, or the key comes out of the
            // catalogue. The vendor id is printed beside it only so it can be
            // pasted into the vendor's own search.
            const named = missing.map(([key, id]) => `${key} (${id})`).join(', ');
            // The sample is printed only when NOTHING matches, which is the
            // signature of a key rotated onto a different account. With one or
            // two voices missing it is noise — the reader already knows which
            // key to act on, and four unrelated ids from the account would
            // invite pasting one of them in, which is how the old
            // ELEVEN_VOICE_ID advice used to end.
            const sample =
              missing.length < entries.length
                ? ''
                : `\n          This account does list: ` +
                  voices
                    .filter((v) => typeof v.voice_id === 'string')
                    .slice(0, 4)
                    .map((v) => `${v.name ?? 'unnamed'} (${v.voice_id})`)
                    .join(', ');
            return {
              vendor: 'ElevenLabs',
              fatal: true,
              detail:
                `accepts the key but does not list ${missing.length} of the ${entries.length} catalogue voices:\n` +
                `          ${named}\n` +
                `          A voice belongs to the account that made it, so this is what a key rotated onto a NEW\n` +
                `          account looks like. Synthesis would 404 for any learner who picked one, and the tutor\n` +
                `          would join and never speak.\n` +
                `          Re-add the voice to this account, or remove the key from ELEVEN_VOICES in voice.ts AND\n` +
                `          from packages/core/src/protocol/voices.ts — both, or the Record stops compiling.` +
                sample,
            };
          }

          // A stock voice is a tutor with an expiry date on it. Non-fatal: it
          // still speaks today, and refusing to boot over a deadline months out
          // would take the product down to prevent an outage. Reported second,
          // because a voice that cannot be spoken with at all outranks one that
          // can be spoken with until December — probe() returns one check, and
          // one broken vendor has to stay one message.
          const premade = entries.filter(([, id]) => listed.get(id)?.category === 'premade');
          if (premade.length > 0) {
            return {
              vendor: 'ElevenLabs',
              fatal: false,
              detail:
                `lists ${premade.map(([key]) => key).join(', ')} as a premade voice. ElevenLabs is retiring its\n` +
                `          premade catalogue on ${PREMADE_RETIREMENT}, after which that voice stops synthesizing and\n` +
                `          every learner who chose it meets a silent tutor. Replace it with a library or\n` +
                `          professional voice in ELEVEN_VOICES before then, and re-warm the cache.`,
            };
          }
          return null;
        }, true);
        if (catalogue !== null) return catalogue;

        // Asked third and only once the first two are clean, so one broken vendor
        // still produces one message. Costs `PROBE_LINE` worth of quota per boot,
        // which is four characters against a tutor that silently cannot speak.
        //
        // THE DEFAULT VOICE ONLY, and that is a deliberate limit rather than an
        // oversight. This probe answers "is this account allowed to SAY
        // anything", which is a property of the plan and not of the voice; the
        // catalogue check above has already proved the account owns all eight.
        // Probing each one would multiply every dev restart by eight billed
        // requests to re-answer the same question.
        return probeSynthesis(ELEVEN_VOICES[DEFAULT_TUTOR_VOICE], env.ELEVEN_API_KEY ?? '', fetchFn);
      })(),
    );
  }

  checks.push(probe('Deepgram', 'https://api.deepgram.com/v1/projects', { Authorization: `Token ${env.DEEPGRAM_API_KEY ?? ''}` }, fetchFn));

  return (await Promise.all(checks)).filter((c): c is VendorCheck => c !== null);
}

/** Prints what the vendors said, and refuses to start on anything fatal. */
export function reportVendors(checks: readonly VendorCheck[], exit: (code: number) => never = process.exit): void {
  for (const check of checks.filter((c) => !c.fatal)) console.warn(`[luvani:agent] ${check.vendor} ${check.detail}`);

  const fatal = checks.filter((c) => c.fatal);
  if (fatal.length === 0) {
    console.info('[luvani:agent] vendors ok — brain, voice and transcription all answered.');
    return;
  }
  console.error(
    `\n[luvani:agent] Cannot start. The keys are present but the vendors disagree:\n` +
      fatal.map((c) => `        - ${c.vendor} ${c.detail}`).join('\n') +
      `\n\n        Every one of these reaches a learner the same way: a room that opens\n` +
      `        and a tutor that never speaks. Fix them in services/tutor-agent/.env.\n`,
  );
  exit(1);
}

/** Called once at startup, before the worker registers with LiveKit. */
export function preflight(env: Env = process.env, exit: (code: number) => never = process.exit): void {
  for (const line of warnings(env)) console.warn(`[luvani:agent] ${line}`);

  const missing = missingRequired(env);
  if (missing.length === 0) {
    console.info(`[luvani:agent] preflight ok — brain: ${selectedBrain(env)}`);
    return;
  }

  console.error(
    `\n[luvani:agent] Cannot start. Missing in services/tutor-agent/.env:\n` +
      missing.map((name) => `        - ${name}`).join('\n') +
      `\n\n        Copy services/tutor-agent/.env.example to .env and fill it in.\n` +
      `        The brain is selected by TUTOR_LLM (currently: ${selectedBrain(env)}).\n` +
      `        Set TUTOR_LLM=groq to use the free-tier fallback instead.\n`,
  );
  exit(1);
}
