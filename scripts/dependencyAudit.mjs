/** Pure audit policy. Network access belongs only to gate.mjs --audit. */
const HIGH = new Set(['high', 'critical']);
const GHSA = /^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
const range = value => typeof value === 'string' ? value.replace(/\s+/g, '') : '';
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : NaN;
};
/** lockedAt is one exact version, or a non-empty list of them when the tree installs several copies. */
const versions = value => typeof value === 'string' ? [value] : Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item !== '') && new Set(value).size === value.length ? value : null;

export function evaluateAudit(record, lock, report, now = Date.now()) {
  const problems = [];
  if (!record || !Array.isArray(record.advisories) || !lock?.packages || !report?.vulnerabilities ||
    Array.isArray(report.vulnerabilities) || typeof report.vulnerabilities !== 'object' || report.error) {
    return { problems: ['audit metadata, lockfile or decision record is missing/malformed'], accepted: [] };
  }
  const decisions = new Map();
  for (const decision of record.advisories) {
    if (!decision || typeof decision.module !== 'string' || !versions(decision.lockedAt) || !Array.isArray(decision.advisories) || decisions.has(decision.module) || !['accepted', 'fixed'].includes(decision.decision) || (Array.isArray(decision.lockedAt) && decision.decision !== 'accepted')) {
      problems.push('duplicate or malformed advisory decision'); continue;
    }
    decisions.set(decision.module, decision);
    if (!versions(decision.lockedAt).includes(lock.packages[`node_modules/${decision.module}`]?.version)) problems.push(`${decision.module}: reviewed lock version changed`);
    if (Array.isArray(decision.lockedAt)) for (const version of decision.lockedAt) {
      if (!Object.entries(lock.packages).some(([key, row]) => (key === `node_modules/${decision.module}` || key.endsWith(`/node_modules/${decision.module}`)) && row?.version === version)) problems.push(`${decision.module}: listed version ${version} is not installed`);
    }
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
      if (explicitlyApproved && row.nodes.some(node => !versions(decision.lockedAt).includes(lock.packages[node]?.version))) problems.push(`${name}: vulnerable installed copy is outside the reviewed exact version`);
    }
  }
  for (const decision of decisions.values()) {
    if (decision.decision !== 'accepted') continue;
    const live = roots.get(decision.module) ?? [];
    for (const url of decision.advisories ?? []) if (!live.some(advisory => advisory.url === url)) problems.push(`${decision.module}: accepted advisory no longer reported (${url})`);
  }
  return { problems: [...new Set(problems)], accepted: [...decisions.values()].filter(decision => decision.decision === 'accepted').map(decision => decision.module) };
}

/** The line a clean audit prints. With no accepted root it says so rather than naming an empty list. */
export function auditSummary(totals, accepted) {
  const counts = `audit: ${totals.critical ?? 0} critical, ${totals.high ?? 0} high, ${totals.moderate ?? 0} moderate — `;
  return accepted.length === 0 ? `${counts}no accepted high roots.` : `${counts}every high root is one of ${accepted.join(', ')}, each recorded with a reachability argument.`;
}
