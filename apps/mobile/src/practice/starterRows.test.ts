/**
 * The starter rows — F574.
 *
 * Two things are held here. The first is that a learner's first sight of
 * Practice is the same three shapes as their second: same tints, same titles,
 * same order, drawn by the same components, so the page does not change kind
 * the morning after the first conversation.
 *
 * The second is the one that matters more. Every word on that page is authored,
 * and the page is called "Made from your conversations". So nothing here may
 * claim the learner said anything: no quote, no attribution, no field named for
 * something they produced. That is why this module builds a `PhraseToOwn` and
 * refuses to build a `Replay` — one of those has a `quote` in it.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { phraseKeyOf } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { MADE_FROM } from './madeFrom.ts';
import { MADE_FROM_TINT } from './madeFromTint.ts';
import { STARTER, starterFrom } from './starter.ts';
import { STARTER_DESTINATION, STARTER_PACK_ID, starterMomentRow, starterPhraseRow } from './starterRows.ts';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('the starter rows — the same three shapes, from authored material', () => {
  test('the starter draws the same three shapes a conversation would fill', () => {
    const moment = starterMomentRow();

    // Same tints, in the same order, as the made-from rows: peach for the
    // moment, sky for the phrase, sage for the sound. A learner who comes back
    // after their first conversation meets the page they already know.
    assert.equal(moment.tint, MADE_FROM_TINT.replay, 'the first row is not on the paper the moment row is always on');
    assert.equal(MADE_FROM_TINT.phrase, 'sky', 'the phrase row changed paper, and the starter follows it by construction');
    assert.equal(MADE_FROM_TINT.sound, 'sage', 'the sound row changed paper, and the starter follows it by construction');

    // Same title, because it is the same row doing the same job.
    assert.equal(moment.title, MADE_FROM.replay.label, 'the starter names its first row something the tab never says again');

    // And the one difference is the gloss, which says where the material came
    // from. That is the honest half: the learner has not made this yet.
    assert.equal(moment.gloss, STARTER.moment.lead, 'the first row does not say where the authored moment came from');
    assert.notEqual(moment.gloss, MADE_FROM.replay.gloss, 'the starter row claims to be made from a conversation there has not been');

    // Three destinations, each the only place its row can honestly go.
    assert.equal(moment.screen, 'Lesson', 'the authored moment opens something other than the lesson it belongs to');
    assert.equal(STARTER_DESTINATION.sound, 'Missions', 'the sound row opens a sound check for a sound nobody has measured');
  });

  test('the starter phrase opens the own-words drill on the café line, named as the café', () => {
    const starter = starterFrom();
    const phrase = starterPhraseRow(starter);

    assert.equal(phrase.fr, starter.phrase.fr, 'the row offers a different French line than the one the lesson opens with');
    assert.equal(phrase.en, starter.phrase.en, 'the row offers a meaning that is not the line\'s own');
    assert.equal(phrase.key, phraseKeyOf(starter.phrase.fr), 'the phrase key is not the deck\'s own key for that line');
    assert.equal(phrase.packId, STARTER_PACK_ID, 'the starter phrase claims a conversation pack that does not exist');

    // `from` is what the drill shows as the situation. It is the starter's own
    // sentence, not a conversation title, because there is no conversation.
    assert.equal(phrase.from, STARTER.phrase.lead, 'the drill would name a conversation the learner has not had');

    // Neither claim is made about a learner who has done nothing yet.
    assert.equal(phrase.saved, false, 'the starter phrase says it is already in the phrase bank');
    assert.equal(phrase.sayable, false, 'the starter phrase claims a scoped sitting would have something in it');
  });

  test('nothing the starter rows say claims the learner said it', () => {
    const moment = starterMomentRow();
    const phrase = starterPhraseRow(starterFrom());

    // The words, against the same bar every surface under practice/ holds.
    for (const line of [moment.title, moment.gloss, phrase.from]) {
      assert.ok(line.length > 0, 'a row with no words is a row a screen reader cannot announce');
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d|%/, `"${line}" carries an em dash, a digit or a percentage`);
    }

    // And the structural half: this module does not build a `Replay`. That type
    // carries `quote`, which means "what you said", and a first-evening learner
    // has not said anything. A `Replay` assembled here would be a fabricated
    // quote sitting one render away from `MomentCard` printing it under "What
    // you said", which no test downstream would catch because the shape would
    // be valid.
    const source = read('./starterRows.ts');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bquote\b/.test(code), 'the starter builds a quote, and a learner with no conversation has not said one');
    assert.ok(!/:\s*Replay\b/.test(code), 'the starter shapes its moment as a Replay, which has a field claiming the learner spoke');
  });
});
