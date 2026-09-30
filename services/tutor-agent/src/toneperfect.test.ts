import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildReport, getPhoneme } from '@luvani/core';
import { toInventoryIpa } from '../../shared/phoneMap.ts';
import { scoreUtterance, type ScoreFetch } from '../../shared/pronunciation.ts';
import { parseTonePerfect, scoreWithTonePerfect, sniffAudio } from '../../shared/toneperfect.ts';

/**
 * The one real TonePerfect response this product has ever paid for, committed
 * verbatim (raw block and all): the tutor's own recording of "Bonjour, je vais
 * prendre un café.", assessed on 2026-09-29. A fixture edited by hand would no
 * longer be evidence of the vendor's shape, so nothing here trims it.
 */
const FIXTURE_TEXT = readFileSync(new URL('./fixtures/toneperfect-fr.json', import.meta.url), 'utf8');
const FIXTURE = JSON.parse(FIXTURE_TEXT) as {
  words: { word: string; phones: { expected: string; phone: string; heard: string; score: number }[]; phonemes: { expected: string; phone: string; heard: string }[] }[];
  raw: { n_scored: number; words: { phones: { phone: string; heard: string }[] }[]; phones: { phone: string; heard: string }[] };
};
/** A fresh copy per use, so no test can quietly edit the evidence for the next. */
const fixture = () => JSON.parse(FIXTURE_TEXT) as typeof FIXTURE;

const ENDPOINT = 'https://api.toneperfect.app/v1/assess';
/** Short on purpose: long enough to recognise, too short to read as a credential. */
const KEY = 'tp-test-key';
const ENV = { TONEPERFECT_API_KEY: KEY };
/** Recognisable bytes, so "the audio arrived" is a claim and not a shrug: a WAV header, as the live tutor sends. */
const AUDIO = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03, 0x04, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20]);
const LINE = 'Bonjour, je vais prendre un café.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Init = Parameters<ScoreFetch>[1];
type Reply = { status: number; body?: unknown; unreadable?: boolean } | Error | 'hang' | 'hang-deaf';

/**
 * A scripted stand-in for fetch. Each call takes the next reply; the last one
 * repeats. 'hang' never answers but honours the abort signal the way real fetch
 * does; 'hang-deaf' ignores the signal altogether, the worst case a vendor
 * client could hand us.
 */
function scripted(...replies: Reply[]) {
  const calls: { url: string; init: Init }[] = [];
  const fetchFn: ScoreFetch = async (url, init) => {
    calls.push({ url, init });
    const reply = replies[Math.min(calls.length, replies.length) - 1] ?? { status: 200, body: fixture() };
    if (reply instanceof Error) throw reply;
    if (reply === 'hang-deaf') return new Promise(() => {});
    if (reply === 'hang') {
      return new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    }
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => {
        if (reply.unreadable) throw new SyntaxError('Unexpected token < in JSON at position 0');
        return reply.body;
      },
    };
  };
  return { calls, fetchFn };
}

const OK = { status: 200, body: fixture() };

/** Any `fetch` a test forgot to inject lands here instead of on the network. */
const escaped: string[] = [];
let realFetch: typeof globalThis.fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    escaped.push(String(input));
    throw new Error('the network is switched off in this suite');
  }) as typeof globalThis.fetch;
});
after(() => {
  globalThis.fetch = realFetch;
  assert.deepEqual(escaped, [], 'a TonePerfect test reached for the real network');
});

