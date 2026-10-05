import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { renewalSweep, supabaseRenewalsDue, type DueRenewal } from './renewals.ts';
import type { RenewalOutcome } from './revenuecat.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number): DueRenewal => ({ userId: id(n), periodEnd: new Date('2026-10-05T12:00:00.000Z') });
const quietLogger = () => {
  const lines: string[] = [];
  return { lines, logger: { log: (line: string) => lines.push(line), error: (line: string) => lines.push(line) } };
};

describe('the renewal sweep re-reads ended periods from the vendor (F733)', () => {
  test('the sweep asks about ended periods in bounded batches and never holds up the maintenance loop', async () => {
    const asked: string[] = [];
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const { lines, logger } = quietLogger();
    const sweep = renewalSweep({
      due: async () => [1, 2, 3, 4].map(row),
      renew: async (due) => { asked.push(due.userId); if (asked.length === 1) await held; return 'renewed'; },
      logger,
    }, { everyMs: 60_000, read: 100, batch: 3, quietMs: 600_000 });

    const first = sweep.tick(0);
    assert.ok(first, 'a due sweep did not start');
    assert.equal(sweep.tick(1), null, 'a second sweep started while the first was still asking the vendor');
    release();
    await first;
    assert.deepEqual(asked, [id(1), id(2), id(3)], 'one sweep made more vendor reads than its batch');
    assert.equal(sweep.tick(30_000), null, 'a sweep ran before its interval');
    assert.match(lines.at(-1)!, /"event":"billing_renewals".*"renewed":3/);
  });

  test('a row still waiting on the store is left quiet, and the rows behind it are not starved', async () => {
    const asked: string[] = [];
    const outcomes: Record<string, RenewalOutcome | Error> = { [id(1)]: 'waiting', [id(2)]: new Error('vendor down'), [id(3)]: 'lapsed' };
    const { logger } = quietLogger();
    const sweep = renewalSweep({
      due: async () => [1, 2, 3].map(row),
      renew: async (due) => {
        asked.push(due.userId);
        const outcome = outcomes[due.userId]!;
        if (outcome instanceof Error) throw outcome;
        return outcome;
      },
      logger,
    }, { everyMs: 1_000, read: 100, batch: 1, quietMs: 10_000 });

    await sweep.tick(0);
    await sweep.tick(1_000);
    await sweep.tick(2_000);
    assert.deepEqual(asked, [id(1), id(2), id(3)], 'a waiting or failing row blocked the one behind it');
    await sweep.tick(3_000);
    assert.deepEqual(asked, [id(1), id(2), id(3), id(3)], 'a quiet row was asked about again before its time');
    await sweep.tick(10_000);
    assert.equal(asked.at(-1), id(1), 'a quiet row was never asked about again');
  });

  test('a sweep that reads a full page of due rows says so on the error stream', async () => {
    // F733 review: ten vendor reads a sweep is a launch-scale bound. Rows past
    // the page are not read at all, so a full page is the alertable signal.
    const errors: string[] = [];
    const logger = { log: () => {}, error: (line: string) => errors.push(line) };
    const full = renewalSweep({ due: async () => [1, 2, 3].map(row), renew: async () => 'waiting', logger },
      { everyMs: 1_000, read: 3, batch: 1, quietMs: 1_000 });
    await full.tick(0);
    assert.match(errors.join('\n'), /"event":"billing_renewals_backlog","due":3,"read":3/);
    errors.length = 0;
    const room = renewalSweep({ due: async () => [1, 2].map(row), renew: async () => 'waiting', logger },
      { everyMs: 1_000, read: 3, batch: 1, quietMs: 1_000 });
    await room.tick(0);
    assert.deepEqual(errors, [], 'a sweep with room to spare raised a backlog');
  });

  test('a failed read of the due list is logged and the next sweep still runs', async () => {
    const { lines, logger } = quietLogger();
    let calls = 0;
    const sweep = renewalSweep({
      due: async () => { calls += 1; if (calls === 1) throw new Error('database unavailable'); return []; },
      renew: async () => 'renewed',
      logger,
    }, { everyMs: 1_000, read: 100, batch: 10, quietMs: 1_000 });
    await sweep.tick(0);
    assert.match(lines.join('\n'), /billing_renewals_failure/);
    assert.doesNotMatch(lines.join('\n'), /database unavailable/, 'an error body reached the log');
    await sweep.tick(1_000);
    assert.equal(calls, 2);
  });

  test('the due list is read through the service-only function and validated', async () => {
    const calls: { url: string; body: string; auth: string | null }[] = [];
    const answer = (body: unknown, status = 200) => async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), body: String(init?.body), auth: new Headers(init?.headers).get('authorization') });
      return new Response(JSON.stringify(body), { status });
    };
    const good = { renewals: [{ userId: id(7), periodEnd: '2026-10-05T12:00:00+00:00' }] };
    const due = await supabaseRenewalsDue('https://db.test/', 'service', answer(good) as typeof fetch)(10);
    assert.deepEqual(due, [{ userId: id(7), periodEnd: new Date('2026-10-05T12:00:00.000Z') }]);
    assert.equal(calls[0]!.url, 'https://db.test/rest/v1/rpc/billing_renewals_due_v1');
    assert.deepEqual(JSON.parse(calls[0]!.body), { p_limit: 10 });
    assert.equal(calls[0]!.auth, 'Bearer service');

    for (const bad of [
      { renewals: [{ userId: 'not-a-user', periodEnd: '2026-10-05T12:00:00Z' }] },
      { renewals: [{ userId: id(1), periodEnd: 'soon' }] },
      { renewals: [row(1), row(2)].map(r => ({ userId: r.userId, periodEnd: r.periodEnd.toISOString() })) },
      { rows: [] },
      [],
    ]) {
      await assert.rejects(supabaseRenewalsDue('https://db.test', 'service', answer(bad) as typeof fetch)(1), /invalid/);
    }
    await assert.rejects(supabaseRenewalsDue('https://db.test', 'service', answer({}, 500) as typeof fetch)(1), /failed \(500\)/);
  });

  test('the maintenance worker starts the sweep only with the billing mapping, and never awaits it', () => {
    const worker = readFileSync(path.join(import.meta.dirname, '..', 'maintenanceWorker.ts'), 'utf8');
    assert.match(worker, /const billingRead = revenueCatReadConfiguration\(process\.env\);/);
    assert.match(worker, /billingRead === null \? null : renewalSweep\(/);
    assert.match(worker, /renew: row => renewSubscriber\(row\.userId, row\.periodEnd, entitlements, billingRead\)/);
    assert.match(worker, /void renewals\?\.tick\(\);/);
    assert.doesNotMatch(worker, /await renewals/, 'a slow vendor would hold up room stops');
  });
});
