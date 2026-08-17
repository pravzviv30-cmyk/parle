/**
 * Slash commands. Anything that does not start with a slash is speech and goes
 * to the tutor; anything that does is a playground control. `/aide` is the
 * learner asking the TUTOR for help (never counted against them); `/help`
 * lists these commands.
 */

import type { Strictness } from '@parle/brain';

export type Command =
  | { kind: 'scenario'; request: string }
  | { kind: 'strictness'; level: Strictness }
  | { kind: 'recap' }
  | { kind: 'profile' }
  | { kind: 'reset-profile' }
  | { kind: 'silence' }
  | { kind: 'aide' }
  | { kind: 'skip' }
  | { kind: 'commands' }
  | { kind: 'quit' }
  | { kind: 'unknown'; input: string };

const STRICTNESS_LEVELS: readonly Strictness[] = ['flow', 'balanced', 'strict'];

/** Null means plain speech — hand it to the tutor. */
export function parseCommand(line: string): Command | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('/')) return null;

  const [head = '', ...restParts] = trimmed.slice(1).split(/\s+/);
  const rest = restParts.join(' ');
  const word = head.toLowerCase();

  switch (word) {
    case 'scenario':
      return rest.length > 0 ? { kind: 'scenario', request: rest } : { kind: 'unknown', input: trimmed };
    case 'strictness': {
      const level = rest.toLowerCase() as Strictness;
      return STRICTNESS_LEVELS.includes(level) ? { kind: 'strictness', level } : { kind: 'unknown', input: trimmed };
    }
    case 'recap':
      return { kind: 'recap' };
    case 'profile':
      return { kind: 'profile' };
    case 'reset-profile':
      return { kind: 'reset-profile' };
    case 'silence':
      return { kind: 'silence' };
    case 'aide':
      return { kind: 'aide' };
    case 'skip':
      return { kind: 'skip' };
    case 'help':
    case 'commands':
    case '?':
      return { kind: 'commands' };
    case 'quit':
    case 'exit':
      return { kind: 'quit' };
    default:
      return { kind: 'unknown', input: trimmed };
  }
}

export const COMMAND_HELP = [
  '/scenario <what you want to practise>   build a new scene (English or French)',
  '/strictness flow|balanced|strict        how eagerly the coach interrupts',
  '/silence                                simulate saying nothing (the rescue)',
  '/aide                                   ask the tutor for help',
  '/skip                                   move the scene past this beat',
  '/recap                                  wrap the session into the end card',
  '/profile                                what the brain remembers about you',
  '/reset-profile                          forget everything and start fresh',
  '/help                                   this list',
  '/quit                                   save and leave',
].join('\n');
