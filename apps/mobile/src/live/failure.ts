/**
 * What went wrong with a live session, and what to say about it.
 *
 * This file exists because the hook used to answer every possible failure with
 * one of three strings — and one of them, "Could not start the session.", was
 * reached by a denied microphone held by another tab, a 401 from the token
 * server, an ICE timeout, and an insecure browsing context alike. A learner
 * cannot act on that, and neither can whoever is debugging it.
 *
 * Two rules hold here. Every failure names itself in plain words, and every
 * failure has a door: either the learner can type instead of speak, or they can
 * go back. No numbers, and nothing that reads as the learner's fault.
 */

import { ConnectionError, ConnectionErrorReason, DeviceUnsupportedError, MediaDeviceFailure } from 'livekit-client';

export type LiveFailure =
  /** The browser or OS refused the microphone. */
  | 'mic-denied'
  /** There is no microphone on this device. */
  | 'mic-missing'
  /** Something else holds the microphone — another tab, another app. */
  | 'mic-in-use'
  /** No microphone API at all: an insecure origin, or an unsupported browser. */
  | 'mic-unavailable'
  /** The token server did not answer. */
  | 'server-unreachable'
  /** The token server answered, and said no. */
  | 'server-refused'
  /** Reached the room service, but the signal connection failed. */
  | 'signal'
  /** Signalled fine, but no audio path could be established. Usually ICE. */
  | 'media'
  /** Connected, and the tutor never joined the room. */
  | 'agent-absent'
  /** The tutor joined, made a sound, and never produced anything to render. */
  | 'agent-silent'
  /** Was live, then the connection went away. */
  | 'dropped'
  | 'unknown';

/** Thrown by the hook when the token server answers with something unusable. */
export class TokenServerError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`token server replied ${status}`);
    this.name = 'TokenServerError';
    this.status = status;
  }
}

/**
 * Web only, and checked BEFORE connecting. An app served over plain http from
 * anything but localhost has no `navigator.mediaDevices` at all, so the usual
 * getUserMedia rejection never happens — you get a TypeError deep inside
 * livekit-client instead. Catching it here is the difference between "open this
 * over https" and a shrug.
 */
export function micApiUnavailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !navigator.mediaDevices;
}

export function classifyFailure(err: unknown): LiveFailure {
  // Device faults first: livekit-client's own matcher understands the whole
  // getUserMedia error family, including NotReadableError, which the regex this
  // replaced missed entirely.
  const device = MediaDeviceFailure.getFailure(err);
  if (device === MediaDeviceFailure.PermissionDenied) return 'mic-denied';
  if (device === MediaDeviceFailure.NotFound) return 'mic-missing';
  if (device === MediaDeviceFailure.DeviceInUse) return 'mic-in-use';
  if (err instanceof DeviceUnsupportedError) return 'mic-unavailable';

  if (err instanceof TokenServerError) {
    // 5xx means it is there and broken; 4xx means it is there and refusing.
    return err.status >= 500 ? 'server-unreachable' : 'server-refused';
  }

  if (err instanceof ConnectionError) {
    switch (err.reason) {
      case ConnectionErrorReason.NotAllowed:
      case ConnectionErrorReason.ServiceNotFound:
        return 'server-refused';
      case ConnectionErrorReason.ServerUnreachable:
        return 'server-unreachable';
      case ConnectionErrorReason.WebSocket:
        return 'signal';
      case ConnectionErrorReason.LeaveRequest:
        return 'dropped';
      case ConnectionErrorReason.Timeout:
      case ConnectionErrorReason.InternalError:
        // The peer connection giving up is reported as an internal error whose
        // message is "could not establish pc connection". On one machine that
        // is almost always the room service advertising a LAN address for media
        // that the browser is not allowed to reach.
        return /pc connection|ice|peer/i.test(err.message) ? 'media' : 'signal';
      default:
        return 'unknown';
    }
  }

  // A failed fetch is a TypeError with a message that varies by engine, so the
  // name is the reliable part.
  if (err instanceof TypeError) return 'server-unreachable';
  if (err instanceof Error && /fetch|network/i.test(err.message)) return 'server-unreachable';

  // No mediaDevices at all surfaces as a TypeError from inside the client.
  if (err instanceof Error && /mediaDevices|getUserMedia/i.test(err.message)) return 'mic-unavailable';

  return 'unknown';
}

export interface FailureCopy {
  /** The small label above the sentence. */
  label: string;
  /** One or two plain sentences. Never a number, never a reproach. */
  message: string;
  /**
   * True when typing is a real answer to this failure. The tutor is the same
   * tutor either way, so a microphone problem is a situation, not a dead end.
   */
  canType: boolean;
}

const COPY: Record<LiveFailure, FailureCopy> = {
  'mic-denied': {
    label: 'Microphone blocked',
    message: 'Parle needs your microphone to hear you speak. Allow it for this site and try again, or carry on by typing.',
    canType: true,
  },
  'mic-missing': {
    label: 'No microphone',
    message: 'This device has no microphone Parle can use. You can still have the whole conversation by typing.',
    canType: true,
  },
  'mic-in-use': {
    label: 'Microphone busy',
    message: 'Another app or tab is holding the microphone. Close it and try again, or carry on by typing.',
    canType: true,
  },
  'mic-unavailable': {
    label: 'Microphone unavailable',
    message: 'Parle cannot open the microphone here. You can have the whole conversation by typing instead.',
    canType: true,
  },
  // The one failure a learner is most likely to meet, and the one that read
  // worst: "Check it is running, then try again" is advice for whoever runs the
  // service. A learner has no process to check, and Back was the only move on
  // the screen. Typing stays closed on purpose — it goes through the same token
  // server — so the way forward has to be the rest of the app, which is all
  // on-device and completely unaffected.
  'server-unreachable': {
    label: 'Tutor unavailable',
    message: 'Parle cannot reach your tutor right now. Practice works offline, so you can carry on there. Try again in a little while.',
    canType: false,
  },
  'server-refused': {
    label: 'Session refused',
    message: 'Parle could not start a session for this account. Signing out and back in usually settles it.',
    canType: false,
  },
  signal: {
    label: 'Could not connect',
    message: 'The connection would not hold. Check your network and try again.',
    canType: false,
  },
  media: {
    label: 'No audio path',
    message: 'The connection opened but the sound could not get through. Try again in a moment, or switch to another network.',
    canType: false,
  },
  'agent-absent': {
    label: 'Tutor did not answer',
    message: 'Your tutor did not pick up. The room opened but nobody joined it, so nothing has been counted against your minutes.',
    canType: false,
  },
  'agent-silent': {
    label: 'Tutor went quiet',
    message: 'Your tutor joined and then went quiet before saying anything. This one is on us, not on you. Nothing has been counted against your minutes.',
    canType: false,
  },
  dropped: {
    label: 'Connection lost',
    message: 'The connection dropped. Your progress is saved.',
    canType: false,
  },
  unknown: {
    label: 'Session problem',
    message: 'Something stopped the session before it started. Try again, and if it keeps happening the details below are worth sending us.',
    canType: false,
  },
};

export function failureCopy(failure: LiveFailure): FailureCopy {
  return COPY[failure] ?? COPY.unknown;
}
