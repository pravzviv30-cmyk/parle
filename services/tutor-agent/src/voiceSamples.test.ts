import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { AudioFrame } from '@livekit/rtc-node';
import { initializeLogger, tokenize } from '@livekit/agents';

// Before buildTTS is constructed anywhere below, the way voice.test.ts does it.
initializeLogger({ pretty: false, level: 'silent' });

import { TUTOR_VOICES, tutorVoice, type TutorVoiceKey } from '@luvani/core';
import { decodeWav, encodeWav } from './wav.ts';
import { buildTTS, MODEL } from './voice.ts';
import {
  carryAttestation,
  joinClip,
  levelClip,
  MANIFEST_PATH,
  MAX_SAMPLE_BYTES,
  readManifest,
  SAMPLES_DIR,
  sampleDigest,
  samplePath,
  sampleSentences,
  sampleText,
  type SampleRecord,
} from './voiceSamples.ts';

const CATALOGUE = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];

/**
 * Importing this module must not synthesize anything, which is why
 * voiceSamples.ts guards its main() on being executed directly. If that guard
 * is ever removed these tests will start billing the founder's account, so the
 * first thing checked is the guard itself.
 */
const SOURCE = readFileSync(new URL('./voiceSamples.ts', import.meta.url).pathname, 'utf8');

