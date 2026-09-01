/**
 * What the gate can honestly check about a live-model eval is the eval, not the
 * model. So these tests hold curationEval.ts to its own claims: the scorer
 * separates a good keep-list from a bad one by the labels rather than by the
 * count, a fixture that never ran fails the run, and with no API key the
 * command reports BLOCKED and exits non-zero instead of passing quietly.
 *
 * Whether the real model clears the standard is what `npm run eval:curation`
 * answers, and only a run with credentials can answer it. Nothing here should
 * ever be read as "curation is good".
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import {
  CURATION_CHECKS,
  CURATION_FIXTURES,
  WORTH_VALUE,
  blockedReport,
  missingCredentials,
  pickProvider,
  scoreCuration,
  summariseCuration,
  type CurationFixture,
  type Worth,
} from './curationEval.ts';
import type { Curation } from '@luvani/brain';

const EVAL = fileURLToPath(new URL('./curationEval.ts', import.meta.url));
const WORKSPACE = fileURLToPath(new URL('../..', import.meta.url));
/** An env file that does not exist, so this machine's real keys cannot wander in. */
const NO_ENV_FILE = path.join(tmpdir(), `luvani-no-env-${randomUUID()}`);

const CAFE = CURATION_FIXTURES[0] as CurationFixture;

const frOf = (fixture: CurationFixture, worth: Worth): string[] =>
  fixture.phrases.filter((p) => p.worth === worth).map((p) => p.phrase.fr);

/** One topic carrying exactly the phrases named, which is the shape the model returns. */
const proposing = (phraseFr: string[], extensions: Curation['topics'][number]['extensions'] = []): Curation => ({
  topics: [{ titleEn: 'Ordering at a café', titleFr: 'Commander au café', phraseFr, extensions }],
});

