import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getMission, getPhoneme, bestDrillFor, type FocusPoint, type SessionPhonemeReport } from '@luvani/core';

import { SELF_GUIDED, nextSoundCheckReference, soundCheckDecision, type SoundCheckEvidence } from './model.ts';

const emptyReport: SessionPhonemeReport = { stats: [], focus: null, overall: 0, wins: [] };

describe('known-reference sound checks', () => {
  test('only rotates through the mission’s authored reference phrases', () => {
    const mission = getMission('mission:cafe')!;
    const first = nextSoundCheckReference(mission, []);
    assert.equal(first, mission.referencePhrases[0]);

    const evidence: SoundCheckEvidence[] = [
      { missionId: mission.id, reference: first!, at: 1, kind: 'self-guided', focus: null, phoneme: null },
    ];
    assert.equal(nextSoundCheckReference(mission, evidence), mission.referencePhrases[1]);
  });

  test('an empty vendor answer is explicitly unavailable, never a pass', () => {
    const decision = soundCheckDecision(0, emptyReport);
    assert.equal(decision.kind, 'unavailable');
    assert.match(decision.detail, /did not return enough evidence/i);
  });

  test('a real report with no focus is described without showing its numeric score', () => {
    const decision = soundCheckDecision(5, emptyReport);
    assert.equal(decision.kind, 'assessed-clear');
    assert.doesNotMatch(`${decision.headline} ${decision.detail}`, /\d/);
  });

  test('self-guided practice says plainly that it was not assessed', () => {
    assert.equal(SELF_GUIDED.kind, 'self-guided');
    assert.match(SELF_GUIDED.detail, /did not assess/i);
  });
});

describe('the sound check remembers which sound it was about — F468', () => {
  /** A real focus, built from the shipped inventory rather than a hand-made shape. */
  function focusOn(ipa: string): FocusPoint {
    const phoneme = getPhoneme(ipa)!;
    const drill = bestDrillFor(phoneme)!;
    return {
      phoneme,
      stat: { ipa, meanScore: 40, sampleCount: 4, worstWord: 'tu', worstScore: 30 },
      drill,
      reason: 'In "tu" you said /u/ instead of /y/. In French that makes a different word.',
    };
  }

  test('an assessed focus carries its phoneme, so a later screen can look the sound up', () => {
    // The identity used to stop here: `focus` kept the sentence and the report
    // took the phoneme with it, which left every later surface with prose it
    // could print and nothing it could look up.
    const report: SessionPhonemeReport = { stats: [], focus: focusOn('y'), overall: 40, wins: [] };

    const decision = soundCheckDecision(4, report);

    assert.equal(decision.kind, 'assessed-focus');
    assert.equal(decision.phoneme, 'y', 'the assessed sound was thrown away again');
    assert.ok(getPhoneme(decision.phoneme!), 'the stored symbol does not resolve against the inventory');
  });

  test('a check that named no sound stores no sound, rather than a guess', () => {
    for (const decision of [
      soundCheckDecision(0, null),
      soundCheckDecision(4, { stats: [], focus: null, overall: 90, wins: [] }),
      SELF_GUIDED,
    ]) {
      assert.equal(decision.phoneme, null, `${decision.kind} invented a sound nothing measured`);
    }
  });

  test('the key is written on every row, never left off', () => {
    // Whole-row identity is the merge rule for these, so a device that omits
    // the key and one that writes null would read the same attempt as two rows.
    for (const decision of [soundCheckDecision(0, null), SELF_GUIDED]) {
      assert.ok('phoneme' in decision, `${decision.kind} omits the key instead of writing null`);
    }
  });
});
