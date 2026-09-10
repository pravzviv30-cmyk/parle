/**
 * What onboarding is allowed to report about itself.
 *
 * `ProductEvent` is a type, so it is gone by the time anything runs and no
 * assertion can reach it. The flow's pages are real values, though, so half of
 * this check imports and half of it reads the source — the same split
 * `surfaceContract.test.ts` uses for anything that exists only at compile time.
 *
 * The rule being held is one sentence: an event may report on a question the
 * flow actually asks, and on nothing else. `motivationAnswered` broke it in the
 * quietest possible way. The why page went, the boolean stayed, and it would
 * have gone on posting `false` forever — a permanent answer to a question
 * nobody was asked, indistinguishable in the data from thousands of learners
 * declining to say why they are here.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import { PAGES } from '../onboarding/answers.ts';
import { guiltIn } from '../copy/guilt.ts';
import { analyticsAllowed, CONSENT_COPY, CONSENT_HINT, CONSENT_ROW, CONSENT_SUB } from './consent.ts';

const HERE = new URL('.', import.meta.url).pathname;

/** Comments name the properties they explain, so they are not the type. */
const UNION = readFileSync(join(HERE, 'track.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** The property names the union declares for one event name. */
function declaredProperties(event: string): string[] {
  const line = UNION.split('\n').find((l) => l.includes(`name: '${event}'`));
  assert.ok(line, `ProductEvent no longer has a '${event}' variant`);
  const body = /properties: \{([^}]*)\}/.exec(line);
  assert.ok(body, `the '${event}' variant declares no properties block`);
  return (body[1] ?? '')
    .split(';')
    .map((part) => part.trim().split(':')[0]?.trim() ?? '')
    .filter((name) => name.length > 0)
    .sort();
}

/**
 * Which onboarding page each reportable fact comes from. A page missing here
 * reports nothing: `age` is a gate rather than an answer, and `meet` asks the
 * learner no question at all.
 */
const REPORTED_BY_PAGE: Record<string, string> = {
  name: 'personalisedGreeting',
  why: 'motivationAnswered',
};

describe('onboarding analytics — F112', () => {
  test('onboarding_completed reports only questions the flow asks', () => {
    const expected = PAGES.map((page) => REPORTED_BY_PAGE[page])
      .filter((property): property is string => property !== undefined)
      .sort();

    assert.deepEqual(
      declaredProperties('onboarding_completed'),
      expected,
      `onboarding asks ${JSON.stringify([...PAGES])}, so the event may report ` +
        `${JSON.stringify(expected)} and nothing else`,
    );
  });
});

describe('an event property means the same thing to the client and the server — F117', () => {
  // F116 happened because a client type changed and nothing forced the server's
  // half. The forcing function that shipped with it pins KEY SETS across all five
  // events — and would not have caught this, because widening a value domain
  // leaves the key set identical. `kind: string` accepted anything the client
  // could invent while productEvents.ts and the trigger enforced a closed enum,
  // so a fifth SoundCheckKind would have compiled clean and been rejected in
  // production, silently. The type is the forcing function now.
  test('a sound check reports one of the kinds the model actually defines', () => {
    const model = readFileSync(join(HERE, '..', 'soundcheck', 'model.ts'), 'utf8');
    assert.match(
      model,
      /export type SoundCheckKind =/,
      'SoundCheckKind is the source of truth for what a sound check may report',
    );

    const line = UNION.split('\n').find((l) => l.includes("name: 'sound_check_completed'"));
    assert.ok(line, 'ProductEvent no longer has a sound_check_completed variant');
    assert.match(
      line,
      /kind:\s*SoundCheckKind/,
      'kind must be SoundCheckKind: a bare string compiles clean here and the server refuses it',
    );
    assert.doesNotMatch(
      line,
      /kind:\s*string/,
      'a bare string here is how a fifth kind reaches production and is dropped in silence',
    );
  });
});

/**
 * The consent gate — F471.
 *
 * `track.ts` cannot be imported here. It reaches `auth/adapter.ts`, which
 * reaches expo-crypto, which node's type stripper refuses under node_modules,
 * so the whole suite would fail to load rather than fail an assertion. The way
 * round it is `useLiveSession.test.ts`'s: lift the function body out of the
 * source, strip its types with the same stripper this file runs under, and run
 * it with every free name supplied by hand.
 *
 * That is not a source scan wearing a costume. The text being executed IS the
 * shipped text, `analyticsAllowed` is the real rule rather than a restatement of
 * it, and the assertion is about a `fetch` that never happened, which is the
 * only version of "emits nothing" worth making.
 */

const TRACK = readFileSync(join(HERE, 'track.ts'), 'utf8');

/** The body of a top-level function, brace-matched so a nested block is kept. */
function bodyOf(source: string, header: string): string {
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `track.ts no longer declares "${header}"`);
  let depth = 0;
  for (let i = start + header.length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start + header.length, i);
  }
  assert.fail(`"${header}" is never brace-closed`);
}

