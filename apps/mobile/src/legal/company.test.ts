/**
 * The company facts, and the two that are not supplied yet — F474.
 *
 * The interesting half of this module is the absence. Two of the three literals
 * are `null` today, so every consumer has a branch that draws nothing, and a
 * branch that is only exercised in production is a branch nobody has seen. Each
 * one is driven here from both sides: unset, and set.
 *
 * The last test is a source walk rather than a value assertion, because the
 * failure it exists to catch is not a wrong string in this file. It is a screen
 * spelling an address or a company name itself, which is how the app ends up
 * with two answers to "who is this" and the wrong one on the screen a learner
 * reads. Both supplied mockups did exactly that, in France, under a name that
 * is not ours.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import {
  COMPANY,
  CONTACT_ROW,
  LEGAL_REVIEW_PENDING,
  companyFrom,
  companyLine,
  contactRow,
  privacyNote,
  type CompanyFacts,
} from './company.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));

/** A full set of facts, so a test can set one field and mean it. */
function facts(over: Partial<CompanyFacts> = {}): CompanyFacts {
  return companyFrom({ registeredName: 'Vision Strategies Ltd', companyNumber: null, supportEmail: null, ...over });
}

describe('the company facts — F474', () => {
  test('an unset fact renders nothing, never a dead row', () => {
    // Today's shipped state: a name, and two facts nobody has supplied.
    assert.equal(COMPANY.registeredName, 'Vision Strategies Ltd');
    assert.equal(COMPANY.companyNumber, null, 'the Companies House number is set, so the ledger entry can be closed');
    assert.equal(COMPANY.supportEmail, null, 'the support address is set, so the Contact row can be drawn');
    assert.equal(contactRow(COMPANY), null, 'a Contact row was offered with no address behind it');

    // Everything that is not an address is not an address. A note to self, a
    // phone number and a placeholder all reach here the same way: somebody
    // filled the literal in to see the row appear.
    for (const raw of ['', '   ', 'TBC', 'tbd', 'todo', 'support', 'support at luvani', '07700 900000', 'a b@c.d']) {
      assert.equal(contactRow(facts({ supportEmail: raw })), null, `"${raw}" was accepted as an address`);
    }

    // And the refutation, so the branch that draws it is real too.
    const real = contactRow(facts({ supportEmail: '  hello@example.com  ' }));
    assert.deepEqual(real, { label: CONTACT_ROW, address: 'hello@example.com' }, 'a real address is not drawn');
    assert.doesNotMatch(CONTACT_ROW, /\d|[—–]/, 'the Contact label counts or carries an em dash');

    // The note is the one consumer that is never absent, because what it says
    // is true whether or not there is anywhere to write to. What changes is the
    // last sentence.
    assert.doesNotMatch(privacyNote(facts()), /reach us/, 'the note offers a contact with no address behind it');
    assert.match(privacyNote(facts({ supportEmail: 'hello@example.com' })), /You can reach us at hello@example\.com\./);
  });

  test('the company is named as registered in the UK, or not named at all', () => {
    assert.equal(companyLine(facts()), 'Vision Strategies Ltd, registered in the UK.');
    assert.equal(
      companyLine(facts({ companyNumber: '01234567' })),
      'Vision Strategies Ltd, registered in the UK. Company number 01234567.',
      'the number is not a second sentence, so its absence would leave a dangling clause',
    );
    assert.equal(companyLine(facts({ registeredName: null })), null, 'a nameless company still drew a line');
    assert.equal(companyLine(facts({ registeredName: 'TBC' })), null, 'a placeholder reached a learner');

    // The jurisdiction is the fact both mockups got wrong. France, an SAS, and
    // an EU regulation number are refused by the founder's decision, not by
    // taste, and the only line that says where we are registered is this one.
    const line = companyLine(facts())!;
    assert.match(line, /registered in the UK\./, 'the company line stopped saying where the company is registered');
    assert.doesNotMatch(line, /France|SAS|EU|2016\/679/i, 'the company line places us somewhere we are not');

    // House voice, on every sentence this module can put on a screen.
    for (const line of [privacyNote(facts()), privacyNote(facts({ supportEmail: 'hello@example.com' })), companyLine(facts())!, CONTACT_ROW]) {
      assert.equal(guiltIn(line), undefined, `guilt in company copy: ${line}`);
      assert.doesNotMatch(line, /[—–]/, `em dash in company copy: ${line}`);
    }

    // The paragraph keeps saying a review is owing. Accurate words are not
    // cleared words, and the app must not imply otherwise.
    assert.ok(privacyNote(facts()).includes(LEGAL_REVIEW_PENDING), 'the note stopped naming the legal-review gate');
  });

  test('every fact the screen shows about the company comes from one module', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
      });

    // The name and the jurisdiction, anywhere in the app. One module says who
    // we are; anything else that says it is a second answer waiting to disagree.
    for (const file of walk(SRC)) {
      if (file.endsWith(join('legal', 'company.ts'))) continue;
      const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const rel = file.slice(SRC.length);
      assert.doesNotMatch(source, /Vision Strategies|registered in the UK|Company number /, `${rel} writes a company fact itself`);
    }

    // An address, on the surfaces that draw one. Narrower than the whole app on
    // purpose: the sign-in screens carry `you@example.com` as a placeholder in
    // a text field and the dev-only mock adapter keys accounts by one, and
    // neither is a claim about who to write to.
    const SURFACES = ['legal', 'settings', 'tabs', 'profile', 'onboarding'];
    for (const dir of SURFACES.map((name) => join(SRC, name)).filter((path) => existsSync(path))) {
      for (const file of walk(dir)) {
        if (file.endsWith(join('legal', 'company.ts'))) continue;
        const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        assert.doesNotMatch(
          source,
          /['"`][A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}['"`]/,
          `${file.slice(SRC.length)} spells an address, which is the one thing that must be absent until it is set`,
        );
      }
    }
  });
});
