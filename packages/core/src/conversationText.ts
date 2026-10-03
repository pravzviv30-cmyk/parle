/** Optional saved text is separate from earned practice and never supplies learning evidence. */
import type { ServerMessage } from './protocol/protocol.ts';
export interface ConversationTextLine {
  id: string;
  who: 'tutor' | 'learner' | 'narration' | 'coach';
  fr: string;
  frWritten: string | null;
  en: string | null;
}
export interface ConversationText {
  sessionId: string;
  title: string;
  lines: readonly ConversationTextLine[];
}
export interface SavedConversationText extends ConversationText { savedAt: string }
export interface ConversationTextPage { conversations: SavedConversationText[]; nextCursor: string | null }
export function conversationTextCursor(value: unknown): { savedAt: string; sessionId: string } | null {
  if (typeof value !== 'string' || value.length > 256) return null;
  try {
    const v = JSON.parse(value);
    if (typeof v !== 'object' || v === null || !keys(v, ['savedAt', 'sessionId']) ||
      typeof v.savedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(v.savedAt) || !Number.isFinite(Date.parse(v.savedAt)) ||
      typeof v.sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.sessionId)) return null;
    return { savedAt: v.savedAt, sessionId: v.sessionId };
  } catch { return null; }
}
export const CONVERSATION_TEXT_BYTES = 192 * 1024;
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
export function isConversationTextLine(value: unknown): value is ConversationTextLine {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return keys(v, ['id', 'who', 'fr', 'frWritten', 'en']) && text(v.id, 80) &&
    ['tutor', 'learner', 'narration', 'coach'].includes(v.who as string) && text(v.fr, 2000) &&
    (v.frWritten === null || text(v.frWritten, 2000)) && (v.en === null || text(v.en, 2000));
}
export function isConversationText(value: unknown): value is ConversationText {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return keys(v, ['sessionId', 'title', 'lines']) && typeof v.sessionId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.sessionId) &&
    text(v.title, 160) && Array.isArray(v.lines) && v.lines.length > 0 && v.lines.length <= 500 &&
    v.lines.every(isConversationTextLine) && new Set(v.lines.map(line => line.id)).size === v.lines.length &&
    new TextEncoder().encode(JSON.stringify(v)).byteLength <= CONVERSATION_TEXT_BYTES;
}
export function isSavedConversationText(value: unknown): value is SavedConversationText {
  if (typeof value !== 'object' || value === null) return false;
  const { savedAt, ...conversation } = value as Record<string, unknown>;
  return typeof savedAt === 'string' && Number.isFinite(Date.parse(savedAt)) && isConversationText(conversation);
}

/** Memory only until a deliberate save. Overflow invalidates the whole buffer, never silently truncates it. */
export class ConversationTextBuffer {
  private lines: ConversationTextLine[] | null = [];
  append(line: ConversationTextLine): void {
    if (this.lines === null) return;
    if (!isConversationTextLine(line)) { this.lines = null; return; }
    if (this.lines.some(saved => saved.id === line.id)) return;
    this.lines.push({ ...line });
    if (this.lines.length > 500 || new TextEncoder().encode(JSON.stringify(this.lines)).byteLength > CONVERSATION_TEXT_BYTES - 1024) this.lines = null;
  }
  remove(id: string): void { if (this.lines !== null) this.lines = this.lines.filter(line => line.id !== id); }
  clear(): void { this.lines = []; }
  invalidate(): void { this.lines = null; }
  snapshot(): readonly ConversationTextLine[] | null { return this.lines?.map(line => ({ ...line })) ?? null; }
}

/** Capture confirmed wire content, not optimistic drafts or repeated ready views. */
export class ConversationTextRecorder {
  private buffer = new ConversationTextBuffer();
  private sequence = 0;
  private views = new Set<string>();
  private lastOpening: string | null = null;
  private ended = false;
  private blocked = false;
  clear(): void { this.buffer.clear(); this.sequence = 0; this.views.clear(); this.lastOpening = null; this.ended = false; this.blocked = false; }
  receive(message: ServerMessage): void {
    if (message.t === 'safety' && message.action === 'stop') { this.buffer.clear(); this.blocked = true; return; }
    if (this.ended || this.blocked) return;
    const append = (line: Omit<ConversationTextLine, 'id'>) => this.buffer.append({ ...line, id: `s${++this.sequence}` });
    if (message.t === 'recap') { this.ended = true; return; }
    if (message.t === 'transcript' && message.final) {
      append({ who: 'learner', fr: message.text, frWritten: null, en: null });
    }
    if (message.t === 'opening') {
      const key = JSON.stringify(message.prompt);
      if (key === this.lastOpening) return;
      this.lastOpening = key;
      append({ who: 'tutor', fr: message.prompt.fr, frWritten: null, en: message.prompt.en });
    }
    if (message.t === 'convo') {
      const key = message.view.textTurnId;
      // An older agent supplies no stable identity. Keep practice working but
      // refuse to claim its ambiguous replay stream is a complete saved text.
      if (typeof key !== 'string' || !text(key, 80)) { this.buffer.invalidate(); return; }
      if (this.views.has(key)) return;
      if (this.views.size >= 500) { this.buffer.invalidate(); return; }
      this.views.add(key);
      for (const [who, line] of [['narration', message.view.narration], ['tutor', message.view.sceneReply]] as const) {
        if (line) append({ who, fr: line.fr, frWritten: line.frWritten ?? null, en: line.en });
      }
      if (message.view.coachLine) append({ who: 'coach', fr: message.view.coachLine, frWritten: null, en: null });
      for (const correction of message.view.coachNow) {
        append({ who: 'coach', fr: `“${correction.quote}” → “${correction.betterWritten ?? correction.better}”\n${correction.why}`, frWritten: null, en: correction.betterEn });
      }
    }
  }
  snapshot(): readonly ConversationTextLine[] | null { return this.ended && !this.blocked ? this.buffer.snapshot() : null; }
}
