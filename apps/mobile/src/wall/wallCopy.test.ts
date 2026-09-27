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
import { PLANS_RENEWAL, WALL_COPY, YOURS_BANK, YOURS_SUB, PLANS_TITLE } from './wallCopy.ts';
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

describe('the sentences with a number in them keep the numbers off the page', () => {
  // 2026-09-27, notebook Phase 6-E. The plans now read in minutes and in
  // conversations, so some sentences need a number. They are functions of the
  // number, and every digit they print is one they were handed: the catalogue's,
  // the server's, or the one stated conversation length in wallPlans.ts.
  test('every sentence template clears the guilt list and the em dash, and prints only the digits it is given', () => {
    const templates = Object.entries(copy).filter(([, value]) => typeof value === 'function') as [string, (...args: unknown[]) => string][];
    assert.ok(templates.length > 0, 'the wall has no sentence with a number in it');
    for (const [name, template] of templates) {
      for (const sample of [0, 1, 4, 30]) {
        const line = template(...Array.from({ length: Math.max(1, template.length) }, () => sample));
        assert.equal(typeof line, 'string', `${name} does not say a sentence`);
        assert.equal(guiltIn(line), undefined, `guilt in ${name}: ${line}`);
        assert.doesNotMatch(line, /—/, `em dash in ${name}: ${line}`);
        assert.doesNotMatch(line.split(String(sample)).join(''), /\d/, `${name} printed a digit it was not given: ${line}`);
        assert.doesNotMatch(line, /[$€£]/, `a currency symbol in ${name}: ${line}`);
      }
    }
  });

  test('one of anything is singular', () => {
    for (const [name, template] of Object.entries(copy)) {
      if (typeof template !== 'function') continue;
      const line = (template as (...args: unknown[]) => string)(...Array.from({ length: Math.max(1, template.length) }, () => 1));
      assert.doesNotMatch(line, /\b1 (minutes|conversations)\b/, `${name} says one in the plural: ${line}`);
    }
  });
});

describe('the phrase bank is described as what it actually keeps', () => {
  test('no line claims the app kept every line the learner said', () => {
    // 2026-09-27, notebook Phase 6-E (report change 23). The bank holds the
    // phrases each session's recap and each conversation's pack picked out
    // (review/store.ts: addFromSummary, addPhrases). No transcript is kept, and
    // a Conversation Pack is curated learning data, never a readable transcript
    // (docs/STATE_AND_STORAGE.md). "Every line you have said" was not true.
    for (const line of WALL_COPY) {
      assert.doesNotMatch(line, /every (line|word|sentence) you|everything you (have )?said|all you (have )?said|transcript/i,
        `the wall claims the app kept more than it does: ${line}`);
    }
    assert.match(YOURS_BANK, /phrase bank/i);
    assert.match(YOURS_BANK, /phrases/i, 'the bank line no longer says it holds phrases');
    assert.match(YOURS_BANK, /conversations/i, 'the bank line no longer says where the phrases came from');
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
