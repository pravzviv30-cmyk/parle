/**
 * The three rows Practice is made of — F574, F582.
 *
 * They were three cards that each reprinted everything the sitting behind them
 * was about to show, which made the tab a wall of prose in three colours. They
 * are one `TintRow` each now: a colour, a mark, two lines and a chevron, with
 * the material itself on the other side of the tap.
 *
 * Two promises survive that fold and are checked here rather than trusted.
 *
 * The replay speaks. Hearing the better line is the cheapest teaching in the
 * app — the platform synthesizer, free and offline — and a learner who hears it
 * before the drill opens arrives with the sound in their ear rather than
 * reading it cold. A voice started on a tab that then goes away follows the
 * learner onto the next screen, which is F304, so the stop is checked too.
 *
 * And nothing on this tab listens. Practice is made from conversations the
 * learner already had; it takes no microphone, uploads no bytes and scores
 * nobody's mouth. The ways in are named rather than assumed, because "we would
 * notice" is exactly what was said before the last one.
 *
 * There is no renderer in this suite (docs/TESTING.md), so the JSX claims are
 * asked of the source. That ceiling is honest: it proves the props are written
 * down, never that a phone drew them.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { MADE_FROM } from './madeFrom.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** The file that draws the sound row, plus the module that decides what is in the rows. F999 deleted the replay and phrase rows, which nothing drew. */
const ROWS = {
  sound: stripComments(read('./TuneSoundCard.tsx')),
} as const;
const MODEL = stripComments(read('./madeFrom.ts'));
// 2026-10-20, B3, B-Practice: the made-from rows are no longer drawn on
// Practice (a fix is tried on Your fixes, Today keeps the replay in B5); the
// tab still stops any voice it started when it goes.
const TAB = stripComments(read('../tabs/PracticeTab.tsx'));

describe('practice is three rows made from what the learner said — F574, F582', () => {
  test('a voice started on practice stops when the tab goes', () => {
    // A voice started here stops when the tab goes. F304 is the whole
    // reason: Speech.stop() runs before a line starts and nothing runs after.
    assert.match(
      TAB.replace(/\s+/g, ' '),
      /useEffect\(\(\) => \(\) => tutorVoice\.stop\(\), \[\]\)/,
      'the practice tab starts a voice and never stops it; it will follow the learner off this tab',
    );
  });

  test('nothing on practice listens, records or scores', () => {
    // Every way a recording could start, be uploaded, or come back as a
    // judgement about the learner's mouth. None of them is on this tab.
    const LISTENING = [
      'useAudioRecorder',
      'RecordingPresets',
      'AudioModule',
      'expo-audio',
      'SpeakCircle',
      'getUserMedia',
      'MediaRecorder',
      'scoreRecordedAttempt',
      'consumeRecording',
      'transcri',
      'score(',
    ];
    for (const [name, body] of [...Object.entries(ROWS), ['madeFrom.ts', MODEL] as const]) {
      for (const reach of LISTENING) {
        assert.ok(!body.includes(reach), `${name} reaches for ${reach}; nothing on practice records, transcribes or scores`);
      }
    }
    // The sound lead opens the sound check rather than measuring anything here:
    // the one place a known reference is scored has its own screen and its own
    // consent, and it is reached by navigating, never by this card listening.
    assert.match(ROWS.sound, /onCheck\(measured\.missionId\)/, 'the sound lead no longer opens the check it names');
  });

  test('the made-from rows keep the words the founder wrote', () => {
    // The words the founder wrote, exactly.
    assert.equal(MADE_FROM.replay.label, 'Replay a moment');
    assert.equal(MADE_FROM.replay.gloss, 'Listen and try again');
    assert.equal(MADE_FROM.phrase.label, 'Make this phrase yours');
    assert.equal(MADE_FROM.phrase.gloss, 'Say it in your own words');
    assert.equal(MADE_FROM.sound.label, 'Tune one sound');
    assert.equal(MADE_FROM.sound.gloss, 'Focus on a tricky sound');
    for (const line of [MADE_FROM.replay.gloss, MADE_FROM.phrase.gloss, MADE_FROM.sound.gloss, MADE_FROM.replay.listen]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.doesNotMatch(line, /—|\d/, `"${line}" carries an em dash or a digit`);
    }
  });
});

describe('the sound example says only what is true of the sound', () => {
  const FLAT = ROWS.sound.replace(/\s+/g, ' ');

  test('it leads with a word and cue, and discloses the symbol and guide on request', () => {
    assert.match(FLAT, /\{lead\.example\}/, 'the example word is missing');
    assert.match(FLAT, /\{lead\.cue\}/, 'the mouth cue is not drawn');
    assert.match(FLAT, /measured === null \? SOUND_LEAD\.starterLabel : SOUND_LEAD\.measuredLabel/, 'starter and measured states are labelled alike');
    assert.match(FLAT, /\{details && <View/, 'the full guide is shown before the learner asks for it');
    assert.match(FLAT, /<MouthGuide ipa=\{lead\.ipa\} \/>/, 'the guide is not tied to the selected sound');
  });

  test('a measured fact appears only when a check measured it', () => {
    assert.match(FLAT, /const \{ measured, native \} = lead;/, 'the card reads its facts from somewhere other than the model');
    assert.match(FLAT, /\{measured !== null && \(/, 'a measured line is drawn with nothing measured behind it');
    assert.match(FLAT, /\{measured\.line\}/, 'the measured line is spelled on the card instead of read from the model');
  });

  test('audio is the bundled recording or nothing, and never the phone\'s voice under the tutor\'s name', () => {
    // The card plays through the tab's recorded player, never the synthesiser.
    assert.ok(!/tutorVoice|speech\/tutorVoice|speak\(/.test(ROWS.sound), 'the sound lead speaks through the device synthesiser');
    assert.match(FLAT, /\{native !== null && \(/, 'a hear control is drawn with no recording behind it');
    assert.match(FLAT, /\{native\.label\}/, 'the recording is not said to be a recording');
    assert.match(FLAT, /onPress=\{\(\) => onHear\(native\.asset\)\}/, 'the hear control plays something other than the recording');
    // The learner's own voice is never kept on this phone, so it is never played.
    assert.ok(!/\.own\b/.test(FLAT), 'the card offers a recording of the learner that the app does not keep');
  });
});
