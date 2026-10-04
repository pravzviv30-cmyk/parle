/** Error messages, stacks, raw responses and causes can contain learner text or keys. */
const TYPES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'AbortError', 'TimeoutError', 'BrainParseError', 'BrainRefusalError', 'APIError', 'APIConnectionError', 'APIStatusError']);
const CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ERR_INVALID_URL', 'ABORT_ERR']);

export function safeError(error: unknown): { type: string; status?: number; code?: string } {
  const result: { type: string; status?: number; code?: string } = { type: 'Error' };
  if (typeof error !== 'object' || error === null) return result;
  // Even property getters from an unknown SDK error must not break logging.
  try { const name = Reflect.get(error, 'name'); if (typeof name === 'string' && TYPES.has(name)) result.type = name; } catch { /* redacted */ }
  try { const status = Reflect.get(error, 'status'); if (Number.isInteger(status) && status >= 100 && status <= 599) result.status = status; } catch { /* redacted */ }
  try { const code = Reflect.get(error, 'code'); if (typeof code === 'string' && CODES.has(code)) result.code = code; } catch { /* redacted */ }
  return result;
}
