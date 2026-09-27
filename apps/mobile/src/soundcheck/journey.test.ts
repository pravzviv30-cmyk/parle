/**
 * The focused sound journey (Stage 4, item 2), held to what was measured.
 *
 * Every row here is built as `store.ts` would hold it. The journey is the one
 * place the app talks about a learner's sound across several attempts, so the
 * rules are the strict ones: only measured checks count, a self-guided or
 * unavailable attempt changes nothing, and "improvement" is only ever a claim
 * about one reference line that was later measured with nothing called out.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getMission } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { MIC_DENIED, SELF_GUIDED, type SoundCheckEvidence, type SoundCheckKind } from './model.ts';
import { SOUND_FINGERPRINT_OPEN } from '../myfrench/sounds.ts';
import {
  JOURNEY_COPY,
  SOUND_JOURNEY_OPEN,
  againLabel,
  calledOutLine,
  checkOpensOn,
  soundDoorLabel,
  soundJourney,
} from './journey.ts';

const CAFE = getMission('mission:cafe')!;
const HOTEL = getMission('mission:hotel')!;
const [A, B] = CAFE.referencePhrases as [string, string, string];
const [H] = HOTEL.referencePhrases as [string, string, string];
const NOW = Date.parse('2026-09-25T12:00:00Z');
const DAY = 86_400_000;

function check(
  kind: SoundCheckKind,
  at: number,
  over: Partial<SoundCheckEvidence> = {},
): SoundCheckEvidence {
  return {
    missionId: CAFE.id,
    reference: A,
    at,
    kind,
    focus: kind === 'assessed-focus' ? 'Round your lips for this vowel.' : null,
    phoneme: kind === 'assessed-focus' ? 'y' : null,
    ...over,
  };
}

const focus = (at: number, over: Partial<SoundCheckEvidence> = {}) => check('assessed-focus', at, over);
const clear = (at: number, over: Partial<SoundCheckEvidence> = {}) => check('assessed-clear', at, over);

describe('the journey appears only from repeated measurement — Stage 4 item 2', () => {
  test('one measured attempt is not a journey; the fingerprint alone stays', () => {
    assert.equal(soundJourney([], NOW), null);
    assert.equal(soundJourney([focus(NOW - 3 * DAY)], NOW), null);
    // Unmeasured practice does not make a single measurement into two.
    assert.equal(
      soundJourney([focus(NOW - 3 * DAY), check('self-guided', NOW - 2 * DAY), check('unavailable', NOW - DAY)], NOW),
      null,
    );
  });

  test('two measured attempts with nothing called out, or a focus with no sound named, is no journey', () => {
    assert.equal(soundJourney([clear(NOW - 2 * DAY), clear(NOW - DAY, { reference: B })], NOW), null);
    assert.equal(soundJourney([focus(NOW - 2 * DAY, { phoneme: null }), clear(NOW - DAY)], NOW), null);
    // A sound this build does not know has no example word, and nothing is invented for it.
    assert.equal(soundJourney([focus(NOW - 2 * DAY, { phoneme: 'zz' }), clear(NOW - DAY, { reference: B })], NOW), null);
  });

  test('two measured checks and one named focus make a journey, example word first', () => {
    const journey = soundJourney([focus(NOW - 2 * DAY), clear(NOW - DAY, { reference: B })], NOW);
    assert.ok(journey !== null);
    assert.equal(journey.phoneme, 'y');
    assert.equal(journey.example, 'tu', 'the example is the inventory word, not a symbol');
    assert.equal(journey.flaggedTimes, 1);
    assert.deepEqual(journey.situations, [CAFE.id]);
    assert.equal(journey.lastFlaggedAt, NOW - 2 * DAY);
    assert.equal(journey.unmeasured, 0);
  });
});

describe('improvement is only ever claimed per reference line', () => {
  test('a flagged line later measured clear is the one improvement the journey may name', () => {
    const journey = soundJourney([focus(NOW - 2 * DAY), clear(NOW - DAY)], NOW)!;
    assert.deepEqual(journey.laterClear, [{ missionId: CAFE.id, reference: A, at: NOW - DAY }]);
    assert.deepEqual(journey.lines, [{ missionId: CAFE.id, reference: A, lastFlaggedAt: NOW - 2 * DAY, clearAt: NOW - DAY }]);
  });

  test('a clear check on a different line proves nothing about the flagged one', () => {
    const journey = soundJourney([focus(NOW - 2 * DAY), clear(NOW - DAY, { reference: B })], NOW)!;
    assert.deepEqual(journey.laterClear, []);
    // Same words in a different situation are still a different line.
    const elsewhere = soundJourney([focus(NOW - 2 * DAY), clear(NOW - DAY, { missionId: HOTEL.id })], NOW)!;
    assert.deepEqual(elsewhere.laterClear, []);
  });

  test('a clear check before the flag, or a flag after the clear, is not a later clear', () => {
    assert.deepEqual(soundJourney([clear(NOW - 3 * DAY), focus(NOW - 2 * DAY)], NOW)!.laterClear, []);
    assert.deepEqual(soundJourney([focus(NOW - 3 * DAY), clear(NOW - 2 * DAY), focus(NOW - DAY)], NOW)!.laterClear, []);
    // A different sound called out on that line after the clear also takes the
    // claim away, while the journey is still about the first sound.
    const other = soundJourney(
      [focus(NOW - 5 * DAY), clear(NOW - 4 * DAY), focus(NOW - 3 * DAY, { phoneme: 'ʁ' }), focus(NOW - DAY, { reference: B })],
      NOW,
    )!;
    assert.equal(other.phoneme, 'y', 'the fixture is about the first sound');
    assert.deepEqual(other.laterClear, []);
    // So does a legacy focus row that named no sound at all: something was still called out.
    assert.deepEqual(
      soundJourney([focus(NOW - 5 * DAY), clear(NOW - 4 * DAY), focus(NOW - 3 * DAY, { phoneme: null }), focus(NOW - DAY, { reference: B })], NOW)!.laterClear,
      [],
    );
    // And a clear stamped at the very instant of the flag cannot be said to come after it.
    assert.deepEqual(soundJourney([focus(NOW - DAY), clear(NOW - DAY), clear(NOW - 2 * DAY, { reference: B })], NOW)!.laterClear, []);
  });
});

describe('unmeasured practice never moves the journey', () => {
  test('self-guided, unavailable and microphone-refused attempts change no sound, no count and no line', () => {
    const measured = [focus(NOW - 5 * DAY), focus(NOW - 3 * DAY, { reference: B }), clear(NOW - 2 * DAY, { reference: B })];
    const base = soundJourney(measured, NOW)!;
    assert.equal(MIC_DENIED.kind, 'self-guided', 'a refused microphone is recorded as self-guided');

    // Hostile rows too: an unmeasured row carrying a sound or a focus sentence,
    // stamped after everything, on the very lines the journey is about.
    const noise: SoundCheckEvidence[] = [
      check(SELF_GUIDED.kind, NOW - DAY, { phoneme: 'ʁ', focus: 'Try the throat r.' }),
      check(MIC_DENIED.kind, NOW - DAY + 1, { reference: B, phoneme: 'ʁ' }),
      check('unavailable', NOW - DAY + 2, { reference: A, phoneme: 'u' }),
      check('self-guided', NOW - DAY + 3, { reference: A }),
    ];
    const noisy = soundJourney([...measured, ...noise], NOW)!;
    assert.equal(noisy.phoneme, base.phoneme);
    assert.equal(noisy.flaggedTimes, base.flaggedTimes);
    assert.deepEqual(noisy.laterClear, base.laterClear);
    assert.deepEqual(noisy.lines, base.lines);
    assert.deepEqual(noisy.situations, base.situations);
    assert.equal(noisy.lastFlaggedAt, base.lastFlaggedAt);
    assert.equal(noisy.focus, base.focus);
    assert.equal(noisy.unmeasured, 4, 'unmeasured practice is counted, and only counted');
  });
});

describe('which sound, how often, and where', () => {
  test('the newest named sound leads, and only its own flags are counted', () => {
    const journey = soundJourney(
      [
        focus(NOW - 6 * DAY, { phoneme: 'ʁ' }),
        focus(NOW - 5 * DAY, { missionId: HOTEL.id, reference: H }),
        focus(NOW - 4 * DAY),
        focus(NOW - 3 * DAY, { reference: B }),
        focus(NOW - 2 * DAY, { phoneme: 'ʁ', reference: B }),
        focus(NOW - DAY, { phoneme: 'y', missionId: HOTEL.id, reference: H }),
      ],
      NOW,
    )!;
    assert.equal(journey.phoneme, 'y');
    assert.equal(journey.flaggedTimes, 4);
    assert.deepEqual(journey.situations, [HOTEL.id, CAFE.id], 'each situation once, the most recent first');
    assert.equal(journey.lastFlaggedAt, NOW - DAY);
    assert.deepEqual(
      journey.lines.map((l) => [l.missionId, l.reference]),
      [[HOTEL.id, H], [CAFE.id, B], [CAFE.id, A]],
      'one row per flagged line, most recent first',
    );
  });

  test('a newest focus on a sound this build does not know gives way to the newest one it does', () => {
    const journey = soundJourney([focus(NOW - 3 * DAY), focus(NOW - DAY, { phoneme: 'zz' })], NOW)!;
    assert.equal(journey.phoneme, 'y');
    assert.equal(journey.flaggedTimes, 1);
  });

  test('a situation this build does not know, or a row stamped after now, is left out', () => {
    assert.equal(soundJourney([focus(NOW - 2 * DAY, { missionId: 'mission:moon' }), clear(NOW - DAY)], NOW), null);
    assert.equal(soundJourney([focus(NOW - 2 * DAY), clear(NOW + DAY)], NOW), null);
    assert.equal(soundJourney([focus(Number.NaN), clear(NOW - DAY)], NOW), null);
  });

  test('a stored focus sentence is shown only while it is still true', () => {
    assert.equal(soundJourney([focus(NOW - 2 * DAY), clear(NOW - DAY, { reference: B })], NOW)!.focus, 'Round your lips for this vowel.');
    for (const dated of ['It came up 4 times today.', 'You rushed it today.', 'Twice this week.']) {
      const journey = soundJourney([focus(NOW - 2 * DAY, { focus: dated }), clear(NOW - DAY, { reference: B })], NOW)!;
      assert.equal(journey.focus, null, `"${dated}" was drawn months after it stopped being true`);
    }
  });
});

describe('what the journey is allowed to say', () => {
  const lines = [...Object.values(JOURNEY_COPY), SOUND_JOURNEY_OPEN, calledOutLine(1, CAFE.titleEn), calledOutLine(3, CAFE.titleEn)];

  test('no score, no mastery, no trend, no scold', () => {
    for (const line of lines) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.doesNotMatch(line, /—|%|↑|↓|→|\bscore|\bmaster|\bgrid\b|\btrend|\bimprov|\bbetter\b|\bworse\b|\bprogress/i, `"${line}" claims more than was measured`);
      assert.equal(line, line.trim());
    }
  });

  test('the only digit the journey ever shows is a count of measured attempts', () => {
    for (const line of Object.values(JOURNEY_COPY)) assert.doesNotMatch(line, /\d/, `"${line}" carries a digit`);
    assert.doesNotMatch(SOUND_JOURNEY_OPEN, /\d/);
    assert.equal(calledOutLine(1, CAFE.titleEn), `Called out once, on a line from ${CAFE.titleEn}.`);
    assert.equal(calledOutLine(3, CAFE.titleEn), `Called out 3 times, most recently on a line from ${CAFE.titleEn}.`);
    assert.deepEqual(calledOutLine(12, CAFE.titleEn).match(/\d+/g), ['12']);
  });

  test('the line that came back clear is said in the contract’s words', () => {
    assert.equal(JOURNEY_COPY.lineClear, 'That line came back with nothing called out.');
    assert.equal(JOURNEY_COPY.label, 'Your focus sound');
    assert.equal(JOURNEY_COPY.again, 'Check this line again');
  });

  test('the empty state states the rule it waits on, and no stricter one — Stage 4 lead review', () => {
    // The journey needs more than one measured check, only one of which has
    // to call out a sound. The empty line used to say more than one had to
    // call one out, which a learner would read as a bar they had already met.
    assert.match(JOURNEY_COPY.none, /more than one measured check/, 'the empty state does not say how many measured checks it waits for');
    assert.match(JOURNEY_COPY.none, /one of them calls out a sound/, 'the empty state does not say only one of them has to call out a sound');
    assert.doesNotMatch(JOURNEY_COPY.none, /more than one measured check has called/, 'the empty state asks for more call-outs than the journey needs');
  });
});

describe('the check door only promises the line it will open on', () => {
  // The sound check rotates to the next reference line after every attempt
  // (`nextSoundCheckReference`), so opening it for a situation usually shows a
  // different line from the one that was flagged. The button says "this line"
  // only when the check will really open on it.
  test('"Check this line again" only when the check opens on that line', () => {
    const flaggedA = [focus(NOW - 2 * DAY), clear(NOW - DAY, { reference: B })];
    // The newest attempt in the café was line B, so the check opens on the third line.
    assert.equal(checkOpensOn(CAFE.id, flaggedA), CAFE.referencePhrases[2]);
    assert.equal(againLabel({ missionId: CAFE.id, reference: A }, flaggedA), JOURNEY_COPY.againSituation);

    // The last line of the situation was the newest attempt: the check wraps round to line A.
    const wraps = [focus(NOW - 2 * DAY), check('self-guided', NOW - DAY, { reference: CAFE.referencePhrases[2]! })];
    assert.equal(checkOpensOn(CAFE.id, wraps), A);
    assert.equal(againLabel({ missionId: CAFE.id, reference: A }, wraps), JOURNEY_COPY.again);

    assert.equal(checkOpensOn('mission:moon', flaggedA), null);
    assert.equal(againLabel({ missionId: 'mission:moon', reference: A }, flaggedA), JOURNEY_COPY.againSituation);
  });
});

describe('the My French door says where it goes', () => {
  test('the sound row names the journey when it opens the journey, and the check otherwise', () => {
    const journey = soundJourney([focus(NOW - 2 * DAY), clear(NOW - DAY)], NOW);
    assert.equal(soundDoorLabel(journey), SOUND_JOURNEY_OPEN);
    assert.equal(soundDoorLabel(null), SOUND_FINGERPRINT_OPEN);
    assert.notEqual(SOUND_JOURNEY_OPEN, SOUND_FINGERPRINT_OPEN);
  });
});
