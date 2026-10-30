/**
 * The hosted page and the screen are one source — F480.
 *
 * The failure this exists to catch has a shape: somebody improves a sentence in
 * `policy.ts`, the app ships the better one, and the page at the URL in the
 * store listing goes on saying the old one because regenerating it is a step
 * nobody remembers. A reviewer comparing the two is how a resubmission is
 * refused, and nothing in the repo would have said a word.
 *
 * So the check is a test rather than a step in `scripts/gate.mjs`. It rides
 * `npm test`, which the gate already runs, and it needs no change to a
 * carefully ordered gate file to keep working.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { LEGAL_REVIEW_PENDING, companyFrom } from './company.ts';
import { POLICY_INTRO, POLICY_TITLE } from './policy.ts';
import {
  indexHtml,
  indexTitle,
  legalPages,
  privacyHtml,
  supportHtml,
  supportSummary,
  SUPPORT_ANSWERS,
  SUPPORT_INTRO,
  SUPPORT_NO_ADDRESS,
  SUPPORT_TITLE,
} from './html.ts';

const DIST = fileURLToPath(new URL('./dist/', import.meta.url));
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** The facts as they will read once the two owed ones arrive. */
const SUPPLIED = companyFrom({
  registeredName: 'Vision Strategies Ltd',
  companyNumber: '01234567',
  supportEmail: 'hello@example.com',
});

