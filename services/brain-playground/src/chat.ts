/**
 * The playground REPL — where the founder talks to the tutor brain.
 *
 * Type French (or English) to speak. Slash commands drive the playground.
 * The default scene is the café fixture, so a session opens with zero model
 * calls; /scenario builds a fresh scene from a freeform request.
 */

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import process, { stdin, stdout } from 'node:process';

import {
  AnthropicBrainClient,
  CAFE_FRAME,
  MockLlmClient,
  OpenAiCompatBrainClient,
  OpenAiResponsesBrainClient,
  DEFAULT_OPENAI_ANALYST_MODEL,
  DEFAULT_OPENAI_TURN_MODEL,
  defaultModel,
  type BrainEffort,
  type LlmClient,
  type ScenarioFrame,
} from '@luvani/brain';

import { COMMAND_HELP, parseCommand } from './commands.ts';
import { loadProfile, resetProfile, saveProfile } from './profileStore.ts';
import { formatSessionUsage, formatTurnUsage } from './usage.ts';
import { meta, renderProfile, renderRecap, title, warm } from './render.ts';
import { beginSession, buildScenario, endSession, runInput, silenceInput, type Session } from './sessionLoop.ts';

function pickClient(): { client: LlmClient; label: string; turnCostModel: string; analystCostModel: string } {
  const choice = (process.env.BRAIN_LLM ?? '').toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const rawEffort = (process.env.BRAIN_EFFORT ?? '').toLowerCase();
  const effort = (['low', 'medium', 'high'] as const).includes(rawEffort as BrainEffort)
    ? (rawEffort as BrainEffort)
    : undefined;

  if (choice === 'mock') {
    return {
      client: new MockLlmClient(),
      label: 'mock (offline, scripted answers)',
      turnCostModel: DEFAULT_OPENAI_TURN_MODEL,
      analystCostModel: DEFAULT_OPENAI_ANALYST_MODEL,
    };
  }

  if ((choice === 'openai' || (choice === '' && !anthropicKey)) && openaiKey) {
    return {
      client: new OpenAiResponsesBrainClient({ apiKey: openaiKey }),
      label: `${DEFAULT_OPENAI_TURN_MODEL} talker · ${DEFAULT_OPENAI_ANALYST_MODEL} analyst`,
      turnCostModel: DEFAULT_OPENAI_TURN_MODEL,
      analystCostModel: DEFAULT_OPENAI_ANALYST_MODEL,
    };
  }

  if ((choice === 'anthropic' || choice === '') && anthropicKey) {
    // The client routes per activity (routing.ts): the talker answers turns
    // and frames, the analyst handles the background calls. BRAIN_EFFORT
    // still works as the blunt all-activities knob it always was.
    return {
      client: new AnthropicBrainClient(effort ? { effort } : {}),
      label: `routed: sonnet talker · opus analyst${effort ? ` · ${effort} effort` : ''}`,
      turnCostModel: 'claude-sonnet-5',
      analystCostModel: 'claude-opus-5',
    };
  }
  if ((choice === 'groq' || choice === '' || choice === 'anthropic') && groqKey) {
    if (choice === 'anthropic') console.log(meta('No ANTHROPIC_API_KEY found; falling back to groq.'));
    return {
      client: new OpenAiCompatBrainClient({ apiKey: groqKey }),
      label: `${defaultModel()} · groq free tier`,
      turnCostModel: defaultModel(),
      analystCostModel: defaultModel(),
    };
  }
  if (choice === 'anthropic' || choice === 'openai' || choice === 'groq') {
    console.log(meta(`No key found for BRAIN_LLM=${choice}; running the offline mock.`));
  }
  return {
    client: new MockLlmClient(),
    label: 'mock (offline, scripted answers)',
    turnCostModel: DEFAULT_OPENAI_TURN_MODEL,
    analystCostModel: DEFAULT_OPENAI_ANALYST_MODEL,
  };
}

