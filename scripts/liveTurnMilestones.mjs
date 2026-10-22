/** Pure helpers for measureLiveTurn.mjs: where, in a finished turn's JSON text, each
 * spoken-line milestone sits, and when those characters arrived. No I/O.
 * Offsets are the index just after the closing character, so text.slice(0, offset)
 * is everything the learner could have heard by then.
 */

const TOP_KEYS = { coach: 'coachEnd', coachLine: 'coachLineEnd', narration: 'narrationEnd', sceneReply: 'sceneReplyEnd' };
const SENTENCE_END = new Set(['.', '!', '?', '…']);
const SIMPLE_ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

/** Raw offset just after the first sentence end inside a closed JSON string literal, or null. */
function firstSentenceEnd(text, openQuote, closeQuote) {
  const chars = [];
  for (let i = openQuote + 1; i < closeQuote;) {
    let ch = text[i];
    let next = i + 1;
    if (ch === '\\') {
      const code = text[i + 1];
      if (code === 'u') { ch = String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16)); next = i + 6; }
      else { ch = SIMPLE_ESCAPES[code] ?? code; next = i + 2; }
    }
    chars.push({ ch, end: next });
    i = next;
  }
  for (let k = 0; k < chars.length; k += 1) {
    if (!SENTENCE_END.has(chars[k].ch)) continue;
    const after = chars[k + 1]?.ch;
    if (after === undefined || /\s/.test(after)) return chars[k].end;
  }
  return null;
}

/**
 * Scan a turn's final JSON text. Missing milestones are null. A key whose value is
 * a scalar (null) ends right after that scalar. `sceneReplyStart` is where the
 * sceneReply value begins (its opening brace).
 */
export function milestones(text) {
  const out = {
    coachEnd: null, coachLineEnd: null, narrationEnd: null, sceneReplyStart: null,
    frFirstSentenceEnd: null, frEnd: null, sceneReplyEnd: null, end: text.length,
  };
  const stack = []; // open containers: { kind: '{' | '[', key, expectingKey }
  let inString = false, escaped = false, stringStart = -1, scalar = false, lastNonWs = -1;
  const top = () => stack[stack.length - 1];
  const inReply = () => stack.length === 2 && stack[0].key === 'sceneReply';
  // A value just finished inside the container on top of the stack.
  const valueEnded = (end) => {
    const frame = top();
    if (frame === undefined || frame.kind !== '{') return;
    if (stack.length === 1) { const name = TOP_KEYS[frame.key]; if (name && out[name] === null) out[name] = end; }
    else if (inReply() && frame.key === 'fr' && out.frEnd === null) out.frEnd = end;
  };
  const valueStarted = (at) => {
    if (stack.length === 1 && top().kind === '{' && !top().expectingKey && top().key === 'sceneReply' && out.sceneReplyStart === null) out.sceneReplyStart = at;
  };
  const finishScalar = () => { if (scalar) { scalar = false; valueEnded(lastNonWs + 1); } };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') {
        inString = false;
        const frame = top();
        if (frame?.kind === '{' && frame.expectingKey) {
          try { frame.key = JSON.parse(text.slice(stringStart, i + 1)); } catch { frame.key = null; }
          frame.expectingKey = false;
        } else {
          if (frame?.kind === '{' && inReply() && frame.key === 'fr' && out.frFirstSentenceEnd === null) {
            out.frFirstSentenceEnd = firstSentenceEnd(text, stringStart, i);
          }
          valueEnded(i + 1);
        }
      }
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (ch === '"') {
      const frame = top();
      if (frame?.kind === '{' && !frame.expectingKey) valueStarted(i);
      inString = true; stringStart = i;
      continue;
    }
    if (ch === '{' || ch === '[') {
      if (top()?.kind === '{' && !top().expectingKey) valueStarted(i);
      stack.push({ kind: ch, key: null, expectingKey: ch === '{' });
      continue;
    }
    if (ch === '}' || ch === ']') {
      finishScalar();
      stack.pop();
      valueEnded(i + 1);
      continue;
    }
    if (ch === ',') {
      finishScalar();
      const frame = top();
      if (frame?.kind === '{') frame.expectingKey = true;
      continue;
    }
    if (ch === ':') continue;
    // A bare scalar: null, true, false or a number.
    if (!scalar) { scalar = true; if (top()?.kind === '{') valueStarted(i); }
    lastNonWs = i;
  }
  return out;
}

/** Arrivals are [{offset, t}]: cumulative chars after each delta, and its timestamp. Time the char at offset-1 arrived. */
export function atOffset(arrivals, offset) {
  if (offset === null || offset === undefined || arrivals.length === 0) return null;
  for (const arrival of arrivals) if (arrival.offset >= offset) return arrival.t;
  return null;
}

/** How many deltas begin before offset: a token count proxy for the wait. */
export function deltasBefore(arrivals, offset) {
  if (offset === null || offset === undefined) return null;
  let count = 0, begin = 0;
  for (const arrival of arrivals) {
    if (begin < offset) count += 1;
    begin = arrival.offset;
  }
  return count;
}

/** Nearest-rank percentiles over the non-null numbers. */
export function summarise(values) {
  const sorted = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { n: 0, p50: null, p95: null, min: null, max: null };
  const rank = (p) => sorted[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))];
  return { n, p50: rank(0.5), p95: rank(0.95), min: sorted[0], max: sorted[n - 1] };
}
