import assert from 'node:assert/strict';
import { test } from 'node:test';
const { evaluateAudit } = await import(new URL('../../../scripts/dependencyAudit.mjs', import.meta.url).href);
const first = 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc';
const second = 'https://github.com/advisories/GHSA-dddd-eeee-ffff';
const now = Date.parse('2026-10-04T12:00:00Z');
function fixture() {
  return {
    record: { advisories: [{ module: 'fixture', severity: 'high', decision: 'accepted', lockedAt: '1.0.0', reviewed: '2026-10-03', expires: '2026-11-02', advisories: [first], advisoryRanges: { [first]: '<1.1.0' } }] },
    lock: { packages: { 'node_modules/fixture': { version: '1.0.0' } } },
    report: { vulnerabilities: { fixture: { name: 'fixture', via: [{ url: first, range: '<1.1.0', severity: 'high' }], nodes: ['node_modules/fixture'] } } },
  };
}
const check = (f: ReturnType<typeof fixture>, date = now) => evaluateAudit(f.record, f.lock, f.report, date).problems as string[];
test('only the exact reviewed advisory, range, version and active expiry is accepted', () => {
  assert.deepEqual(check(fixture()), []);
  const unknown = fixture();unknown.report.vulnerabilities.fixture.via.push({ url: second, range: '<1.1.0', severity: 'high' });
  assert.ok(check(unknown).some(item => item.includes('unreviewed high')));
  const range = fixture();range.report.vulnerabilities.fixture.via[0]!.range = '<2.0.0';assert.ok(check(range).some(item => item.includes('range changed')));
  const severity = fixture();severity.report.vulnerabilities.fixture.via[0]!.severity = 'critical';assert.ok(check(severity).some(item => item.includes('unreviewed critical')));
  const version = fixture();version.lock.packages['node_modules/fixture'].version = '1.0.1';assert.ok(check(version).some(item => item.includes('version changed')));
  assert.ok(check(fixture(), Date.parse('2026-11-02T00:00:00Z')).some(item => item.includes('expired')));
});
test('stale, duplicate, malformed and overlong exception windows fail closed', () => {
  const missing = fixture();delete (missing.record.advisories[0] as Partial<typeof missing.record.advisories[0]>).expires;assert.ok(check(missing).length);
  for (const expiry of ['2026-99-99','2026-10-02','2026-12-03']) {const f=fixture();f.record.advisories[0]!.expires=expiry;assert.ok(check(f).length);}
  const future = fixture();future.record.advisories[0]!.reviewed='2026-10-05';assert.ok(check(future).length);
  const duplicate = fixture();duplicate.record.advisories.push(duplicate.record.advisories[0]!);assert.ok(check(duplicate).some(item => item.includes('duplicate')));
  const stale = fixture();stale.report.vulnerabilities.fixture.via=[];assert.ok(check(stale).some(item => item.includes('no longer')));
  assert.ok(evaluateAudit({}, {}, { error: { code:'registry-unavailable' } }, now).problems.length);
  const malformed=fixture();malformed.report.vulnerabilities.fixture.via[0]!.url='https://untrusted.invalid/advisory';assert.ok(check(malformed).some(item=>item.includes('malformed')));
});
test('a recorded fix cannot cover a new advisory and unknown moderate findings remain reported without acceptance', () => {
  const fixed=fixture();fixed.record.advisories[0]!.decision='fixed';assert.ok(check(fixed).some(item=>item.includes('recorded fixed')));
  const moderate=fixture();moderate.report.vulnerabilities.fixture.via.push({url:second,range:'<2.0.0',severity:'moderate'});assert.deepEqual(check(moderate),[]);
  const shifted=fixture();(shifted.report.vulnerabilities.fixture.nodes as string[]).push('nested/node_modules/fixture');
  (shifted.lock.packages as Record<string,{version:string}>)['nested/node_modules/fixture']={version:'0.9.0'};
  assert.ok(check(shifted).some(item=>item.includes('outside the reviewed exact version')));
});
