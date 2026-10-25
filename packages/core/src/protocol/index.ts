export {
  TOPIC_SERVER,
  TOPIC_CLIENT,
  encodeMessage,
  decodeServerMessage,
  decodeClientMessage,
  toLearnerInput,
  SAFETY_CATEGORIES,
  type SafetyCategory,
  ERROR_KINDS,
  type ErrorKind,
  HELD_TURN_STATES,
  type HeldTurnState,
  type ServerMessage,
  type ClientMessage,
  type ConvoSpeakerLine,
  type ConvoSupportView,
  type ConvoCoachItem,
  type ConvoPhrase,
  type ConvoView,
  type RecapPayload,
} from './protocol.ts';

// The chosen tutor voice is a wire value: it rides /session/start, gets signed
// into the join metadata and is resolved by the agent. It lives beside the
// protocol for that reason, and is exported here so the app, the token server
// and the agent all reach one catalogue rather than three copies.
export {
  TUTOR_VOICES,
  DEFAULT_TUTOR_VOICE,
  isTutorVoiceKey,
  tutorVoice,
  tutorSampleLine,
  type TutorVoiceKey,
  type TutorPersona,
  type TutorVoice,
  type TutorVoiceGender,
  type TutorVoiceAgeBand,
} from './voices.ts';
