import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { buildConversationPack } from '@luvani/core';

import { SYNC_EXCLUSIONS } from '../sync/policy.ts';
import { USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { nextStep } from '../practice/nextStep.ts';
import { MAX_PACK_MARKS, continuedAt, packIdOfNode, withMark, withMarks, type PackMark } from './marks.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const NOW = Date.parse('2026-09-12T20:00:00.000Z');

function pack(id: string) {
  return buildConversationPack({
    id, sessionId: id, learnerId: 'l', createdAt: new Date(NOW - 60_000).toISOString(),
    title: { fr: 'x', en: 'x' }, summary: 's', keyPhrases: [{ fr: 'Bonjour', frWritten: null, en: 'Hello' }],
  });
}

describe('what this phone did with a pack (F550)', () => {
  test('a finished pack drill marks the pack practised, an abandoned one does not, and the next step moves on', () => {
    // The fold: the server's null becomes this phone's date, and a later
    // server date wins over it.
    const marks = withMark([], 's1', 'practisedAt', NOW);
    const [folded] = withMarks([pack('s1')], marks);
    assert.equal(folded!.lastPractisedAt, new Date(NOW).toISOString());
    assert.equal(withMarks([{ ...pack('s1'), lastPractisedAt: '2026-01-01T00:00:00.000Z' }], marks)[0]!.lastPractisedAt, '2026-01-01T00:00:00.000Z');

    // And the next step moves on: the practised pack is not re-offered.
    assert.equal(nextStep([], [pack('s1')], NOW)!.kind, 'pack', 'an unpractised pack is not the next step');
    assert.equal(nextStep([], withMarks([pack('s1')], marks), NOW), null, 'the next step re-offers a pack this phone already practised');

    // One mark per pack, both stamps kept, the least recently touched dropped.
    const both = withMark(withMark([], 's1', 'practisedAt', 10), 's1', 'continuedAt', 20);
    assert.equal(both.length, 1);
    assert.deepEqual(both[0], { packId: 's1', practisedAt: 10, continuedAt: 20 });
    assert.equal(continuedAt(pack('s1'), both), 20);
    let many: PackMark[] = [];
    for (let i = 0; i < MAX_PACK_MARKS + 3; i += 1) many = withMark(many, `p${i}`, 'practisedAt', i);
    assert.equal(many.length, MAX_PACK_MARKS);
    assert.ok(!many.some((mark) => mark.packId === 'p0'), 'the cap kept the least recently touched mark');

    // Which node names a pack: the pack's own id and the replay's, nothing else.
    assert.equal(packIdOfNode('s1', [pack('s1')]), 's1');
    assert.equal(packIdOfNode('replay:s1', [pack('s1')]), 's1');
    assert.equal(packIdOfNode('unit:cafe', [pack('s1')]), null);
    assert.equal(packIdOfNode('replay:s9', [pack('s1')]), null);

    // The drill screen says when a sitting finished, separately from Done,
    // which also fires on Leave, and the navigator marks only on that signal.
    const drill = read('../DrillScreen.tsx');
    assert.match(drill, /onFinished\?: \(nodeId: string\) => void/, 'the drill screen has no finished signal of its own');
    assert.match(drill, /if \(!session\?\.finished \|\| !node \|\| finishedRef\.current\) return;[\s\S]{0,120}onFinished\?\.\(node\.id\)/, 'the finished signal fires on something other than a finished sitting, or twice');
    const navigator = read('../nav/RootNavigator.tsx');
    assert.match(navigator, /onFinished=\{\(nodeId\) => void markPractisedNode\(nodeId\)\}/, 'the navigator does not mark a finished pack drill');
    assert.doesNotMatch(navigator, /onDone=\{[^}]*markPackPractised/, 'the navigator marks on Done, which also fires on Leave');

    // On this phone: a per-user key the reset clears, excluded from sync with
    // the reason written down.
    assert.ok((USER_KEY_SUFFIXES as readonly string[]).includes('packMarks'));
    assert.match(read('./marks.ts'), /userKey\('packMarks'\)/);
    const exclusion = SYNC_EXCLUSIONS.find((entry) => entry.namespace === 'packMarks');
    assert.ok(exclusion && exclusion.reason.length > 40, 'packMarks is not excluded from sync for a written reason');
  });
});
