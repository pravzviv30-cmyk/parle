import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SCORING_TIMEOUT_MS, scoreUtterance, selectScoringVendor, type ScoreFetch } from '../../shared/pronunciation.ts';

/**
 * The router between the learner's voice and whichever vendor scores it.
 *
 * What matters here is where the audio goes. A score is only honest if the
 * voice reached the scorer somebody chose, and a voice sent to a vendor nobody
 * chose is a privacy problem before it is a scoring one.
 */

const TONEPERFECT = 'https://api.toneperfect.app/v1/assess';
const SPEECHACE = 'https://api.speechace.co/api/scoring/text/v9/json';
const AUDIO = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x05, 0x06, 0x07, 0x08]);
const REQ = { reference: 'Bonjour, je vais prendre un café.', audio: AUDIO };
const BOTH = { TONEPERFECT_API_KEY: 'tp-test-key', SPEECHACE_API_KEY: 'sa-test-key' };
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/toneperfect-fr.json', import.meta.url), 'utf8')) as unknown;

/**
 * Any `fetch` a test forgot to inject lands here instead of on the network.
 * Installed before the first test and checked by the last one.
 */
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
});

/** Records every request and answers each vendor in its own shape. */
function recorder() {
  const calls: { url: string; init: Parameters<ScoreFetch>[1] }[] = [];
  const fetchFn: ScoreFetch = async (url, init) => {
    calls.push({ url, init });
    const body = url.startsWith(TONEPERFECT)
      ? FIXTURE
      : { text_score: { word_score_list: [{ word: 'bonjour', phone_score_list: [{ phone: 'b', quality_score: 90 }] }] } };
    return { ok: true, status: 200, json: async () => body };
  };
  return { calls, fetchFn };
}

/** The audio part of a request, whichever vendor's field name it travels under. */
async function audioSent(form: FormData): Promise<Uint8Array | null> {
  const part = (form.get('audio') ?? form.get('user_audio_file')) as Blob | null;
  return part ? new Uint8Array(await part.arrayBuffer()) : null;
}