describe('the request TonePerfect receives', () => {
  test('the request carries the audio, the line, the language and a bearer key, and never the key in the URL', async (t) => {
    t.mock.method(console, 'info', () => {});
    const { calls, fetchFn } = scripted(OK);
    await scoreWithTonePerfect({ reference: LINE, audio: AUDIO }, { fetchFn, env: ENV });

    assert.equal(calls.length, 1, 'exactly one request should carry the utterance');
    const { url, init } = calls[0]!;
    assert.equal(url, ENDPOINT, 'no query string at all, so nothing secret can ride in it');
    assert.ok(!url.includes(KEY), 'the key never appears in the URL, which is the part proxies log');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers?.Authorization, `Bearer ${KEY}`);
    assert.deepEqual(Object.keys(init.headers ?? {}).sort(), ['Authorization', 'Idempotency-Key']);

    const form = init.body;
    const fields: [string, FormDataEntryValue][] = [];
    form.forEach((value, name) => fields.push([name, value]));
    assert.deepEqual(fields.map(([name]) => name).sort(), ['audio', 'language', 'text'], 'nothing about the learner rides along');
    assert.equal(form.get('text'), LINE, 'accuracy scoring is meaningless without the line');
    assert.equal(form.get('language'), 'fr-FR', 'French by default, never English');
    const audio = form.get('audio') as File | null;
    assert.ok(audio instanceof Blob, 'the audio part is the whole point of the request');
    assert.equal(audio.type, 'audio/wav');
    assert.equal(audio.name, 'utterance.wav');
    assert.deepEqual(new Uint8Array(await audio.arrayBuffer()), AUDIO, 'the bytes the learner spoke');
    for (const [name, value] of fields) {
      assert.ok(typeof value !== 'string' || !value.includes(KEY), `the ${name} field carries the key`);
    }

    const quebec = scripted(OK);
    await scoreWithTonePerfect({ reference: 'Bonjour', audio: AUDIO, dialect: 'fr-ca' }, { fetchFn: quebec.fetchFn, env: ENV });
    assert.equal(quebec.calls[0]!.init.body.get('language'), 'fr-CA', 'a Quebec learner is assessed as one');
  });

  test('a drill recording is sent to TonePerfect labelled with the format it was recorded in', async (t) => {
    t.mock.method(console, 'info', () => {});
    const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
    // Drills and sound checks record AAC in .m4a on a phone and WebM on the web; only
    // the live tutor sends WAV. A header the vendor was not told about is a refusal.
    const cases: [string, number[], string, string][] = [
      ['wav', [...ascii('RIFF'), 0x24, 0x08, 0x00, 0x00, ...ascii('WAVEfmt ')], 'audio/wav', 'utterance.wav'],
      ['m4a, as expo-audio records on a phone', [0x00, 0x00, 0x00, 0x20, ...ascii('ftypM4A '), 0x00, 0x00], 'audio/mp4', 'utterance.m4a'],
      ['webm, as a browser records', [0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81], 'audio/webm', 'utterance.webm'],
      ['ogg', [...ascii('OggS'), 0x00, 0x02, 0x00, 0x00], 'audio/ogg', 'utterance.ogg'],
      ['mp3 with an ID3 tag', [...ascii('ID3'), 0x04, 0x00, 0x00], 'audio/mpeg', 'utterance.mp3'],
      ['mp3 opening on a frame sync', [0xff, 0xfb, 0x90, 0x64], 'audio/mpeg', 'utterance.mp3'],
      ['mp3 opening on an MPEG-2.5 frame sync', [0xff, 0xe3, 0x18, 0xc4], 'audio/mpeg', 'utterance.mp3'],
      ['unknown bytes', ascii('hello, world'), 'application/octet-stream', 'audio'],
      ['a RIFF that is not WAVE', [...ascii('RIFF'), 0x24, 0x08, 0x00, 0x00, ...ascii('AVI ')], 'application/octet-stream', 'audio'],
      ['a header cut short before the ftyp box', [0x00, 0x00, 0x00, 0x20, ...ascii('fty')], 'application/octet-stream', 'audio'],
      ['a JPEG, whose 0xFFD8 is no frame sync', [0xff, 0xd8, 0xff, 0xe0], 'application/octet-stream', 'audio'],
    ];

    for (const [label, header, mime, filename] of cases) {
      const bytes = new Uint8Array(header);
      assert.deepEqual(sniffAudio(bytes), { mime, filename }, label);
      assert.deepEqual(bytes, new Uint8Array(header), `sniffing ${label} leaves the bytes alone`);

      const { calls, fetchFn } = scripted(OK);
      await scoreWithTonePerfect({ reference: LINE, audio: bytes }, { fetchFn, env: ENV });
      assert.equal(calls.length, 1, label);
      const part = calls[0]!.init.body.get('audio') as File | null;
      assert.ok(part instanceof Blob, `${label}: the audio part is there`);
      assert.equal(part.type, mime, `${label} is labelled as what it is`);
      assert.equal(part.name, filename, `${label} is named as what it is`);
      assert.deepEqual(new Uint8Array(await part.arrayBuffer()), bytes, `${label}: the bytes go unchanged`);
    }
  });

  test('every attempt gets its own Idempotency-Key, and a retry reuses it', async (t) => {
    t.mock.method(console, 'info', () => {});
    t.mock.method(console, 'warn', () => {});

    const first = scripted(OK);
    const second = scripted(OK);
    await scoreWithTonePerfect({ reference: LINE, audio: AUDIO }, { fetchFn: first.fetchFn, env: ENV });
    await scoreWithTonePerfect({ reference: LINE, audio: AUDIO }, { fetchFn: second.fetchFn, env: ENV });
    const a = first.calls[0]!.init.headers?.['Idempotency-Key'];
    const b = second.calls[0]!.init.headers?.['Idempotency-Key'];
    assert.match(a ?? '', UUID, 'random, so the JSON the vendor keeps for a day carries no learner identifier');
    assert.match(b ?? '', UUID);
    assert.notEqual(a, b, 'two utterances are two assessments, and each one is billed on its own');

    const retried = scripted({ status: 503 }, OK);
    await scoreWithTonePerfect({ reference: LINE, audio: AUDIO }, { fetchFn: retried.fetchFn, env: ENV });
    assert.equal(retried.calls.length, 2);
    const [once, again] = retried.calls.map((c) => c.init.headers?.['Idempotency-Key']);
    assert.match(once ?? '', UUID);
    assert.equal(again, once, 'a retried request carries the same key, so it cannot bill twice');
  });

  test('a 5xx is retried once inside the same deadline; a 4xx is not retried', async (t) => {
    t.mock.method(console, 'info', () => {});
    t.mock.method(console, 'warn', () => {});
    const req = { reference: LINE, audio: AUDIO };

    const deadline = new AbortController();
    const recovered = scripted({ status: 503 }, OK);
    const observations = await scoreWithTonePerfect(req, { fetchFn: recovered.fetchFn, env: ENV, signal: deadline.signal });
    assert.equal(recovered.calls.length, 2, 'one retry after a server error');
    assert.equal(observations.length, 19, 'and the retry’s answer is the one that counts');
    assert.equal(recovered.calls[0]!.init.signal, deadline.signal, 'the first attempt runs on the shared deadline');
    assert.equal(recovered.calls[1]!.init.signal, deadline.signal, 'and so does the retry: it does not get a fresh clock');

    const down = scripted({ status: 503 }, { status: 502 }, OK);
    assert.deepEqual(await scoreWithTonePerfect(req, { fetchFn: down.fetchFn, env: ENV }), []);
    assert.equal(down.calls.length, 2, 'at most two attempts, however long the outage');

    const throttled = scripted({ status: 429 }, OK);
    assert.equal((await scoreWithTonePerfect(req, { fetchFn: throttled.fetchFn, env: ENV })).length, 19);
    assert.equal(throttled.calls.length, 2, 'a rate limit is worth one more try');

    const dropped = scripted(new TypeError('fetch failed'), OK);
    assert.equal((await scoreWithTonePerfect(req, { fetchFn: dropped.fetchFn, env: ENV })).length, 19);
    assert.equal(dropped.calls.length, 2, 'a dropped connection is worth one more try');

    for (const status of [400, 401, 402, 403, 404, 413, 415, 422]) {
      const refused = scripted({ status }, OK);
      assert.deepEqual(await scoreWithTonePerfect(req, { fetchFn: refused.fetchFn, env: ENV }), [], `${status}`);
      assert.equal(refused.calls.length, 1, `a ${status} will say the same thing twice, so it is not asked twice`);
    }

    // The deadline fired while the first attempt was failing: nothing is left to spend on a retry.
    const late = new AbortController();
    const spent = scripted({ status: 503 }, OK);
    const lateFetch: ScoreFetch = async (url, init) => {
      late.abort();
      return spent.fetchFn(url, init);
    };
    assert.deepEqual(await scoreWithTonePerfect(req, { fetchFn: lateFetch, env: ENV, signal: late.signal }), []);
    assert.equal(spent.calls.length, 1, 'no retry once the shared deadline has fired');
  });
});

