/**
 * The envelope, held to the one job it has: never let something unreadable off the
 * network turn into a crash, or into a write over data this device can read.
 *
 * Every case here is a payload that could actually appear. A row written by a newer
 * build, a row written by an older one, a half-finished write, a service-role paste that
 * went in as a bare object, and a blob big enough that a cap somewhere else has failed.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENVELOPE_VERSION,
  MAX_ENVELOPE_BYTES,
  envelopeBytes,
  innerVersion,
  parseJson,
  readEnvelope,
  sameData,
  sealEnvelope,
  serialise,
  stableStringify,
  utf8Bytes,
} from './envelope.ts';

describe('the sync envelope — what crosses the wire', () => {
  test('a sealed envelope carries the device and the clock, and the blob untouched', () => {
    const data = { version: 3, entries: [{ at: 1, kind: 'convo' }] };
    const envelope = sealEnvelope(data, 'device-a', 1_700_000_000_000);
    assert.equal(envelope.v, ENVELOPE_VERSION);
    assert.equal(envelope.deviceId, 'device-a');
    assert.equal(envelope.savedAt, 1_700_000_000_000);
    assert.equal(envelope.data, data, 'the store blob is passed through, never rebuilt');
    assert.equal(
      Object.prototype.hasOwnProperty.call(envelope, 'revision'),
      false,
      'revision belongs to the column, so that there is one ordering truth and not two',
    );
  });

  test('a round trip through JSON reads back as the same envelope', () => {
    const envelope = sealEnvelope([{ id: 'a' }], 'device-a', 42);
    const reading = readEnvelope(JSON.parse(JSON.stringify(envelope)) as unknown);
    assert.equal(reading.ok, true);
    assert.deepEqual(reading.ok ? reading.envelope.data : null, [{ id: 'a' }]);
  });

  test('every shape that is not an envelope is named rather than thrown on', () => {
    const cases: [unknown, string][] = [
      [null, 'not-an-object'],
      ['{}', 'not-an-object'],
      [42, 'not-an-object'],
      [[1, 2, 3], 'not-an-object'],
      [{ v: 2, deviceId: 'd', savedAt: 1, data: {} }, 'unknown-envelope-version'],
      [{ v: 1, deviceId: '', savedAt: 1, data: {} }, 'no-device-id'],
      [{ v: 1, savedAt: 1, data: {} }, 'no-device-id'],
      [{ v: 1, deviceId: 'd', savedAt: 'yesterday', data: {} }, 'no-saved-at'],
      [{ v: 1, deviceId: 'd', savedAt: Number.NaN, data: {} }, 'no-saved-at'],
      [{ v: 1, deviceId: 'd', savedAt: 1 }, 'no-data'],
      [{ v: 1, deviceId: 'd', savedAt: 1, data: undefined }, 'no-data'],
    ];
    for (const [value, reason] of cases) {
      const reading = readEnvelope(value);
      assert.equal(reading.ok, false, `${JSON.stringify(value)} was accepted as an envelope`);
      assert.equal(reading.ok === false ? reading.reason : null, reason);
    }
  });

  test('a payload that cannot survive JSON is refused rather than half-sent', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const reading = readEnvelope({ v: 1, deviceId: 'd', savedAt: 1, data: cyclic });
    assert.equal(reading.ok, false);
    assert.equal(reading.ok === false ? reading.reason : null, 'not-serialisable');
    assert.equal(serialise(cyclic), null);
    assert.equal(envelopeBytes(sealEnvelope(cyclic, 'd', 1)), null);
  });

  test('a null data field is a real value and is kept, because an empty store is a fact', () => {
    const reading = readEnvelope({ v: 1, deviceId: 'd', savedAt: 1, data: null });
    assert.equal(reading.ok, true);
    assert.equal(reading.ok ? reading.envelope.data : 'missing', null);
  });

  test('size is counted in UTF-8 bytes, so accented French is not under-measured', () => {
    assert.equal(utf8Bytes('abc'), 3);
    assert.equal(utf8Bytes('é'), 2, 'one UTF-16 unit, two bytes on the wire');
    assert.equal(utf8Bytes('日'), 3);
    assert.equal(utf8Bytes('😀'), 4, 'one code point across two UTF-16 units');
    assert.equal(utf8Bytes('\ud800'), 3, 'a lone surrogate still has a byte cost');
    assert.equal(utf8Bytes("Je voudrais un café, s'il vous plaît"), 38);
  });

  test('the size ceiling is measured on the whole envelope, not on the blob alone', () => {
    const small = sealEnvelope({ a: 'x'.repeat(10) }, 'device-a', 1);
    assert.equal(envelopeBytes(small)! < MAX_ENVELOPE_BYTES, true);
    const big = sealEnvelope({ a: 'x'.repeat(MAX_ENVELOPE_BYTES) }, 'device-a', 1);
    assert.equal(envelopeBytes(big)! > MAX_ENVELOPE_BYTES, true);
    assert.equal(MAX_ENVELOPE_BYTES, 131_072);
  });

  test('the inner schema version is read from the blob, and absence is not a version', () => {
    assert.equal(innerVersion({ version: 4, entries: [] }), 4);
    assert.equal(innerVersion([{ id: 'a' }]), null, 'the review deck is a bare array and has no opinion');
    assert.equal(innerVersion({ version: 'four' }), null);
    assert.equal(innerVersion(null), null);
  });

  test('two blobs that differ only in key order are the same blob', () => {
    assert.equal(sameData({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
    assert.equal(sameData({ a: [1, { x: 1, y: 2 }] }, { a: [1, { y: 2, x: 1 }] }), true);
    assert.equal(sameData({ a: 1 }, { a: 1, b: undefined }), true, 'a missing field and an undefined one are one state');
    assert.equal(sameData([1, 2], [2, 1]), false, 'order inside an array is data, not formatting');
    assert.equal(
      sameData(null, undefined),
      true,
      'both mean this device has nothing here, and the engine must not treat that as a change to push',
    );
    assert.equal(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
  });

  test('reading disk or a response body never throws, whatever is in it', () => {
    assert.equal(parseJson(null), null);
    assert.equal(parseJson(''), null);
    assert.equal(parseJson('{oh no'), null);
    assert.deepEqual(parseJson('{"a":1}'), { a: 1 });
  });
});