describe('a sample clip per voice, made the way the tutor speaks', () => {
  test('the sample script writes one clip per catalogue voice through the same voice seam', () => {
    // The seam, read from the source, because main() talks to a vendor and the
    // only free way to see which function it calls is to look. Same idiom and
    // the same regex shape as the warm-cache transport check in ttsCache.test.ts:
    // `[^}]*` cannot cross a brace, so this also pins that no nested object
    // literal creeps in before missTransport.
    assert.match(
      SOURCE,
      /buildTTS\(\{[^}]*voice[^}]*missTransport:\s*'http'/,
      'clips are synthesized through buildTTS with the voice, not by a hand-rolled vendor request',
    );
    // SYNTHESIS specifically, rather than the vendor's host, because the script
    // now also reads free voice metadata to record what the vendor has verified
    // (F502). That read cannot make audio: it is a GET on the voices endpoint and
    // it bills nothing. Naming the synthesis path makes the rule say what it
    // always meant, and it is stricter than the old one about what may creep in.
    assert.doesNotMatch(
      SOURCE,
      /text-to-speech/,
      'a clip made around the seam would miss the pinned model and settings and mislead the learner',
    );
    for (const url of SOURCE.match(/https:\/\/api\.elevenlabs\.io\/[^`'"\s]*/g) ?? []) {
      assert.match(url, /^https:\/\/api\.elevenlabs\.io\/v1\/voices\//, `${url} is not the free metadata read`);
    }

    // Guarded so importing the module for these facts costs nothing.
    assert.match(SOURCE, /executedDirectly/, 'main() runs only when the file is run as a script');

    // One line per voice, each naming its own persona. Two of the eight are
    // women, so a shared name here is the mismatch the catalogue exists to stop.
    const seen = new Set<string>();
    for (const key of CATALOGUE) {
      const text = sampleText(key);
      const { name } = tutorVoice(key).persona;
      assert.ok(text.includes(name), `${key} introduces itself as ${name}`);
      assert.ok(!seen.has(text), `${key} has its own line`);
      seen.add(text);

      // Bilingual, and split the way the runtime splits it: the French sentence
      // and the English one are separate synthesis requests and separate cache
      // entries, exactly as the framework's sentence adapter would ask for them.
      const sentences = sampleSentences(key);
      assert.equal(sentences.length, 2, `${key} is one French sentence and one English one`);
      assert.match(sentences[0]!, /^Bonjour, je m’appelle /, 'the French one first');
      assert.equal(sentences[1]!, `Hi, my name is ${name}.`, 'then the same introduction in English');

      // A sample TRANSLATES and never remarks on its own recording. The wording
      // that broke this rule was "And this is how I sound in English", and the
      // bridge that replaced it for a day, "and in English, my name is", broke a
      // different one: it explained itself. Neither is allowed back.
      assert.doesNotMatch(text, /how I sound|English/i, 'a sample translates; it never comments on its own voice');

      // Short, because every one of these ships in the app download.
      assert.ok(text.length < 90, `${key}'s line stays short: ${text.length} characters`);

      // The catalogue's copy rules reach the clip too. Nothing comparative, no
      // vendor named, and nothing that asks a learner to speak: this clip is
      // played by a listen button, and a learner is never pressed to talk.
      assert.doesNotMatch(text, /—/, 'no em dash');
      assert.doesNotMatch(text, /best|better|native|most|real French/i, 'no claim about the other seven');
      assert.doesNotMatch(text, /repeat|say it|répétez|essayez/i, 'and it asks the learner for nothing');
    }
  });

  test('every catalogue voice has a bundled sample the app can play', () => {
    // The destinations are complete and inside the app bundle. This is the half
    // that holds before anyone spends: add a ninth voice without a sample and
    // this fails, rather than Metro failing on a missing require at build time
    // or, worse, the chooser offering a listen button that plays nothing.
    const destinations = CATALOGUE.map(samplePath);
    assert.equal(new Set(destinations).size, CATALOGUE.length, 'one distinct clip per voice');
    for (const [i, dest] of destinations.entries()) {
      assert.equal(dirname(dest), SAMPLES_DIR, 'clips live where the app bundles from');
      assert.equal(basename(dest), `${CATALOGUE[i]}.m4a`, 'named by catalogue key, in a format expo-audio plays');
    }
    assert.match(SAMPLES_DIR, /apps[/\\]mobile[/\\]assets[/\\]voices$/, 'inside the app, not the service');

    // And the half that holds afterwards. The clips themselves come from one
    // paid run of `npm run voice-samples`, so they are not here on a fresh
    // clone; the moment the first one lands this becomes a full check, and it
    // is deliberately all-or-nothing. A half-finished run is the dangerous
    // state: it leaves the chooser with a voice whose listen button is silent,
    // which reads to a learner as a broken app rather than a missing file.
    const present = CATALOGUE.filter((key) => existsSync(samplePath(key)));
      // F299: this used to `return` here when no clip was present, reasoning that
      // the clips come from one paid run and so are absent on a fresh clone. That
      // was wrong about what the clips ARE. The app `require()`s all eight
      // statically, so they are a BUILD DEPENDENCY, not an optional asset: with
      // none on disk this suite went green while `expo export` failed to resolve
      // `../../assets/voices/luc.m4a` and no screen loaded on any platform. A test
      // that passes in exactly the state where its claim is false is worse than no
      // test, because the ledger then carries it as proof. The clips are committed;
      // a missing one fails here rather than in Metro.

    assert.equal(present.length, CATALOGUE.length, `voice-samples ran but stopped short: ${present.join(', ')}`);
    for (const key of CATALOGUE) {
      const file = samplePath(key);
      const bytes = statSync(file).size;
      assert.ok(bytes > 0, `${key}'s clip is not empty`);
      assert.ok(bytes <= MAX_SAMPLE_BYTES, `${key}'s clip is ${bytes} bytes, over the ${MAX_SAMPLE_BYTES} ceiling`);
      // A real MPEG-4 container: `ftyp` is the first box, at offset 4. A WAV or
      // a truncated download would sail past a size check and fail on a phone.
      assert.equal(readFileSync(file).toString('ascii', 4, 8), 'ftyp', `${key}'s clip is an m4a`);
    }
  });
});

describe('the frames become one clip', () => {
  /** A frame of a recognisable constant, so a join is visible in the samples. */
  function frame(level: number, samples: number, rate = 24000): AudioFrame {
    return new AudioFrame(new Int16Array(samples).fill(level), rate, 1, samples);
  }

  test('two frames join with a beat, at the vendor’s own rate', () => {
    // 24000 samples per second, so a 350ms gap is 8400 samples. Written out
    // rather than recomputed from the constant, because a test that repeats the
    // implementation's arithmetic checks nothing.
    //
    // Two frames is no longer what the script produces, since the line became one
    // sentence. Kept because it is the behaviour the copy would need if it ever
    // grew a second sentence, and because it is the only place the gap is proven
    // at all. The single-frame path production actually uses is tested below.
    const joined = joinClip([frame(1000, 12000), frame(-1000, 6000)], 350);
    assert.equal(joined.sampleRate, 24000, 'the rate comes from the audio, never from a constant here');
    assert.equal(joined.channels, 1);
    assert.equal(joined.samples.length, 12000 + 8400 + 6000);
    assert.equal(joined.samples[11999], 1000, 'the first frame ends where it ended');
    assert.equal(joined.samples[12000], 0, 'then silence');
    assert.equal(joined.samples[20399], 0, 'for the whole beat');
    assert.equal(joined.samples[20400], -1000, 'and the second frame follows');

    // The WAV it produces round-trips, which is what the encoder is handed.
    const back = decodeWav(encodeWav(joined));
    assert.equal(back.sampleRate, 24000);
    assert.equal(back.samples.length, joined.samples.length);
  });

  test('a voice that produced no audio is an error, not a silent clip', () => {
    // A clip of pure silence would pass every size and container check in this
    // file and reach a learner as a listen button that does nothing.
    assert.throws(() => joinClip([]), /no audio/);
    assert.throws(() => joinClip([frame(0, 0)]), /no audio/);
  });
});

describe('the voice sample script is wired to a command', () => {
  test('npm run voice-samples runs the script that writes the clips', () => {
    // The ledger points at this line of package.json, and a script nobody can
    // invoke is a script that never runs.
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url).pathname, 'utf8'));
    assert.equal(pkg.scripts['voice-samples'], 'node --experimental-strip-types src/voiceSamples.ts');
  });
});

