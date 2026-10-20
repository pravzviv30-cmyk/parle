/**
 * The 402, and what a learner who has run out is actually told — F251, F168.
 *
 * The token server answers a session it will not grant with three things: a
 * machine-readable refusal code, a sentence, and the whole plan catalogue. The
 * hook used to cast all of that down to `{ message?: string }`, so the code and
 * the catalogue were parsed away at the door and the sentence was rendered raw.
 * Both halves of that were wrong, and this file holds both.
 *
 * The sentence half is the one a learner felt. One of the server's lines reads
 * "The introductory minutes for this installation have already been used by
 * another account." — an internal noun and an accusation, shown to somebody who
 * has done nothing. `failure.ts` already discards the server's prose for every
 * other 4xx and answers from a closed local table; the 402 was the single path
 * that escaped that rule, and its own comment said so.
 *
 * ## How this tests a file it cannot import
 *
 * Same harness as useLiveSession.test.ts and startOwnership.test.ts, and for
 * the same reason: the hook reaches expo-modules-core through globals.ts, which
 * node's type stripping refuses to load. So the production text is LIFTED out
 * of the file exactly as the file writes it — the copy table, the two parsers
 * and the 402 branch — and run with every free name supplied by hand. A
 * fragment that reaches for something this harness has not thought about throws
 * a ReferenceError rather than quietly passing.
 *
 * The bodies it is fed are not invented either. Two come from `canStartSession`
 * in core, which is the function whose refusal the server forwards, and the
 * third is read out of the token server's own source. If either side changes
 * its words, this file says so rather than agreeing with itself.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { PLANS, canStartSession, type Entitlement, type Plan } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const hook = read('./useLiveSession.ts');
const server = read('../../../../services/token-server/src/server.ts');

/* ------------------------------------------------------------------------- *
 * The harness: production text, lifted and run.
 * ------------------------------------------------------------------------- */

/**
 * From `header` — which must end in its own opening bracket — to the bracket
 * that closes it. Nothing lifted below carries an unbalanced bracket inside a
 * string or a comment, and if one ever does the generated function fails to
 * parse, which is a failure and not a false pass.
 */
function fragmentAt(source: string, start: number, header: string): string {
  const open = header.trimEnd().slice(-1);
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start + header.lastIndexOf(open); i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    else if (source[i] === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`"${header}" is never closed`);
}

function fragment(source: string, header: string): string {
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `this test reads the hook for "${header}" and the hook no longer writes it`);
  return fragmentAt(source, start, header);
}

/** A fragment as plain JavaScript, through node's own stripper. */
function asJs(source: string): string {
  const wrapped = stripTypeScriptTypes(`async function lifted() {\n${source}\n}`);
  return wrapped.slice(wrapped.indexOf('{') + 1, wrapped.lastIndexOf('}'));
}