describe('the hosted legal pages — F480', () => {
  test('the generated pages carry no script and no external asset', () => {
    // A privacy notice that fetches something from a third party while it is
    // being read is a joke at the reader's expense. It also has to answer on a
    // first visit from a reviewer on an unknown network, so everything it needs
    // is in the one file.
    for (const { file, html } of [...legalPages(), ...legalPages(SUPPLIED)]) {
      assert.doesNotMatch(html, /<script|onload=|onclick=|javascript:/i, `${file} carries a script`);
      assert.doesNotMatch(html, /<link\b|<img\b|<iframe\b|<video\b|<audio\b/i, `${file} loads an external asset`);
      assert.doesNotMatch(html, /@import|url\(/i, `${file} pulls in a stylesheet or a webfont`);
      assert.doesNotMatch(html, /https?:\/\//i, `${file} reaches off the page`);

      // Readable on a phone, and legal HTML rather than a fragment.
      assert.match(html, /^<!doctype html>\n<html lang="en">/, `${file} is not a whole page`);
      assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/, `${file} has no viewport`);
      assert.match(html, /<title>[^<]+ \| Luvani<\/title>/, `${file} has no title`);
      assert.ok(html.endsWith('</html>\n'), `${file} does not end where a file should`);

      // The trader is identifiable on the page itself, not only in the app.
      assert.match(html, /Vision Strategies Ltd, registered in the UK\./, `${file} does not say whose page it is`);
    }
  });

  test('the hosted policy page carries no internal legal review note', () => {
    // F929: the founder uploads dist/ for the App Store listing, which is the
    // production app's notice, so it is rendered as production renders it.
    const sentence = LEGAL_REVIEW_PENDING;
    assert.ok(!privacyHtml().includes(sentence), 'the hosted notice tells learners about an internal review');
    assert.ok(!readFileSync(join(DIST, 'privacy.html'), 'utf8').includes(sentence), 'the committed privacy.html still carries the review note');
  });

  test('the gate fails when the committed html no longer matches the module', () => {
    // The committed file has to exist. The founder uploads this folder by hand,
    // so a page that only appears after somebody runs a script is a page that
    // goes up stale, or does not go up at all.
    const how = 'run `npm run legal:html` and commit apps/mobile/src/legal/dist';

    // Every file that goes up is named here, so a stale root fails the same way
    // a stale notice does. F487 added the root; a page dropped from this list
    // would otherwise leave the drift check quietly covering less than it did.
    assert.deepEqual(
      legalPages().map(({ file }) => file),
      ['index.html', 'privacy.html', 'support.html'],
      `the set of generated pages changed, so the drift check no longer covers what is uploaded: ${how}`,
    );
    for (const { file, html } of legalPages()) {
      const path = join(DIST, file);
      assert.ok(existsSync(path), `legal/dist/${file} is missing: ${how}`);
      assert.equal(
        readFileSync(path, 'utf8'),
        html,
        `legal/dist/${file} no longer matches the module, so the hosted page and the screen disagree: ${how}`,
      );
    }

    // And the command the failure names is real.
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    assert.match(pkg.scripts['legal:html'] ?? '', /scripts\/legal-html\.mjs/, 'npm run legal:html is gone');
    assert.match(
      readFileSync(join(ROOT, 'scripts', 'legal-html.mjs'), 'utf8'),
      /legalPages/,
      'the script stopped rendering the module these pages come from',
    );
  });

  test('the support page is generated but names no address until one is set', () => {
    const unset = supportHtml(companyFrom({ registeredName: 'Vision Strategies Ltd', companyNumber: null, supportEmail: null }));
    assert.ok(unset.includes(SUPPORT_NO_ADDRESS), 'the support page invented a way to be reached');
    assert.doesNotMatch(unset, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'the support page spells an address');

    const set = supportHtml(SUPPLIED);
    assert.match(set, /The way to reach us is by email, at hello@example\.com\./, 'a supplied address is never drawn');
    assert.ok(!set.includes(SUPPORT_NO_ADDRESS), 'the page still says it has no address after one was set');

    // What the page answers is checkable: the store handles subscriptions, and
    // both data rows are in the app. Nothing here promises a reply time.
    assert.equal(SUPPORT_ANSWERS.length, 3, 'the support page stopped answering the three things it is asked');
    for (const line of [SUPPORT_TITLE, SUPPORT_INTRO, SUPPORT_NO_ADDRESS, ...SUPPORT_ANSWERS.flatMap((a) => [a.question, a.answer])]) {
      assert.ok(line.trim().length > 0, 'a support line is empty');
      assert.equal(guiltIn(line), undefined, `guilt in support copy: ${line}`);
      assert.doesNotMatch(line, /[—–]/, `em dash in support copy: ${line}`);
    }
    assert.doesNotMatch(
      SUPPORT_ANSWERS.map((a) => a.answer).join(' '),
      /within \w+ (hours|days)|we will reply|guarantee/i,
      'the support page promises a reply nobody has committed to',
    );
  });
});

/** The same four characters `html.ts` takes out, so a comparison is like for like. */
function escaped(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Everything the root actually says, one line of text at a time. */
function textOf(html: string): string[] {
  const main = html.slice(html.indexOf('<main>'), html.indexOf('</main>'));
  return main
    .split('\n')
    .map((line) => line.replace(/<[^>]*>/g, '').trim())
    .filter((line) => line.length > 0);
}

describe('the root of the hosted site — F487', () => {
  test('the generated site answers at its root and names both pages', () => {
    // `npm run legal:html` wrote two files and nothing else, so the bare address
    // answered 404 from the day the site went up. Apple only opens the two URLs
    // it is given, so nothing was blocked; what met a 404 was anybody who
    // trimmed the path back, or who was read the address aloud and typed the
    // short form of it. Cloudflare serves `index.html` at `/`, which is why the
    // file is named that and not something prettier.
    const root = legalPages().find(({ file }) => file === 'index.html');
    assert.ok(root, 'the generator writes no index.html, so the bare address answers nothing');

    // Committed, like the other two, because the folder is uploaded by hand.
    const path = join(DIST, 'index.html');
    assert.ok(existsSync(path), 'legal/dist/index.html is missing: run `npm run legal:html` and commit apps/mobile/src/legal/dist');
    assert.equal(readFileSync(path, 'utf8'), root.html, 'legal/dist/index.html no longer matches the module');

    // Both pages, by their own names, and reachable.
    assert.match(root.html, new RegExp(`>${escaped(POLICY_TITLE)}</a>`), 'the root stopped naming the privacy notice');
    assert.match(root.html, new RegExp(`>${escaped(SUPPORT_TITLE)}</a>`), 'the root stopped naming the support page');

    // The clean paths, not the file names. Cloudflare answers `privacy.html`
    // with a 308 to `/privacy`, and a link that redirects is a link a reviewer's
    // checker meets as a 308 rather than a 200.
    assert.deepEqual(
      [...root.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
      ['/privacy', '/support'],
      'the root links to the file names rather than to the addresses they are served at',
    );

    // A signpost rather than a page with content of its own, and short.
    assert.ok(textOf(root.html).length <= 8, 'the root grew content of its own');
    for (const line of [indexTitle(), supportSummary()]) {
      assert.ok(line.trim().length > 0, 'a line on the root is empty');
      assert.equal(guiltIn(line), undefined, `guilt on the root: ${line}`);
      assert.doesNotMatch(line, /[—–]/, `em dash on the root: ${line}`);
    }
  });

  test('the index is built from the same module as the pages it links to', () => {
    // Hand written, this page is the one that goes stale first: it is the file
    // nobody edits when the notice is renamed, and the file nobody deletes when
    // a page stops being generated. So it holds no words of its own. Every line
    // on it is a string the page it points at already uses, and every link is
    // built from the file name that page is actually written to.
    const index = indexHtml();
    const others = legalPages().filter(({ file }) => file !== 'index.html');

    // One link per page below the root, and every one of them resolves to a
    // file this module really writes.
    const targets = [...index.matchAll(/href="([^"]+)"/g)].map((m) => `${m[1]?.slice(1)}.html`);
    assert.deepEqual(targets, others.map(({ file }) => file), 'the root links to a page this module does not build');

    // The title is the notice's own, so renaming the notice renames the root
    // rather than leaving a signpost pointing at a name that no longer exists.
    assert.equal(indexTitle(), `${POLICY_TITLE} and ${SUPPORT_TITLE.toLowerCase()}`);
    assert.match(index, new RegExp(`<title>${escaped(indexTitle())} \\| Luvani</title>`), 'the root titles itself');

    // What support answers is read off the support page's own answers, so a
    // fourth one appears here and the root can promise nothing extra.
    for (const { question } of SUPPORT_ANSWERS) {
      const lowered = `${question[0]?.toLowerCase() ?? ''}${question.slice(1)}`;
      assert.ok(
        supportSummary().includes(question) || supportSummary().includes(lowered),
        `the root stopped naming something the support page answers: ${question}`,
      );
    }

    // And nothing else is said on it. Every line of text is one of the strings
    // the other modules already own, which is what makes drift impossible here
    // rather than merely unlikely.
    const owned = new Set(
      [indexTitle(), SUPPORT_INTRO, POLICY_TITLE, POLICY_INTRO, SUPPORT_TITLE, supportSummary(), 'Vision Strategies Ltd, registered in the UK.'].map(
        escaped,
      ),
    );
    for (const line of textOf(index)) {
      assert.ok(owned.has(line), `the root says something no page it links to says: ${line}`);
    }
  });
});
