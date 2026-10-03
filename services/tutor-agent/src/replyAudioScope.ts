import { AsyncLocalStorage } from 'node:async_hooks';
import { TransformStream, type ReadableStream } from 'node:stream/web';
interface AudioRecord { firstFrame?: () => void; }
interface Dispatch { record: AudioRecord; handleId?: string; interrupted?: () => boolean; }
/** Correlation experiment: only work spawned inside this guarded say owns a
 * record. Missing propagation or handle identity yields no measurement. */
export class ReplyAudioScope<Frame> {
  private readonly scope = new AsyncLocalStorage<Dispatch>();
  dispatch<Result>(record: AudioRecord | undefined, invoke: () => Result): Result {
    if (!record?.firstFrame) return invoke();
    const token: Dispatch = { record };
    const result = this.scope.run(token, invoke);
    if (result && typeof result === 'object' && 'id' in result && typeof result.id === 'string' && result.id !== ''
      && 'interrupted' in result && typeof result.interrupted === 'boolean') {
      token.handleId = result.id; token.interrupted = () => result.interrupted !== false;
    }
    return result;
  }
  observe(source: ReadableStream<Frame>): ReadableStream<Frame> {
    const token = this.scope.getStore();
    if (!token) return source;
    let first = true;
    return source.pipeThrough(new TransformStream<Frame, Frame>({
      transform(frame, controller) {
        if (first) {
          first = false;
          if (token.handleId) { try { if (token.interrupted?.() === false) token.record.firstFrame?.(); } catch { /* Measurement cannot affect speech. */ } }
        }
        controller.enqueue(frame);
      },
    }));
  }
}
