/**
 * The one line under a node's title.
 *
 * Pulled out of PathNodeRow for the reason docs/TESTING.md gives for every rule
 * that has ever lived inside a component here: apps/mobile has no renderer, so a
 * rule in a component is a rule nothing can check. It matters more than usual
 * for this one, because "locked" now covers two genuinely different situations
 * and telling a learner the wrong one is telling them something untrue.
 */

import type { PathNode } from '@parle/core';

export function statusLine(node: PathNode): string {
  switch (node.state) {
    case 'complete':
      return 'Learned';
    case 'needs-review':
      return 'Ready to come back to';
    case 'in-progress':
      return 'Started';
    case 'locked':
      // A locked *topic* is one the learner has already talked about: its
      // phrases are banked and its drills are still being written. Telling them
      // their conversations will write it would be describing something that
      // has already happened.
      return node.kind === 'topic' ? 'Your tutor is still writing this one' : 'Your conversations write this one';
    default:
      return node.sub;
  }
}