const AsyncFunction = Object.getPrototypeOf(async (): Promise<void> => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;

async function runAsync(source: string, world: Record<string, unknown>): Promise<void> {
  const names = Object.keys(world);
  const fn = new AsyncFunction(...names, `"use strict";\n${asJs(source)}`);
  await fn(...names.map((name) => world[name]));
}

const TABLE = fragment(hook, 'const OUT_OF_MINUTES: Record<OutOfMinutesCode, OutOfMinutesCopy> = {');
const REFUSAL_CODE = fragment(hook, 'function refusalCode(body: unknown): OutOfMinutesCode {');
const PLANS_IN = fragment(hook, 'function plansIn(body: unknown): Record<Plan, PlanSpec> | null {');
const BRANCH = fragment(hook, 'if (res.status === 402) {');

/** The table, the two parsers and the branch, in one program, as the hook writes them. */
const PROGRAM = `${TABLE};\n${REFUSAL_CODE}\n${PLANS_IN}\n${BRANCH}`;

interface Copy {
  label: string;
  message: string;
}

/** The copy table itself, so the sentences asserted below are the real ones. */
const COPY = ((): Record<string, Copy> => {
  const fn = new Function(`"use strict";\n${asJs(`${TABLE};\nreturn OUT_OF_MINUTES;`)}`) as () => Record<string, Copy>;
  return fn();
})();

interface Shown {
  phase?: string;
  code?: string;
  label?: string;
  message?: string;
  plans?: unknown;
}

/**
 * Answer one 402 and collect what the screen would be given.
 *
 * The body goes through JSON on the way in, because that is what the wire does
 * to it: a catalogue that survives a structured clone but not a serialisation
 * would still be broken on a phone.
 */
async function answer(
  body: unknown,
  opts: { gone?: boolean; unparseable?: boolean } = {},
): Promise<{ statuses: Shown[]; traced: string[]; noted: unknown[] }> {
  const seen: { statuses: Shown[]; traced: string[]; noted: unknown[] } = { statuses: [], traced: [], noted: [] };
  await runAsync(PROGRAM, {
    res: {
      status: 402,
      json: async (): Promise<unknown> => {
        if (opts.unparseable === true) throw new SyntaxError('Unexpected end of JSON input');
        return JSON.parse(JSON.stringify(body));
      },
    },
    abandoned: async (): Promise<boolean> => opts.gone === true,
    setStatus: (s: unknown) => seen.statuses.push(s as Shown),
    trace: (event: string) => seen.traced.push(event),
    // The refusal keeps the catalogue for the subscription wall, which is reached
    // from this very branch. Collected rather than discarded, so the test below
    // can assert the wall gets the same object the screen does.
    noteCatalogue: (plans: unknown) => seen.noted.push(plans),
    PLANS,
  });
  return seen;
}

/* ------------------------------------------------------------------------- *
 * The bodies the token server really sends.
 * ------------------------------------------------------------------------- */

const spent = (plan: Plan): Entitlement => ({ plan, secondsUsed: PLANS[plan].secondsPerPeriod });
/** Just over a minute left, which is under the shortest session worth starting. */
const nearlySpent = (plan: Plan): Entitlement => ({ plan, secondsUsed: PLANS[plan].secondsPerPeriod - 61 });

interface Body {
  error: string;
  message: string;
  plans: unknown;
}

/**
 * `{ error: result.reason, message: result.message, plans: PLANS }`, built from
 * the decision the server forwards rather than from a string typed in here.
 */
function refusalBody(e: Entitlement): Body {
  const decision = canStartSession(e);
  if (decision.allowed) throw new Error('this entitlement can still start a session, so it is not a refusal');
  return { error: decision.reason, message: decision.message, plans: PLANS };
}

/** The one refusal the server writes itself, read out of the server. */
const CLAIMED: Body = ((): Body => {
  const found = /return json\(res, 402, \{\s*error: '([^']+)',\s*message: '([^']+)',\s*plans: PLANS,/.exec(server);
  assert.ok(found, 'the token server no longer refuses a second account on one device with a 402 carrying its plans');
  return { error: found[1]!, message: found[2]!, plans: PLANS };
})();

const EVERY_402: Body[] = [
  refusalBody(spent('trial')),
  refusalBody(spent('starter')),
  refusalBody(nearlySpent('regular')),
  refusalBody({ plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod, lapsed: true }),
  CLAIMED,
];

/* ------------------------------------------------------------------------- *
 * The tests.
 * ------------------------------------------------------------------------- */

describe('the 402 the hook is handed — F251', () => {
  test('the 402 keeps the refusal code and the plans, not just the sentence', async () => {
    // The server attaches its catalogue to both 402s. If it stops, there is
    // nothing for a paywall to be built out of and this file is reading a
    // promise the server no longer makes.
    assert.match(
      server,
      /json\(res, result\.status, \{ error: result\.reason, message: result\.message, plans: PLANS \}/,
      'the token server stopped sending its plans with a refusal, so the app has nothing to offer',
    );

    const expected: [Body, string][] = [
      [EVERY_402[0]!, 'exhausted'],
      [EVERY_402[1]!, 'exhausted'],
      [EVERY_402[2]!, 'insufficient-for-session'],
      [EVERY_402[3]!, 'subscription-lapsed'],
      [CLAIMED, 'trial already claimed'],
    ];

    for (const [body, code] of expected) {
      const seen = await answer(body);
      assert.equal(seen.statuses.length, 1, `${code}: the learner was shown nothing at all`);
      const status = seen.statuses[0]!;
      assert.equal(status.phase, 'out-of-minutes', `${code}: a refusal about minutes reached some other screen`);
      assert.equal(status.code, code, `${code}: the refusal code was parsed away, so nothing downstream can tell the refusals apart`);
      assert.deepEqual(status.plans, PLANS, `${code}: the plans payload was parsed away at the door`);
      // The same object reaches the subscription wall, which is a screen this
      // refusal leads to. It has to be the one the server sent rather than a
      // second copy: a compiled allowance that disagrees with the meter is F266,
      // and the wall's plans page shows it next to a price.
      assert.deepEqual(seen.noted, [PLANS], `${code}: the wall was not given the catalogue the screen was given`);
      assert.notEqual(status.message, body.message, `${code}: the server's own sentence is being rendered`);
      assert.ok(typeof status.label === 'string' && status.label.length > 0, `${code}: no heading for the screen`);
    }

    // The number in `Only 1 min 1s left.` is the other reason the server's
    // sentence is not renderable: it is a countdown, and this product does not
    // run one.
    assert.match(EVERY_402[2]!.message, /\d/, 'the too-little-left refusal stopped carrying a raw number; this test is stale');
    assert.ok(!/\d/.test(String(await onlyMessage(EVERY_402[2]!))), 'a number from the server reached the learner');

    // A 402 this build has not been taught about is still a 402: the status
    // code alone says the session was refused over minutes.
    // A body with no catalogue in it notes nothing, rather than noting null and
    // wiping the last good one. `noteCatalogue` ignores null for that reason, and
    // this is the case that would otherwise have proved it by accident.
    const bare = await answer({ error: 'exhausted', message: 'anything' });
    assert.deepEqual(bare.noted, [null], 'a refusal with no catalogue did not reach noteCatalogue at all');

    const odd = await answer({ error: 'some refusal invented after this build', message: 'anything', plans: PLANS });
    assert.equal(odd.statuses[0]?.code, 'unknown', 'an unrecognised refusal was passed through as though it were known');
    assert.ok((odd.statuses[0]?.message ?? '').length > 0, 'an unrecognised refusal left the learner with a blank screen');

    // And a body that will not parse must not become an error screen about
    // something else. This used to throw into the catch and be classified as
    // an unknown connection failure.
    const torn = await answer(null, { unparseable: true });
    assert.equal(torn.statuses.length, 1, 'a 402 whose body will not parse threw instead of explaining itself');
    assert.equal(torn.statuses[0]?.code, 'unknown');
    assert.equal(torn.statuses[0]?.plans, null, 'a catalogue was invented out of a body that never arrived');

    // A body carrying no usable catalogue hands over nothing rather than a
    // half one, because a paywall drawn from holes is worse than no paywall.
    const partial = await answer({ error: 'exhausted', message: 'x', plans: { trial: PLANS.trial } });
    assert.equal(partial.statuses[0]?.plans, null, 'half a catalogue was passed on as a whole one');

    // The ownership gate stays where it is. A learner who left while the token
    // was in flight is not shown a paywall for a session they abandoned.
    const gone = await answer(CLAIMED, { gone: true });
    assert.deepEqual(gone.statuses, [], 'an abandoned attempt still wrote to the screen the learner had left');
  });

  test("a trial claimed by another account is explained in our words, not the server's", async () => {
    const seen = await answer(CLAIMED);
    const status = seen.statuses[0]!;

    assert.equal(status.code, 'trial already claimed');
    assert.notEqual(status.message, CLAIMED.message, 'the server sentence went straight to the learner');
    // D24 (2026-10-20): the server's sentence now offers a plan, which this
    // build's copy table does not; ours stays the one the learner reads.
    assert.match(CLAIMED.message, /this device/i, 'the server stopped naming the device; this test is stale');
    assert.doesNotMatch(status.message!, /installation/i, 'an internal noun reached a learner');
    assert.doesNotMatch(
      status.message!,
      /used by another account|already been used by/i,
      'a learner who has done nothing was told somebody else used their minutes',
    );

    // Then the whole table, because the sentence above is only safe while every
    // sentence beside it is. These are the rules PRODUCT.md makes hardest, and
    // a learner out of minutes is the most pressurable moment there is.
    assert.ok(Object.keys(COPY).length >= 4, 'the copy table shrank; this test is reading the wrong thing');
    for (const [code, copy] of Object.entries(COPY)) {
      for (const line of [copy.label, copy.message]) {
        assert.equal(guiltIn(line), undefined, `${code}: a banned word in "${line}"`);
        assert.ok(!/\d/.test(line), `${code}: a number in "${line}"`);
        assert.ok(!line.includes('—'), `${code}: an em dash in "${line}"`);
        assert.doesNotMatch(
          line,
          /installation|token server|endpoint|payload|entitlement|\bapi\b|\bhttp|\b402\b|room service/i,
          `${code}: the plumbing is explained to a learner in "${line}"`,
        );
        // Nothing can be bought yet: the store has no product, the paywall
        // ships dark, and a sentence offering a purchase would be a button
        // that is not on the screen.
        assert.doesNotMatch(
          line,
          /\b(buy|purchase|upgrade|subscribe|checkout|billing)\b|\$/i,
          `${code}: purchasing is offered before there is anything to sell in "${line}"`,
        );
      }
      // Every refusal names something the learner can still do. Practice and
      // review are on-device and completely unaffected by any of this.
      assert.match(
        copy.message,
        /practice|review|later|offline/i,
        `${code}: "${copy.message}" tells the learner what happened and nothing about what to do`,
      );
    }
  });

  test("the out of minutes screen speaks the app's words, not the server's", async () => {
    // F168's own claim, which is about the screen rather than the parse. Both
    // renderers put the hook's sentence in front of the learner, so the hook's
    // sentence is the whole of what a learner reads.
    for (const [name, path] of [
      ['the lesson', '../LiveSessionScreen.tsx'],
      ['the conversation', '../ConvoScreen.tsx'],
    ] as const) {
      const screen = read(path);
      const at = screen.indexOf("live.status.phase === 'out-of-minutes'");
      assert.notEqual(at, -1, `${name} no longer renders the out-of-minutes phase at all`);
      assert.match(
        screen.slice(at, at + 700),
        /\{live\.status\.message\}/,
        `${name} renders something other than the sentence the hook supplies`,
      );
    }
    // Stage 3 (2026-09-25): the lesson hands the sentence to its own page on
    // the scrolling frame, so the page is held to drawing it.
    assert.match(read('./OutOfMinutesView.tsx'), /<Text[^>]*>\{message\}<\/Text>/, "the lesson's out-of-minutes page drops the hook's sentence");

    // And every sentence that field can hold, over every 402 the server sends,
    // is one of ours.
    const ours = new Set(Object.values(COPY).map((c) => c.message));
    for (const body of EVERY_402) {
      const shown = await onlyMessage(body);
      assert.ok(ours.has(shown), `a sentence the app does not own reached the screen: "${shown}"`);
      assert.notEqual(shown, body.message, `the server's sentence was rendered for ${body.error}`);
    }

    // Nothing in the branch reads the server's prose any more. The cast that
    // took `message` off the body is the defect, so its shape is named here.
    assert.doesNotMatch(
      BRANCH,
      /body\.message|body\?\.message|\{ message\?: string \}/,
      'the 402 branch is reading the server sentence again',
    );
  });
});

/** What the screen would show for one body, and nothing else. */
async function onlyMessage(body: Body): Promise<string> {
  const seen = await answer(body);
  assert.equal(seen.statuses.length, 1, `no status at all for ${body.error}`);
  return String(seen.statuses[0]!.message);
}
