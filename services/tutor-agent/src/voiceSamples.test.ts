import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { AudioFrame } from '@livekit/rtc-node';
import { TUTOR_VOICES, tutorVoice, type TutorVoiceKey } from '@luvani/core';
import { decodeWav, encodeWav } from './wav.ts';
import { joinClip, MAX_SAMPLE_BYTES, SAMPLES_DIR, samplePath, sampleSentences, sampleText } from './voiceSamples.ts';

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
    assert.doesNotMatch(
      SOURCE,
      /api\.elevenlabs\.io/,
      'a clip made around the seam would miss the pinned model and settings and mislead the learner',
    );

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

      // Bilingual, and split the way the runtime splits: one French sentence
      // and one English one, each a separate synthesis and a separate cache
      // entry, exactly as the framework's sentence adapter would ask for them.
      const sentences = sampleSentences(key);
      assert.equal(sentences.length, 2, `${key} is one French sentence and one English one`);
      assert.match(sentences[0]!, /^Bonjour, je m’appelle /, 'the French one first');
      assert.equal(sentences[1]!, `Hello, my name is ${name}.`, 'then its direct English translation');
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

describe('the two sentences become one clip', () => {
  /** A frame of a recognisable constant, so a join is visible in the samples. */
  function frame(level: number, samples: number, rate = 24000): AudioFrame {
    return new AudioFrame(new Int16Array(samples).fill(level), rate, 1, samples);
  }

  test('the French and English sentences join with a beat, at the vendor’s own rate', () => {
    // 24000 samples per second, so a 350ms gap is 8400 samples. Written out
    // rather than recomputed from the constant, because a test that repeats the
    // implementation's arithmetic checks nothing.
    const joined = joinClip([frame(1000, 12000), frame(-1000, 6000)], 350);
    assert.equal(joined.sampleRate, 24000, 'the rate comes from the audio, never from a constant here');
    assert.equal(joined.channels, 1);
    assert.equal(joined.samples.length, 12000 + 8400 + 6000);
    assert.equal(joined.samples[11999], 1000, 'the French sentence ends where it ended');
    assert.equal(joined.samples[12000], 0, 'then silence');
    assert.equal(joined.samples[20399], 0, 'for the whole beat');
    assert.equal(joined.samples[20400], -1000, 'and the English sentence follows');

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
