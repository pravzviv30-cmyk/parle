import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEFAULT_TUTOR_VOICE, TUTOR_VOICES, type TutorVoiceKey } from '@luvani/core';
import { voicesToWarm, warmCost, warmPlanLine, warmVoiceLine, WARM_VOICES_ENV } from './warmPlan.ts';

const CATALOGUE = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];

/**
 * The real scripted corpus, measured rather than asserted at a magic number:
 * 62 sentences and 1,618 characters at the time of writing. The tests below use
 * a small stand-in corpus so a lesson edit cannot turn a cost-arithmetic test
 * red, and only the ratio test reads the real one.
 */
const CORPUS = ['Bonjour !', 'Un café, s’il vous plaît.', 'What would you like to say?'];

describe('the warm plan decides which voices a run pays for', () => {
  test('the warm run warms only the default voice unless LUVANI_WARM_VOICES asks for more', () => {
    // The whole point of the plan. Eight voices is roughly 12,900 characters, a
    // third of a Starter month, and a cold clone running `npm run warm-cache`
    // must not spend that by accident. Unset means one voice.
    assert.deepEqual(voicesToWarm({}), [DEFAULT_TUTOR_VOICE]);

    // An empty or whitespace value is unset, not "warm nothing". The .env in
    // this service is edited by hand and a `LUVANI_WARM_VOICES=` line left
    // behind reads to a human as absent; it must behave that way too. Same
    // parsing idiom as selectedVoiceVendor() in voice.ts, for the same reason.
    assert.deepEqual(voicesToWarm({ [WARM_VOICES_ENV]: '' }), [DEFAULT_TUTOR_VOICE]);
    assert.deepEqual(voicesToWarm({ [WARM_VOICES_ENV]: '   ' }), [DEFAULT_TUTOR_VOICE]);
    assert.deepEqual(voicesToWarm({ [WARM_VOICES_ENV]: ' , ' }), [DEFAULT_TUTOR_VOICE]);

    // A comma list warms exactly those, and nothing else.
    assert.deepEqual(voicesToWarm({ [WARM_VOICES_ENV]: 'celine' }), ['celine']);
    assert.deepEqual(voicesToWarm({ [WARM_VOICES_ENV]: 'celine, emilie' }), ['celine', 'emilie']);

    // Case and stray spacing are the shape of a value typed at a shell prompt,
    // and neither is a different request.
    assert.deepEqual(voicesToWarm({ [WARM_VOICES_ENV]: ' CELINE ,emilie ' }), ['celine', 'emilie']);

    // Asked twice is billed once, and the order is the catalogue's rather than
    // the operator's, so two runs of the same set print comparable reports.
    assert.deepEqual(voicesToWarm({ [WARM_VOICES_ENV]: 'emilie,celine,emilie' }), ['celine', 'emilie']);
  });

  test('LUVANI_WARM_VOICES=all warms every catalogue voice and reports the characters per voice', () => {
    assert.deepEqual(voicesToWarm({ [WARM_VOICES_ENV]: 'all' }), CATALOGUE);
    assert.deepEqual(voicesToWarm({ [WARM_VOICES_ENV]: ' ALL ' }), CATALOGUE, 'the word, however it is typed');
    assert.equal(CATALOGUE.length, 8, 'eight voices, so `all` is eight times the bill');

    // The cost is stated before a character is spent, per voice and in total,
    // because "warm everything" is the request most likely to be typed without
    // knowing what it costs.
    const cost = warmCost(CATALOGUE, CORPUS);
    assert.equal(cost.voices, 8);
    assert.equal(cost.lines, CORPUS.length);
    assert.equal(cost.charsPerVoice, CORPUS.reduce((n, l) => n + l.length, 0));
    assert.equal(cost.charsTotal, cost.charsPerVoice * 8, 'a voice is a whole second copy of the corpus');

    const planned = warmPlanLine(cost);
    assert.match(planned, /8 voices/, 'says how many voices it is about to pay for');
    assert.match(planned, new RegExp(`${cost.charsPerVoice} characters per voice`), 'and the per-voice number');
    assert.match(planned, new RegExp(`${cost.charsTotal}`), 'and what that comes to');

    // The per-voice line after the fact reports what was actually billed, which
    // is not the estimate: a rerun is nearly all hits and costs nothing.
    const spent = warmVoiceLine('celine', { cached: 60, synthesized: 2, chars: 34 });
    assert.match(spent, /celine/);
    assert.match(spent, /60 already cached/);
    assert.match(spent, /2 synthesized/);
    assert.match(spent, /34 chars/, 'the characters this voice actually cost');
  });

  test('an unknown key in LUVANI_WARM_VOICES refuses before spending, naming the catalogue', () => {
    // A typo must not warm seven voices and then stop. It is a pure parse, so
    // the refusal happens before the vendor is ever constructed.
    assert.throws(
      () => voicesToWarm({ [WARM_VOICES_ENV]: 'celine,hendrick' }),
      (err: Error) => {
        assert.match(err.message, /hendrick/, 'names the key that is wrong');
        for (const key of CATALOGUE) {
          assert.ok(err.message.includes(key), `names ${key} so the fix needs no second file`);
        }
        assert.match(err.message, /\ball\b/, 'and the one word that is not a key');
        assert.match(err.message, /[Nn]othing was synthesized/, 'and says plainly that no money moved');
        return true;
      },
    );

    // A vendor id is the wrong kind of name and the most likely paste. It gets
    // the same refusal rather than a 404 eight lines into a paid run.
    assert.throws(() => voicesToWarm({ [WARM_VOICES_ENV]: 'IPgYtHTNLjC7Bq7IPHrm' }), /not in the catalogue/);

    // And the run itself refuses, exit 1, before it asks for a key or a voice.
    // Spawned with no credentials at all and in an empty cwd so dotenv finds no
    // .env: if the plan were resolved after synthesis began, this would fail
    // with a vendor error instead of the catalogue, which is the distinction
    // the test exists to make.
    const script = new URL('./warmCache.ts', import.meta.url).pathname;
    const run = spawnSync(process.execPath, ['--experimental-strip-types', script], {
      cwd: mkdtempSync(join(tmpdir(), 'luvani-warmplan-')),
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', [WARM_VOICES_ENV]: 'hendrick' },
      encoding: 'utf8',
    });
    assert.equal(run.status, 1, 'the run stops rather than warming what it can');
    assert.match(run.stderr, /not in the catalogue/, 'and refuses over the typo');
    assert.doesNotMatch(run.stdout, /scripted lines/, 'having printed nothing about work it did not start');
  });
});
