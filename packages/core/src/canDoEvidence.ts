import type { ConvoView } from './protocol/protocol.ts';
import { getMission, type MissionId } from './missions/missions.ts';
import { readMissionTasks } from './missions/tasks.ts';

export const MAX_CAN_DO_SOURCES = 8;
export const MAX_CAN_DO_QUOTE_CHARS = 240;
export interface CanDoSource { sourceId: string; beatId: string; quote: string }
export interface CanDoEvidence extends CanDoSource { sessionId: string; missionId: MissionId }
export interface CurrentMissionFinish { sessionId: string; missionId: string; rung: number }
const sessionPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function readableQuote(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_CAN_DO_QUOTE_CHARS
    && value.trim().split(/\s+/u).length <= 40 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}
export function readCanDoEvidence(value: unknown): CanDoEvidence | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const mission = typeof row.missionId === 'string' ? getMission(row.missionId) : undefined;
  if (!mission || typeof row.sessionId !== 'string' || !sessionPattern.test(row.sessionId)
    || typeof row.sourceId !== 'string' || !/^accepted-[1-9]\d{0,3}$/.test(row.sourceId)
    || typeof row.beatId !== 'string' || !mission.beatIds.includes(row.beatId) || !readableQuote(row.quote)) return null;
  return { sessionId: row.sessionId, missionId: mission.id, sourceId: row.sourceId, beatId: row.beatId, quote: row.quote };
}

/** Transient accepted-input provenance; never lifetime achievement or model history. */
export class CanDoEvidenceLedger {
  readonly missionId: string;
  private accepted: CanDoSource[] = [];
  private firstWin: boolean | null = null;
  private sequence = 0;
  private revoked = false;
  constructor(missionId: string | null | undefined) { this.missionId = missionId ?? ''; }
  get sources(): readonly CanDoSource[] { return this.accepted.map(row => ({ ...row })); }
  get independentFinish(): boolean { return !this.revoked && this.firstWin === true; }
  noteWinningView(view: ConvoView): void {
    if (this.revoked || this.firstWin !== null || view.missionDone !== true) return;
    const tasks = readMissionTasks(view.missionTasks, this.missionId);
    this.firstWin = view.rung === 4 && tasks !== null && tasks.items.every(item => item.achieved);
  }
  recordAcceptedSource(quote: string, beatId: string, previousGoals: readonly string[], view: ConvoView, outputAccepted: boolean): void {
    if (this.revoked || !outputAccepted || !readableQuote(quote) || previousGoals.includes(beatId)) return;
    const tasks = readMissionTasks(view.missionTasks, this.missionId);
    if (!tasks?.items.some(item => item.id === beatId && item.achieved)) return;
    this.accepted = [...this.accepted, { sourceId: `accepted-${++this.sequence}`, beatId, quote }].slice(-MAX_CAN_DO_SOURCES);
  }
  resolve(sessionId: string, sourceId: string): CanDoEvidence | null {
    if (!this.independentFinish) return null;
    const source = this.accepted.find(row => row.sourceId === sourceId);
    return source ? readCanDoEvidence({ ...source, sessionId, missionId: this.missionId }) : null;
  }
  clear(): void { this.revoked = true; this.accepted = []; this.firstWin = null; }
}

/** The phone requires its own current win and verbatim learner line as well. */
export function currentCanDoQuote(evidence: CanDoEvidence | null | undefined, finish: CurrentMissionFinish | null | undefined,
  lines: readonly { who: string; fr: string }[]): string | null {
  const valid = readCanDoEvidence(evidence);
  return valid && finish?.rung === 4 && valid.sessionId === finish.sessionId && valid.missionId === finish.missionId
    && lines.some(line => line.who === 'learner' && line.fr === valid.quote) ? valid.quote : null;
}
