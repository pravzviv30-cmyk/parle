/**
 * Talk about it again — the second door on a topic card.
 *
 * A topic the learner has already talked about should be able to lead back to
 * the tutor, not only into drills. Two rules and one label, out here where a
 * node test can reach them:
 *
 *  - who gets the offer: topics only, and never one whose drills are still
 *    being written, because that row is not a door yet;
 *  - what the learner is told BEFORE they tap, which is that this starts a live
 *    conversation and spends talking minutes. Finding that out afterwards is
 *    finding out you have been charged for a surprise.
 *
 * The label carries no number on purpose. Minutes are enforced at token
 * issuance and the app cannot see the balance before then, so any figure here
 * would be one the app made up.
 */

import type { PathNode, PracticeTopic } from '@parle/core';

export const TALK_AGAIN = {
  action: 'Talk about it again',
  cost: 'This starts a live conversation and uses your talking minutes.',
};

/** Topic rows only, and only once the topic has something behind it. */
export function offersTalkAgain(node: Pick<PathNode, 'kind' | 'state'>): boolean {
  return node.kind === 'topic' && node.state !== 'locked';
}

/** What a screen reader says, cost included, because it is said on screen too. */
export function talkAgainLabel(title: string): string {
  return `${TALK_AGAIN.action}: ${title}. ${TALK_AGAIN.cost}`;
}

/**
 * The hint that rides the session start, or nothing.
 *
 * The wire shape is `{ fr, en }` and it is shared with the token server and the
 * agent. The server drops a malformed seed and opens a generic session rather
 * than refusing, because a bad hint must never strand a learner. That is its
 * job, not a licence to send blanks: a row whose stored topic is missing, or
 * whose title is half written, seeds nothing and the conversation simply opens
 * the way it always has.
 */
export function seedTopicFor(
  nodeId: string,
  topics: readonly PracticeTopic[],
): { fr: string; en: string } | null {
  const topic = topics.find((t) => t.id === nodeId);
  if (topic === undefined) return null;
  const fr = topic.title.fr.trim();
  const en = topic.title.en.trim();
  if (fr.length === 0 || en.length === 0) return null;
  return { fr, en };
}
