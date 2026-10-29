import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { missReason } from './missReason.ts';
import { answerCurrent } from './session.ts';
import { DRILL_FIXTURES } from './fixtures.ts';

describe('the reason a miss shows — LEARN-017', () => {
  test('the reason is the right item\'s own French and English, one short line', () => {
    for (const exercise of DRILL_FIXTURES) {
      const reason = missReason(exercise);
      if (exercise.kind === 'own-words' || exercise.kind === 'listen-type') {
        assert.equal(reason, null, `${exercise.id} has no right string with a meaning to show`);
        continue;
      }
      assert.ok(reason, exercise.id);
      assert.match(reason, /^[^=\n]+ = [^=\n]+$/, `${exercise.id}: "${reason}"`);
      assert.doesNotMatch(reason, /___/, `${exercise.id} left the blank in`);
    }
  });

  test('a fill-blank shows the whole sentence filled, with its meaning', () => {
    assert.equal(
      missReason({ id: 'x', phraseKey: 'p', kind: 'fill-blank', sentence: 'Je vais ___ un café.', options: null, accepted: ['prendre'], en: "I'll have a coffee." } as never),
      "Je vais prendre un café. = I'll have a coffee.",
    );
  });

  test('a choice shows the right option, not the pick', () => {
    assert.equal(
      missReason({ id: 'x', phraseKey: 'p', kind: 'best-sentence', prompt: 'Order', candidates: [{ fr: 'Bonjour', en: 'Hello' }, { fr: 'je vais prendre', en: "I'll have" }], correctIndex: 1 } as never),
      "je vais prendre = I'll have",
    );
  });
});

describe('the reason names the form the sheet shows — F919 verifier', () => {
  const sit = (e: unknown) => ({ queue: [e as never], missesById: {}, answered: [], startedAt: 0, finished: false });
  test('a miss near the second accepted answer builds the reason from that answer', () => {
    const fill = { id: 'f', phraseKey: 'p', kind: 'fill-blank', difficulty: 'production', sentence: "J'envoie un ___.", options: null, accepted: ['SMS', 'texto'], en: "I'm sending a text." };
    const fb = answerCurrent(sit(fill), 'textoo zzz').feedback!;
    assert.equal(fb.closest, 'texto');
    assert.equal(missReason(fill as never, fb.closest), "J'envoie un texto. = I'm sending a text.");
    const tap = { id: 't', phraseKey: 'p', kind: 'tap-translate', difficulty: 'production', en: 'Thanks a lot', tokens: [], accepted: ['merci', 'merci beaucoup'] };
    const fb2 = answerCurrent(sit(tap), 'merci beaucoupp zz').feedback!;
    assert.equal(fb2.closest, 'merci beaucoup');
    assert.equal(missReason(tap as never, fb2.closest), 'merci beaucoup = Thanks a lot');
    const tr = { id: 'r', phraseKey: 'p', kind: 'translate', difficulty: 'production', fr: 'Ça sera tout, merci', en: "That's all, thanks", direction: 'en-fr', accepted: ['Ça sera tout, merci', 'merci beaucoup'] };
    assert.equal(missReason(tr as never, 'merci beaucoup'), "merci beaucoup = That's all, thanks");
    const back = { ...tr, direction: 'fr-en', accepted: ["That's all, thanks", 'that is everything thanks'] };
    assert.equal(missReason(back as never, 'that is everything thanks'), 'Ça sera tout, merci = that is everything thanks');
  });

  test('a listen-type first miss keeps the transcript hidden; the second shows it', () => {
    const l = { id: 'l', phraseKey: 'p', kind: 'listen-type', difficulty: 'production', fr: 'Ça marche', accepted: ['ça marche'] };
    const first = answerCurrent(sit(l), 'zzz');
    assert.equal(first.feedback!.closest, null, 'the retry no longer tests listening');
    assert.equal(answerCurrent(first.state, 'zzz').feedback!.closest, 'ça marche');
  });

  test('a missed item comes back with two others between it, where the queue has them', () => {
    const ex = (id: string) => ({ id, phraseKey: id, kind: 'listen-type', difficulty: 'production', fr: id, accepted: [id] });
    const s = { queue: [ex('a'), ex('b'), ex('c'), ex('d')] as never[], missesById: {}, answered: [], startedAt: 0, finished: false };
    const q = answerCurrent(s, 'zzz').state.queue.map((e) => e.id);
    assert.ok(q.indexOf('a') >= 2, `came back too soon: ${q.join(',')}`);
  });
});
