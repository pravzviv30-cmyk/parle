/** Keep recent practice without erasing the learner's best earned independence. */
export function retainCompletions<T extends { at: number; rung: number }>(sorted: readonly T[], cap: number): T[] {
  if (cap < 1) return [];
  if (sorted.length <= cap) return [...sorted];
  let best: T | undefined;
  for (const row of sorted) {
    if (Number.isInteger(row.rung) && row.rung >= 1 && row.rung <= 4 && (!best || row.rung > best.rung)) best = row;
  }
  const recent = sorted.slice(-cap);
  if (!best || recent.includes(best)) return recent;
  return [best, ...recent.slice(1)].sort((a, b) => a.at - b.at);
}
