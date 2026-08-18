/**
 * Free conversation over LiveKit — the brain, spoken.
 *
 * The sequencing here mirrors the playground's sessionLoop exactly, adapted to
 * voice: every decision lives in @parle/brain where it is tested, and this
 * file only sequences. The one structural difference from the scripted tutor
 * is that the pipeline LLM is NOT used for generation — the brain produces the
 * reply out of band, this agent speaks it with `session.say`, and every hook
 * path ends by throwing `voice.StopResponse` so the pipeline's own (unused)
 * LLM never answers on top of it. Without that throw the tutor speaks twice.
 *
 * The rescue keeps the playground's proven order: silence and aide-moi render
 * support INSTANTLY from material already in hand, and only then does the
 * model get asked for its warm in-character step-in. A stuck learner never
 * waits on a network round-trip to be handed the line.
 */

import { voice, type llm } from '@livekit/agents';
import { selectedBrain } from './preflight.ts';

import {
  APERO_FRAME,
  AnthropicBrainClient,
  BrainParseError,
  BrainRefusalError,
  CAFE_FRAME,
  OpenAiCompatBrainClient,
  RECOVERY_LINE,
  applyExtractionToProfile,
  applyNonSpokenInput,
  applyTurnToProfile,
  assembleRecap,
  buildDrillGenerationRequest,
  buildExtractionRequest,
  buildScenarioRequest,
  buildSystemBlocks,
  createConversation,
  createProfile,
  finishSession,
  integrateTurn,
  learnerSnapshotFrom,
  migrateProfile,
  prepareTurn,
  supportViewFor,
  type ConversationState,
  type LearnerProfile,
  type LearnerTurnInput,
  type LlmClient,
  type ScenarioFrame,
  type SessionRecap,
  type TurnView,
} from '@parle/brain';
import { STUCK_SILENCE_MS, decodeClientMessage, validateExercise, type ServerMessage } from '@parle/core';

import { reportUsage } from './usage.ts';

/**
 * The wire shapes, derived from the protocol's own ServerMessage rather than
 * restated: core's barrel does not re-export the payload types, and deriving
 * them here means the mapping helpers are checked against the exact objects
 * `encodeMessage` will accept.
 */
export type ConvoView = Extract<ServerMessage, { t: 'convo' }>['view'];
export type RecapPayload = Extract<ServerMessage, { t: 'recap' }>['recap'];

/** Anything that can carry a message back to the app. */
type Publisher = (message: ServerMessage) => void;

// ─────────────────────────────────────────────── pure mapping helpers

/**
 * Map the brain's TurnView onto the wire's ConvoView, field by field. The
 * support shapes align structurally (brain's SupportView is the wire's
 * ConvoSupportView); the beat loses its internal id, which the app never
 * renders.
 */
export function toConvoView(view: TurnView): ConvoView {
  return {
    sceneReply: {
      speaker: view.sceneReply.speaker,
      fr: view.sceneReply.fr,
      frWritten: view.sceneReply.frWritten,
      en: view.sceneReply.en,
    },
    coachLine: view.coachLine,
    coachNow: view.coachNow.map((c) => ({
      kind: c.kind,
      quote: c.quote,
      better: c.better,
      betterWritten: c.betterWritten,
      betterEn: c.betterEn,
      why: c.why,
      weight: c.weight,
    })),
    narration:
      view.narration === null
        ? null
        : {
            speaker: view.narration.speaker,
            fr: view.narration.fr,
            frWritten: view.narration.frWritten,
            en: view.narration.en,
          },
    supportView: view.supportView,
    rung: view.rung,
    beat: { goalEn: view.beat.goalEn, position: view.beat.position, total: view.beat.total },
    recapDue: view.recapDue,
  };
}

