import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
const routes = new Set(['health', 'ready', 'session', 'account', 'billing', 'drill', 'phrase-audio', 'conversation-packs', 'conversation-text', 'product-events', 'agent', 'internal']);
const buckets = [50, 100, 250, 500, 1000, 2500, 5000, 15000, Infinity];
const processIdentity={bootId:randomUUID(),startedAt:new Date().toISOString()};
const counts = new Map<string, { requests: number; errors: number; durationBuckets: number[] }>();
/** Low-cardinality fields only. Caller IDs, URLs, headers and body never enter logs. */
export function observeRequest(req: IncomingMessage, res: ServerResponse) {
  const requestId = randomUUID();
  res.setHeader('x-request-id', requestId);
  const segment = req.url?.split(/[/?]/)[1] ?? '';
  const route = routes.has(segment) ? segment : 'unknown';
  const start = performance.now();
  let recorded = false;
  const complete = () => {
    if (recorded) return; recorded = true;
    const durationMs = Math.round(performance.now() - start);
    const status = res.writableFinished ? res.statusCode : 499;
    const metrics = counts.get(route) ?? { requests: 0, errors: 0, durationBuckets: buckets.map(() => 0) };
    metrics.requests++; if (status >= 500 || status === 499) metrics.errors++;
    const index = buckets.findIndex(bound => durationMs <= bound); metrics.durationBuckets[index] = (metrics.durationBuckets[index] ?? 0) + 1;
    counts.set(route, metrics);
    console.log(JSON.stringify({ event: 'http_request', requestId, route, status, durationMs }));
  };
  res.once('finish', complete); res.once('close', complete);
}
export function requestMetrics() { return { process:processIdentity,durationBoundsMs: buckets.map(value => Number.isFinite(value) ? value : null), routes: Object.fromEntries(counts) }; }