describe('the clips the app cannot start without — F299', () => {
  /**
   * A separate guard from the format and size checks above, because it answers a
   * different question: not "is this clip playable" but "can the app be built at
   * all". `apps/mobile/src/tutor/voiceSamples.ts` `require()`s every clip
   * statically, so Metro resolves them at BUILD time. With the directory absent,
   * `expo export` fails on `Unable to resolve ../../assets/voices/luc.m4a` with an
   * import stack running all the way to `index.ts` — no screen loads, on any
   * platform, while every unit test is green.
   *
   * That is the gap this test exists to close: the gate runs tests and typecheck
   * and never bundles, so nothing else in the suite can see a missing asset.
   */
  test('every bundled clip is on disk, so the app can be built at all', () => {
    assert.ok(existsSync(SAMPLES_DIR), `${SAMPLES_DIR} does not exist — the app cannot be bundled`);
    const missing = CATALOGUE.filter((key) => !existsSync(samplePath(key)));
    assert.deepEqual(
      missing,
      [],
      `the app statically imports these and Metro will fail to resolve them: ${missing.join(', ')}. ` +
        `Run: npm run voice-samples -w @luvani/tutor-agent`,
    );
  });
});


/**
 * The record the run leaves behind, and the only thing in this repo that can
 * notice the defect F507 was filed for.
 *
 * The clips are binaries. For a week they said a sentence `sampleText` no longer
 * returned, and every test here passed, because the tests checked that the files
 * existed and were small enough. F299 closed the vacuous version of that gap with
 * an existence check; this closes the next one up, which is content. The field
 * that makes it honest is the sha256: every other field could be satisfied by
 * retyping the new copy into the JSON, and a hash of the committed audio cannot.
 */
