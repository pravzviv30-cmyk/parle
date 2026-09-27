/**
 * Before and after a tutor revisit (Stage 4, item 3), from recorded facts only.
 *
 * A revisit pack names its source by id (`revisedFromPackId`, server-verified).
 * What can honestly be put side by side is curated on both ends: the earlier
 * pack's first correction, the practice recorded on it, and whether the same
 * correction was curated again after the revisit. Whether the tutor's one-detail
 * variation was attempted or went well is recorded nowhere, so nothing here
 * infers it.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { buildConversationPack, type ConversationPack, type ConversationPackCorrection } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { isPracticeEvent, type PracticeEvent } from '../practice/history.ts';
import { PRACTICE_BEFORE, REVISION_COPY, correctionLine, normaliseBetter, revisionEvidence } from './revision.ts';

const NOW = Date.UTC(2026, 8, 24, 12);
const DAY = 86_400_000;

const CORRECTION: ConversationPackCorrection = {
  quote: 'Je veux un café',
  better: "Je voudrais un café, s'il vous plaît.",
  betterEn: 'I would like a coffee, please.',
  why: 'Softer when you ask.',
};

function pack(
  id: string,
  daysAgo: number,
  over: { revisedFromPackId?: string | null; corrections?: ConversationPackCorrection[]; wins?: string[] } = {},
): ConversationPack {
  return buildConversationPack({
    id,
    sessionId: id,
    learnerId: 'l',
    createdAt: new Date(NOW - daysAgo * DAY).toISOString(),
    title: { fr: `Titre ${id}`, en: `Title ${id}` },
    summary: 's',
    keyPhrases: [{ fr: `Un ${id}`, frWritten: null, en: 'one' }],
    ...over,
  });
}

const sitting = (id: string, at: number, targets: { packId: string | null; outcome: 'recalled' | 'practised' | 'unresolved' }[]): PracticeEvent => {
  const event: PracticeEvent = {
    kind: 'session-completed',
    id,
    at,
    packId: targets.find((t) => t.packId !== null)?.packId ?? null,
    targets: targets.map((t, i) => ({
      phraseKey: `phrase:k${i}`,
      source: t.packId === null ? { kind: 'review' } : { kind: 'pack', packId: t.packId },
      outcome: t.outcome,
      attempts: t.outcome === 'unresolved' ? 2 : 1,
    })),
  };
  assert.ok(isPracticeEvent(event), `fixture ${id} is not a valid stored event`);
  return event;
};

const source = pack('src', 5, { corrections: [CORRECTION] });

describe('a revisit is put beside the conversation it came from — Stage 4 item 3', () => {
  test('a pack that revisited nothing has no before and after', () => {
    const plain = pack('plain', 1);
    assert.equal(revisionEvidence(plain, [source, plain], []), null);
    const nulled = pack('nulled', 1, { revisedFromPackId: null });
    assert.equal(revisionEvidence(nulled, [source, nulled], []), null);
  });

  test('a revisit still being made into practice says nothing yet', () => {
    // Its corrections have not been curated, so "did not come up again" would
    // be said about a list nobody has written.
    for (const state of ['generating', 'failed'] as const) {
      const after = { ...pack('after', 1, { revisedFromPackId: 'src' }), state };
      assert.equal(revisionEvidence(after, [source, after], []), null, `a ${state} revisit drew a before and after`);
    }
  });

  test('a source no longer in the cache is not brought back', () => {
    const after = pack('after', 1, { revisedFromPackId: 'src' });
    assert.equal(revisionEvidence(after, [after], []), null);
    // Its history is still on the phone; history resurrects nothing.
    assert.equal(revisionEvidence(after, [after], [sitting('s1', NOW - 3 * DAY, [{ packId: 'src', outcome: 'practised' }])]), null);
  });

  test('the earlier correction is the one the revisit was briefed with, and did not recur', () => {
    const after = pack('after', 1, { revisedFromPackId: 'src', wins: ['Asked politely'] });
    const evidence = revisionEvidence(after, [source, after], [])!;
    assert.equal(evidence.source.id, 'src');
    assert.deepEqual(evidence.before.correction, CORRECTION, 'the before is not the source pack’s first curated correction');
    assert.equal(evidence.before.practice, null);
    assert.equal(evidence.after.corrections, 0);
    assert.equal(evidence.after.earlierCorrectionRepeated, false);
    assert.deepEqual(evidence.after.wins, ['Asked politely']);
    assert.equal(correctionLine(evidence), REVISION_COPY.notRepeated);
  });

  test('the same correction coming up again is caught through punctuation and case', () => {
    const variants = [
      "je voudrais un café s'il vous plaît",
      "JE VOUDRAIS UN CAFÉ, S’IL VOUS PLAÎT !",
      "  Je voudrais   un café, s'il vous plaît…  ",
      '« Je voudrais un café, s’il vous plaît. »',
    ];
    for (const better of variants) {
      const after = pack('after', 1, { revisedFromPackId: 'src', corrections: [{ ...CORRECTION, better }] });
      const evidence = revisionEvidence(after, [source, after], [])!;
      assert.equal(evidence.after.earlierCorrectionRepeated, true, `"${better}" was not recognised as the same correction`);
      assert.equal(correctionLine(evidence), REVISION_COPY.repeated);
    }
    // A different correction is a different correction.
    const other = pack('other', 1, { revisedFromPackId: 'src', corrections: [{ ...CORRECTION, better: 'Je voudrais un thé.' }] });
    const evidence = revisionEvidence(other, [source, other], [])!;
    assert.equal(evidence.after.earlierCorrectionRepeated, false);
    assert.equal(evidence.after.corrections, 1);
    assert.equal(normaliseBetter("Je voudrais un café, s'il vous plaît."), normaliseBetter('je voudrais un café s’il vous plaît'));
  });

  test('a correction that only lost its accents is the same correction — Stage 4 review (2026-09-25)', () => {
    // A re-curated `better` that dropped an accent must not be read as a
    // correction that "did not come up again". Erring toward "came up again"
    // is the safe direction: it claims nothing the learner did.
    for (const better of ["Je voudrais un cafe, s'il vous plait.", 'JE VOUDRAIS UN CAFE S’IL VOUS PLAIT']) {
      const after = pack('after', 1, { revisedFromPackId: 'src', corrections: [{ ...CORRECTION, better }] });
      const evidence = revisionEvidence(after, [source, after], [])!;
      assert.equal(evidence.after.earlierCorrectionRepeated, true, `"${better}" was read as a different correction`);
      assert.equal(correctionLine(evidence), REVISION_COPY.repeated);
    }
    assert.equal(normaliseBetter('Où est la gare ?'), 'ou est la gare');
    // Folding accents does not merge different words.
    assert.notEqual(normaliseBetter('Je voudrais un thé.'), normaliseBetter("Je voudrais un café, s'il vous plaît."));
    // Stage 4 re-check (2026-09-25): the ligatures are spelling, not accents,
    // and a re-curated line may write them out ("coeur", "soeur").
    assert.equal(normaliseBetter('J’ai mal au cœur.'), normaliseBetter("J'ai mal au coeur"));
    assert.equal(normaliseBetter('Ma sœur arrive.'), 'ma soeur arrive');
    assert.equal(normaliseBetter('Un curriculum vitæ'), 'un curriculum vitae');
  });

  test('with no earlier correction there is nothing to say about one', () => {
    const bare = pack('bare', 5);
    const after = pack('after', 1, { revisedFromPackId: 'bare', corrections: [CORRECTION] });
    const evidence = revisionEvidence(after, [bare, after], [])!;
    assert.equal(evidence.before.correction, null);
    assert.equal(evidence.after.earlierCorrectionRepeated, false);
    assert.equal(correctionLine(evidence), null, 'a verdict about a correction that never existed');
  });
});

describe('what was practised before is attributed by target source only', () => {
  const after = pack('after', 1, { revisedFromPackId: 'src' });

  test('review in the same sitting, or another conversation, is not practice of the source', () => {
    const history = [
      sitting('review', NOW - 3 * DAY, [{ packId: null, outcome: 'recalled' }]),
      sitting('elsewhere', NOW - 3 * DAY, [{ packId: 'other', outcome: 'recalled' }]),
    ];
    assert.equal(revisionEvidence(after, [source, after], history)!.before.practice, null);
  });

  test('a sitting mixing review and the source counts only the source’s own targets', () => {
    const history = [sitting('mix', NOW - 3 * DAY, [{ packId: null, outcome: 'recalled' }, { packId: 'src', outcome: 'practised' }])];
    assert.equal(revisionEvidence(after, [source, after], history)!.before.practice, 'practised');
  });

  test('the newest sitting on the source before the revisit decides, and later ones do not', () => {
    const history = [
      sitting('old', NOW - 4 * DAY, [{ packId: 'src', outcome: 'recalled' }]),
      sitting('newer', NOW - 3 * DAY, [{ packId: 'src', outcome: 'unresolved' }]),
      // After the revisit pack was made: not "before".
      sitting('later', NOW, [{ packId: 'src', outcome: 'recalled' }]),
    ];
    assert.equal(revisionEvidence(after, [source, after], history)!.before.practice, 'attempted');
  });

  test('a revisit with no readable date has no before — Stage 4 review (2026-09-25)', () => {
    // An unparseable `createdAt` used to become +Infinity, so every sitting,
    // including ones after the revisit, counted as "before the revisit".
    const history = [
      sitting('old', NOW - 4 * DAY, [{ packId: 'src', outcome: 'recalled' }]),
      sitting('later', NOW, [{ packId: 'src', outcome: 'recalled' }]),
    ];
    for (const createdAt of ['not a date', '']) {
      const undated = { ...pack('undated', 1, { revisedFromPackId: 'src' }), createdAt };
      const evidence = revisionEvidence(undated, [source, undated], history)!;
      assert.equal(evidence.before.practice, null, `a revisit dated "${createdAt}" claimed practice before it`);
      // The correction comparison does not depend on time, so it still stands.
      assert.deepEqual(evidence.before.correction, CORRECTION);
      assert.equal(correctionLine(evidence), REVISION_COPY.notRepeated);
    }
  });

  test('a warm-up or a revisit opening is not practice', () => {
    const history: PracticeEvent[] = [
      { kind: 'warmup-completed', id: 'w1', at: NOW - 3 * DAY, packId: 'src' },
      { kind: 'revisit-started', id: 'r1', at: NOW - 2 * DAY, packId: 'src' },
    ];
    assert.equal(revisionEvidence(after, [source, after], history)!.before.practice, null);
  });
});

describe('what the section may say', () => {
  test('the process, and a fact about corrections; never a verdict on the variation', () => {
    assert.equal(REVISION_COPY.process, 'Your tutor was asked to retry the situation, then change one detail.');
    assert.equal(REVISION_COPY.notRepeated, 'The earlier correction did not come up again in the revisit.');
    for (const line of Object.values(REVISION_COPY)) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.doesNotMatch(line, /\d|—|%/, `"${line}" carries a number or a dash`);
      assert.doesNotMatch(line, /handled|variation|replay|you (?:got|fixed|improved)|better now|mastered|\bstill\b|\byet\b/i, `"${line}" claims or blames more than was recorded`);
    }
  });

  test('what was practised before is said in the section’s own sentence — Stage 4 review (2026-09-25)', () => {
    // It used to borrow My French's line after a label, and read "Before the
    // revisit: Ready to revisit".
    assert.deepEqual(PRACTICE_BEFORE, {
      recalled: 'Before the revisit, you recalled phrases from it without choices.',
      practised: 'Before the revisit, you practised its phrases.',
      attempted: 'Before the revisit, you tried its phrases.',
    });
    for (const line of Object.values(PRACTICE_BEFORE)) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.doesNotMatch(line, /\d|—|%/, `"${line}" carries a number or a dash`);
    }
    assert.ok(!('practisedBefore' in REVISION_COPY), 'the old label is still there to be joined to a borrowed line');
  });

  test('the library draws the section only for a real revisit, from the curated fields only', () => {
    const raw = readFileSync(fileURLToPath(new URL('./ConversationPackLibrary.tsx', import.meta.url)), 'utf8');
    const lib = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ');
    assert.match(lib, /const revision = selected === null \? null : revisionEvidence\(selected, packs, history\);/);
    assert.match(lib, /\{revision !== null && \(/, 'the section is drawn without a revisit behind it');
    assert.match(lib, /<Label>\{REVISION_COPY\.label\}<\/Label>/);
    assert.match(lib, /\{REVISION_COPY\.process\}/);
    assert.match(lib, /\{revision\.before\.correction\.quote\}/);
    assert.match(lib, /\{revision\.before\.correction\.better\}/);
    assert.match(lib, /correctionLine\(revision\)/);
    // Stage 4 review (2026-09-25): the section's own sentence, not a label
    // joined to My French's line.
    assert.match(lib, /\{revision\.before\.practice !== null && \( <Text[^>]*>\{PRACTICE_BEFORE\[revision\.before\.practice\]\}<\/Text> \)\}/);
    assert.doesNotMatch(lib, /EVIDENCE_LINE|practisedBefore/, 'the section still borrows My French’s line');
    // The history is read behind the account guard, and a failed read says nothing.
    assert.match(lib, /loadPracticeHistory\(\)/);
    assert.match(lib, /scopeGeneration\(\) === scope/);
    assert.doesNotMatch(lib, /revision\.after\.corrections\}|revision\.after\.wins/, 'the section prints a count or restates wins');
  });
});
