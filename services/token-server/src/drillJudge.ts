/**
 * POST /drill/judge — is this paraphrase still the same sentence?
 *
 * The own-words drill shows a learner a French line and asks them to say the
 * same thing their own way. Nothing deterministic can grade that, so a model
 * reads it. The model lives here rather than on the phone for the two reasons
 * that decide every boundary in this repo: the app holds no vendor key, and
 * the bill for a model call is ours.
 *
 * What this endpoint is careful about, in the order it matters:
 *
 *   1. **It stores nothing.** The attempt is a sentence an adult was nervous
 *      about writing. It is read out of the body, put in one prompt, and
 *      dropped. There is no table, no log line and no event that carries it,
 *      and the test that says so is the one to keep if any other is lost. The
 *      usage meter may learn that a call happened; `LlmUsage` is five numbers
 *      and a model name, and nothing else is ever handed to it.
 *   2. **A brain that will not answer is a 503.** Never an invented verdict,
 *      and never a default pass. The app's answer to 503 is to show the line
 *      and write no grade, which is the product's rule for a freeze: answer
 *      with the line, not with a smaller hint.
 *   3. **It validates before it acts.** The same habit `validStartRung()`
 *      keeps at the other end of this server. The load-bearing strings earn a
 *      400 when they are missing; the two hints do not, because a hint that
 *      arrives odd must never be the reason a learner is refused.
 *
 * Shaped like the /drill/score handler beside it: the same identity resolution,
 * the same three scoring rate limits, and a body cap sized to what the request
 * actually is. Four kilobytes is a whole screen of text and then some.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  buildOwnWordsJudgeRequest,
  parseOwnWordsVerdict,
  priceUsage,
  type BrainJudgeRequest,
  type LlmUsage,
} from '@luvani/brain/llm';

import type { ResolvedUser } from './auth.ts';

/** A drill card is a sentence or two. Four kilobytes is generous for that. */
export const JUDGE_BODY_LIMIT_BYTES = 4 * 1024;

/**
 * How long a learner may be left looking at a spinner before they are shown
 * the line instead. A judge that is merely slow is, to the person waiting, a
 * judge that is not coming.
 */
export const JUDGE_TIMEOUT_MS = 10_000;

/** The CEFR bands the brain understands. A hint, so never a 400 on its own. */
const CEFR_BANDS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type CefrBand = (typeof CEFR_BANDS)[number];

/** Where an unreadable or absent level lands: the middle of the beginner range. */
const DEFAULT_CEFR: CefrBand = 'A2';

/** Caps on what one card can hold, so a body cannot become a prompt budget. */
const MAX_LINE = 400;
const MAX_ATTEMPT = 600;
const MAX_MUST_KEEP = 8;

export interface DrillJudgeDeps {
  /** Identity, resolved exactly as every other authenticated endpoint does. */
  users: { resolve(authorizationHeader: string | undefined, assertedUserId: string | null): Promise<ResolvedUser> };
  /**
   * This endpoint's rate limits, run by the server that owns the limiter.
   * `userId` is null on the pre-authentication pass and the caller's id after
   * it, which is the same two-stage shape /drill/score uses. Returns false
   * when it has already answered 429.
   */
  limits(req: IncomingMessage, res: ServerResponse, userId: string | null): Promise<boolean>;
  /** The brain. Only `judge` is ever called. */
  client: { judge(request: BrainJudgeRequest): Promise<{ verdict: unknown; usage: LlmUsage }> };
  /**
   * Optional meter. It is handed the usage object and nothing else, by
   * construction: five numbers and the model that answered. There is no
   * parameter here through which the attempt could travel.
   */
  usage?(usage: LlmUsage): void;
  timeoutMs?: number;
}

/**
 * The one line the server prints per judged attempt: which model answered and
 * what it cost. It is built from the usage object alone, so it cannot carry the
 * attempt. With Jev in front of the brain, the model name is how an operator
 * sees which checks Jev settled and which went on to the brain.
 */
