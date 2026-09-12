import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, missionStates, type ConversationPack } from '@luvani/core';
import { createProfile, type LearnerProfile } from '@luvani/brain/profile';

import { guiltIn } from '../copy/guilt.ts';
import type { ScenarioRecord } from '../missions/progressStore.ts';
import { continuityFrom, continuityHeadline } from './continuity.ts';

const NOW = Date.parse('2026-09-12T20:00:00.000Z');

function pack(over: Partial<Parameters<typeof buildConversationPack>[0]> = {}): ConversationPack {
  return buildConversationPack({
    id: 'sess-1',
    sessionId: 'sess-1',
    learnerId: 'learner',
    createdAt: new Date(NOW - 60_000).toISOString(),
    title: { fr: 'Le code wifi', en: 'The wifi password' },
    summary: 'You asked for the wifi.',
    keyPhrases: [{ fr: 'Le code wifi, s’il vous plaît', frWritten: null, en: 'The wifi password, please' }],
    ...over,
  });
}

function brainWith(over: Partial<LearnerProfile['memory']> = {}, lastScenarios: string[] = []): LearnerProfile {
  const profile = createProfile();
  return { ...profile, memory: { ...profile.memory, ...over }, preferences: { ...profile.preferences, lastScenarios } };
}

describe('what the tutor remembers, said in one line (F546)', () => {
  test('continuity comes from a real record in priority order, and a new learner gets nothing', () => {
    const progress = missionStates([], [], NOW);
    const base = { brain: createProfile(), packs: [] as ConversationPack[], records: [] as ScenarioRecord[], progress };

    // A new learner: nothing, not a friendly invention.
    assert.equal(continuityFrom(base), null);

    // The faintest record: the last scene's title.
    const faint = continuityFrom({ ...base, brain: brainWith({}, ['Au marché']) });
    assert.ok(faint !== null);
    assert.equal(continuityHeadline('Camille'), 'Camille remembers', 'the headline is the tutor tab’s, and names whoever the learner chose');
    assert.equal(faint.line, 'Last time: Au marché.');
    assert.equal(faint.action, null);

    // The tutor's own opener outranks it.
    const opener = continuityFrom({ ...base, brain: brainWith({ opener: { fr: 'On reparle de ton chat ?', en: 'Shall we talk about your cat again?' } }, ['Au marché']) });
    assert.equal(opener!.line, 'Shall we talk about your cat again?');
    assert.equal(opener!.action, null);

    // A finished conversation outranks the opener, and can be continued.
    const talked = continuityFrom({ ...base, brain: brainWith({ opener: { fr: 'x', en: 'Shall we talk about your cat again?' } }), packs: [pack()] });
    assert.equal(talked!.line, 'Last time you talked about the wifi password.');
    assert.deepEqual(talked!.action, { kind: 'continue', seedTopic: { fr: 'Le code wifi', en: 'The wifi password' } });

    // A pack still being written is not yet something to continue.
    assert.equal(continuityFrom({ ...base, packs: [pack({ state: 'generating' })] }), null);

    // A scene walked out of outranks everything, and resumes.
    const record: ScenarioRecord = { missionId: 'mission:hotel', at: NOW - 30_000, elapsedMs: 90_000, beatsDone: 1 };
    const left = continuityFrom({ ...base, packs: [pack()], records: [record] });
    assert.equal(left!.line, 'Check into a hotel is waiting where you left it.');
    assert.deepEqual(left!.action, { kind: 'resume', missionId: 'mission:hotel' });

    // A scene finished since the walk-out is not waiting any more.
    const finished = missionStates([{ id: 'mission:hotel', at: NOW - 10_000, rung: 3 }], [], NOW);
    const done = continuityFrom({ ...base, progress: finished, records: [record], packs: [pack()] });
    assert.equal(done!.action!.kind, 'continue');

    for (const view of [faint, opener, talked, left]) {
      for (const line of [view!.line, continuityHeadline('Camille')]) {
        assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
        assert.doesNotMatch(line, /—/);
      }
    }
  });
});
