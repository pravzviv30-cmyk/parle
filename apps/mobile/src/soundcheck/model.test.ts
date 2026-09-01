import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getMission, type SessionPhonemeReport } from '@luvani/core';

import { SELF_GUIDED, nextSoundCheckReference, soundCheckDecision, type SoundCheckEvidence } from './model.ts';

const emptyReport: SessionPhonemeReport = { stats: [], focus: null, overall: 0, wins: [] };

describe('known-reference sound checks', () => {
  test('only rotates through the mission’s authored reference phrases', () => {
    const mission = getMission('mission:cafe')!;
    const first = nextSoundCheckReference(mission, []);
    assert.equal(first, mission.referencePhrases[0]);

    const evidence: SoundCheckEvidence[] = [
      { missionId: mission.id, reference: first!, at: 1, kind: 'self-guided', focus: null },
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
