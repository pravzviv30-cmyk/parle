/**
 * The voice a learner picks, and the sheet they pick it on.
 *
 * ## Why half of this is a source walk
 *
 * apps/mobile has no renderer (docs/TESTING.md): fifty-odd components and not
 * one `.test.tsx`. So the rules live in `tutorVoice.ts` and are checked
 * directly, and `ProfileTab.tsx` is then held to *using* them, which is a thing
 * a reader of the file can actually see. What is proved here is that the sheet
 * offers the catalogue rather than a list of its own, that a tap goes through
 * the named door, and that exactly one clip can be playing. What is not proved
 * here is pixels, VoiceOver, or a sound coming out of a phone.
 *
 * ## The defect this exists for
 *
 * Half of the six voices are women. A chooser that shows its own hand-written
 * list of names, or its own hand-written descriptions, is a second opinion
 * about who these people are, and the first thing it gets wrong is a pronoun.
 * Every row below therefore comes off `TUTOR_VOICES` in core, which is also
 * what the token server shape-checks against and what the agent resolves to a
 * vendor id. One list, three processes.
 *
 * ## What may be said about a recording
 *
 * Only what has been verified: gender, where the accent is from, and "young"
 * for the one voice whose age band is known. No vendor, no vendor id, and
 * nothing comparative. "The most native sounding" is a claim about the other
 * seven that is not true, and a learner who picks by adjective and then dislikes
 * the voice has been mis-sold. The sample is what tells them apart.
 *
 * `stripComments` is load-bearing: this header names `useAudioPlayer`,
 * `withTutorVoice` and several of the words the copy scan forbids, and every
 * one of those is a needle the walks below look for.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  tutorSampleLine, DEFAULT_TUTOR_VOICE, TUTOR_VOICES, tutorVoice, type TutorVoiceKey } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';
import { tutorNameOf } from './tutorName.ts';
import {
  TUTOR_VOICE_COPY,
  TUTOR_VOICE_OPTIONS,
  TUTOR_VOICE_ORDER,
  TUTOR_VOICE_ROW,
  TUTOR_VOICE_SUB,
  TUTOR_VOICE_TITLE,
  nextSample,
  tutorVoiceLabel,
  tutorVoiceOf,
} from './tutorVoice.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const TAB = stripComments(read('../tabs/ProfileTab.tsx'));
/**
 * Profile's tutor card, which is where the way into the sheet lives now.
 *
 * Revamp A folded the "Tutor's voice" settings row into row one of the card
 * under "Your tutor" (F576). The row says the tutor's NAME rather than the
 * name of the setting, which is the same fact told the way a person would tell
 * it, and the sheet behind it is unchanged.
 */
const CARD = stripComments(read('../profile/TutorMemoryCard.tsx'));
const SAMPLES = stripComments(read('./voiceSamples.ts'));

/**
 * `first` is present, `second` is present, and `first` comes first.
 *
 * The two presence checks are the whole point, and ProfileTab.test.ts writes
 * the same helper down for the same reason: `indexOf` answers -1 for something
 * that was deleted, and -1 sorts before every real position, so the obvious
 * spelling of an ordering check passes most confidently in the one case it
 * exists to catch.
 */
function writtenBefore(source: string, first: string, second: string): boolean {
  const a = source.indexOf(first);
  const b = source.indexOf(second);
  return a >= 0 && b >= 0 && a < b;
}

/** The body of one `if (sheet === '<name>') {` branch, braces matched. */
function sheetBranch(source: string, name: string): string {
  const start = source.indexOf(`if (sheet === '${name}')`);
  assert.ok(start >= 0, `Profile has no ${name} sheet at all`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`the ${name} sheet is never closed`);
}

const VOICE_SHEET = sheetBranch(TAB, 'tutorVoice');

