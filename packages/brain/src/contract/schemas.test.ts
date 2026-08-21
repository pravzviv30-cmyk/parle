import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { MemoryExtractionSchema, ScenarioFrameSchema, TurnSchema } from './schemas.ts';
import { sampleCoachItem, sampleTurn } from './samples.ts';
import { DrillBatchSchema } from '../drill/generate.ts';
import { CAFE_FRAME, APERO_FRAME } from '../fixtures.ts';

describe('the turn contract round-trips', () => {
  test('a clean sample turn parses', () => {
    const parsed = TurnSchema.parse(sampleTurn());
    assert.equal(parsed.sceneReply.speaker, 'Karim');
  });

  test('a coaching turn parses with every kind in the taxonomy', () => {
    for (const kind of [
      'blocking-error',
      'english-to-french',
      'grammar-slip',
      'textbook-phrasing',
      'register-mismatch',
      'anglicism',
    ] as const) {
      const turn = sampleTurn({ coach: [sampleCoachItem({ kind })] });
      assert.equal(TurnSchema.parse(turn).coach[0]!.kind, kind);
    }
  });

  test('an unknown coach kind is rejected', () => {
    const turn = sampleTurn({ coach: [{ ...sampleCoachItem(), kind: 'vibes' as never }] });
    assert.throws(() => TurnSchema.parse(turn));
  });

  test('a missing required field is rejected', () => {
    const { sceneReply: _dropped, ...rest } = sampleTurn();
    assert.throws(() => TurnSchema.parse(rest));
  });

  test('survives JSON serialization, the shape it actually arrives in', () => {
    const wire = JSON.parse(JSON.stringify(sampleTurn()));
    assert.deepEqual(TurnSchema.parse(wire), sampleTurn());
  });
});

describe('the scenario fixtures satisfy the frame schema', () => {
  test('the café frame parses', () => {
    const frame = ScenarioFrameSchema.parse(CAFE_FRAME);
    assert.equal(frame.characters[0]!.register, 'courant');
  });

  test('the apéro frame parses and carries the argot end of the range', () => {
    const frame = ScenarioFrameSchema.parse(APERO_FRAME);
    assert.ok(frame.characters.some((c) => c.register === 'argot'));
  });

  test('fixture beat ids are unique — the engine keys on them', () => {
    for (const frame of [CAFE_FRAME, APERO_FRAME]) {
      const ids = frame.beats.map((b) => b.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  });
});

describe('a scene with no beats is refused at the contract — an empty spine wedges the session', () => {
  test('a scenario with no beats is rejected before it can open', () => {
    // The beats are the conversation's spine. `createConversation` reads
    // `beats[0]` and `openScene` reads `beats[beatIndex]` without asking, so an
    // empty array throws *after* the agent has left the choosing phase and
    // before it reaches the scene — and a learner stranded in that gap has
    // every later thing they say dropped in silence, forever.
    //
    // Refusing it here means the throw lands inside buildFrame's existing
    // catch, where the fallback is already sitting. The learner gets a scene.
    assert.throws(
      () => ScenarioFrameSchema.parse({ ...CAFE_FRAME, beats: [] }),
      'a frame with no beats must not parse; if it does, the session wedges where no learner can get out of it',
    );

    for (const frame of [CAFE_FRAME, APERO_FRAME]) {
      assert.ok(
        ScenarioFrameSchema.parse(frame).beats.length >= 1,
        'the fixture that catch falls back to has to clear the same floor, or the rescue wedges exactly like the thing it is rescuing from',
      );
    }
  });

  test('the floor travels to the model, not just to our own parse', () => {
    // This is the one place this file breaks its own "no refinements" rule, and
    // it is only allowed because the constraint survives the trip. The SDK's
    // schema transform passes minItems through when it is 0 or 1 and demotes
    // every other value into a prose description — so `.min(1)` is enforced
    // server-side, while `.min(3)` would quietly become a suggestion and turn a
    // model slip into a hard parse failure for no gain.
    const wire = zodOutputFormat(ScenarioFrameSchema) as unknown as {
      schema: { properties: Record<string, { minItems?: number }> };
    };
    assert.equal(
      wire.schema.properties.beats?.minItems,
      1,
      'the beats floor must reach the API in the request, or we are only catching the empty frame after paying for it',
    );
  });
});

describe('the schemas are safe for structured outputs', () => {
  test('every generated object forbids unknown properties and requires every key', () => {
    // The API demands additionalProperties: false and treats every property as
    // required. zodOutputFormat produces the JSON schema the request will carry,
    // so this asserts on exactly what the server will see.
    for (const [name, schema] of [
      ['tutor_turn', TurnSchema],
      ['scenario_frame', ScenarioFrameSchema],
      ['memory_extraction', MemoryExtractionSchema],
      ['drill_batch', DrillBatchSchema],
    ] as const) {
      const format = zodOutputFormat(schema);
      const text = JSON.stringify(format);
      assert.ok(text.includes('"additionalProperties":false'), `${name} allows unknown properties`);

      const objects = collectObjects(JSON.parse(text));
      for (const obj of objects) {
        const keys = Object.keys(obj.properties ?? {});
        if (keys.length === 0) continue;
        assert.deepEqual(
          [...(obj.required ?? [])].sort(),
          [...keys].sort(),
          `${name} has an object where not every property is required`,
        );
      }
    }
  });

  test('nullable is expressed as a null union, never as an absent property', () => {
    // One representative nullable field per schema that ships to the API.
    for (const [name, schema] of [
      ['tutor_turn (frWritten-style fields)', TurnSchema],
      ['memory_extraction (openerFr/openerEn)', MemoryExtractionSchema],
      ['drill_batch (repeat-this ipa)', DrillBatchSchema],
    ] as const) {
      const text = JSON.stringify(zodOutputFormat(schema));
      assert.ok(/"null"/.test(text), `expected null unions in ${name}`);
    }
  });
});

/** Walk a JSON schema tree and collect every object-typed node. */
function collectObjects(node: unknown, out: { properties?: Record<string, unknown>; required?: string[] }[] = []): typeof out {
  if (Array.isArray(node)) {
    for (const item of node) collectObjects(item, out);
    return out;
  }
  if (typeof node === 'object' && node !== null) {
    const record = node as Record<string, unknown>;
    if (record.type === 'object' || record.properties) {
      out.push(record as (typeof out)[number]);
    }
    for (const value of Object.values(record)) collectObjects(value, out);
  }
  return out;
}