describe('what counts as no score', () => {
  test('an unassessable response means no score, not a low one', async (t) => {
    const warned = t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'info', () => {});

    // The words and their scores are all still there; only the verdict says not to trust them.
    const refusedToAssess = { ...fixture(), assessable: false, reason: 'speech_too_short' };
    const { calls, fetchFn } = scripted({ status: 200, body: refusedToAssess });
    assert.deepEqual(await scoreWithTonePerfect({ reference: LINE, audio: AUDIO }, { fetchFn, env: ENV }), []);
    assert.equal(calls.length, 1, 'an answer, even a refusal to assess, is not retried');
    assert.ok(
      warned.mock.calls.some((c) => String(c.arguments[0]).includes('speech_too_short')),
      'the vendor’s reason is logged, so an unscored session can be explained',
    );

    // Only `completed` and a literal `true` count. Anything else, however many scores it carries, is no verdict.
    for (const verdict of [
      { status: 'failed', assessable: false, reason: null },
      { status: 'processing' },
      { assessable: undefined },
      { assessable: 'true' },
      { status: undefined },
    ]) {
      assert.deepEqual(parseTonePerfect({ ...fixture(), ...verdict }), [], JSON.stringify(verdict));
    }
  });

  test('a refusal, an outage, a hang and a malformed body all leave the turn unscored', async (t) => {
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'info', () => {});
    const req = { reference: LINE, audio: AUDIO };

    const refused = scripted({ status: 401 });
    assert.deepEqual(await scoreWithTonePerfect(req, { fetchFn: refused.fetchFn, env: ENV }), [], 'a refusal');

    const outage = scripted(new TypeError('fetch failed'));
    assert.deepEqual(await scoreWithTonePerfect(req, { fetchFn: outage.fetchFn, env: ENV }), [], 'an outage');
    assert.equal(outage.calls.length, 2);

    // A hang, through the router that owns the deadline. Real fetch gives up when the signal fires...
    const hung = scripted('hang');
    const startedAt = Date.now();
    assert.deepEqual(await scoreUtterance(req, { fetchFn: hung.fetchFn, env: ENV, timeoutMs: 40 }), [], 'a hang');
    assert.equal(hung.calls.length, 1, 'a timeout spends the deadline, so it is never retried');
    assert.ok(hung.calls[0]!.init.signal?.aborted, 'the request was told to give up');
    // ...and a client that ignores the signal still cannot hold the learner's turn.
    const deaf = scripted('hang-deaf');
    assert.deepEqual(await scoreUtterance(req, { fetchFn: deaf.fetchFn, env: ENV, timeoutMs: 40 }), [], 'a deaf hang');
    assert.ok(Date.now() - startedAt < 2000, 'both hangs were abandoned at the deadline, not waited out');

    for (const reply of [
      { status: 200, unreadable: true },
      { status: 200, body: 'not json at all' },
      { status: 200, body: null },
      { status: 200, body: [1, 2, 3] },
      { status: 200, body: { status: 'completed', assessable: true, words: 'nope' } },
      { status: 200, body: { status: 'completed', assessable: true, words: [{ word: 'rue', phones: [{ expected: 'ʁ' }, { score: 80 }] }] } },
    ]) {
      const malformed = scripted(reply);
      assert.deepEqual(await scoreWithTonePerfect(req, { fetchFn: malformed.fetchFn, env: ENV }), [], JSON.stringify(reply));
      assert.equal(malformed.calls.length, 1, 'a body that cannot be read is an answer, not an outage');
    }
  });

  test('no request is made without a key or without audio', async () => {
    for (const env of [{}, { TONEPERFECT_API_KEY: '' }, { TONEPERFECT_API_KEY: '   ' }, { SPEECHACE_API_KEY: 'test-key' }]) {
      const noKey = scripted(OK);
      assert.deepEqual(await scoreWithTonePerfect({ reference: LINE, audio: AUDIO }, { fetchFn: noKey.fetchFn, env }), []);
      assert.equal(noKey.calls.length, 0, `an unconfigured scorer must not send the learner’s voice anywhere: ${JSON.stringify(env)}`);
    }

    for (const audio of [undefined, new Uint8Array(0)]) {
      const noAudio = scripted(OK);
      assert.deepEqual(await scoreWithTonePerfect({ reference: LINE, ...(audio ? { audio } : {}) }, { fetchFn: noAudio.fetchFn, env: ENV }), []);
      assert.equal(noAudio.calls.length, 0, 'silence is not worth a vendor round trip, or a credit');
    }
  });
});