/** Run the eval as the command the playground actually declares. */
function runCli(env: Record<string, string>): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, ['--experimental-strip-types', EVAL], {
      encoding: 'utf8',
      cwd: WORKSPACE,
      env: { PATH: process.env.PATH ?? '', LUVANI_ENV_FILE: NO_ENV_FILE, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? -1, out: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

test('the curation eval scores keeps against drops and runs from the playground', () => {
  const reaching = frOf(CAFE, 'reach');
  const pleasantries = frOf(CAFE, 'filler');
  assert.equal(reaching.length, pleasantries.length, 'both keep-lists must be the same size, so only the labels differ');

  // Keeping the five phrases that carried the task.
  const good = scoreCuration(CAFE, proposing(reaching));
  assert.equal(good.kept.length, 5);
  assert.ok(good.keptSeparation > 0, `keeping the task phrases must outrank the drops, got ${good.keptSeparation}`);
  assert.equal(good.ok, true, `a keep-list of task language must clear the standard: ${JSON.stringify(good.problems)}`);

  // Keeping five pleasantries instead. Same count, same caps, same everything
  // an engagement proxy would see, and it must score below what it dropped.
  const bad = scoreCuration(CAFE, proposing(pleasantries));
  assert.equal(bad.kept.length, 5, 'the failing run keeps just as many cards, so size cannot be what separates them');
  assert.ok(bad.keptSeparation < 0, `keeping pleasantries must score below the drops, got ${bad.keptSeparation}`);
  assert.equal(bad.ok, false);
  assert.ok(
    bad.problems.some((problem) => problem.check === 'keeps-beat-drops'),
    'and it must fail under the check that names the standard',
  );

  assert.ok(
    good.keptSeparation > bad.keptSeparation,
    'the score has to order the two keep-lists, not merely mark one of them',
  );
  assert.equal(good.reachKept, 5);
  assert.equal(bad.reachKept, 0);

  // The eval is not a library nobody can run: the playground declares it, and
  // the command it declares reaches this file and produces the eval's own report.
  const manifest = JSON.parse(readFileSync(path.join(WORKSPACE, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  assert.equal(
    manifest.scripts['eval:curation'],
    'node --experimental-strip-types src/eval/curationEval.ts',
    'the playground must declare the eval as a script, or nobody can run it',
  );
  const run = runCli({});
  assert.match(run.out, /BLOCKED/, 'and running it must produce the eval report, not a crash');
  assert.notEqual(run.code, 0, 'a run that measured nothing is not a pass');
});

describe('the standard', () => {
  test('worth is an ordering: reaching for beats filler, and filler beats what the learner already uses', () => {
    assert.ok(WORTH_VALUE.reach > WORTH_VALUE.filler);
    assert.ok(WORTH_VALUE.filler > WORTH_VALUE.known);
  });

  test('every fixture forces a real choice: twelve phrases, five worth reaching for, two already used', () => {
    assert.ok(CURATION_FIXTURES.length >= 2, 'one fixture is an anecdote');
    for (const fixture of CURATION_FIXTURES) {
      assert.equal(fixture.phrases.length, 12, `${fixture.id} must offer twelve phrases against a cap of five`);
      assert.equal(frOf(fixture, 'reach').length, 5, `${fixture.id}`);
      assert.equal(frOf(fixture, 'filler').length, 5, `${fixture.id}`);
      assert.equal(frOf(fixture, 'known').length, 2, `${fixture.id}`);
      for (const labelled of fixture.phrases) {
        assert.notEqual(labelled.because.trim(), '', `${fixture.id}: "${labelled.phrase.fr}" has a label and no argument for it`);
      }
    }
  });

  test('no fixture is sorted best first, which would let the fallback score without choosing', () => {
    for (const fixture of CURATION_FIXTURES) {
      const firstFive = fixture.phrases.slice(0, 5).filter((p) => p.worth === 'reach').length;
      assert.ok(firstFive < 5, `${fixture.id} opens with five reach phrases, so it measures the ordering, not the editor`);
    }
  });
});

describe('what code refuses, whatever the model proposed', () => {
  test('a phrase the evidence record already calls used never reaches a card', () => {
    const alreadyUsed = frOf(CAFE, 'known');
    assert.equal(alreadyUsed.length, 2);
    const score = scoreCuration(CAFE, proposing([...alreadyUsed, ...frOf(CAFE, 'reach').slice(0, 3)]));

    assert.equal(score.knownKept, 0, 'nothing on the used list may become a card');
    assert.equal(score.knownProposed, 2, 'and the eval still records that the model asked for them');
    for (const fr of alreadyUsed) assert.ok(!score.kept.includes(fr), `"${fr}" is on a card`);
    assert.equal(score.kept.length, 3);
  });

  test('an extension that breaks the copy rules is counted, not carried onto a card', () => {
    const dirty = {
      fr: 'un chocolat chaud, s’il vous plaît',
      frWritten: null,
      en: 'a hot chocolate — you got 3 of these right',
      enLiteral: null,
      register: 'courant' as const,
      note: null,
    };
    const score = scoreCuration(CAFE, proposing(frOf(CAFE, 'reach').slice(0, 3), [dirty]));

    assert.equal(score.extensionsOffered, 1);
    assert.equal(score.extensionsUnclean, 1, 'the gate must see the violation');
    assert.equal(score.extensionsOnCards, 0, 'and no card may carry it');
    assert.ok(
      !score.problems.some((problem) => problem.check === 'extensions-pass-the-gate'),
      'a rejection is the gate working, not a problem with the run',
    );
  });

  test('a phrase the session never recorded is counted as ungrounded rather than kept', () => {
    const score = scoreCuration(CAFE, proposing([...frOf(CAFE, 'reach'), 'je suis désolé pour le retard']));
    assert.equal(score.ungroundedProposals, 1);
    assert.ok(!score.kept.includes('je suis désolé pour le retard'));
    assert.ok(
      !score.problems.some((problem) => problem.check === 'cards-are-grounded'),
      'the card list stayed grounded, which is what the check is about',
    );
  });

  test('a failed call is scored on its fallback, not skipped', () => {
    const score = scoreCuration(CAFE, null);
    assert.ok(score.kept.length > 0, 'the learner still gets a deck when the call dies, so the deck still gets scored');
    assert.equal(score.proposed.length, 0);
    assert.equal(score.knownKept, 0, 'the fallback spends its slots on the same terms');
  });
});

describe('honesty', () => {
  test('a fixture that never ran fails the run instead of passing quietly', () => {
    const only = scoreCuration(CAFE, proposing(frOf(CAFE, 'reach')));
    assert.equal(only.ok, true);

    const partial = summariseCuration([only]);
    assert.equal(partial.ok, false, 'one fixture out of two is not a pass');
    assert.ok(partial.lines.some((line) => line.startsWith('MISS ')), partial.lines.join('\n'));

    const strayId = 'a-fixture-nobody-declared';
    const stray = summariseCuration([{ ...only, fixtureId: strayId }], [CURATION_FIXTURES[0] as CurationFixture]);
    assert.equal(stray.ok, false, 'a score for an undeclared fixture is not a pass either');
    assert.ok(stray.lines.some((line) => line.includes('UNKNOWN')), stray.lines.join('\n'));
  });

  test('missing credentials means none of the three keys, and any one of them unblocks', () => {
    assert.deepEqual(missingCredentials({}), ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY']);
    assert.deepEqual(missingCredentials({ OPENAI_API_KEY: '  ' }), ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY']);
    assert.deepEqual(missingCredentials({ GROQ_API_KEY: 'gsk_x' }), []);
    assert.deepEqual(missingCredentials({ ANTHROPIC_API_KEY: 'sk-x' }), []);
  });

  test('BRAIN_LLM cannot select a provider whose key is missing', () => {
    assert.equal(pickProvider({}), null);
    assert.equal(pickProvider({ GROQ_API_KEY: 'gsk_x' }), 'groq');
    // The trap this replaces: a named provider with no key used to fall through
    // and build a client around an empty string, which fails on the wire and is
    // then scored as a fallback deck rather than reported as a missing key.
    assert.equal(pickProvider({ BRAIN_LLM: 'openai', GROQ_API_KEY: 'gsk_x' }), 'groq');
    assert.equal(pickProvider({ BRAIN_LLM: 'openai', OPENAI_API_KEY: 'sk-x', GROQ_API_KEY: 'gsk_x' }), 'openai');
    assert.equal(pickProvider({ ANTHROPIC_API_KEY: 'sk-x', GROQ_API_KEY: 'gsk_x' }), 'anthropic');
  });

  test('the blocked report names every check that stays unmeasured and claims nothing', () => {
    const report = blockedReport(missingCredentials({}));
    assert.match(report, /^BLOCKED:/);
    for (const check of CURATION_CHECKS) assert.ok(report.includes(check.id), `${check.id} missing from the blocked report`);
    assert.doesNotMatch(report, /passed/i, 'a blocked run must not report a check as passed');
    assert.doesNotMatch(report, /kept better than/i, 'nor print the line a clean run ends on');
  });

  test('with no key the eval prints BLOCKED, exits 2, and scores nothing', () => {
    const run = runCli({});
    assert.equal(run.code, 2, `blocked must exit 2, got ${run.code}: ${run.out}`);
    assert.match(run.out, /^BLOCKED: none of OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY is set/m);
    assert.doesNotMatch(run.out, /separation/, 'nothing may be scored without a model');
    assert.doesNotMatch(run.out, /all \d+ curation fixtures/, 'and no pass line may be printed');
  });
});
