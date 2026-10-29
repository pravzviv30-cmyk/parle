/**
 * The same words, as a page that can be hosted.
 *
 * App Store Connect asks for a privacy policy at a URL and a support URL, and
 * Apple asks for the policy to be reachable inside the app as well. That is two
 * surfaces for one document, and two copies maintained by hand disagree the
 * first time one of them is edited. So there is one source, `policy.ts`, and
 * this renders it. `scripts/legal-html.mjs` writes the result to
 * `legal/dist/`, and `html.test.ts` regenerates it and fails when the committed
 * file no longer matches, which catches the drift here rather than at review.
 *
 * ## Deliberately plain
 *
 * No script, no external asset, no webfont, no analytics. Partly because a
 * privacy notice that phones a third party while it is being read is a joke at
 * the reader's expense, and partly because the page has to answer on a first
 * visit from a reviewer with an unknown network. Everything it needs is in the
 * one file: system fonts, one inline stylesheet, and text.
 *
 * The colours come from `palette.ts` rather than being typed here, so the page
 * and the app are the same document in two places rather than two designs.
 */

import { paper } from '../palette.ts';
import { companyLine, contactRow, legalReviewNoteShown, type CompanyFacts, COMPANY } from './company.ts';
import { POLICY_INTRO, POLICY_TITLE, policySections } from './policy.ts';

/** What the support page is called, in its title bar and on the page. */
export const SUPPORT_TITLE = 'Support';

/** What Luvani is, for somebody who arrived at this page from a store listing. */
export const SUPPORT_INTRO = 'Luvani is an app for practising spoken French with an AI tutor.';

/** The three answers a support page is actually asked for. */
export const SUPPORT_ANSWERS: readonly { question: string; answer: string }[] = [
  {
    question: 'Managing your subscription',
    answer: 'Subscriptions are handled by the App Store, under your Apple Account, and can be cancelled there at any time.',
  },
  {
    question: 'Deleting your account',
    answer: 'Settings inside the app has Delete account. It removes your account and the learning tied to it.',
  },
  {
    question: 'Getting your data',
    answer: 'Settings also has Download my data, which writes a file with everything we hold for you.',
  },
];

/**
 * What the page says while no address is set.
 *
 * It is written to be a warning as much as a sentence. If this ever appears on
 * a hosted page, the page went up before it was ready, and it says so rather
 * than leaving a reviewer to find a support page with no support on it.
 */
export const SUPPORT_NO_ADDRESS = 'An address for support is not set yet, so this page is not ready to be published.';

/**
 * The address Cloudflare serves one of these files at.
 *
 * Uploading `privacy.html` publishes it at `/privacy`, and the `.html` form
 * answers a 308 redirect to the clean one (`docs/LEGAL_HOSTING.md`). So the
 * root links to the clean path: a link that redirects is one an App Review
 * checker meets as a 308 rather than a 200. This is the only place in the repo
 * that knows the rewrite exists, and it derives the path from the file name so
 * a page cannot be linked under a name it was not written under.
 */
function hosted(file: string): string {
  return `/${file.replace(/\.html$/, '')}`;
}

/** HTML text, with the four characters that could end an element taken out. */
function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * One stylesheet, inline, sized for a phone held in one hand.
 *
 * A measure in `ch` rather than pixels, generous line height, and nothing that
 * needs a download. The dark scheme is one media query rather than a theme,
 * because a static page has no state to keep.
 */
function style(): string {
  return [
    `:root { color-scheme: light dark; }`,
    `body { margin: 0; background: ${paper.ground}; color: ${paper.ink};`,
    `  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;`,
    `  font-size: 17px; line-height: 1.6; }`,
    `main { max-width: 38rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }`,
    `h1 { font-size: 1.8rem; line-height: 1.2; margin: 0 0 0.5rem; }`,
    `h2 { font-size: 1.15rem; line-height: 1.3; margin: 2.5rem 0 0.5rem; }`,
    `p { margin: 0 0 1rem; }`,
    `.lede { color: ${paper.inkSoft}; font-size: 1.05rem; }`,
    `footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid ${paper.groundDeep};`,
    `  color: ${paper.inkSoft}; font-size: 0.95rem; }`,
    `a { color: inherit; }`,
    `@media (prefers-color-scheme: dark) {`,
    `  body { background: ${paper.ink}; color: ${paper.ground}; }`,
    `  .lede, footer { color: ${paper.groundDeep}; }`,
    `  footer { border-top-color: ${paper.inkSoft}; }`,
    `}`,
  ].join('\n');
}