describe('which vendor hears the learner', () => {
  test('TonePerfect is chosen whenever its key is set and nothing says otherwise', async (t) => {
    const warned = t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'info', () => {});

    assert.equal(selectScoringVendor({ TONEPERFECT_API_KEY: 'tp-test-key' }), 'toneperfect');
    assert.equal(selectScoringVendor(BOTH), 'toneperfect', 'the founder’s choice wins over the older key');
    assert.equal(selectScoringVendor({ SPEECHACE_API_KEY: 'sa-test-key' }), 'speechace', 'the alternative, when it is all there is');
    assert.equal(selectScoringVendor({}), null);

    // Blank is unset. The `TUTOR_LLM=` line in a copied example taught that lesson once already.
    assert.equal(selectScoringVendor({ ...BOTH, LUVANI_SCORING_VENDOR: '' }), 'toneperfect');
    assert.equal(selectScoringVendor({ ...BOTH, LUVANI_SCORING_VENDOR: '   ' }), 'toneperfect');
    assert.equal(selectScoringVendor({ TONEPERFECT_API_KEY: '', SPEECHACE_API_KEY: 'sa-test-key' }), 'speechace');
    assert.equal(selectScoringVendor({ TONEPERFECT_API_KEY: '  ' }), null);

    // A name nobody recognises is treated as unset, and said out loud once rather than on every turn.
    assert.equal(selectScoringVendor({ ...BOTH, LUVANI_SCORING_VENDOR: 'azure' }), 'toneperfect');
    assert.equal(selectScoringVendor({ ...BOTH, LUVANI_SCORING_VENDOR: 'azure' }), 'toneperfect');
    const aboutAzure = warned.mock.calls.filter((c) => String(c.arguments[0]).includes('azure'));
    assert.equal(aboutAzure.length, 1, 'an unrecognised vendor name is warned about once');

    // End to end: with both keys present, the audio goes to TonePerfect and only there.
    const { calls, fetchFn } = recorder();
    const observations = await scoreUtterance(REQ, { fetchFn, env: BOTH });
    assert.deepEqual(calls.map((c) => c.url), [TONEPERFECT]);
    assert.deepEqual(await audioSent(calls[0]!.init.body), AUDIO);
    assert.equal(observations.length, 19, 'and its answer comes back as the learner’s observations');
    assert.equal(SCORING_TIMEOUT_MS, 5000, 'a live turn waits five seconds for a score and no longer');
  });

  test('LUVANI_SCORING_VENDOR picks the vendor by name, and the audio goes to that vendor\'s endpoint', async (t) => {
    t.mock.method(console, 'info', () => {});
    t.mock.method(console, 'warn', () => {});

    const speechace = recorder();
    const fromSpeechace = await scoreUtterance(REQ, { fetchFn: speechace.fetchFn, env: { ...BOTH, LUVANI_SCORING_VENDOR: 'speechace' } });
    assert.equal(speechace.calls.length, 1);
    assert.ok(speechace.calls[0]!.url.startsWith(SPEECHACE), 'named, so chosen, even with the TonePerfect key present');
    assert.deepEqual(await audioSent(speechace.calls[0]!.init.body), AUDIO, 'the bytes the learner spoke');
    assert.deepEqual(fromSpeechace, [{ ipa: 'b', score: 90, word: 'bonjour', substituted: undefined }]);

    const toneperfect = recorder();
    await scoreUtterance(REQ, { fetchFn: toneperfect.fetchFn, env: { ...BOTH, LUVANI_SCORING_VENDOR: ' TonePerfect ' } });
    assert.deepEqual(toneperfect.calls.map((c) => c.url), [TONEPERFECT], 'trimmed and lower-cased before it is read');
    assert.deepEqual(await audioSent(toneperfect.calls[0]!.init.body), AUDIO);

    // A name is honoured as written, key or no key. What happens without the key is the next test.
    assert.equal(selectScoringVendor({ LUVANI_SCORING_VENDOR: 'speechace' }), 'speechace');
    assert.equal(selectScoringVendor({ LUVANI_SCORING_VENDOR: 'toneperfect', SPEECHACE_API_KEY: 'sa-test-key' }), 'toneperfect');
  });

  test('a vendor named without its key scores nothing rather than sending audio elsewhere', async (t) => {
    const warned = t.mock.method(console, 'warn', () => {});

    const speechaceNamed = recorder();
    const env = { LUVANI_SCORING_VENDOR: 'speechace', TONEPERFECT_API_KEY: 'tp-test-key' };
    assert.deepEqual(await scoreUtterance(REQ, { fetchFn: speechaceNamed.fetchFn, env }), []);
    assert.equal(speechaceNamed.calls.length, 0, 'the learner’s voice is never redirected to a vendor nobody chose');
    assert.ok(
      warned.mock.calls.some((c) => String(c.arguments[0]).includes('SPEECHACE_API_KEY')),
      'the missing key is named in the log, so an unscored drill can be explained',
    );

    const toneperfectNamed = recorder();
    const other = { LUVANI_SCORING_VENDOR: 'toneperfect', SPEECHACE_API_KEY: 'sa-test-key' };
    assert.deepEqual(await scoreUtterance(REQ, { fetchFn: toneperfectNamed.fetchFn, env: other }), []);
    assert.equal(toneperfectNamed.calls.length, 0);
    assert.ok(warned.mock.calls.some((c) => String(c.arguments[0]).includes('TONEPERFECT_API_KEY')));
  });

  test('with no vendor configured, the audio goes nowhere', async (t) => {
    const warned = t.mock.method(console, 'warn', () => {});

    const nowhere = recorder();
    assert.deepEqual(await scoreUtterance(REQ, { fetchFn: nowhere.fetchFn, env: {} }), []);
    assert.deepEqual(await scoreUtterance(REQ, { fetchFn: nowhere.fetchFn, env: { TONEPERFECT_API_KEY: '', SPEECHACE_API_KEY: ' ' } }), []);
    assert.equal(nowhere.calls.length, 0);
    const unconfigured = warned.mock.calls.filter((c) => /no scoring vendor/i.test(String(c.arguments[0])));
    assert.equal(unconfigured.length, 1, 'a mistyped key name shows up in the log once, not as a silent "unavailable"');

    // No audio is the live path with the flag off, every single turn: nothing is sent, and nothing is said.
    const warningsSoFar = warned.mock.callCount();
    const silent = recorder();
    assert.deepEqual(await scoreUtterance({ reference: REQ.reference }, { fetchFn: silent.fetchFn, env: BOTH }), []);
    assert.deepEqual(await scoreUtterance({ reference: REQ.reference, audio: new Uint8Array(0) }, { fetchFn: silent.fetchFn, env: {} }), []);
    assert.equal(silent.calls.length, 0, 'silence is not worth a vendor round trip');
    assert.equal(warned.mock.callCount(), warningsSoFar, 'and a turn with no audio is not a misconfiguration');
  });
});

describe('the suite itself', () => {
  // Last in the file on purpose: it vouches for every test above it.
  test('nothing in this suite reaches the network', async (t) => {
    t.mock.method(console, 'warn', () => {});
    assert.deepEqual([...escaped], [], 'a test above reached for the real network');

    // Every test above injects its own fetch. The default is real fetch, read at call time, so a
    // test that forgot would have landed on the tripwire: prove the tripwire is live for both vendors.
    assert.deepEqual(await scoreUtterance(REQ, { env: { TONEPERFECT_API_KEY: 'tp-test-key' } }), []);
    assert.deepEqual(escaped, [TONEPERFECT, TONEPERFECT], 'a dropped connection is tried twice, and both were caught');
    escaped.length = 0;
    assert.deepEqual(await scoreUtterance(REQ, { env: { SPEECHACE_API_KEY: 'sa-test-key' } }), []);
    assert.equal(escaped.length, 1);
    assert.ok(escaped[0]!.startsWith(SPEECHACE));
    escaped.length = 0;
  });
});
