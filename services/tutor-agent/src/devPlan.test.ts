/**
 * The supervisor's judgement, tested away from its process handling.
 *
 * `npm run dev` has to decide three things before it spawns anything: what
 * order to start in, what to do about a port that already answers, and whether
 * the .env files can actually serve a session. Those are decisions, so they are
 * pure functions here. The spawning, the log labelling and the process-group
 * reaping live in scripts/dev.mjs and are verified by running it — a test of
 * those would be a test of the operating system.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { missingRequired, selectedBrain } from './preflight.ts';
import {
  bootPlan,
  classifyPort,
  envGaps,
  parseEnvFile,
  sharedAgentSecret,
  type BootStep,
  type ProbeResult,
} from '../../shared/devPlan.ts';

const AGENT_ENV = {
  LIVEKIT_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'secret',
  DEEPGRAM_API_KEY: 'dg',
  ELEVEN_API_KEY: 'el',
  TUTOR_LLM: 'groq',
  GROQ_API_KEY: 'gq',
};

const TOKEN_ENV = {
  LIVEKIT_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'secret',
};

const stepFor = (id: string): BootStep => {
  const step = bootPlan().find((s) => s.id === id);
  assert.ok(step, `the plan has no step called ${id}`);
  return step;
};

describe('devPlan — the order things start in', () => {
  test('the boot plan orders livekit, then the token server, then the agent, then the app', () => {
    assert.deepEqual(
      bootPlan().map((s) => s.id),
      ['livekit', 'token', 'agent', 'app'],
      'the token server signs tokens for livekit, the agent registers with livekit, and the app talks to the ' +
        'token server, so any other order starts something before the thing it depends on.',
    );
  });

  test('every step says how to know it is ready', () => {
    for (const step of bootPlan()) {
      assert.ok(step.ready, `${step.id} has no readiness rule, so the supervisor would race the next step`);
      assert.ok(step.ready.timeoutMs > 0, `${step.id} would wait forever`);
    }
  });

  test('the agent is the one step with no port of its own', () => {
    // It registers outward with LiveKit rather than listening, so a port check
    // would be looking for something that is never there.
    assert.equal(stepFor('agent').port, null);
    for (const id of ['livekit', 'token', 'app']) assert.ok(stepFor(id).port! > 0);
  });
});

describe('devPlan — a port that already answers', () => {
  test('a port already answering as livekit is reused rather than fought over', () => {
    // The exact case on this machine: livekit-server --dev has been up for days.
    const probe: ProbeResult = { reachable: true, status: 200, body: 'OK' };
    const verdict = classifyPort(stepFor('livekit'), probe);
    assert.equal(verdict.kind, 'reuse', 'a livekit that is already serving is the one we want, not a rival');
    assert.match(verdict.kind === 'reuse' ? verdict.note : '', /7880/);
  });

  test('a port held by something else stops the boot and names the port', () => {
    // Someone else's dev server on 7880. Spawning livekit would fail obscurely
    // inside its own logs; reusing it would hand the agent a stranger.
    const probe: ProbeResult = { reachable: true, status: 200, body: '<!doctype html><title>someone else</title>' };
    const verdict = classifyPort(stepFor('livekit'), probe);
    assert.equal(verdict.kind, 'occupied');
    const message = verdict.kind === 'occupied' ? verdict.message : '';
    assert.match(message, /7880/, 'the port number is the one thing the reader needs');
    assert.match(message, /lsof/, 'and the command that says who has it');
  });

  test('a silent port is simply spawned', () => {
    assert.equal(classifyPort(stepFor('token'), { reachable: false }).kind, 'spawn');
  });

  test('a token server already answering /health is reused', () => {
    const probe: ProbeResult = { reachable: true, status: 200, body: '{"ok":true,"livekitUrl":"ws://localhost:7880"}' };
    const verdict = classifyPort(stepFor('token'), probe);
    assert.equal(verdict.kind, 'reuse');
    assert.match(
      verdict.kind === 'reuse' ? verdict.note : '',
      /env/i,
      'a reused process is running the env it booted with, which is worth saying out loud',
    );
  });

  test('a port answering with an error is not mistaken for the service', () => {
    const verdict = classifyPort(stepFor('token'), { reachable: true, status: 500, body: 'nope' });
    assert.equal(verdict.kind, 'occupied');
  });
});

describe('devPlan — what the .env files are missing', () => {
  test('a complete pair of env files has nothing to report', () => {
    assert.deepEqual(envGaps(AGENT_ENV, TOKEN_ENV), []);
  });

  test('a gap names the exact variable and the exact file', () => {
    const { DEEPGRAM_API_KEY: _drop, ...withoutDeepgram } = AGENT_ENV;
    const gaps = envGaps(withoutDeepgram, TOKEN_ENV);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0]!.name, 'DEEPGRAM_API_KEY');
    assert.equal(gaps[0]!.file, 'services/tutor-agent/.env');
  });

  test('the token server is checked as well as the agent', () => {
    const gaps = envGaps(AGENT_ENV, { ...TOKEN_ENV, LIVEKIT_API_SECRET: '' });
    assert.ok(
      gaps.some((g) => g.file === 'services/token-server/.env' && g.name === 'LIVEKIT_API_SECRET'),
      'the token server cannot sign a join token without it, and it fails at the moment a learner taps start',
    );
  });

  test('a blank line reads as absent, not as set', () => {
    // The exact trap preflight.ts documents: TUTOR_LLM= looks unset to a reader
    // and reads as set to `??`.
    const gaps = envGaps({ ...AGENT_ENV, GROQ_API_KEY: '   ' }, TOKEN_ENV);
    assert.ok(gaps.some((g) => g.name === 'GROQ_API_KEY'));
  });
});

describe('devPlan — reading an env file', () => {
  test('comments, blanks and quotes are all handled', () => {
    const parsed = parseEnvFile(
      ['# a comment', '', 'PLAIN=value', 'QUOTED="quoted value"', "SINGLE='single'", 'EMPTY=', 'SPACED = spaced '].join('\n'),
    );
    assert.equal(parsed.PLAIN, 'value');
    assert.equal(parsed.QUOTED, 'quoted value');
    assert.equal(parsed.SINGLE, 'single');
    assert.equal(parsed.EMPTY, '');
    assert.equal(parsed.SPACED, 'spaced');
    assert.equal(parsed['# a comment'], undefined);
  });

  test('a value containing an equals sign survives', () => {
    assert.equal(parseEnvFile('KEY=a=b=c').KEY, 'a=b=c');
  });

  test('a missing file is an empty set of values, not a crash', () => {
    assert.deepEqual(parseEnvFile(''), {});
  });
});

describe('devPlan — the agent secret', () => {
  test('an unset secret is generated once and shared by both processes', () => {
    // Without it /session/end is open and anyone can debit anyone's minutes,
    // which is the hole B6 closed and which an unset secret quietly reopens.
    const secret = sharedAgentSecret({}, {}, () => 'generated-value');
    assert.equal(secret.value, 'generated-value');
    assert.equal(secret.generated, true);
  });

  test('a secret already configured is left exactly as it is', () => {
    const secret = sharedAgentSecret({ PARLE_AGENT_SECRET: 'mine' }, { PARLE_AGENT_SECRET: 'mine' }, () => 'unused');
    assert.equal(secret.value, 'mine');
    assert.equal(secret.generated, false);
  });

  test('two different configured secrets are a gap, because the debit would be refused', () => {
    const secret = sharedAgentSecret({ PARLE_AGENT_SECRET: 'a' }, { PARLE_AGENT_SECRET: 'b' }, () => 'unused');
    assert.equal(secret.mismatch, true);
  });
});


describe('devPlan — the supervisor and the agent must agree', () => {
  test('the supervisor and the agent preflight agree on which brain TUTOR_LLM selects', () => {
    // devPlan cannot import preflight: services/shared is below the services
    // that use it, and reaching upward would invert the direction speechace.ts
    // established. So it mirrors selectedBrain, and an unguarded mirror is a
    // silent disagreement waiting for a fourth TUTOR_LLM value: the supervisor
    // would demand the wrong key, or none, and the agent would demand another
    // one process later.
    //
    // Nothing here couples the two implementations. It couples their answers.
    const complete = { ...AGENT_ENV };
    for (const value of [
      '',
      '  ',
      'anthropic',
      'ANTHROPIC',
      'openai',
      'OPENAI',
      'groq',
      'claude-cli',
      'CLAUDE-CLI',
      'claude-cli-all',
      'CLAUDE-CLI-ALL',
      'nonsense',
    ]) {
      const env = { ...complete, TUTOR_LLM: value };
      const brain = selectedBrain(env);

      // Blank every key, then ask each side which one it misses.
      const bare = { ...env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', GROQ_API_KEY: '' };
      const agentWants = missingRequired(bare).filter((name) => name.endsWith('_API_KEY'));
      const devWants = envGaps(bare, TOKEN_ENV)
        .filter((gap) => gap.name.endsWith('_API_KEY'))
        .map((gap) => gap.name);

      assert.deepEqual(
        devWants,
        agentWants,
        `TUTOR_LLM=${JSON.stringify(value)} reads as ${brain}; npm run dev and the agent must want the same key`,
      );
    }
  });

  test('both brain selectors agree on claude-cli-all', () => {
    // The fourth value the mirror was waiting for. It is the one where the
    // right answer is "no key at all": the subscription answers through a
    // binary on PATH, and Groq drops out of the picture entirely. A supervisor
    // that demanded GROQ_API_KEY here would refuse to boot a stack that runs.
    const env = { ...AGENT_ENV, TUTOR_LLM: 'claude-cli-all', ANTHROPIC_API_KEY: '', GROQ_API_KEY: '' };

    assert.equal(selectedBrain(env), 'claude-cli-all');
    const agentWants = missingRequired(env).filter((name) => name.endsWith('_API_KEY'));
    const devWants = envGaps(env, TOKEN_ENV)
      .filter((gap) => gap.name.endsWith('_API_KEY'))
      .map((gap) => gap.name);

    assert.deepEqual(agentWants, [], 'the agent asks for no brain credential');
    assert.deepEqual(devWants, agentWants, 'and npm run dev asks for exactly the same nothing');
  });
});
