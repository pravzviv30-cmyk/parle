import { getMission } from './missions.ts';

/** Whole session-local observation list; never derived from beat position. */
export interface MissionTasks {
  missionId: string;
  items: { id: string; goalEn: string; achieved: boolean }[];
}

/** Present but unreadable evidence stays null, distinct from old-worker absence. */
export function readMissionTasks(value: unknown, activeMissionId?: string | null): MissionTasks | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const list = value as Record<string, unknown>;
  if (typeof list.missionId !== 'string' || (activeMissionId !== undefined && list.missionId !== activeMissionId)) return null;
  const mission = getMission(list.missionId);
  if (!mission || !Array.isArray(list.items) || list.items.length !== mission.beatIds.length ||
      list.items.length === 0 || list.items.length > 12) return null;
  const items: MissionTasks['items'] = [];
  for (const [index, raw] of list.items.entries()) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (item.id !== mission.beatIds[index] || typeof item.goalEn !== 'string' ||
        item.goalEn.trim().length === 0 || item.goalEn.length > 200 || /[\u0000-\u001f\u007f]/u.test(item.goalEn) ||
        typeof item.achieved !== 'boolean') return null;
    items.push({ id: item.id as string, goalEn: item.goalEn, achieved: item.achieved });
  }
  return { missionId: mission.id, items };
}
