/** Ephemeral correction retry. Shares the scoring budget; never writes a grade. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildFixLineJudgeRequest, parseFixLineVerdict } from '@luvani/brain/llm';
import type { FixLineObserver } from './fixLineObserver.ts';
import { JUDGE_TIMEOUT_MS, cefrOf, json, line, readJudgeBody, type DrillJudgeDeps } from './drillJudge.ts';
import { answerRequestError } from './requestBoundary.ts';
import { normaliseAttempt } from './judgeMemo.ts';

export async function handleFixLineJudge(req: IncomingMessage, res: ServerResponse, deps: DrillJudgeDeps & { fixLineObserver?: FixLineObserver }): Promise<void> {
  if (!(await deps.limits(req, res, null))) return;
  let body: Record<string, unknown> | null;
  try { body = await readJudgeBody(req); }
  catch (error) { return answerRequestError(req, res, error); }
  if (!body) return json(res, 400, { error: 'a correction retry is one small JSON object' });
  const resolved = await deps.users.resolve(req.headers.authorization, typeof body.userId === 'string' ? body.userId : null);
  if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
  if (typeof body.userId === 'string' && body.userId !== resolved.userId) return json(res, 403, { error: 'account changed' });
  if (!(await deps.limits(req, res, resolved.userId))) return;
  const original = line(body.original, 400);
  const better = line(body.better, 400);
  const rawAttempt = line(body.attempt, 600);
  const attempt = rawAttempt === null ? null : normaliseAttempt(rawAttempt);
  const why = line(body.why, 400);
  if (!original || !better || !attempt || original.normalize('NFC') === better.normalize('NFC')) {
    return json(res, 400, { error: 'a distinct correction and one retry are required' });
  }
  if (req.aborted || res.destroyed || res.writableEnded) return;
  const input = { original, better, attempt, why, cefr: cefrOf(body.cefr) };
  const remembered = deps.memo?.get(resolved.userId, 'fix-line', buildFixLineJudgeRequest(input));
  if (remembered !== undefined) {
    deps.memoHit?.('fix-line');
    return json(res, 200, { verdict: remembered });
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  const expiry = new Promise<never>((_resolve, reject) => {
    cancel = () => { controller.abort(); reject(new Error('correction check ended')); };
    timer = setTimeout(cancel, deps.timeoutMs ?? JUDGE_TIMEOUT_MS);
  });
  req.once('aborted', cancel);
  res.once('close', cancel);
  try {
    if (deps.fixLineObserver) {
      const accepted = await Promise.race([deps.fixLineObserver.read({original, better, attempt}, controller.signal, usage => deps.usage?.(usage)), expiry]);
      if (controller.signal.aborted || req.aborted || res.destroyed || res.writableEnded) return;
      if (accepted) {
        const verdict = { fixed: true, hint: null };
        deps.memo?.set(resolved.userId, 'fix-line', buildFixLineJudgeRequest(input), verdict);
        return json(res, 200, { verdict });
      }
    }
    if (controller.signal.aborted || req.aborted || res.destroyed || res.writableEnded) return;
    const admittedClient=await (deps.clientFor?.(resolved,controller.signal) ?? Promise.resolve(deps.client));
    const pending = admittedClient.judge(buildFixLineJudgeRequest(input, controller.signal))
      .then(answer => { deps.usage?.(answer.usage); return answer; });
    const answer = await Promise.race([pending, expiry]);
    const verdict = parseFixLineVerdict(answer.verdict, `${original} ${better}`);
    // An unjudged (null) answer is not remembered: the next try may be read.
    if (verdict !== null) deps.memo?.set(resolved.userId, 'fix-line', buildFixLineJudgeRequest(input), verdict);
    return json(res, 200, { verdict });
  } catch {
    return json(res, 503, { error: 'judge-unavailable' });
  } finally {
    clearTimeout(timer);
    req.removeListener('aborted', cancel);
    res.removeListener('close', cancel);
  }
}
