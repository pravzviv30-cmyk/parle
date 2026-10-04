/** Pure audit policy. Network access belongs only to gate.mjs --audit. */
const HIGH = new Set(['high', 'critical']);
const GHSA = /^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
const range = value => typeof value === 'string' ? value.replace(/\s+/g, '') : '';
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : NaN;
};

export function evaluateAudit(record, lock, report, now = Date.now()) {
  const problems = [];
  if (!record || !Array.isArray(record.advisories) || !lock?.packages || !report?.vulnerabilities ||
    Array.isArray(report.vulnerabilities) || typeof report.vulnerabilities !== 'object' || report.error) {
    return { problems: ['audit metadata, lockfile or decision record is missing/malformed'], accepted: [] };
  }
  const decisions = new Map();
  for (const decision of record.advisories) {
    if (!decision || typeof decision.module !== 'string' || typeof decision.lockedAt !== 'string' || !Array.isArray(decision.advisories) || decisions.has(decision.module) || !['accepted', 'fixed'].includes(decision.decision)) {
      problems.push('duplicate or malformed advisory decision'); continue;
    }
    decisions.set(decision.module, decision);
    if (lock.packages[`node_modules/${decision.module}`]?.version !== decision.lockedAt) problems.push(`${decision.module}: reviewed lock version changed`);
    if (!Array.isArray(decision.advisories) || decision.advisories.length === 0 || decision.advisories.some(url => !GHSA.test(url))) problems.push(`${decision.module}: advisory IDs missing/malformed`);
    if (decision.decision === 'accepted') {
      const reviewed = date(decision.reviewed), expires = date(decision.expires);
      if (!Number.isFinite(reviewed) || !Number.isFinite(expires) || reviewed > now || expires <= reviewed || expires - reviewed > 30 * 86400000 || expires <= now) problems.push(`${decision.module}: exception missing, invalid or expired review window`);
      if (!decision.advisoryRanges || typeof decision.advisoryRanges !== 'object' || (decision.advisories ?? []).some(url => !range(decision.advisoryRanges[url])) || Object.keys(decision.advisoryRanges ?? {}).some(url => !(decision.advisories ?? []).includes(url))) problems.push(`${decision.module}: exact advisory ranges missing/malformed`);
    }
  }
  const roots = new Map();
  for (const [name, row] of Object.entries(report.vulnerabilities)) {
    if (!row || row.name !== name || !Array.isArray(row.via) || !Array.isArray(row.nodes)) { problems.push(`${name}: registry advisory row is malformed`); continue; }
    const direct = row.via.filter(value => value && typeof value === 'object');
    if (direct.length === 0) continue;
    roots.set(name, direct);
    const decision = decisions.get(name);
    if (decision?.decision === 'fixed') problems.push(`${name}: recorded fixed but a root advisory is still reported`);
    for (const advisory of direct) {
      if (!GHSA.test(advisory.url) || !range(advisory.range) || !['info','low','moderate','high','critical'].includes(advisory.severity)) { problems.push(`${name}: advisory metadata is malformed`); continue; }
      const explicitlyApproved = decision?.decision === 'accepted' && decision.advisories.includes(advisory.url) && range(decision.advisoryRanges?.[advisory.url]) === range(advisory.range) && decision.severity === advisory.severity;
      if (decision?.decision === 'accepted' && decision.advisories.includes(advisory.url) && !explicitlyApproved) problems.push(`${name}: reviewed advisory range changed (${advisory.url})`);
      if (HIGH.has(advisory.severity) && !explicitlyApproved) problems.push(`${name}: unreviewed ${advisory.severity} advisory (${advisory.url})`);
      if (explicitlyApproved && row.nodes.some(node => lock.packages[node]?.version !== decision.lockedAt)) problems.push(`${name}: vulnerable installed copy is outside the reviewed exact version`);
    }
  }
  for (const decision of decisions.values()) {
    if (decision.decision !== 'accepted') continue;
    const live = roots.get(decision.module) ?? [];
    for (const url of decision.advisories ?? []) if (!live.some(advisory => advisory.url === url)) problems.push(`${decision.module}: accepted advisory no longer reported (${url})`);
  }
  return { problems: [...new Set(problems)], accepted: [...decisions.values()].filter(decision => decision.decision === 'accepted').map(decision => decision.module) };
}
