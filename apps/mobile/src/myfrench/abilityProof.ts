import { getMission, isEarned, type MissionProgress } from '@luvani/core';

/** The most recently independently finished scene that still has catalogue content. */
export function abilityProof(progress: readonly MissionProgress[], completions: readonly { id: string; at: number; rung: number }[], now = Date.now()) {
  const earned = progress.filter(isEarned);
  const proven = completions
    .filter((row) => row.rung === 4 && Number.isFinite(row.at) && row.at > 0 && row.at <= now && earned.some((item) => item.mission.id === row.id))
    .sort((a, b) => b.at - a.at);
  const latest = proven[0];
  const mission = latest ? getMission(latest.id) : undefined;
  return latest && mission ? { mission, at: latest.at } : null;
}