describe('the saved TonePerfect response', () => {
  test('the saved TonePerfect response parses into one observation per scored phone', () => {
    const payload = fixture();
    const observations = parseTonePerfect(payload);

    const scored = payload.words.flatMap((w) => w.phones).filter((p) => Number.isFinite(p.score));
    assert.equal(scored.length, 19);
    assert.equal(payload.raw.n_scored, 19, 'the vendor counts the same nineteen');
    assert.equal(observations.length, 19, 'one observation per scored phone, none dropped and none invented');

    assert.deepEqual(
      [...new Set(observations.map((o) => o.ipa))],
      ['b', 'ɔ̃', 'ʒ', 'u', 'ʁ', 'ə', 'v', 'ɛ', 'p', 'ɑ̃', 'd', 'œ̃', 'k', 'a', 'f', 'e'],
    );
    assert.deepEqual(
      observations.map((o) => o.word),
      [...Array(5).fill('bonjour'), 'je', 'je', 'vais', 'vais', ...Array(5).fill('prendre'), 'un', ...Array(4).fill('café')],
      'each sound keeps the word it came from, so feedback can quote it',
    );
    assert.deepEqual(observations[0], { ipa: 'b', score: 87.9, word: 'bonjour' });
    assert.deepEqual(
      observations.map((o) => o.score),
      scored.map((p) => p.score),
      'the vendor’s score passes through untouched',
    );
  });

  test('every symbol TonePerfect returned is in the French inventory, none unmapped', (t) => {
    const warned = t.mock.method(console, 'warn', () => {});
    const payload = fixture();

    // Every place the response names a sound: the parsed block, its duplicate, and the vendor's raw block.
    const symbols = new Set<string>();
    for (const w of payload.words) {
      for (const p of [...w.phones, ...w.phonemes]) for (const s of [p.expected, p.phone, p.heard]) symbols.add(s);
    }
    for (const p of [...payload.raw.words.flatMap((w) => w.phones), ...payload.raw.phones]) {
      symbols.add(p.phone);
      symbols.add(p.heard);
    }

    assert.equal(symbols.size, 18, 'eighteen distinct symbols came back from the one real call');
    for (const symbol of symbols) {
      const ipa = toInventoryIpa(symbol);
      assert.ok(ipa !== null, `${symbol} is not a symbol the inventory speaks`);
      assert.equal(ipa, symbol, `${symbol} arrived as plain IPA and needed no alias`);
      assert.ok(getPhoneme(ipa), `${symbol} maps to nothing the scorer can report on`);
    }

    parseTonePerfect(payload);
    const complaints = warned.mock.calls.map((c) => String(c.arguments[0]));
    assert.deepEqual(complaints.filter((m) => /not in the French inventory|no readable phones/.test(m)), []);
  });

  test('what the learner said instead is kept as the substitution', () => {
    const observations = parseTonePerfect(fixture());
    const substituted = observations.filter((o) => o.substituted !== undefined);

    assert.deepEqual(
      substituted.map((o) => [o.word, o.ipa, o.substituted]),
      [
        ['bonjour', 'u', 'ɔ'],
        ['vais', 'ɛ', 'e'],
        ['prendre', 'ʁ', 'a'],
        ['un', 'œ̃', 'ɛ̃'],
      ],
    );
    assert.equal(observations.find((o) => o.ipa === 'b')?.substituted, undefined, 'a sound heard as itself is no substitution');
    const prendre = observations.filter((o) => o.word === 'prendre' && o.ipa === 'ʁ');
    assert.deepEqual(prendre.map((o) => o.substituted), [undefined, 'a'], 'only the final /ʁ/ of "prendre" slipped');

    // A sound outside French is exactly the answer worth showing, so it is kept verbatim;
    // a vendor spelling we can place is translated like any other.
    const [english, xsampa] = parseTonePerfect({
      status: 'completed',
      assessable: true,
      words: [
        { word: 'tu', phones: [{ expected: 'y', heard: 'ʊ', score: 44 }] },
        { word: 'je', phones: [{ expected: 'ʒ', heard: 'S', score: 61 }] },
      ],
    });
    assert.equal(english?.substituted, 'ʊ');
    assert.equal(xsampa?.substituted, 'ʃ');
  });
});