async function main(): Promise<void> {
  const { client, label, turnCostModel, analystCostModel } = pickClient();
  let frame: ScenarioFrame = CAFE_FRAME;

  let { session, lines } = beginSession(loadProfile(), frame);
  let current: Session = session;

  console.log('');
  console.log(title('Luvani · tutor brain playground'));
  console.log(meta(`brain: ${label}`));
  console.log(meta('Speak French (or English) and press enter. /help lists the commands.'));
  lines.forEach((l) => console.log(l));

  const rl = createInterface({ input: stdin, output: stdout });

  const wrapUp = (): void => {
    if (current.state.turnCount > 0 && !current.state.finished) {
      const { recap, profile } = endSession(current);
      renderRecap(recap).forEach((l) => console.log(l));
      saveProfile(profile);
    } else {
      saveProfile(current.profile);
    }
    if (current.calls > 0) console.log(meta(formatSessionUsage(current.totals, current.calls, turnCostModel)));
  };

  const restart = (nextFrame: ScenarioFrame): void => {
    frame = nextFrame;
    const begun = beginSession(current.profile, frame);
    current = begun.session;
    begun.lines.forEach((l) => console.log(l));
  };

  rl.on('SIGINT', () => {
    console.log('');
    wrapUp();
    rl.close();
    process.exit(0);
  });

  const prompt = (): void => {
    stdout.write(warm('vous> '));
  };

  // The async-iterator form, not rl.question(): the iterator buffers lines
  // that arrive while a turn is still processing (fast typists, piped input)
  // instead of dropping them, and ends cleanly at EOF.
  prompt();
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      prompt();
      continue;
    }

    const command = parseCommand(trimmed);
    try {
      if (command === null) {
        const { lines: out, recapDue } = await runInput(current, client, { type: 'spoke', text: trimmed }, turnCostModel);
        out.forEach((l) => console.log(l));
        if (recapDue) {
          wrapUp();
          console.log(meta('Session wrapped. Same scene resets below; /scenario builds a new one.'));
          restart(frame);
        }
        prompt();
        continue;
      }

      switch (command.kind) {
        case 'silence':
        case 'aide': {
          const input = command.kind === 'silence' ? silenceInput() : ({ type: 'help' } as const);
          const { lines: out, recapDue } = await runInput(current, client, input, turnCostModel);
          out.forEach((l) => console.log(l));
          if (recapDue) {
            wrapUp();
            restart(frame);
          }
          break;
        }
        case 'scenario': {
          console.log(meta('Building the scene…'));
          const started = Date.now();
          const result = await buildScenario(client, current.profile, command.request);
          console.log(meta(formatTurnUsage(result.usage, Date.now() - started, analystCostModel)));
          if (current.state.turnCount > 0) wrapUp();
          restart(result.frame);
          break;
        }
        case 'strictness': {
          current.state = { ...current.state, strictness: command.level };
          console.log(meta(`Strictness: ${command.level}.`));
          break;
        }
        case 'skip': {
          current.state = { ...current.state, forceAdvance: true };
          console.log(meta('The scene will move on with the next line.'));
          break;
        }
        case 'recap': {
          wrapUp();
          console.log(meta('Same scene resets below; /scenario builds a new one.'));
          restart(frame);
          break;
        }
        case 'profile': {
          renderProfile(current.profile).forEach((l) => console.log(l));
          break;
        }
        case 'reset-profile': {
          const fresh = resetProfile();
          console.log(meta('Profile forgotten.'));
          current.profile = fresh;
          restart(frame);
          break;
        }
        case 'commands': {
          console.log(COMMAND_HELP);
          break;
        }
        case 'quit': {
          wrapUp();
          rl.close();
          return;
        }
        case 'unknown': {
          console.log(meta(`Unrecognized: ${command.input}. /help lists the commands.`));
          break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(meta(`Something failed (${message}). The session carries on.`));
    }
    prompt();
  }

  // EOF on stdin (piped input ran out): leave with the card, like /quit.
  wrapUp();
}

await main();