describe('the clips say what the app says, and can be checked — F507', () => {
  // voice.test.ts's idiom: a key that is never sent and a throwaway cache dir, so
  // buildTTS can be constructed purely to read back the voiceKey it would use.
  // LUVANI_TTS_VENDOR is deleted rather than left alone: with fish in the shell
  // this would compare an elevenlabs record against a fish key and fail for a
  // reason that has nothing to do with the clips.
  const ENV_KEYS = [
    'ELEVEN_API_KEY',
    'ELEVEN_VOICE_ID',
    'LUVANI_TTS_VENDOR',
    'LUVANI_TTS_MISS_TRANSPORT',
    'TTS_CACHE_DIR',
    'FISH_API_KEY',
    'FISH_VOICE_ID',
    'FISH_MODEL',
  ] as const;
  let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.ELEVEN_API_KEY = 'test-key-never-sent';
    delete process.env.ELEVEN_VOICE_ID;
    delete process.env.LUVANI_TTS_VENDOR;
    delete process.env.LUVANI_TTS_MISS_TRANSPORT;
    delete process.env.FISH_API_KEY;
    delete process.env.FISH_VOICE_ID;
    delete process.env.FISH_MODEL;
    process.env.TTS_CACHE_DIR = mkdtempSync(join(tmpdir(), 'luvani-samples-'));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('the committed clips record the text, the voice and the settings that made them', async () => {
    const rerun = `regenerate with: npm run voice-samples -w @luvani/tutor-agent`;
    assert.ok(existsSync(MANIFEST_PATH), `no provenance record at ${MANIFEST_PATH}. ${rerun}`);

    const manifest = readManifest();
    assert.deepEqual(
      Object.keys(manifest.clips).sort(),
      [...CATALOGUE].sort(),
      `the record names a different set of voices than the catalogue. ${rerun}`,
    );

    for (const key of CATALOGUE) {
      const record = manifest.clips[key];
      assert.ok(record, `${key} has no record. ${rerun}`);

      // The observed bug: the words moved and the audio did not.
      assert.equal(record.text, sampleText(key), `${key}'s clip was made from different words. ${rerun}`);
      assert.deepEqual(
        record.requests,
        sampleSentences(key),
        `${key}'s clip was not split the way it is split now. ${rerun}`,
      );
      assert.equal(record.requests.length, 2, `${key} was synthesized as ${record.requests.length} requests, not two`);
      assert.equal(record.requests[1], `Hi, my name is ${tutorVoice(key).persona.name}.`, `${key}'s English request. ${rerun}`);

      // E4's defect one level out: retune a setting, move the model or re-clone a
      // voice and the clips are stale in a way no comparison of words would see.
      // The voiceKey folds the voice id, the model and every delivery knob.
      const tts = buildTTS({ voice: key, missTransport: 'http' });
      try {
        assert.equal(record.voiceKey, tts.opts.voiceKey, `${key}'s clip was made in a different voice configuration. ${rerun}`);
        assert.equal(record.sampleRate, tts.sampleRate, `${key}'s clip was made at a different rate. ${rerun}`);
      } finally {
        await tts.close();
      }

      // The field that cannot be satisfied by editing a string.
      const bytes = readFileSync(samplePath(key));
      assert.equal(record.bytes, bytes.length, `${key}'s recorded size is not the committed file's. ${rerun}`);
      assert.equal(record.sha256, sampleDigest(bytes), `${key}'s committed audio is not the audio that was recorded. ${rerun}`);
    }
  });

  test('a clip nobody has listened to cannot be recorded as heard', () => {
    // No test in this repo can hear, so the only evidence about an accent is a
    // person saying they played it. Eight binaries committed on faith is how
    // F507 happened, one level down.
    const manifest = readManifest();
    for (const key of CATALOGUE) {
      const heard = (manifest.clips[key]?.heard ?? '').trim();
      assert.ok(
        heard.length > 0,
        `nobody has written down what ${key}'s clip sounds like. Play it, then fill in "heard" in ${basename(MANIFEST_PATH)}.`,
      );
      assert.doesNotMatch(heard, /^(ok|okay|fine|good|done|yes|tbd|todo|n\/a|-+|\.+)$/i, `"${heard}" is a box ticked, not something heard`);
    }

    // The carry rule, unit-tested because it is the part that decides whether a
    // human is asked again. Synthesis is cached, so a rerun that changes nothing
    // rewrites identical bytes; forcing a fresh listen for that would teach
    // whoever runs the script to type anything at all to get the gate green.
    const made: Omit<SampleRecord, 'heard'> = {
      text: 'a line',
      requests: ['a line'],
      voiceKey: 'vendor:voice:model:settings',
      sampleRate: 24000,
      bytes: 1234,
      sha256: 'abc',
      vendor: {
        name: 'A Voice', category: 'high_quality', gender: 'male', age: 'middle_aged',
        accent: { fr: 'standard', en: 'en-french' }, model: 'eleven_multilingual_v2',
        readAt: '2026-09-10T00:00:00.000Z',
      },
    };
    const heard: SampleRecord = { ...made, heard: 'played it on laptop speakers, French throughout' };
    assert.equal(carryAttestation(heard, made), heard.heard, 'an unchanged clip keeps the listen it already had');
    assert.equal(carryAttestation(undefined, made), '', 'a clip with no history has not been heard');
    assert.equal(carryAttestation({ ...heard, sha256: 'different' }, made), '', 'different audio has not been heard');
    assert.equal(carryAttestation({ ...heard, text: 'other words' }, made), '', 'different words have not been heard');
    assert.equal(carryAttestation({ ...heard, voiceKey: 'other' }, made), '', 'a different voice configuration has not been heard');
  });

  test('the English sentence reaches the vendor on its own, short and in the same voice', () => {
    // The accent is the VOICE's job now, not the request shape (F502, F505). What
    // this pins is the shape the manifest records and a live session would send:
    // French first, then a short English sentence, each its own request, both
    // through one CachedTTS so they cannot come from two different voices.
    const splitter = new tokenize.basic.SentenceTokenizer();

    for (const key of CATALOGUE) {
      const text = sampleText(key);
      const sentences = splitter.tokenize(text);
      assert.equal(sentences.length, 2, `${key}'s line is not one French sentence and one English one`);
      assert.match(sentences[0]!, /^Bonjour, je m’appelle /, `${key} does not open in French`);
      assert.ok(sentences[1]!.startsWith('Hi, my name is '), `${key}'s English sentence is not the introduction`);
      assert.ok(sentences[1]!.length <= 30, `${key}'s English sentence is ${sentences[1]!.length} characters, which is not short`);

      // The negative control, inverted from the one this replaced: comma-joining
      // the two collapses them into a single request, which is what the retired
      // one-sentence design did. Two is therefore the period's doing, and a
      // tokenizer upgrade that stopped splitting would fail here rather than
      // silently halve the number of requests the clip is made from.
      const commaJoined = text.replace('. Hi, my name is', ', and my name is');
      assert.equal(splitter.tokenize(commaJoined).length, 1, 'a comma does still fail to end a sentence here');
    }

    // And both sentences go through ONE instance, so "the same voice" is a fact
    // about the code and not a hope: a second buildTTS inside the loop would be
    // a second cache key and, under a vendor with no catalogue, a second voice.
    assert.match(
      SOURCE,
      /const cached = buildTTS\(\{[^}]*\}\);[\s\S]*?for \(const sentence of sampleSentences\(voice\)\)/,
      'the sentences are not synthesized through one CachedTTS built once per voice',
    );
  });

  test('the introduction is written in one place, and every screen reads it from there', () => {
    // The drift that caused this: the sentence was typed into the agent AND into
    // the first-run voice page, and the page went a week showing words the audio
    // had stopped saying. Comments count as copies too, because the copy tests
    // strip comments and so a stale quote in one can never fail on its own.
    const root = new URL('../../../', import.meta.url).pathname;
    const HOME = 'packages/core/src/protocol/voices.ts';
    const MARKERS = ['Hi, my name is', 'Bonjour, je m\u2019appelle'];

    const walk = (dir: string): string[] =>
      readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(rel);
        return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')
          ? [rel]
          : [];
      });

    const offenders = ['apps/mobile/src', 'packages/core/src', 'services/tutor-agent/src']
      .flatMap(walk)
      .filter((rel) => rel !== HOME)
      .filter((rel) => {
        const source = readFileSync(join(root, rel), 'utf8');
        return MARKERS.some((marker) => source.includes(marker));
      });

    assert.deepEqual(
      offenders,
      [],
      `the introduction is written out in ${offenders.join(', ')} as well as ${HOME}. ` +
        `Call tutorSampleLine instead, and do not quote the sentence in a comment either.`,
    );

    // And the home really is the home.
    assert.ok(readFileSync(join(root, HOME), 'utf8').includes(MARKERS[0]!), `${HOME} no longer holds the line`);
  });

  test('one sentence is one frame, and a single frame gets no beat', () => {
    // This is the path production takes now, and it had no test: with one
    // sentence there is no "between" for the gap to fill, so joinClip must hand
    // back exactly what it was given, length for length. A silent 350ms of
    // padding on the front or back of every clip would be inaudible in review
    // and wrong in eight shipped files.
    const samples = new Int16Array(9600).fill(1234);
    const only = new AudioFrame(samples, 24000, 1, samples.length);
    const joined = joinClip([only], 350);

    assert.equal(joined.samples.length, 9600, 'a lone frame is not padded');
    assert.equal(joined.sampleRate, 24000);
    assert.equal(joined.channels, 1);
    assert.deepEqual(Array.from(new Set(joined.samples)), [1234], 'and no silence is mixed into it');

    const back = decodeWav(encodeWav(joined));
    assert.equal(back.samples.length, 9600, 'and it round-trips through the WAV the encoder is handed');
  });
});


