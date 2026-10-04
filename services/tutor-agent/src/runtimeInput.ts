import type { ClientMessage } from '@luvani/core';
import { isAcceptedLearnerText } from './safety.ts';

/** Current client packets carry controls or one answer; profiles ride grant metadata. */
export const MAX_CLIENT_PACKET_BYTES = 8_192;
export const INPUT_LIMIT_MESSAGE = 'That message is too long. Send a shorter answer.';
export const INPUT_BUSY_MESSAGE = 'Your tutor is finishing a reply. Try again in a moment.';
const decoder = new TextDecoder('utf-8', { fatal: true });
const CONTROL = new Set(['ready', 'help', 'skip', 'slower', 'english', 'typing', 'moment', 'leave']);

export type ClientInputResult = { message: ClientMessage; reason?: never } | { message: null; reason: 'malformed' | 'oversized' };

/** Validate the original packet before forgiving protocol decoding can drop fields. */
export function readClientInput(payload: Uint8Array): ClientInputResult {
  if (payload.byteLength > MAX_CLIENT_PACKET_BYTES) return { message: null, reason: 'oversized' };
  try {
    const value: unknown = JSON.parse(decoder.decode(payload));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return { message: null, reason: 'malformed' };
    const fields = value as Record<string, unknown>;
    const tag = fields.t;
    const exact = (keys: readonly string[]) => Object.keys(fields).every(key => keys.includes(key));
    if (typeof tag !== 'string') return { message: null, reason: 'malformed' };
    if (tag === 'say' || tag === 'choice') {
      if (!exact(['t', 'text']) || typeof fields.text !== 'string') return { message: null, reason: 'malformed' };
      if (!isAcceptedLearnerText(fields.text)) return { message: null, reason: 'oversized' };
      return { message: { t: tag, text: fields.text } };
    }
    if (tag === 'mode' && exact(['t', 'voiceless']) && typeof fields.voiceless === 'boolean') return { message: { t: 'mode', voiceless: fields.voiceless } };
    if (tag === 'hear' && exact(['t', 'line']) && (fields.line === undefined || fields.line === 'support' || fields.line === 'scene')) {
      return { message: fields.line === undefined ? { t: 'hear' } : { t: 'hear', line: fields.line } };
    }
    if (CONTROL.has(tag) && exact(['t'])) return { message: { t: tag } as ClientMessage };
  } catch { /* Payload and parse errors never enter logs. */ }
  return { message: null, reason: 'malformed' };
}
