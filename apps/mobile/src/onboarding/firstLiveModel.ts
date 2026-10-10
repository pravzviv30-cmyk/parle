import { firstPracticeNext, firstPracticeScenario, isConversationPack, parseFirstPracticeBrief, type ConversationPack, type FirstPracticeBrief } from '@luvani/core';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
export interface FirstContribution { id: string; text: string; input: 'typed' | 'spoken' | 'unknown' }
export interface FirstLiveRecord {
  brief: FirstPracticeBrief;
  sessionId: string | null;
  outcome: 'active' | 'completed' | 'partial' | 'interrupted';
  contributions: FirstContribution[];
  seconds: number;
  completedAt: number | null;
  pack: ConversationPack | null;
}
export function briefFromDraft(draft: PreAccountOnboardingDraft): FirstPracticeBrief {
  return { version: 1, goals: draft.reason ? [draft.reason] : [], level: draft.startLevel,
    confidence: draft.speakingConfidence ?? null, focus: draft.practiceFocus ?? null,
    minutes: typeof draft.minutes === 'number' ? draft.minutes : null, tutorVoice: draft.tutorVoice };
}
export function repairFirstLiveRecord(value: unknown): FirstLiveRecord | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as FirstLiveRecord, brief = parseFirstPracticeBrief(v.brief);
  if (!brief || !['active', 'completed', 'partial', 'interrupted'].includes(v.outcome)
    || (v.sessionId !== null && (typeof v.sessionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(v.sessionId)))
    || !Number.isInteger(v.seconds) || v.seconds < 0 || v.seconds > 1260
    || (v.completedAt !== null && (!Number.isSafeInteger(v.completedAt) || v.completedAt <= 0))
    || !Array.isArray(v.contributions) || v.contributions.length > 500 || new Set(v.contributions.map(c => c?.id)).size !== v.contributions.length
    || !v.contributions.every(c => c && typeof c.id === 'string' && c.id.length > 0 && c.id.length <= 80 && typeof c.text === 'string' && c.text.length <= 2000 && ['typed', 'spoken', 'unknown'].includes(c.input))
    || (v.pack !== null && (!isConversationPack(v.pack) || v.pack.sessionId !== v.sessionId))) return null;
  if (v.outcome === 'completed' && (!v.sessionId || !v.completedAt || !v.pack)) return null;
  return { brief, sessionId: v.sessionId, outcome: v.outcome, contributions: v.contributions,
    seconds: v.seconds, completedAt: v.completedAt, pack: v.pack };
}
const normalized = (s: string) => s.toLocaleLowerCase('fr').normalize('NFC').replace(/[’']/g, "'").replace(/[^\p{L}\p{N}']+/gu, ' ').trim();
/** Only final worker-confirmed learner contributions can support a claim. */
export function firstAchievements(record: FirstLiveRecord): string[] {
  const claims: string[] = [];
  if (record.outcome === 'completed') claims.push(`You completed a conversation: ${firstPracticeScenario(record.brief).fr}.`);
  // The existing pack curates vocabulary. Match exact whole phrases to the
  // learner's confirmed typed words; tutor phrases and uncertain ASR never become quotes.
  for (const phrase of record.pack?.keyPhrases ?? []) {
    const match = record.contributions.find(c => c.input === 'typed' && (` ${normalized(c.text)} `).includes(` ${normalized(phrase.fr)} `));
    if (match && normalized(phrase.fr).length >= 4) claims.push(`You said “${phrase.fr}” by typing.`);
    if (claims.length >= 3) break;
  }
  if (record.contributions.some(c => c.input === 'spoken') && claims.length < 3) claims.push('You took part using your voice.');
  if (claims.length === 0 && record.contributions.some(c => c.input === 'typed')) claims.push('You exchanged messages with your AI tutor.');
  return [...new Set(claims)].slice(0, 3);
}
export function firstLiveSummary(record: FirstLiveRecord) {
  return { heading: record.outcome === 'completed' ? 'Your first session completed.' : record.outcome === 'interrupted' ? 'Your practice was interrupted.' : 'A start worth keeping.',
    detail: record.outcome === 'completed' ? 'Here is what you did in this session.' : record.outcome === 'interrupted' ? 'The connection ended before your practice was complete. Your confirmed contributions are still here.' : 'You ended before completing the exercise. Your confirmed contributions are still here.',
    achievements: firstAchievements(record), next: firstPracticeNext(record.brief) };
}