export function judgeUsageLine(usage: LlmUsage): string {
  const priced = priceUsage(usage);
  const cost = `$${priced.usd.toFixed(6)}${priced.exact ? '' : ' (estimated)'}`;
  return `[luvani:judge] answered by ${usage.model ?? 'an unnamed model'}: ${usage.inputTokens} input, ${usage.outputTokens} output, ${cost}`;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

/** The body, or null when it was too large or was not an object. */
async function readJudgeBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > JUDGE_BODY_LIMIT_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** A required string: present, not blank, and bounded. */
function line(value: unknown, max = MAX_LINE): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > max) return null;
  return trimmed;
}

/**
 * The meaning elements, read as a hint rather than as a requirement.
 *
 * An empty list is a legitimate answer and means "the whole meaning", which is
 * what the prompt says when this is empty. Anything unreadable is dropped, not
 * refused: a malformed hint must not cost a learner their turn.
 */
function mustKeepOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter((part) => part !== '' && part.length <= MAX_LINE)
    .slice(0, MAX_MUST_KEEP);
}

/** The level, clamped. Same reasoning as `mustKeep`: a hint, never a refusal. */
function cefrOf(value: unknown): CefrBand {
  return typeof value === 'string' && (CEFR_BANDS as readonly string[]).includes(value)
    ? (value as CefrBand)
    : DEFAULT_CEFR;
}

/**
 * One judged attempt.
 *
 * Every failure after authentication answers the same way, because from the
 * learner's side there is no difference worth telling them about between a
 * vendor being down, a call timing out and an answer that did not parse. All
 * three mean the tutor could not read it, and all three must leave the grade
 * unwritten rather than guessed.
 */
export async function handleDrillJudge(req: IncomingMessage, res: ServerResponse, deps: DrillJudgeDeps): Promise<void> {
  if (!(await deps.limits(req, res, null))) return;

  const body = await readJudgeBody(req);
  if (body === null) return json(res, 400, { error: 'a judge request is one small JSON object' });

  const resolved = await deps.users.resolve(
    req.headers.authorization,
    typeof body.userId === 'string' ? body.userId : null,
  );
  if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
  if (!(await deps.limits(req, res, resolved.userId))) return;

  const fr = line(body.fr);
  const en = line(body.en);
  const situation = line(body.situation);
  const attempt = line(body.attempt, MAX_ATTEMPT);
  if (!fr || !en || !situation) return json(res, 400, { error: 'the line, its meaning and the situation are required' });
  if (!attempt) return json(res, 400, { error: 'an attempt is required' });

  // Both halves of a timeout, because they answer different failures: the
  // abort stops paying for a call nobody will read, and the rejection is what
  // lets the learner move on even if a client ignores its signal.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('the judge did not answer in time'));
    }, deps.timeoutMs ?? JUDGE_TIMEOUT_MS);
  });

  try {
    const request = buildOwnWordsJudgeRequest(
      { fr, en, situation, mustKeep: mustKeepOf(body.mustKeep), attempt, cefr: cefrOf(body.cefr) },
      controller.signal,
    );
    const answer = await Promise.race([deps.client.judge(request), expiry]);
    // The meter learns that a call happened and what it cost. It is handed the
    // usage object itself, never the request and never the attempt.
    deps.usage?.(answer.usage);
    // `allowedFrom` is what the drill and the learner already put on screen, so
    // a note echoing their own café back is not mistaken for a French leak.
    const verdict = parseOwnWordsVerdict(answer.verdict, `${fr} ${en} ${situation} ${attempt}`);
    return json(res, 200, { verdict });
  } catch {
    // Deliberately no detail, and deliberately nothing logged from the body:
    // the error may carry the raw model answer, which was written about this
    // learner's sentence. The app shows the line and writes no grade.
    return json(res, 503, { error: 'judge-unavailable' });
  } finally {
    clearTimeout(timer);
  }
}
