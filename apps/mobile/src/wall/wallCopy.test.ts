/**
 * Every sentence the subscription wall says, held to the rules it is written under.
 *
 * The interesting test in this file is the last one. It is not about the wall's
 * copy at all: it is about why this scan reads `WALL_COPY` and must never be
 * widened to the strings the wall renders. Widening it looks strictly safer and
 * would make the app refuse to display a real phrase from a real mission we
 * shipped, so the reason is written down where somebody about to widen it will
 * be standing.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { MISSIONS } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import * as copy from './wallCopy.ts';
import { PLANS_RENEWAL, WALL_COPY, YOURS_SUB, PLANS_TITLE } from './wallCopy.ts';
import { WELCOME_PATH } from './welcomePath.ts';

const SOURCE = readFileSync(fileURLToPath(new URL('./wallCopy.ts', import.meta.url)), 'utf8');

describe('the wall says nothing it is not allowed to say', () => {
  test('every line clears the guilt list, the em dash walk and the price rule', () => {
    assert.ok(WALL_COPY.length > 0, 'the wall says nothing at all');
    for (const line of WALL_COPY) {
      assert.equal(guiltIn(line), undefined, `guilt in wall copy: ${line}`);
      assert.doesNotMatch(line, /—/, `em dash in wall copy: ${line}`);
      // Every number the wall shows comes off the wire: a price from the store's
      // own localised string, an allowance from the PLANS catalogue the server
      // sends. A price compiled into a binary goes stale in a country nobody
      // checked, and an allowance compiled in is F266 with extra steps.
      assert.doesNotMatch(line, /\d/, `a digit in wall copy: ${line}`);
      assert.doesNotMatch(line, /[$€£]/, `a currency symbol in wall copy: ${line}`);
    }
  });

  test('the module itself carries no price and no allowance', () => {
    assert.doesNotMatch(SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''), /[$€£]\s*\d|\d+[.,]\d{2}/,
      'the module carries a price');
  });

  test('nothing this module exports is missing from the scan', () => {
    // The scan is only worth having if a line added tomorrow is in it. Every
    // string export is checked against the flattened list rather than trusted to
    // have been added by hand.
    const missing: string[] = [];
    for (const [name, value] of Object.entries(copy)) {
      if (name === 'WALL_COPY') continue;
      if (typeof value === 'string' && !WALL_COPY.includes(value)) missing.push(name);
      if (Array.isArray(value)) {
        for (const line of value as readonly string[]) {
          if (!WALL_COPY.includes(line)) missing.push(`${name}: ${line}`);
        }
      }
    }
    assert.deepEqual(missing, [], 'a line the wall can say is not covered by the scan');
  });
});

describe("the two promises the founder wrote, in their words", () => {
  test('the free promise is said once, and it is what stays rather than what stops', () => {
    assert.equal(YOURS_SUB, 'You can keep practising what you learned for free.');
    assert.equal(WALL_COPY.filter((line) => line === YOURS_SUB).length, 1);
  });

  test('the paid promise is about having conversations, not about keeping anything', () => {
    assert.equal(PLANS_TITLE, 'Keep having new real conversations');
    // The mechanism the founder chose, stated as a refusal: the wall converts on
    // wanting the next conversation and never on fearing the loss of the last one.
    for (const line of WALL_COPY) {
      assert.doesNotMatch(line, /\bexpires?\b|\bends (today|tonight|soon)\b|\bhurry\b|\blast chance\b|\bonly \w+ left\b/i,
        `urgency in wall copy: ${line}`);
      assert.doesNotMatch(line, /\bother learners\b|\bjoin \w+ (people|learners)\b|\bmost popular\b/i,
        `invented social proof in wall copy: ${line}`);
    }
  });
});

describe('no sentence carries a number that prose cannot keep true', () => {
  test('no line counts the situations on the path', () => {
    // "Four situations" would drift the day WELCOME_PATH changes, silently,
    // because prose does not typecheck. The rows say how many there are by
    // being there.
    const counts = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    for (const line of WALL_COPY) {
      for (const count of counts) {
        assert.doesNotMatch(line, new RegExp(`\\b${count}\\b (situation|room|plan)`, 'i'),
          `${line} counts something that can change`);
      }
    }
    assert.equal(WELCOME_PATH.length, 4, 'the path changed size, which is fine, and no sentence had to move');
  });

  test('the plans page says what a subscription is, which Apple asks for and a learner is owed', () => {
    assert.match(PLANS_RENEWAL, /renew/, 'the purchase surface does not say the plan renews');
    assert.match(PLANS_RENEWAL, /month/, 'the purchase surface does not say how long a period is');
    assert.match(PLANS_RENEWAL, /cancel/, 'the purchase surface does not say it can be cancelled');
  });
});

describe('the scan reads this module and never a phrase the wall renders', () => {
  test('a real mission phrase would be refused by the guilt list, which is why it is not scanned', () => {
    // This is the trap. `guiltIn` is a substring match over a lowercased line,
    // deliberately, because a false positive costs one sentence a rewrite and a
    // false negative ships guilt to a learner. The cost is that ordinary English
    // words contain banned ones.
    assert.equal(guiltIn('what time breakfast is'), 'break');
    assert.equal(guiltIn('allowed'), 'owe');
    assert.equal(guiltIn('however'), 'owe');
    assert.equal(guiltIn('a closer look'), 'lose');

    // And the hotel mission genuinely ships the phrase whose English is about
    // breakfast, so a scan widened from this module to the strings the wall
    // renders would make the app refuse to display a line from a mission we
    // shipped. The learner's own French is content; this module is chrome. Only
    // chrome is written by us, so only chrome is scanned.
    const hotel = MISSIONS.find((mission) => mission.id === 'mission:hotel');
    assert.ok(hotel);
    assert.ok(
      hotel.phraseKeys.some((key) => key.includes('petit déjeuner')),
      'the hotel mission no longer ships the breakfast phrase, so this test needs a new example rather than deleting',
    );
  });
});