describe('what the report makes of it', () => {
  test('the fixture is deterministic: same ranking, same weakest sound, no focus to name', () => {
    assert.equal(buildReport(parseTonePerfect(fixture())).focus, null, 'one native-quality line earns no focus');

    const threePasses = () => buildReport([...parseTonePerfect(fixture()), ...parseTonePerfect(fixture()), ...parseTonePerfect(fixture())]);
    const runs = [threePasses(), threePasses(), threePasses()];
    assert.deepEqual(runs[1], runs[0]);
    assert.deepEqual(runs[2], runs[0]);

    const report = runs[0]!;
    assert.equal(report.stats.length, 16);
    assert.deepEqual(
      report.stats.map((s) => s.ipa),
      ['ə', 'ɑ̃', 'œ̃', 'v', 'f', 'p', 'a', 'ʒ', 'e', 'ɔ̃', 'd', 'k', 'b', 'ʁ', 'ɛ', 'u'],
      'the same ranking every time',
    );
    const weakest = report.stats.at(-1)!;
    assert.equal(weakest.ipa, 'u');
    assert.equal(weakest.meanScore, 76);
    assert.equal(weakest.sampleCount, 3);
    assert.equal(weakest.worstWord, 'bonjour');
    assert.equal(weakest.commonSubstitution, 'ɔ');

    // /u/ is the only sound under the bar and there is no drill for it yet; /ɛ/ and /ʁ/ clear the bar.
    // Naming a problem with no way to fix it is worse than silence, so the tutor's own line is clean.
    assert.ok(report.stats.find((s) => s.ipa === 'ɛ')!.meanScore >= 78);
    assert.ok(report.stats.find((s) => s.ipa === 'ʁ')!.meanScore >= 78);
    assert.equal(report.focus, null, 'no focus to name');
  });

  test('a TonePerfect response with a genuinely weak sound reaches a focus point and its drill', () => {
    // The same numbers speechace.test.ts proves with, in TonePerfect's shape: "sur place".
    const phone = (expected: string, score: number, heard = expected) => ({
      expected,
      phone: expected,
      dimension: 'phoneme',
      heard,
      score,
      operation: heard === expected ? 'M' : 'S',
      diagnosis_status: 'experimental',
    });
    const weak = {
      status: 'completed',
      assessable: true,
      reason: null,
      words: [
        { index: 0, text: 'Sur', word: 'sur', phones: [phone('s', 94), phone('y', 41, 'u'), phone('ʁ', 38, 'l')] },
        { index: 1, text: 'place', word: 'place', phones: [phone('p', 88), phone('l', 91), phone('a', 90), phone('s', 93)] },
      ],
    };

    const report = buildReport([...parseTonePerfect(weak), ...parseTonePerfect(weak), ...parseTonePerfect(weak)]);
    assert.ok(report.focus, 'expected a focus point from genuinely weak scores');
    assert.equal(report.focus.phoneme.ipa, 'ʁ', 'the hardest, most-wrong sound should win');
    assert.equal(report.focus.drill.id, 'r-vs-l', 'and the drill should contrast the actual substitution');
    assert.match(report.focus.reason, /sur/, 'feedback should quote the word they said it in');
  });
});
