import { isServiceFailure, type ServiceFailure } from '@luvani/core';

/** Worker state, never client error wording or a disconnected callback. */
export function terminalServiceFailure(input: { kind: unknown; recoverable: unknown; ended: boolean; learnerPresent: boolean; voiceless: boolean }): ServiceFailure | null {
  if (input.ended || !input.learnerPresent || input.recoverable !== false || !isServiceFailure(input.kind)) return null;
  if (input.voiceless && (input.kind === 'stt_error' || input.kind === 'tts_error' || input.kind === 'interruption_detection_error')) return null;
  return input.kind;
}
