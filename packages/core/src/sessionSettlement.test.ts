import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSettlementResult, sessionSettlementCopy } from './sessionSettlement.ts';
import { decodeServerMessage, encodeMessage } from './protocol/protocol.ts';

test('settlement rejects invented credit and impossible per-plan balances', () => {
  const valid = { kind: 'restored-current-period', refundedSeconds: 10, secondsRemaining: 1790, plan: 'trial' };
  assert.deepEqual(readSettlementResult(valid), valid);
  for (const patch of [{ refundedSeconds: 0 }, { refundedSeconds: 901 }, { refundedSeconds: -1 }, { refundedSeconds: 1.1 }, { secondsRemaining: 1801 }, { plan: 'unknown' }, { kind: 'not-charged' }]) {
    assert.equal(readSettlementResult({ ...valid, ...patch }), null);
  }
  assert.equal(readSettlementResult({ ...valid, plan: 'starter', secondsRemaining: 10801 }), null);
  assert.equal(readSettlementResult({ kind: 'pending', refundedSeconds: 90 }), null);
  assert.deepEqual(readSettlementResult({ kind: 'pending' }), { kind: 'pending' });
});

test('only a validated settlement and recognized terminal failure cross the wire', () => {
  const result = { kind: 'not-charged' as const, refundedSeconds: 0, secondsRemaining: 1800, plan: 'trial' as const };
  assert.deepEqual(decodeServerMessage(encodeMessage({ t: 'settlement', result })), { t: 'settlement', result });
  assert.equal(decodeServerMessage(new TextEncoder().encode(JSON.stringify({ t: 'settlement', result: { ...result, refundedSeconds: 100 } }))), null);
  const error = (kind: string, recoverable: boolean) => decodeServerMessage(new TextEncoder().encode(JSON.stringify({ t: 'error', message: 'Problem', kind, recoverable, terminal: true })));
  assert.equal((error('llm_error', false) as { terminal?: boolean }).terminal, true);
  assert.equal((error('llm_error', true) as { terminal?: boolean }).terminal, undefined);
  assert.equal((error('connection', false) as { terminal?: boolean }).terminal, undefined);
  assert.match(sessionSettlementCopy({ kind: 'historical-reversal', refundedSeconds: 90, secondsRemaining: 100, plan: 'trial' })!, /earlier allowance/);
  assert.doesNotMatch(sessionSettlementCopy({ kind: 'pending' })!, /are back|restored/);
});
