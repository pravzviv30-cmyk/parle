/**
 * Ask the tutor to read one own-words attempt — F581.
 *
 * The own-words drill hands the learner a situation and a meaning and asks for
 * whatever French they have. Nothing on the phone can grade that, so the
 * sentence goes to `POST /drill/judge`, which is the only place a vendor key
 * exists. What comes back is an `OwnWordsVerdict`: four observations and no
 * verdict about the learner. `decideOwnWords` in core turns it into a move.
 *
 * Shaped on `scoreAttempt.ts` beside it, and for the same three reasons.
 *
 *   1. **Every failure is null.** Server down, budget spent, timeout, a body
 *      that did not parse, a 503 the endpoint returns rather than inventing a
 *      verdict: all of it lands as null, and the screen's answer to null is to
 *      show the line and write no grade. There is no branch here that can
 *      become a pass, and none that can become a miss.
 *   2. **Nothing is stored.** The attempt is a sentence somebody was nervous
 *      about writing. It is put in one request and dropped; this module has no
 *      store, no cache and no log. The server end of that promise is held by
 *      `drillJudge.test.ts`.
 *   3. **The level is a hint, not a claim.** The learner's CEFR estimate rides
 *      along so the judge knows who it is reading, and a profile that will not
 *      load costs nothing: the server defaults it. A failed profile read must
 *      never be the reason a learner's turn is refused.
 */

import type { OwnWordsExercise, OwnWordsVerdict } from '@luvani/core';

import { authHeaders } from '../auth/adapter.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { loadProfile } from '../profile/store.ts';

/** The learner's level, or undefined. Never a reason to fail the call. */
async function levelHint(): Promise<string | undefined> {
  try {
    return (await loadProfile())?.brain.cefr.estimate;
  } catch {
    return undefined;
  }
}

/**
 * One judged attempt, or null.
 *
 * `null` means nobody judged it. It never means the learner was wrong: the
 * caller must treat it as the tutor being unreachable and write no grade.
 */
export async function judgeOwnWords(
  userId: string,
  exercise: OwnWordsExercise,
  attempt: string,
): Promise<OwnWordsVerdict | null> {
  try {
    const cefr = await levelHint();
    const res = await fetch(`${TOKEN_SERVER}/drill/judge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        userId,
        fr: exercise.fr,
        en: exercise.en,
        situation: exercise.situation,
        mustKeep: exercise.mustKeep,
        attempt,
        ...(cefr === undefined ? {} : { cefr }),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { verdict?: unknown };
    return readVerdict(data.verdict);
  } catch {
    return null;
  }
}

/**
 * The shape, checked again on this side of the wire.
 *
 * The server validates what the model said, and this validates what the server
 * said, because a field arriving as undefined would otherwise reach
 * `decideOwnWords` as a falsy `meaningKept` — a network shape becoming a
 * judgement about a learner. Anything short of the whole shape is null.
 */
function readVerdict(raw: unknown): OwnWordsVerdict | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.meaningKept !== 'boolean' || typeof v.comprehensible !== 'boolean') return null;
  if (v.natural !== 'yes' && v.natural !== 'awkward' && v.natural !== 'no') return null;
  if (v.betterLine !== null && typeof v.betterLine !== 'string') return null;
  if (typeof v.note !== 'string') return null;
  return {
    meaningKept: v.meaningKept,
    comprehensible: v.comprehensible,
    natural: v.natural,
    betterLine: v.betterLine,
    note: v.note,
  };
}