/**
 * What the vendor says, checked against what this repo says about it.
 *
 * `voice.ts` used to assert in a comment that all eight voices were verified for
 * French and English. Nobody had asked the vendor, and it was false for every one
 * of them: their English came back american, british, singaporean or unlabelled,
 * and the tutor said its English half in an American accent for weeks (F508).
 *
 * A comment cannot be checked. So the sample run records the vendor's own answer
 * beside the clip it made, and these read it back offline, with no key and no
 * network. If the vendor relabels a voice the record goes stale rather than
 * wrong, which is what `readAt` is for.
 */
describe('the catalogue matches what the vendor says about the recordings — F502, F504', () => {
  const rerun = 'regenerate with: npm run voice-samples -w @luvani/tutor-agent';

  test('every voice the catalogue offers is verified for French and English on the model the tutor pins', () => {
    const manifest = readManifest();
    for (const key of CATALOGUE) {
      const vendor = manifest.clips[key]?.vendor;
      assert.ok(vendor, `${key} has no vendor record. ${rerun}`);
      assert.equal(vendor.model, MODEL, `${key}'s vendor record was read for a different model. ${rerun}`);
      assert.notEqual(vendor.accent.fr, 'not verified on this model', `${key} is not verified for French on ${MODEL}`);
      assert.equal(
        vendor.accent.en,
        'en-french',
        `${key}'s English is "${vendor.accent.en}" and not en-french. That is the defect F508 was filed for: ` +
          `a learner hears the tutor switch accent halfway through its own introduction.`,
      );
    }
  });

  test("the catalogue's sound lines agree with what the vendor says about each recording", () => {
    // F504. A place name in learner-facing copy is a claim about a recording, and
    // the only party who can back it is the vendor who made it.
    const PLACE: Record<string, string> = { standard: 'France', parisian: 'Paris', belgian: 'Belgium' };
    const AGE: Record<string, string> = { young: 'young', middle_aged: 'middle-aged', old: 'old' };
    const manifest = readManifest();

    for (const key of CATALOGUE) {
      const vendor = manifest.clips[key]?.vendor;
      assert.ok(vendor, `${key} has no vendor record. ${rerun}`);
      const entry = tutorVoice(key);

      const place = PLACE[vendor.accent.fr];
      assert.ok(place, `the vendor calls ${key}'s French "${vendor.accent.fr}" and no honest place name maps to it`);
      assert.ok(entry.sound.includes(place), `${key} says "${entry.sound}" but the vendor places it in ${place}`);
      assert.equal(entry.gender, vendor.gender, `${key}'s catalogue gender and the vendor's disagree`);
      assert.equal(entry.ageBand, AGE[vendor.age], `${key}'s catalogue age band and the vendor's disagree`);
    }
  });

  test('every listen says what the English half sounded like', () => {
    // The English half is the whole reason this clip is bilingual and the whole
    // reason F508 exists. A listen that never mentions it did not answer the
    // question the clip was made to ask.
    const manifest = readManifest();
    for (const key of CATALOGUE) {
      const heard = (manifest.clips[key]?.heard ?? '').trim();
      assert.match(
        heard,
        /english/i,
        `${key}'s listen does not say what the English half sounded like: "${heard}"`,
      );
    }
  });

  test('a sample clip is levelled and encoded the way the script says, not the way a default decided', () => {
    // F506. Levelling is pure arithmetic over the samples, so it is the one part
    // of the loudness decision a test can exercise without paying a vendor.
    const quiet = { sampleRate: 22050, channels: 1, samples: Int16Array.from([0, 4000, -4000, 2000]) };
    const lifted = levelClip(quiet, -1);
    const peak = Math.max(...Array.from(lifted.samples, (v) => Math.abs(v)));
    const target = 32767 * 10 ** (-1 / 20);
    assert.ok(Math.abs(peak - target) <= 1, `levelled peak is ${peak}, not ${Math.round(target)}`);
    assert.equal(lifted.sampleRate, quiet.sampleRate, 'levelling must not touch the rate');
    assert.equal(lifted.samples.length, quiet.samples.length, 'levelling must not touch the length');

    // Shape is preserved: it is a gain, not a filter and not a compressor, so the
    // voice a learner picks is still the voice they meet.
    const ratio = lifted.samples[1]! / quiet.samples[1]!;
    for (let i = 1; i < quiet.samples.length; i += 1) {
      const got = lifted.samples[i]! / quiet.samples[i]!;
      assert.ok(Math.abs(got - ratio) < 0.01, 'levelling changed the shape of the waveform, not just its level');
    }

    // Silence has no peak to lift and must come back untouched rather than
    // divided by zero into noise.
    const silence = { sampleRate: 22050, channels: 1, samples: new Int16Array(8) };
    assert.deepEqual(Array.from(levelClip(silence).samples), Array.from(silence.samples));

    // And the encoder is asked for the bitrate and quality the script names.
    assert.match(SOURCE, /const BITRATE_BPS = 64000;/, 'the clip bitrate is not the one F506 measured as the ceiling');
    assert.match(SOURCE, /'-q', '127'/, "the encoder's own quality knob is left at its default");
  });
});