/** The shell every page shares: no script, no asset, one stylesheet. */
function page(title: string, body: readonly string[], facts: CompanyFacts): string {
  const company = companyLine(facts);
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escape(`${title} | Luvani`)}</title>`,
    '<style>',
    style(),
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    ...body,
    '<footer>',
    ...(company === null ? [] : [`<p>${escape(company)}</p>`]),
    '</footer>',
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

/**
 * The privacy notice, section for section, exactly as the production app draws
 * it. The founder uploads this page for the App Store listing, which is the
 * production app's notice, so it carries no internal legal review note (F929).
 */
export function privacyHtml(facts: CompanyFacts = COMPANY): string {
  const body = [`<h1>${escape(POLICY_TITLE)}</h1>`, `<p class="lede">${escape(POLICY_INTRO)}</p>`];
  for (const section of policySections(facts, legalReviewNoteShown('production'))) {
    body.push(`<h2>${escape(section.heading)}</h2>`);
    for (const paragraph of section.body) body.push(`<p>${escape(paragraph)}</p>`);
  }
  return page(POLICY_TITLE, body, facts);
}

/**
 * The support page, which names an address only once there is one.
 *
 * Generated either way on purpose. A page that only exists after a missing fact
 * arrives is a page nobody has ever looked at, and this one is going in front of
 * an App Review reviewer.
 */
export function supportHtml(facts: CompanyFacts = COMPANY): string {
  const contact = contactRow(facts);
  const body = [
    `<h1>${escape(SUPPORT_TITLE)}</h1>`,
    `<p class="lede">${escape(SUPPORT_INTRO)}</p>`,
    `<p>${escape(contact === null ? SUPPORT_NO_ADDRESS : `The way to reach us is by email, at ${contact.address}.`)}</p>`,
  ];
  for (const { question, answer } of SUPPORT_ANSWERS) {
    body.push(`<h2>${escape(question)}</h2>`, `<p>${escape(answer)}</p>`);
  }
  body.push('<h2>Privacy</h2>', '<p><a href="privacy.html">What Luvani keeps about you</a></p>');
  return page(SUPPORT_TITLE, body, facts);
}

/**
 * What the support page answers, as one line for the page that links to it.
 *
 * Assembled from `SUPPORT_ANSWERS` rather than typed again, so a fourth answer
 * appears on the root the moment it is added and the root can never promise an
 * answer the support page does not give.
 */
export function supportSummary(): string {
  const parts = SUPPORT_ANSWERS.map(({ question }, i) => (i === 0 ? question : `${question[0]?.toLowerCase() ?? ''}${question.slice(1)}`));
  const last = parts.pop() ?? '';
  return `${parts.length === 0 ? last : `${parts.join(', ')} and ${last}`}.`;
}

/**
 * What the root page is called, in its title bar and on the page.
 *
 * The two pages under it, named by them. A notice that is renamed renames this
 * as well, which is the point: the root is a signpost, and a signpost carrying
 * its own name for a place is how somebody ends up at the wrong one.
 */
export function indexTitle(): string {
  return `${POLICY_TITLE} and ${SUPPORT_TITLE.toLowerCase()}`;
}

/** Every page below the root, each one named by the module that renders it. */
function pagesBelowRoot(facts: CompanyFacts): readonly { file: string; title: string; lede: string; html: string }[] {
  return [
    { file: 'privacy.html', title: POLICY_TITLE, lede: POLICY_INTRO, html: privacyHtml(facts) },
    { file: 'support.html', title: SUPPORT_TITLE, lede: supportSummary(), html: supportHtml(facts) },
  ];
}

/**
 * The root of the hosted site: a signpost, and nothing else — F487.
 *
 * Apple only ever opens the two addresses it is given, so this blocks no
 * submission. It exists for the person who trims the path back, or who was read
 * the address aloud and typed the short version, and met a 404 where a company
 * should have been.
 *
 * It has no content of its own. Every word on it comes from the modules that
 * render the pages it points at, so it cannot name a page that was not built,
 * cannot link to one under a name it was not written under, and cannot go on
 * calling the notice something the notice stopped calling itself.
 */
export function indexHtml(facts: CompanyFacts = COMPANY): string {
  const body = [`<h1>${escape(indexTitle())}</h1>`, `<p class="lede">${escape(SUPPORT_INTRO)}</p>`];
  for (const { file, title, lede } of pagesBelowRoot(facts)) {
    body.push(`<h2><a href="${escape(hosted(file))}">${escape(title)}</a></h2>`, `<p>${escape(lede)}</p>`);
  }
  return page(indexTitle(), body, facts);
}

/** Every page this module renders, named the way the hosted file is named. */
export function legalPages(facts: CompanyFacts = COMPANY): readonly { file: string; html: string }[] {
  return [
    { file: 'index.html', html: indexHtml(facts) },
    ...pagesBelowRoot(facts).map(({ file, html }) => ({ file, html })),
  ];
}