describe('the voice on the Profile tab', () => {
  test('the voice row offers every catalogue voice, marks the chosen one, and writes through the named door', () => {
    // The list is the catalogue, in the catalogue's order, and is not retyped.
    assert.deepEqual(
      TUTOR_VOICE_OPTIONS.map((option) => option.value),
      Object.keys(TUTOR_VOICES),
      'the sheet offers a list of its own, so a voice added in core would never appear on a phone',
    );
    assert.equal(TUTOR_VOICE_OPTIONS.length, 6, 'the catalogue has six voices and the sheet must offer all of them');
    for (const option of TUTOR_VOICE_OPTIONS) {
      const entry = tutorVoice(option.value);
      assert.equal(option.label, entry.persona.name, `${option.value} is offered under a name that is not the persona's`);
      assert.equal(option.gloss, entry.sound, `${option.value} carries a description this app invented`);
    }
    assert.deepEqual([...TUTOR_VOICE_ORDER], Object.keys(TUTOR_VOICES));

    // Reading a stored key. Null is the ordinary state of a new account, and
    // junk is what a sync, a version chain or another device's disk can leave.
    assert.equal(tutorVoiceOf(null), DEFAULT_TUTOR_VOICE, 'a learner who has never chosen is stranded without a voice');
    assert.equal(tutorVoiceOf(undefined), DEFAULT_TUTOR_VOICE);
    assert.equal(tutorVoiceOf({ tutorVoice: null } as never), DEFAULT_TUTOR_VOICE);
    assert.equal(tutorVoiceOf({ tutorVoice: 'marie' } as never), 'marie', 'a chosen voice was not read back');
    assert.equal(tutorVoiceOf({ tutorVoice: 'constructor' } as never), DEFAULT_TUTOR_VOICE, 'the prototype chain is reachable from a stored blob');
    // Shaped like a vendor handle and deliberately not one of the real ones:
    // the ids live in the agent, and a copy of one in the app's test tree is a
    // copy in the app's repository. What is under test is the shape.
    assert.equal(tutorVoiceOf({ tutorVoice: 'aB3xQ7zK1mP9rT2vW5yH' } as never), DEFAULT_TUTOR_VOICE, 'a vendor handle is not one of our keys');
    assert.equal(tutorVoiceLabel({ tutorVoice: 'emilie' } as never), tutorVoice('emilie').persona.name);
    assert.equal(tutorVoiceLabel(null), tutorVoice(DEFAULT_TUTOR_VOICE).persona.name);

    // The row is row one of Profile's tutor card now (F576), and what it shows
    // is the tutor's name rather than the name of the setting. That is the same
    // fact told the way a person would tell it: the name IS the voice.
    //
    // The card resolves that name once, through `tutorNameOf`, and uses it for
    // both of its rows, because one card resolving one name twice would be two
    // answers to one question. So the two doors are held to agreeing here, on
    // every key the catalogue has and on every kind of rubbish a stored blob
    // can carry: if they ever part, the row shows one person and the sheet
    // marks another.
    for (const key of Object.keys(TUTOR_VOICES) as TutorVoiceKey[]) {
      assert.equal(
        tutorVoiceLabel({ tutorVoice: key } as never),
        tutorNameOf({ tutorVoice: key } as never),
        `the voice row and the sheet disagree about who ${key} is`,
      );
    }
    for (const junk of [null, undefined, { tutorVoice: null }, { tutorVoice: 'constructor' }, { tutorVoice: 'aB3xQ7zK1mP9rT2vW5yH' }]) {
      assert.equal(
        tutorVoiceLabel(junk as never),
        tutorNameOf(junk as never),
        'the voice row and the sheet fall back to two different people for a profile neither can read',
      );
    }

    // The card draws it, whole: the orb as the mark, the resolved name as the
    // title, and the press that opens the sheet handed down by Profile.
    assert.match(CARD, /const name = tutorNameOf\(profile\);/, 'the row names the tutor some other way than the persona');
    assert.match(
      CARD,
      /<TutorRow first mark=\{<TutorMark \/>\} title=\{name\} gloss=\{PARTNER_LINE\} onPress=\{onVoice\} \/>/,
      'the voice row is not the first row of the tutor card, or it no longer opens the sheet it is handed',
    );
    assert.match(
      TAB,
      /<TutorMemoryCard onVoice=\{\(\) => setSheet\('tutorVoice'\)\} \/>/,
      'the tutor card is handed no way to open the sheet, so the catalogue is unreachable from Profile',
    );
    // And only one way in. The old settings row must not have stayed behind:
    // two rows opening one sheet is two places to keep a label in step.
    assert.ok(
      !TAB.includes('TUTOR_VOICE_ROW') && !CARD.includes('TUTOR_VOICE_ROW'),
      'the voice is still a settings row as well as the tutor row, so there are two ways into one sheet',
    );
    assert.equal(
      (TAB.match(/setSheet\('tutorVoice'\)/g) ?? []).length,
      1,
      'more than one control on Profile opens the voice sheet',
    );

    // The sheet itself: every option, the chosen one marked, one tap out.
    assert.match(VOICE_SHEET, /TUTOR_VOICE_OPTIONS\.map\(/, 'the sheet draws something other than the catalogue');
    assert.match(
      VOICE_SHEET,
      /selected=\{tutorVoiceOf\(profile\) === option\.value\}/,
      'nothing on the sheet marks what is already chosen, so a learner cannot tell who they have',
    );
    assert.match(
      VOICE_SHEET,
      /update\(withTutorVoice\(profile, option\.value\)\)/,
      'the sheet writes the voice some other way than the named door, so it can rewrite the rest of the learner model',
    );
    assert.match(TAB, /import \{[^}]*\bwithTutorVoice\b[^}]*\} from '\.\.\/profile\/store\.ts'/, 'withTutorVoice is not imported from the store');
    assert.doesNotMatch(
      VOICE_SHEET,
      /\.\.\.profile\b|brain:\s*\{/,
      'the sheet spreads the profile by hand instead of going through the door that owns this field',
    );

    // The pace switch moved to the foot of this sheet with revamp A (F576).
    // How fast the tutor speaks is a question about the tutor, so it belongs
    // beside the six cards that choose who the tutor is rather than on the
    // learner's own card. Below them, so the sheet still opens on the choice it
    // exists for rather than on a setting.
    assert.match(VOICE_SHEET, /title=\{PACE_ROW\}/, 'the pace switch is not on the voice sheet');
    assert.ok(
      writtenBefore(VOICE_SHEET, 'TUTOR_VOICE_OPTIONS.map(', 'PACE_ROW'),
      'the pace switch is drawn above the six voices, so the sheet opens on a setting rather than on a choice',
    );
    assert.match(VOICE_SHEET, /update\(withPace\(profile, next \? 'slow' : 'normal'\)\)/, 'the pace is written some other way than the named door');
    // One site. Twice inside the sheet, which is the row named once for the eye
    // and once for a screen reader, and nowhere on the learning card: a copy
    // left there would be a second switch for one value, and the two would
    // report different things about one tutor.
    assert.equal(
      (VOICE_SHEET.match(/PACE_ROW/g) ?? []).length,
      2,
      'the pace row at the foot of the sheet is not named once for the eye and once for a screen reader',
    );
    const learning = TAB.slice(TAB.indexOf('<Label>{LEARNING_LABEL}</Label>'));
    assert.ok(!learning.includes('PACE_ROW'), 'the pace switch is on the learning card as well as on the sheet, so one value has two switches');
  });

  test('the voice sheet never names a vendor and carries no em dash', () => {
    // The same list failure.test.ts polices the pipeline copy with. A learner
    // choosing a voice is choosing a person, not a supplier, and the supplier
    // is a thing that can change under them without the voice changing at all.
    const vendors = /deepgram|elevenlabs|eleven labs|openai|anthropic|cartesia|fish|livekit|azure|google|playht|resemble/i;
    // The vendor ids are twenty-character opaque handles. A learner must
    // never read one, and neither must anything that ships in the app bundle.
    const vendorId = /\b[A-Za-z0-9]{18,}\b/;
    // Nothing comparative. Every one of these would be a claim about the other
    // seven, and none of them has been measured.
    const comparative = /\bbetter\b|\bbest\b|\bmost\b|\bmore native\b|\bnative\b|\bclearer\b|\bclearest\b|\beasiest\b|\bpurest\b|\bproper\b|\breal french\b/i;

    assert.ok(TUTOR_VOICE_COPY.length >= 19, 'the copy list is too short to be the whole sheet');
    for (const line of TUTOR_VOICE_COPY) {
      assert.doesNotMatch(line, vendors, `"${line}" names the machinery`);
      assert.doesNotMatch(line, vendorId, `"${line}" carries something that looks like a vendor id`);
      assert.doesNotMatch(line, comparative, `"${line}" tells a learner one of these voices is better than the others`);
      assert.doesNotMatch(line, /—/, `em dash in voice copy: ${line}`);
      assert.equal(guiltIn(line), undefined, `guilt in voice copy: ${line}`);
      assert.ok(line.trim().length > 0, 'a blank line reached the sheet');
    }

    // The subline is the honest half: a change is real, and it lands next time.
    assert.match(TUTOR_VOICE_SUB, /whenever you like/i, 'the sheet no longer says this can be changed again');
    assert.match(TUTOR_VOICE_SUB, /next conversation/i, 'the sheet no longer says when the change is felt');
    assert.equal(TUTOR_VOICE_ROW, TUTOR_VOICE_TITLE, 'the row and the sheet it opens call this two different things');

    // And nothing the sheet renders is written in the screen instead of here.
    assert.ok(writtenBefore(VOICE_SHEET, 'TUTOR_VOICE_TITLE', 'TUTOR_VOICE_SUB'), 'the sheet lost one of its two lines');
    assert.doesNotMatch(VOICE_SHEET, vendors, 'the screen names a vendor the copy module never could');
  });

  test("each voice on the sheet offers a listen, and it plays that voice's clip", () => {
    // One bundled clip per catalogue voice, each require spelled out, because
    // Metro resolves the literal string and a template would bundle nothing.
    for (const key of Object.keys(TUTOR_VOICES) as TutorVoiceKey[]) {
      assert.ok(
        SAMPLES.includes(`${key}: require('../../assets/voices/${key}.m4a')`),
        `${key} has no bundled clip, so its listen button would do nothing`,
      );
    }
    assert.match(SAMPLES, /Record<TutorVoiceKey, VoiceSample>/, 'the table is not keyed by the catalogue, so a ninth voice could ship without a clip');

    // The sheet offers the listen, and the clip it plays is the one belonging
    // to the row that was tapped rather than whatever the player last held.
    assert.match(
      VOICE_SHEET,
      /onHear=\{\(\) => hearVoice\(option\.value\)\}/,
      'the rows have no listen, or the listen is not tied to the row it sits on',
    );
    assert.match(TAB, /samplePlayer\.replace\(voiceSample\(next\)\)/, 'the player is handed something other than the tapped voice');
    assert.match(TAB, /import \{ voiceSample \} from '\.\.\/tutor\/voiceSamples\.ts'/, 'the clips are reached some other way');

    // Choosing must never require listening first. The listen is a sibling
    // control on the card, and the card's own press is what chooses, so a
    // learner who never taps an ear still gets a voice.
    assert.ok(
      writtenBefore(VOICE_SHEET, 'onPress=', 'onHear='),
      'the listen has taken the place of the choice, and a learner is now made to audition everybody',
    );
  });

  test('starting one sample stops the one already playing', () => {
    // The rule. A second sample joining the first tells a learner nothing about
    // either voice, which is the entire purpose of the control.
    assert.equal(nextSample(null, 'alexandre'), 'alexandre', 'the first tap plays nothing');
    assert.equal(nextSample('alexandre', 'marie'), 'marie', 'the second voice did not take over from the first');
    assert.equal(nextSample('alexandre', 'alexandre'), null, 'the control that started a sound cannot stop it');
    assert.equal(nextSample(null, 'emilie'), 'emilie');

    // Every pair, so "takes over" is not a property of one lucky ordering.
    const keys = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];
    for (const playing of keys) {
      for (const tapped of keys) {
        assert.equal(nextSample(playing, tapped), playing === tapped ? null : tapped);
      }
    }

    // And the screen cannot break the rule by holding two players. One
    // `useAudioPlayer`, one `playing` key, and a pause on the way out.
    const players = TAB.match(/useAudioPlayer\(/g) ?? [];
    assert.equal(players.length, 1, 'Profile holds more than one player, so two clips can sound at once');
    assert.match(TAB, /const next = nextSample\(samplePlaying, key\)/, 'the screen decides for itself which sample plays');
    assert.match(TAB, /setSamplePlaying\(next\)/, 'the screen forgets which sample is playing, so a second tap cannot stop it');
    assert.match(TAB, /samplePlayer\.pause\(\)/, 'nothing ever stops the clip, so it follows the learner off the sheet');
    assert.ok(
      writtenBefore(TAB, 'samplePlayer.replace(voiceSample(next))', 'samplePlayer.play()'),
      'the player is told to play before it is given the clip, so the previous voice sounds again',
    );
  });
});

describe('the bilingual introduction the sample speaks', () => {
  test('the bilingual introduction is copy this module owns, not a sentence typed into a screen', () => {
    // Two things at once. Each option carries the catalogue's introduction rather
    // than a sentence written here, and every one of them is in TUTOR_VOICE_COPY,
    // which is what puts them under the sweep above: vendor names, vendor-shaped
    // ids, comparatives, em dashes and guilt words, for free and forever.
    for (const option of TUTOR_VOICE_OPTIONS) {
      assert.equal(option.sample, tutorSampleLine(option.value), `${option.value}'s introduction is not the catalogue's`);
      assert.ok(option.sample.includes(option.label), `${option.value}'s introduction does not name ${option.label}`);
      assert.ok(TUTOR_VOICE_COPY.includes(option.sample), `${option.value}'s introduction escapes the copy scan`);
    }
  });
});
