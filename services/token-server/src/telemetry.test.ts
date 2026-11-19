import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { test } from 'node:test';
import { observeRequest, requestMetrics } from './telemetry.ts';

test('every server route prefix has its own metrics label, and the exporter accepts it', async () => {
  const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
  const prefixes = [...new Set([...source.matchAll(/url\.pathname\s*(?:===\s*|\.startsWith\(\s*)'\/([^/'?]+)/g)].map(match => match[1]!))];
  assert.ok(prefixes.length >= 10, `found ${prefixes.join(',')}`);
  const log = console.log; console.log = () => {};
  try {
    for (const prefix of prefixes) {
      const res = Object.assign(new EventEmitter(), { statusCode: 200, writableFinished: true, setHeader() {} });
      observeRequest({ url: `/${prefix}/x?y=1` } as IncomingMessage, res as unknown as ServerResponse);
      res.emit('finish');
    }
  } finally { console.log = log; }
  const metrics = requestMetrics();
  for (const prefix of prefixes) assert.equal(metrics.routes[prefix]?.requests, 1, `/${prefix} has no label of its own`);
  assert.equal(metrics.routes.unknown, undefined);
  const exporter = await import(new URL('../../../deployment/observability.mjs', import.meta.url).href);
  const emitted = { ...metrics.routes, unknown: { requests: 0, errors: 0, durationBuckets: metrics.durationBoundsMs.map(() => 0) } };
  const payload = { http: { ...metrics, routes: emitted }, operations: { version: 1, tutor: true, practice: true, maintenance: true, erasurePending: 0, erasureOldestSeconds: 0 } };
  assert.deepEqual(Object.keys(exporter.decodeMetrics(payload).http.routes).sort(), Object.keys(emitted).sort());
});