const AsyncFunction = Object.getPrototypeOf(async (): Promise<void> => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;

const TRACK_BODY = bodyOf(TRACK, 'export async function trackProductEvent(event: ProductEvent): Promise<void> {');

/** Run the lifted body with a fabricated world, and hand back what it did. */
async function send(world: Record<string, unknown>): Promise<void> {
  const wrapped = stripTypeScriptTypes(`async function lifted() {\n${TRACK_BODY}\n}`);
  const js = wrapped.slice(wrapped.indexOf('{') + 1, wrapped.lastIndexOf('}'));
  const names = Object.keys(world);
  await new AsyncFunction(...names, `"use strict";\n${js}`)(...names.map((name) => world[name]));
}

const EVENT = { name: 'my_french_opened', properties: { situationsDone: 2, linesKept: 3 } };

/** Everything the body reaches for, with the consent and the fetch left open. */
function world(consent: () => Promise<unknown>, calls: string[]): Record<string, unknown> {
  return {
    auth: { getSession: () => Promise.resolve({ id: 'learner-1' }) },
    authHeaders: () => Promise.resolve({ authorization: 'Bearer t' }),
    loadConsent: () => {
      calls.push('read');
      return consent();
    },
    analyticsAllowed,
    TOKEN_SERVER: 'https://example.invalid',
    fetch: (url: string) => {
      calls.push(`fetch ${url}`);
      return Promise.resolve({ ok: true });
    },
    event: EVENT,
  };
}

describe('the consent gate — F471', () => {
  test('an opted-out learner emits nothing, and the network is never reached', async () => {
    const declined: string[] = [];
    await send(world(() => Promise.resolve({ allowed: false }), declined));
    assert.deepEqual(declined, ['read'], 'a learner who said no still reached the network');

    // A learner nobody has asked yet is in the same position as one who
    // declined, and for the stronger reason: nothing was ever agreed to.
    const unasked: string[] = [];
    await send(world(() => Promise.resolve(null), unasked));
    assert.deepEqual(unasked, ['read'], 'an event was sent for a learner who was never asked');

    // And the refutation, so the gate is not simply always shut.
    const agreed: string[] = [];
    await send(world(() => Promise.resolve({ allowed: true }), agreed));
    assert.deepEqual(
      agreed,
      ['read', 'fetch https://example.invalid/events'],
      'a learner who said yes is not being counted, so this gate proves nothing',
    );
  });

  test('consent is read fresh on every event rather than cached', async () => {
    // The withdrawal mid-launch: yes, one event, then off, then another event.
    // A cached answer sends the second one and nothing ever says so.
    const calls: string[] = [];
    let answer = true;
    const w = world(() => Promise.resolve({ allowed: answer }), calls);
    await send(w);
    answer = false;
    await send(w);
    assert.deepEqual(
      calls,
      ['read', 'fetch https://example.invalid/events', 'read'],
      'the second event ignored a withdrawal made between the two',
    );

    // And the source, because a cache added later would be a module-level
    // variable rather than a changed statement.
    const stripped = TRACK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(
      stripped,
      /^(let|var) /m,
      'track.ts holds module state, which is where a remembered consent would live',
    );
    assert.match(
      TRACK_BODY,
      /Promise\.all\(\[[^\]]*loadConsent\(\)/,
      'the consent left the Promise.all, so it is either cached or an extra round trip',
    );
  });

  test('an unreadable consent reads as no', async () => {
    // Everything a JSON blob off a device's disk can come back as. Only the
    // last one is a permission; the rest are a build that cannot prove one was
    // ever given, and guessing at a permission is the failure this prevents.
    for (const junk of [null, undefined, {}, { allowed: 'true' }, { allowed: 1 }, { allowed: null }, 'true', 1, []]) {
      assert.equal(analyticsAllowed(junk), false, `${JSON.stringify(junk) ?? 'undefined'} was read as agreement`);
    }
    assert.equal(analyticsAllowed({ allowed: false }), false, 'a declined consent is not agreement');
    assert.equal(analyticsAllowed({ allowed: true }), true, 'a real yes is being refused, so nobody can opt in');

    // `loadConsent` throws rather than resolving when nobody is signed in, so
    // the throw has to land in the same catch the network failures do: no
    // account, no event, and no crash out of a fire-and-forget call.
    const calls: string[] = [];
    await send(
      world(() => {
        throw new Error('no signed-in user');
      }, calls),
    );
    assert.deepEqual(calls, ['read'], 'a signed-out learner reached the network');
  });

  test('nothing the consent row says counts, scolds or promises a retention', () => {
    assert.deepEqual([...CONSENT_COPY], [CONSENT_ROW, CONSENT_SUB, CONSENT_HINT], 'a sentence is missing from the list');
    for (const line of CONSENT_COPY) {
      assert.ok(line.trim().length > 0, 'a consent line is empty');
      assert.equal(guiltIn(line), undefined, `guilt in consent copy: ${line}`);
      assert.doesNotMatch(line, /[—–]/, `em dash in consent copy: ${line}`);
      assert.doesNotMatch(line, /\d/, `a digit in consent copy: ${line}`);
      // A count of events rots the day a sixth one lands, and a period stated
      // here would be a promise no scheduled delete keeps yet, which
      // PRIVACY_AND_SAFETY.md records under "Not true yet". Both belong in the
      // policy, which can say what is actually true at whatever length it takes.
      assert.doesNotMatch(line, /\b(one|two|three|four|five|six)\b/i, `the consent row counts: ${line}`);
      assert.doesNotMatch(line, /month|year|week|\bday|kept for|retention|delet/i, `the consent row promises a retention: ${line}`);
      assert.doesNotMatch(line, /\b(must|should|please|wrong|bad)\b/i, `the consent row asks for something: ${line}`);
    }
    // The half a learner is really asking about stays in the row itself.
    assert.match(CONSENT_SUB, /Never what you say/, 'the row stopped saying what an event can never carry');
    assert.match(CONSENT_HINT, /Settings/, 'the hint stopped saying where the answer can be changed');
  });
});

/** The privacy document, so a cited heading can be checked against the real thing. */
const DOC = readFileSync(join(HERE, '..', '..', '..', '..', 'docs', 'PRIVACY_AND_SAFETY.md'), 'utf8');

/** Every heading that document offers, at any level. */
const DOC_HEADINGS = new Set(
  DOC.split('\n')
    .filter((line) => /^#{1,6} /.test(line))
    .map((line) => line.replace(/^#{1,6} /, '').trim()),
);

/** Every source file in the two folders whose comments point into that document. */
function citingFiles(): string[] {
  const out: string[] = [];
  for (const dir of [join(HERE), join(HERE, '..', 'legal')]) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

describe('pointing at the privacy document — F486', () => {
  test('a citation into the privacy document names a section rather than a line', () => {
    // Three citations here carried line numbers, and all three had rotted
    // before anybody read them: an edit anywhere above a paragraph moves it,
    // and nothing moves the comment that pointed at it. One of them landed a
    // reader in a Supabase migration paragraph, the other two in the safety-net
    // bullets. So the form is a heading, which is what the rest of the legal
    // modules already do, and this walks both folders to keep it that way.
    assert.ok(DOC_HEADINGS.size > 10, 'the privacy document lost its headings, so nothing here can be checked');

    const cited = new Map<string, string[]>();
    for (const file of citingFiles()) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!/PRIVACY_AND_SAFETY\.md/.test(line)) continue;
        assert.doesNotMatch(
          line,
          /PRIVACY_AND_SAFETY\.md[^\n]{0,24}:\s*\d/,
          `${file} cites a line number into the privacy document, which rots by design: ${line.trim()}`,
        );
        const named = /PRIVACY_AND_SAFETY\.md[^"\n]*"([^"]+)"/.exec(line);
        if (named === null) continue;
        const heading = named[1]!;
        assert.ok(DOC_HEADINGS.has(heading), `${file} cites a section the privacy document does not have: "${heading}"`);
        cited.set(heading, [...(cited.get(heading) ?? []), file]);
      }
    }

    // Deleting a citation is not a way to pass this. These are the two sections
    // the repaired references stand on, and the files they stand in.
    for (const heading of ['Analytics: consent, opt-out and retention', 'Not true yet']) {
      assert.ok(cited.has(heading), `nothing points at "${heading}" any more, so a citation was dropped rather than repaired`);
    }
    assert.ok((cited.get('Not true yet') ?? []).length >= 2, 'only one of the two unenforced-retention citations survived');
    const where = [...cited.values()].flat();
    for (const name of ['consent.ts', 'track.test.ts']) {
      assert.ok(where.some((file) => file.endsWith(name)), `${name} stopped saying which part of the privacy document it rests on`);
    }
  });
});
