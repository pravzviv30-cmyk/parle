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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES } from '../onboarding/answers.ts';

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
