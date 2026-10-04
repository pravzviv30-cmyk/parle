/** Opt-in named worker, never dispatched by the production Tutor token route. */
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { cli, defineAgent, voice, WorkerOptions } from '@livekit/agents';
import { realtime } from '@livekit/agents-plugin-openai';
import { NATIVE_EVAL_AGENT, NATIVE_EVAL_INSTRUCTIONS, NATIVE_EVAL_TEACHING, NativeEvalBudget, nativeEvalRemaining } from './nativeEvalPolicy.ts';
import { applyLanguageAgreement, languageAgreementInstruction, nativeTeachingRequest, parseNativeTeachingReply, type LanguageAgreement } from './nativeEvalLanguage.ts';

import { assertDevelopmentPaidTool } from './standalonePaidTool.ts';
assertDevelopmentPaidTool();

export default defineAgent({
  entry: async (ctx) => {
    if (process.env.LUVANI_NATIVE_EVAL !== '1' || !process.env.OPENAI_API_KEY) {
      ctx.shutdown('Native evaluation is disabled');
      return;
    }
    const startup = setTimeout(() => ctx.shutdown('No evaluation participant'), 30_000);
    await ctx.connect();
    const participant = await ctx.waitForParticipant();
    clearTimeout(startup);
    const remaining = nativeEvalRemaining(participant.metadata);
    if (!participant.identity.startsWith('native-eval-') || remaining === 0) {
      ctx.shutdown('Invalid evaluation admission');
      return;
    }
    const cancellation = new AbortController();
    const budget = new NativeEvalBudget();
    let agreement: LanguageAgreement = { tutor: 'adaptive', learner: 'free' };
    let activeRequest: AbortController | null = null;
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const session = new voice.AgentSession({ llm: new realtime.GPTLiveModel({
      model: 'gpt-live-1', voice: 'marin', delegation: 'client',
      // This option controls retries, not the five-minute application deadline.
      connOptions: { maxRetry: 0, retryIntervalMs: 1000, timeoutMs: 10_000 },
    }) });
    let closing = false;
    let hardStop: ReturnType<typeof setTimeout>;
    const stop = async () => {
      if (closing) return;
      closing = true;
      clearTimeout(hardStop);
      cancellation.abort();
      try { await session.close(); }
      finally { await ctx.room.disconnect(); ctx.shutdown('Evaluation complete'); }
    };
    hardStop = setTimeout(() => { void stop(); }, remaining);
    ctx.addShutdownCallback(async () => { clearTimeout(hardStop); cancellation.abort(); await session.close(); });
    ctx.room.on('participantDisconnected', (p) => { if (p.identity === participant.identity) void stop(); });
    ctx.room.on('disconnected', () => { void stop(); });

    class EvaluationTutor extends voice.Agent {
      override async onEnter() {
        const live = this.duplexSession as realtime.GPTLiveSession;
        live.on('delegation_created', ({ id, pendingTranscript }) => {
          if (closing || budget.hasSeen(id)) return;
          // An interruption may change the request. Abort old work and fence its
          // result; otherwise an old French reply can overwrite a new English request.
          activeRequest?.abort();
          activeRequest = null;
          budget.release();
          if (!budget.acquire(id)) {
            // No unbounded backend fallback after the comparison allowance.
            live.appendCommentary('This short test has reached its teaching limit. Please end the test.', { delegationId: id });
            return;
          }
          const requestControl = new AbortController();
          activeRequest = requestControl;
          void (async () => {
            try {
              const input = [...history.slice(-8), { role: 'user', content: pendingTranscript.slice(0, 4000) }];
              const response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST', headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
                signal: AbortSignal.any([cancellation.signal, requestControl.signal, AbortSignal.timeout(15_000)]),
                body: JSON.stringify(nativeTeachingRequest(agreement, NATIVE_EVAL_TEACHING, input)),
              });
              if (!response.ok) throw new Error('Backend unavailable');
              const body = await response.json() as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
              const text = (body.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? [])
                .filter((c) => c.type === 'output_text').map((c) => c.text ?? '').join(' ');
              const result = parseNativeTeachingReply(text);
              if (closing || activeRequest !== requestControl) return;
              const updated = applyLanguageAgreement(agreement, result);
              if (updated.tutor !== agreement.tutor || updated.learner !== agreement.learner) {
                agreement = updated;
                // Session instruction first, spoken content second. Metadata is
                // validated enums, never a raw learner-authored system instruction.
                live.appendInstructions(languageAgreementInstruction(agreement));
              }
              history.push({ role: 'user', content: pendingTranscript.slice(0, 4000) }, { role: 'assistant', content: result.reply });
              history.splice(0, Math.max(0, history.length - 8));
              live.appendCommentary(result.reply, { delegationId: id });
            } catch {
              if (!closing && activeRequest === requestControl) live.appendCommentary('The teaching connection is unavailable. Please end this test and try later.', { delegationId: id });
            } finally {
              if (activeRequest === requestControl) { activeRequest = null; budget.release(); }
            }
          })();
        });
        live.appendCommentary('Bonjour ! Let’s practise ordering in a café. What would you like to order?');
      }
    }
    try {
      await session.start({ agent: new EvaluationTutor({ instructions: NATIVE_EVAL_INSTRUCTIONS }), room: ctx.room, record: false });
    } catch { await stop(); throw new Error('Native voice evaluation could not start'); }
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url), agentName: NATIVE_EVAL_AGENT }));
