/**
 * The brain on a Claude subscription rather than an API key.
 *
 * Why it exists: an API key is a thing you buy before you know whether the
 * product is any good. The `claude` command line is already installed and
 * already logged in, so the coaching quality of Claude can be judged before a
 * single cent is committed, and swapped to the API later by changing TUTOR_LLM
 * and nothing else.
 *
 * Why it is not the whole brain: measured on this machine, one call costs
 * between eight and nine seconds, of which barely two is the model. The rest is
 * process startup rebuilding a large system prompt every time. Against a
 * realtime turn budget of well under a second that is not a tuning problem, so
 * SplitBrainClient keeps this on the three calls that run after the room has
 * closed, where nine seconds is invisible.
 *
 * Shape follows openaiCompat.ts, not anthropic.ts: there is no server-side
 * structured output here either, so the schema travels in the prompt and the
 * contract is enforced below with the same zod schemas and the same single
 * repair round-trip.
 */

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { MemoryExtractionSchema, ScenarioFrameSchema, TurnSchema } from '../contract/schemas.ts';
import type { MemoryExtraction, ScenarioFrame, TutorTurn } from '../contract/types.ts';
import { CurationSchema, type Curation } from '../curate/curate.ts';
import { DrillBatchSchema, type DrillBatch } from '../drill/generate.ts';
import {
  BrainParseError,
  type BrainCurateRequest,
  type BrainDrillsRequest,
  type BrainExtractRequest,
  type BrainFrameRequest,
  type BrainTurnRequest,
  type LlmClient,
  type LlmUsage,
} from './client.ts';
import { resolveRouting, type BrainActivity, type BrainRouting } from './routing.ts';

/** One CLI invocation. Injectable, because a test must not spawn a real one. */
export type ClaudeCliRun = (
  args: readonly string[],
  prompt: string,
  cwd: string,
) => Promise<{ code: number; stdout: string; stderr: string }>;

export interface ClaudeCliConfig {
  routing?: BrainRouting;
  run?: ClaudeCliRun;
  timeoutMs?: number;
}

type ContractSchema =
  | typeof TurnSchema
  | typeof ScenarioFrameSchema
  | typeof MemoryExtractionSchema
  | typeof DrillBatchSchema
  | typeof CurationSchema;

function jsonSchemaText(schema: ContractSchema): string {
  const format = zodOutputFormat(schema) as { schema?: unknown };
  return JSON.stringify(format.schema ?? format);
}

/** The CLI's envelope. The model's own answer is the `result` string inside it. */
interface CliEnvelope {
  is_error?: boolean;
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

/**
 * A command line answers the way a chat does, so the object may arrive wearing
 * a fence or a sentence of preamble. Take the outermost braces.
 */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const open = body.indexOf('{');
  const close = body.lastIndexOf('}');
  return open >= 0 && close > open ? body.slice(open, close + 1) : body.trim();
}

const DEFAULT_TIMEOUT_MS = 180_000;

/**
 * Spawn the real thing.
 *
 * The working directory is the one detail here that is load-bearing rather than
 * incidental: run in the repo, the CLI reads the project's CLAUDE.md into its
 * own system prompt, and the tutor would answer a French beginner with a share
 * of this repo's engineering rules in its head. A neutral directory keeps the
 * tutor's instructions to the ones the prompt actually carries.
 */
function spawnClaude(timeoutMs: number): ClaudeCliRun {
  return (args, prompt, cwd) =>
    new Promise((resolve, reject) => {
      const child = spawn('claude', [...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`The claude command did not answer within ${timeoutMs}ms.`));
      }, timeoutMs);

      child.stdout.on('data', (chunk) => (stdout += String(chunk)));
      child.stderr.on('data', (chunk) => (stderr += String(chunk)));
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, stdout, stderr });
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
}

export class ClaudeCliBrainClient implements LlmClient {
  private readonly routing: BrainRouting;
  private readonly run: ClaudeCliRun;
  private readonly cwd: string;

  constructor(config: ClaudeCliConfig = {}) {
    this.routing = config.routing ?? resolveRouting();
    this.run = config.run ?? spawnClaude(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.cwd = tmpdir();
  }

  async turn(request: BrainTurnRequest): Promise<{ turn: TutorTurn; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack, request.system.contract].join('\n\n');
    const transcript = request.messages.map((m) => `[${m.role}] ${m.text}`).join('\n\n');
    const { value, usage } = await this.ask('turn', system, transcript, TurnSchema);
    return { turn: value as TutorTurn, usage };
  }

  async frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack].join('\n\n');
    const { value, usage } = await this.ask('frame', system, request.request, ScenarioFrameSchema);
    return { frame: value as ScenarioFrame, usage };
  }

  async extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack].join('\n\n');
    const { value, usage } = await this.ask('extract', system, request.request, MemoryExtractionSchema);
    return { extraction: value as MemoryExtraction, usage };
  }

  async drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack].join('\n\n');
    const { value, usage } = await this.ask('drills', system, request.request, DrillBatchSchema);
    return { batch: value as DrillBatch, usage };
  }

  async curate(request: BrainCurateRequest): Promise<{ curation: Curation; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack].join('\n\n');
    const { value, usage } = await this.ask('curate', system, request.request, CurationSchema);
    return { curation: value as Curation, usage };
  }

  private async ask(
    activity: BrainActivity,
    system: string,
    request: string,
    schema: ContractSchema,
  ): Promise<{ value: unknown; usage: LlmUsage }> {
    const route = this.routing[activity];
    const args = ['-p', '--output-format', 'json', '--model', route.model];
    const schemaText = jsonSchemaText(schema);
    const base =
      `${system}\n\n` +
      `Return ONLY one JSON object matching this JSON schema, with no prose and no code fence:\n${schemaText}\n\n` +
      `${request}`;

    const usage: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let lastRaw = '';
    let lastError = '';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompt =
        attempt === 0
          ? base
          : `${base}\n\nYour previous answer was not a valid object (${lastError}). It was:\n${lastRaw}\n\nReturn ONLY the corrected JSON object.`;

      const result = await this.run(args, prompt, this.cwd);
      if (result.code !== 0) {
        // The CLI's own words are worth more than ours here: an expired login
        // says so precisely, and a wrapped message would hide it.
        throw new Error(`The claude command failed (exit ${result.code}): ${(result.stderr || result.stdout).trim().slice(0, 400)}`);
      }

      let envelope: CliEnvelope;
      try {
        envelope = JSON.parse(result.stdout) as CliEnvelope;
      } catch {
        throw new BrainParseError('The claude command did not return its own JSON envelope.', result.stdout.slice(0, 400));
      }
      usage.inputTokens += envelope.usage?.input_tokens ?? 0;
      usage.outputTokens += envelope.usage?.output_tokens ?? 0;
      usage.cacheReadTokens += envelope.usage?.cache_read_input_tokens ?? 0;
      usage.cacheWriteTokens += envelope.usage?.cache_creation_input_tokens ?? 0;

      lastRaw = envelope.result ?? '';
      try {
        return { value: schema.parse(JSON.parse(extractJson(lastRaw))), usage };
      } catch (error) {
        lastError = error instanceof Error ? error.message.slice(0, 400) : 'unknown parse failure';
      }
    }
    throw new BrainParseError('The subscription brain did not produce a contract-shaped object.', lastRaw);
  }
}
