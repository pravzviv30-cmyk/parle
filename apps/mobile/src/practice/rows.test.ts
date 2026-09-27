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
import { MADE_FROM_TINT } from './madeFromTint.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** The three files that draw the rows, plus the module that decides what is in them. */
const ROWS = {
  replay: stripComments(read('./ReplayMomentCard.tsx')),
  phrase: stripComments(read('./MakePhraseCard.tsx')),
  sound: stripComments(read('./TuneSoundCard.tsx')),
} as const;
const MODEL = stripComments(read('./madeFrom.ts'));
const TAB = stripComments(read('../tabs/PracticeTab.tsx'));

describe('practice is three rows made from what the learner said — F574, F582', () => {
  test('replay speaks the better line and stops it when the tab goes', () => {
    // The tap plays the better way first and opens the sitting after, so the
    // line is in the learner's ear before the exercise asks for it.
    assert.match(ROWS.replay, /speak\(replay\.better\)/, 'the replay row never speaks the better line');
    const press = ROWS.replay.slice(ROWS.replay.indexOf('onPress={'), ROWS.replay.indexOf('/>', ROWS.replay.indexOf('onPress={')));
    assert.ok(press.length > 0, 'the replay row no longer has a press handler; this test is reading the wrong thing');
    assert.ok(
      press.indexOf('speak(replay.better)') < press.indexOf('onTry()'),
      'the drill opens before the line is spoken, so the voice arrives over the exercise',
    );
    // It is the tutor's own voice module, which is playback and nothing else.
    assert.match(ROWS.replay, /from '\.\.\/speech\/tutorVoice\.ts'/, 'the replay row speaks through something other than the tutor voice');
    // And a voice started here stops when the tab goes. F304 is the whole
    // reason: Speech.stop() runs before a line starts and nothing runs after.
    assert.match(
      TAB.replace(/\s+/g, ' '),
      /useEffect\(\(\) => \(\) => tutorVoice\.stop\(\), \[\]\)/,
      'the practice tab starts a voice and never stops it; it will follow the learner off this tab',
    );
    // The row says what the tap will play, so a learner who cannot see the
    // chevron is not told only "Replay a moment, button".
    assert.match(ROWS.replay, /accessibilityLabel=\{`\$\{MADE_FROM\.replay\.label\}, \$\{MADE_FROM\.replay\.listen\}`\}/, 'the replay row does not say what it will play');
    assert.equal(MADE_FROM.replay.listen, 'Hear the better line');
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
    // The sound row opens the sound check rather than measuring anything here:
    // the one place a known reference is scored has its own screen and its own
    // consent, and it is reached by navigating, never by this row listening.
    assert.match(ROWS.sound, /onCheck\(sound\.missionId\)/, 'the sound row no longer opens the check it names');
  });

  test('each row is one colour, one mark and two lines', () => {
    const GLYPHS = { replay: 'ReplayGlyph', phrase: 'QuoteGlyph', sound: 'WaveformGlyph' } as const;
    for (const key of ['replay', 'phrase', 'sound'] as const) {
      const body = ROWS[key];
      assert.match(body, /<TintRow\b/, `the ${key} row is not the shared tinted row`);
      assert.match(
        body,
        new RegExp(`tint=\\{MADE_FROM_TINT\\.${key}\\}`),
        `the ${key} row picks a colour of its own instead of the one the tint module names`,
      );
      assert.match(
        body,
        new RegExp(`<${GLYPHS[key]} color=\\{accent\\.primary\\}`),
        `the ${key} row draws the wrong mark, or draws it in the wrong ink`,
      );
      // The sound row alone names its first step when nothing is measured yet
      // (whole-app phase 1). Both words still come from MADE_FROM.
      const title = key === 'sound' ? `title=\\{sound === null \\? MADE_FROM\\.sound\\.go : MADE_FROM\\.sound\\.label\\}` : `title=\\{MADE_FROM\\.${key}\\.label\\}`;
      assert.match(body, new RegExp(title), `the ${key} row spells its own title`);
      // The card anatomy is gone: no second Card, no button, no French printed
      // on the tab. All of that lives in the sitting the row opens.
      assert.ok(!/<Card\b/.test(body), `the ${key} row is still a card`);
      assert.ok(!/<OutlineButton\b|<PillButton\b|<GhostButton\b/.test(body), `the ${key} row still carries a button of its own`);
    }
    // Three rows, three different papers, so no two say the same thing.
    assert.equal(new Set(Object.values(MADE_FROM_TINT)).size, 3, 'two kinds of practice share a paper');
    // And the words the founder wrote, exactly.
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

  test('the phrase row opens the sitting that asks for the learner’s own French', () => {
    // The row used to deal a scoped sitting that asked the learner to reproduce
    // the phrase they had just been shown, which is copying. The node it hands
    // over now carries the meaning and the situation instead of an answer.
    assert.match(ROWS.phrase, /ownWords: \{ fr: phrase\.fr, en: phrase\.en, situation: phrase\.from \}/, 'the phrase row no longer asks for the learner’s own words');
    assert.match(ROWS.phrase, /phraseKeys: \[phrase\.key\]/, 'the sitting is opened on something other than this phrase');
    // The answer is not smuggled along beside the question.
    assert.ok(!/accepted/.test(ROWS.phrase), 'the phrase row hands the sitting an answer key');
  });
});

describe('the sound row names its real first step — whole-app phase 1', () => {
  test('with no measured sound it offers to choose a situation, not to tune a sound', () => {
    const card = readFileSync(fileURLToPath(new URL('./TuneSoundCard.tsx', import.meta.url)), 'utf8');
    assert.match(card, /title=\{sound === null \? MADE_FROM\.sound\.go : MADE_FROM\.sound\.label\}/);
    assert.match(MADE_FROM.sound.go, /sound check/);
  });
});