/** The recap is already wire-shaped; the map is stated so it cannot silently widen. */
export function toRecapPayload(recap: SessionRecap): RecapPayload {
  return {
    headline: recap.headline,
    wins: recap.wins,
    fixes: recap.fixes,
    phrases: recap.phrases,
    nextFocus: recap.nextFocus,
    cefr: recap.cefr,
    stats: recap.stats,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The app sends its stored LearnerProfile back as the opaque `snapshot` field
 * of the token metadata. Validation is deliberately loose — a tampered profile
 * only affects pedagogy, never minutes — but every top-level field the engine
 * dereferences at construction time must exist, or a bad snapshot crashes the
 * worker instead of degrading to a fresh profile.
 */
export function parseStoredProfile(snapshot: unknown): LearnerProfile {
  if (
    isRecord(snapshot) &&
    isRecord(snapshot.cefr) &&
    isRecord(snapshot.errorPatterns) &&
    isRecord(snapshot.phrases) &&
    isRecord(snapshot.preferences) &&
    Array.isArray(snapshot.preferences.lastScenarios) &&
    isRecord(snapshot.stats)
  ) {
    // Older apps send back version-1 profiles for as long as they live on a
    // device; the upgrade is additive and never touches learning history.
    return migrateProfile(snapshot as unknown as LearnerProfile);
  }
  return createProfile();
}

/**
 * Which scene this session opens on. No model call at session start — a
 * scenario-builder round-trip would put seconds of latency (and cost) in front
 * of the opening line. The two fixture frames alternate: a learner who just
 * did the café gets the apéro, and back. Frames are identified by title,
 * because that is what `finishSession` records in `lastScenarios`.
 */
export function chooseFrame(profile: LearnerProfile): ScenarioFrame {
  // Alternate on the MOST RECENT scene only. Keying on membership would lock
  // the learner out of the café forever after their first visit — the list
  // remembers everything, so `includes` is a one-way door.
  const last = profile.preferences.lastScenarios[profile.preferences.lastScenarios.length - 1];
  return last === CAFE_FRAME.title ? APERO_FRAME : CAFE_FRAME;
}

// ─────────────────────────────────────────────── the voice agent

/**
 * The brain, selected exactly like the scripted tutor's TUTOR_LLM switch, so
 * one .env flag moves both session shapes between quality tiers together.
 * Claude is the default: coaching quality is the product, and the routed
 * client (brain's routing.ts) already keeps the realtime turns on the fast
 * tier. Groq remains the documented $0 fallback for key-less setups.
 */
function brainClient(): LlmClient {
  if (selectedBrain() === 'groq') return new OpenAiCompatBrainClient({ apiKey: process.env.GROQ_API_KEY ?? '' });
  return new AnthropicBrainClient(); // reads ANTHROPIC_API_KEY
}

/**
 * Everything the tutor says before a scene exists, hand-written so the session
 * opens with zero model calls and (once warmed) zero synthesis. The opener is
 * ISSEN's lesson taken literally: the tutor talks first, within seconds, and
 * asks the learner what they want to talk about.
 */
export const CONVO_LINES = {
  opener: { fr: "Alors, de quoi on parle aujourd'hui ?", en: 'So, what do you want to talk about today?' },
  bridge: { fr: 'Ah, très bien. Alors…', en: 'Ah, very good. So…' },
  suggest: {
    fr: 'Par exemple, une conversation dans la rue. Ou au café. Touchez une plaque, ou dites-le, simplement.',
    en: 'For example, a conversation in the street. Or at the café. Tap a plaque, or just say it.',
  },
} as const;

/** How long the scenario builder gets before the fixture scene opens instead. */
const FRAME_TIMEOUT_MS = 10_000;

/**
 * The text-mode silence window. Typing is slower than speaking and a reader
 * pauses differently from a speaker, so the four-second voice rule would feel
 * like being hovered over. Twelve seconds of nothing still means stuck.
 */
const TEXT_SILENCE_MS = 12_000;

/** How long the post-session memory call gets before its enrichment is dropped. */
const EXTRACT_TIMEOUT_MS = 8_000;

/** How long drill authoring gets — the biggest post-session call, still bounded. */
const DRILLS_TIMEOUT_MS = 25_000;

/**
 * The tappable answers to the opening question. Three curated doors, then the
 * most personal extra we hold — a remembered interest beats replaying the
 * last scene — and never more than four, because a wall of choices is its own
 * kind of stranding.
 */
export function topicChips(profile: LearnerProfile): { label: string; en: string; value: string }[] {
  const chips = [
    {
      label: 'Dans la rue',
      en: 'A stranger in the street',
      value: 'A chance conversation with a stranger who bumps into you in a busy street',
    },
    { label: 'Au café', en: 'Ordering at the counter', value: 'Ordering at a busy Paris café' },
    { label: "L'apéro", en: 'Drinks with friends', value: 'A Friday evening apéro with French friends' },
  ];
  const interest = profile.memory.facts.filter((f) => f.kind === 'interest').at(-1);
  const last = profile.preferences.lastScenarios[profile.preferences.lastScenarios.length - 1];
  if (interest !== undefined) {
    chips.push({ label: interest.fr ?? interest.en, en: interest.en, value: `A conversation about: ${interest.en}` });
  } else if (last !== undefined) {
    chips.push({ label: 'Encore !', en: `Back to: ${last}`, value: last });
  }
  return chips;
}

/**
 * Flow strictness and a 12-turn budget make a framed 3–5 minute scene: coaching
 * mostly waits for the recap, and the beat cap keeps the scene moving.
 */
const CONVO_MAX_TURNS = 12;

export class ParleConversation extends voice.Agent {
  private state: ConversationState;
  private profile: LearnerProfile;
  private readonly client: LlmClient;
  private publish: Publisher = () => {};
  private silenceTimer?: ReturnType<typeof setTimeout>;
  private startedAt = Date.now();
  private ended = false;
  /**
   * Where the session is: choosing a topic, waiting on the scenario builder,
   * or inside the scene. The fallback conversation is constructed eagerly so
   * `state` is never null — `starting` only gates which inputs do what.
   */
  private phase: 'choosing' | 'starting' | 'scene' = 'choosing';
  /** The choosing screen, kept for `ready` replays and silence re-offers. */
  private lastTopics: Extract<ServerMessage, { t: 'topics' }> | null = null;
  /** The suggestion is offered once; after that, silence on the choosing screen is fine. */
  private suggested = false;
  /** The last published view, kept for `ready` replays and rescue merging. */
  private lastView: ConvoView | null = null;
  /** The finished session's recap message, kept for post-end `ready` replays. */
  private lastRecap: Extract<ServerMessage, { t: 'recap' }> | null = null;

  /** Set from the room identity so usage lands on the right account. */
  learnerId = 'anonymous';

  /**
   * Text mode: the same conversation with the voice pipeline dark. Learner
   * turns arrive as typed `say` messages, the tutor's lines render instead of
   * sounding, and the silence rescue runs on a reader's clock. Everything
   * pedagogical is identical — that is the point.
   */
  private readonly voiceless: boolean;

  constructor(profile: LearnerProfile, opts: { voiceless?: boolean } = {}) {
    // The pipeline LLM never generates here; see the header. One line keeps
    // the framework satisfied and makes the intent grep-able.
    super({ instructions: 'You are unused; replies are generated out of band.' });
    this.profile = profile;
    this.voiceless = opts.voiceless ?? false;
    this.state = createConversation(chooseFrame(profile), learnerSnapshotFrom(profile), {
      strictness: 'flow',
      maxTurns: CONVO_MAX_TURNS,
    });
    this.client = brainClient();
  }

  /** Every spoken line funnels through here so text mode can stay silent. */
  private say(text: string, options: { allowInterruptions?: boolean } = {}): void {
    if (this.voiceless) return;
    this.session.say(text, options);
  }

  /** Wire up the channel back to the app. */
  attach(publish: Publisher): void {
    this.publish = publish;
  }

  /** Drives the microphone control: live while the learner has the floor. */
  sendSpeaking(speaking: boolean): void {
    this.publish({ t: 'speaking', speaking });
  }

  /** Tell the learner something went wrong, in plain unscolding words. */
  publishError(message: string): void {
    this.publish({ t: 'error', message });
  }

  /**
   * Open the session on the choosing moment: the tutor asks what to talk
   * about, the chips land on screen, and nothing costs a model call. The
   * scene itself opens when a topic arrives — spoken or tapped.
   */
  open(session: voice.AgentSession): void {
    void session; // kept for signature parity with ParleTutor; speech goes via this.session
    // A remembered opener beats the generic question: "Alors, cet entretien ?"
    // is the moment the tutor stops being an app. One line of live synthesis
    // per session, pennies, worth every one of them.
    const opener = this.profile.memory.opener ?? CONVO_LINES.opener;
    this.lastTopics = { t: 'topics', prompt: { fr: opener.fr, en: opener.en }, chips: topicChips(this.profile) };
    this.publish(this.lastTopics);
    this.say(opener.fr, { allowInterruptions: false });
    if (this.voiceless) this.armRescue(this.session);
  }

  /**
   * A topic landed. Say the cached bridge line so the learner is never
   * waiting in silence, design the scene, and open it. The scenario builder
   * failing — parse error, outage, timeout — falls back to the fixture
   * alternator: the learner gets a scene either way, always.
   */
  private async startScene(request: string): Promise<void> {
    if (this.phase !== 'choosing' || this.ended) return;
    this.phase = 'starting';
    this.clearRescue();
    this.say(CONVO_LINES.bridge.fr, { allowInterruptions: false });

    let frame = chooseFrame(this.profile);
    try {
      frame = await this.buildFrame(request);
    } catch (error) {
      console.error('[parle] scenario build failed; opening on a fixture:', error);
    }
    if (this.ended) return;

    this.state = createConversation(frame, learnerSnapshotFrom(this.profile), {
      strictness: 'flow',
      maxTurns: CONVO_MAX_TURNS,
    });
    this.phase = 'scene';
    this.openScene();
  }

  /** One frame call with a hard deadline — a learner is audibly waiting. */
  private async buildFrame(request: string): Promise<ScenarioFrame> {
    const snapshot = learnerSnapshotFrom(this.profile);
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error(`no frame after ${FRAME_TIMEOUT_MS}ms`)), FRAME_TIMEOUT_MS);
      });
      const { frame } = await Promise.race([
        this.client.frame({
          kind: 'frame',
          system: buildSystemBlocks(),
          request: buildScenarioRequest({ request, learner: { cefr: snapshot.cefr, watchFor: snapshot.watchFor } }),
        }),
        timeout,
      ]);
      return frame;
    } finally {
      // The losing timer must not fire into a settled race — an unhandled
      // rejection takes the worker down, which strands every learner on it.
      if (deadline !== undefined) clearTimeout(deadline);
    }
  }

  /**
   * Open the scene: publish the opening view built from material the frame
   * already carries (no model call), then speak the narrator's scene-setting
   * and the character's opening line, uninterruptible so a speakerphone echo
   * cannot cut the scene's first words.
   */
  private openScene(): void {
    const frame = this.state.frame;
    const opening = frame.openingLine;
    const narration = frame.openingNarration;
    const beats = frame.beats;
    const beatIndex = Math.max(
      0,
      beats.findIndex((b) => b.id === this.state.currentBeat),
    );
    const beat = beats[beatIndex]!;

    this.publishView({
      sceneReply: { speaker: opening.speaker, fr: opening.fr, frWritten: opening.frWritten, en: opening.en },
      coachLine: null,
      coachNow: [],
      narration: { speaker: narration.speaker, fr: narration.fr, frWritten: narration.frWritten, en: narration.en },
      supportView: supportViewFor(this.state.directive.support, this.state.lastSupport),
      rung: this.state.ladder.rung,
      beat: { goalEn: beat.goalEn, position: beatIndex + 1, total: beats.length },
      recapDue: false,
    });
    // The narration is spoken in English: the learner must be able to picture
    // the scene before a word of French lands on them.
    this.say(narration.en, { allowInterruptions: false });
    this.say(opening.fr, { allowInterruptions: false });
  }

  /**
   * Arm the rescue. Called once the tutor has finished speaking; four silent
   * seconds mean stuck, not thinking, and support renders instantly.
   *
   * On the choosing screen the same silence gets a gentler answer: one spoken
   * suggestion, once — after that the chips carry the moment, because a tutor
   * that keeps prompting an undecided learner is its own kind of pressure.
   * While the scenario builder runs, silence is expected and the timer stays
   * dark.
   */
  armRescue(session: voice.AgentSession): void {
    this.clearRescue();
    void session; // kept for signature parity with ParleTutor; speech goes via this.session
    if (this.ended || this.phase === 'starting') return;
    const window = this.voiceless ? TEXT_SILENCE_MS : STUCK_SILENCE_MS;
    if (this.phase === 'choosing') {
      if (this.suggested) return;
      this.silenceTimer = setTimeout(() => {
        this.suggested = true;
        this.say(CONVO_LINES.suggest.fr, { allowInterruptions: false });
        if (this.lastTopics) this.publish(this.lastTopics);
      }, window);
      return;
    }
    this.silenceTimer = setTimeout(() => {
      void this.rescue({ type: 'silence', durationMs: window });
    }, window);
  }

  clearRescue(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = undefined;
  }

  /** Handle an intent the learner expressed by tapping rather than speaking. */
  async handleClientMessage(session: voice.AgentSession, payload: Uint8Array): Promise<void> {
    const msg = decodeClientMessage(payload);
    if (!msg) return; // a malformed frame must not disturb a live conversation

    if (msg.t === 'ready') {
      // After the scene has closed, the recap IS the current state — replaying
      // the last scene view would hand a reconnecting app a session that no
      // longer exists and swallow its recap and updated profile.
      if (this.ended && this.lastRecap) this.publish(this.lastRecap);
      else if (this.phase === 'choosing' && this.lastTopics) this.publish(this.lastTopics);
      else if (this.lastView) this.publish({ t: 'convo', view: this.lastView });
      return;
    }
    if (msg.t === 'leave') return void this.finish();

    if (msg.t === 'topic') return void this.startScene(msg.value);

    // Before the scene exists, every other tap gets the same gentle answer as
    // silence: a spoken suggestion and the chips again. There is no ladder to
    // move and no line to replay yet.
    if (this.phase !== 'scene') {
      if (msg.t === 'say') return void this.startScene(msg.text);
      if (msg.t === 'help' || msg.t === 'skip') {
        this.clearRescue();
        this.suggested = true;
        this.say(CONVO_LINES.suggest.fr, { allowInterruptions: false });
        if (this.lastTopics) this.publish(this.lastTopics);
      }
      return;
    }

    if (msg.t === 'hear') {
      // Replay the current support line, uninterruptible so it plays out whole.
      this.say(this.state.lastSupport.fullLine.fr, { allowInterruptions: false });
      return;
    }
    if (msg.t === 'slower') {
      // Two effects, both honest: the line again right now, and a pace flag
      // that rides every later turn's context so the tutor STAYS slow. The
      // audio itself replays at the cached speed until slow synthesis is
      // proven out with the voice vendor.
      this.state = { ...this.state, pace: 'slow' };
      if (this.lastView) this.say(this.lastView.sceneReply.fr, { allowInterruptions: false });
      return;
    }
    if (msg.t === 'english') {
      // The gloss is already in hand — saying it costs nothing and is never a
      // ladder event. Asking to understand is a healthy act.
      if (this.lastView) this.say(this.lastView.sceneReply.en, { allowInterruptions: false });
      return;
    }
    if (msg.t === 'say') {
      // A typed learner turn: text-mode conversation, or a voice learner who
      // could not say it aloud just now. Identical to speech from here on.
      this.clearRescue();
      this.publish({ t: 'transcript', text: msg.text, final: true });
      await this.runBrainTurn({ type: 'spoke', text: msg.text });
      return;
    }
    if (msg.t === 'help' || msg.t === 'skip') {
      // The brain has no skip: a learner reaching for either button is lost,
      // and what a lost learner needs is support, not a hole in the scene.
      this.clearRescue();
      await this.rescue({ type: 'help' });
    }
    // 'choice' arrives as speech as well, exactly like the scripted path.
  }

  /** The learner said something. Run it through the brain, speak the answer. */
  override async onUserTurnCompleted(_chatCtx: llm.ChatContext, newMessage: llm.ChatMessage): Promise<void> {
    this.clearRescue();
    const text = (newMessage.textContent ?? '').trim();
    if (text.length > 0 && !this.ended) {
      if (this.phase === 'choosing') {
        // Speech on the choosing screen IS the topic. The transcript shows
        // the learner they were heard; the scene does the rest.
        this.publish({ t: 'transcript', text, final: true });
        void this.startScene(text);
      } else if (this.phase === 'scene') {
        this.publish({ t: 'transcript', text, final: true });
        await this.runBrainTurn({ type: 'spoke', text });
      }
      // Speech while the scenario builder runs is dropped: the learner is
      // watching the bridge moment, and the scene they asked for is seconds
      // away. Answering into it would talk over the opening narration.
    }
    // Every path out of this hook cancels the pipeline's own reply — the
    // brain already spoke; the unused pipeline LLM must not answer too.
    throw new voice.StopResponse();
  }

  /**
   * Silence or aide-moi. The ladder moves and the support renders NOW, from
   * material the last turn already carried; the model's warm in-character
   * step-in follows when the network gets around to it.
   */
  private async rescue(input: Extract<LearnerTurnInput, { type: 'silence' | 'help' }>): Promise<void> {
    if (this.ended) return;

    const { state, view } = applyNonSpokenInput(this.state, input);
    this.state = state;
    if (this.lastView) {
      // Merge: the scene has not moved, so the last reply stands; only the
      // support, the rung and the (now silent) coach change. Stale narration
      // clears too — a rescue is not a scene shift.
      this.publishView({
        ...this.lastView,
        coachLine: null,
        coachNow: [],
        narration: null,
        supportView: view.supportView,
        rung: view.rung,
      });
    }

    await this.runBrainTurn(input);
  }

  /**
   * One brain turn, sequenced exactly like the playground's runInput:
   * prepareTurn → client.turn → integrateTurn → fold into the profile →
   * publish → speak. A failed model turn says the recovery line and records
   * nothing — the learner must never be stranded mid-scene.
   */
  private async runBrainTurn(input: LearnerTurnInput): Promise<void> {
    const request = prepareTurn(this.state, input);
    let turn;
    try {
      ({ turn } = await this.client.turn(request));
    } catch (error) {
      if (this.ended) return; // a failed turn against a finished session is just noise
      if (error instanceof BrainParseError || error instanceof BrainRefusalError) {
        this.say(RECOVERY_LINE);
        return;
      }
      // Anything else (network, provider outage) gets the same gentle exit:
      // an unhandled throw here would strand the learner in silence.
      console.error('[parle] convo brain turn failed:', error);
      this.say(RECOVERY_LINE);
      return;
    }

    // The session may have ended while the model call was in flight (the
    // learner left, or the recap fired from another path). A late turn must
    // not speak into a closed scene or mutate a profile already handed over.
    if (this.ended) return;

    // `this.state` is read fresh after the await: if another input completed
    // while this call was in flight, this turn folds into that newer state.
    const { state, view } = integrateTurn(this.state, input, turn);
    this.state = state;
    this.profile = applyTurnToProfile(this.profile, turn, new Date().toISOString());

    this.publishView(toConvoView(view));
    this.speak(view);

    if (view.recapDue) await this.finish();
  }

  /** Narration, then coach, then the scene reply — outside-in, like a film. */
  private speak(view: TurnView): void {
    // On the low rungs the line must play out in full: without headphones the
    // learner's microphone hears the tutor, and a VAD "interruption" during a
    // modelled line is almost never the learner talking.
    const options = view.rung <= 2 ? { allowInterruptions: false } : {};
    // A scene shift is spoken in English and never interruptible: a learner
    // who misses the new picture cannot follow anything said inside it.
    if (view.narration !== null) this.say(view.narration.en, { allowInterruptions: false });
    if (view.coachLine !== null) this.say(view.coachLine, options);
    this.say(view.sceneReply.fr, options);
  }

  private publishView(view: ConvoView): void {
    this.lastView = view;
    this.publish({ t: 'convo', view });
    // Text mode has no speech, so no AgentStateChanged ever fires to start
    // the silence clock. The render is the moment the learner has the floor.
    if (this.voiceless) this.armRescue(this.session);
  }

  /**
   * End the session: assemble the recap in code, fold the session into the
   * profile, hand both to the app, then debit the metered seconds.
   *
   * Idempotent, because both an earned recap and a learner closing the app can
   * arrive here — and billing someone twice for one session is the kind of bug
   * that costs a refund and a review.
   */
  async finish(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.clearRescue();

    const { recap, state } = assembleRecap(this.state, {
      estimate: this.profile.cefr.estimate,
      confidence: this.profile.cefr.confidence,
    });
    this.state = state;
    this.profile = finishSession(this.profile, state);

    // The profile rides along verbatim: the agent owns the shape, the app is
    // just the storage that brings it back next session. Kept for `ready`
    // replays, so an app that reconnects after the scene closed still gets its
    // recap and updated profile instead of a stale scene view.
    this.lastRecap = { t: 'recap', recap: toRecapPayload(recap), profile: this.profile };
    this.publish(this.lastRecap);

    const wallClockSec = Math.round((Date.now() - this.startedAt) / 1000);
    console.log(
      `[parle] convo complete — ${recap.stats.turns} turns, ${recap.stats.rescues} rescues, ` +
        `${wallClockSec}s, cefr=${recap.cefr.estimate} (${recap.cefr.confidence})`,
    );
    await reportUsage({ userId: this.learnerId, seconds: wallClockSec, utterancesScored: 0 });

    // Only now, with the recap shipped and the seconds debited, the analyst
    // does its background work. A learner who kills the app first loses this
    // session's memory and drills, and nothing else.
    void this.extractMemory(state.turnCount);
    void this.generateDrills(state.turnCount);
  }

  /**
   * The post-session memory call. Best-effort by design: the recap already
   * shipped, so a failure here costs a nicety, never the session. On success
   * the enriched profile rides a second recap publish — idempotent for the
   * app, which just persists the newest blob.
   */
  private async extractMemory(turnCount: number): Promise<void> {
    // An empty session has nothing to remember, and asking would be spend
    // without a question.
    if (turnCount === 0 || this.lastRecap === null) return;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = buildExtractionRequest({ history: this.state.history, knownFacts: this.profile.memory.facts });
      const timeout = new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error(`no extraction after ${EXTRACT_TIMEOUT_MS}ms`)), EXTRACT_TIMEOUT_MS);
      });
      const { extraction } = await Promise.race([
        this.client.extract({ kind: 'extract', system: buildSystemBlocks(), request }),
        timeout,
      ]);
      this.profile = applyExtractionToProfile(this.profile, extraction, new Date().toISOString());
      this.lastRecap = { ...this.lastRecap, profile: this.profile };
      this.publish(this.lastRecap);
    } catch (error) {
      console.error('[parle] memory extraction failed; the recap already shipped without it:', error);
    } finally {
      if (deadline !== undefined) clearTimeout(deadline);
    }
  }

  /**
   * Tomorrow's drills from today's sentences. Best-effort like the memory
   * call, with one extra gate: every generated exercise passes core's
   * deterministic linter before it ships, because a broken drill teaches
   * broken French and a rejected one costs nothing — fixtures cover the gap.
   */
  private async generateDrills(turnCount: number): Promise<void> {
    if (turnCount === 0) return;
    const sessionPhrases = this.state.phrases;
    const profilePhrases = Object.values(this.profile.phrases)
      .filter((p) => !p.mastered)
      .slice(0, 10)
      .map((p) => ({ fr: p.fr, frWritten: p.frWritten, en: p.en }));
    if (sessionPhrases.length === 0 && profilePhrases.length === 0) return;

    const errorTags = Object.entries(this.profile.errorPatterns)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([tag]) => tag);

    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = buildDrillGenerationRequest({ sessionPhrases, profilePhrases, errorTags });
      const timeout = new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error(`no drills after ${DRILLS_TIMEOUT_MS}ms`)), DRILLS_TIMEOUT_MS);
      });
      const { batch } = await Promise.race([
        this.client.drills({ kind: 'drills', system: buildSystemBlocks(), request }),
        timeout,
      ]);

      const valid = batch.exercises.filter((exercise) => validateExercise(exercise).ok);
      const dropped = batch.exercises.length - valid.length;
      if (dropped > 0) console.warn(`[parle] drill linter rejected ${dropped} of ${batch.exercises.length} exercises`);
      if (valid.length === 0) return;
      this.publish({ t: 'drills', exercises: valid });
    } catch (error) {
      console.error('[parle] drill generation failed; the fixture bank covers the gap:', error);
    } finally {
      if (deadline !== undefined) clearTimeout(deadline);
    }
  }
}
