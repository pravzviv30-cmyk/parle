# Graph Report - Parle  (2026-08-19)

## Corpus Check
- 230 files · ~162,941 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1791 nodes · 4475 edges · 111 communities (81 shown, 30 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9089e3f4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generate.ts
- drill/index.ts
- metering/index.ts
- phonemes/index.ts
- DrillScreen.tsx
- runEval.ts
- useLiveSession.ts
- sessionLoop.ts
- expo
- App.tsx
- dependencies
- buildSystemBlocks
- review/store.ts
- loop.mjs
- conversation.ts
- AuthAdapter
- convo.ts
- utterance.test.ts
- paper
- ladder.ts
- SignUpScreen.tsx
- brain/package.json
- token-server/package.json
- brain-playground/package.json
- session/session.ts
- OnboardingFlow.tsx
- ParleConversation
- src/theme.ts
- core/package.json
- tutor.ts
- compilerOptions
- drill/store.ts
- ParleTutor
- openaiCompat.ts
- mobile/tsconfig.json
- package.json
- profile.ts
- dependencies
- mobile/package.json
- protocol.ts
- SessionScreen.tsx
- brain/tsconfig.json
- core/tsconfig.json
- brain-playground/tsconfig.json
- token-server/tsconfig.json
- tutor-agent/tsconfig.json
- RootNavigator.tsx
- scripts
- globals.native.ts
- Entitlement
- agent.ts
- activity.ts
- client.ts
- anthropic.ts
- expo-linking
- @expo/metro-runtime
- expo-sharing
- expo-speech
- expo-status-bar
- expo-web-browser
- server.ts
- @livekit/react-native-expo-plugin
- @parle/core
- ttsCache.test.ts
- react-native
- @react-native-async-storage/async-storage
- client.test.ts
- react-native-svg
- levels.ts
- LlmUsage
- gate.mjs
- brain/src/index.ts
- Format
- LearnerProfile
- Never stranded and never scolded
- shared/speechace.ts
- AnthropicBrainClient
- copy.ts
- @livekit/react-native-webrtc
- ProfileTab.tsx
- react-dom
- react-native-screens
- @react-navigation/bottom-tabs
- @react-navigation/native
- @supabase/supabase-js
- SummaryScreen.tsx
- components.tsx
- tokens.ts
- The pedagogy
- expo-file-system
- The live path
- The loop
- State and storage
- Testing
- bug-hunter.md
- Architecture
- README.md
- FailingBrain
- fix-verifier.md
- auth.ts
- CachedTTS
- warmCache.ts
- Expo + TypeScript npm-workspaces monorepo
- nav/theme.ts
- FakeTTS
- FakeChunkedStream
- expo-audio
- expo-font
- @livekit/react-native
- react-native-safe-area-context

## God Nodes (most connected - your core abstractions)
1. `space()` - 62 edges
2. `paper` - 35 edges
3. `ParleConversation` - 34 edges
4. `type` - 28 edges
5. `ParleTutor` - 24 edges
6. `LlmUsage` - 23 edges
7. `Rung` - 23 edges
8. `integrateTurn()` - 21 edges
9. `Format` - 21 edges
10. `ScenarioFrame` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `A real spoken exchange inside one five-minute session` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  PRODUCT.md → packages/core/src/lessons/cafe.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx
- `fitDisplay length-stepped French line` --rationale_for--> `fitDisplay()`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/components.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (111 total, 30 thin omitted)

### Community 0 - "generate.ts"
Cohesion: 0.09
Nodes (23): AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), DrillBatchSchema, DrillGenerationInput, FillBlankZ, GeneratedExerciseZ (+15 more)

### Community 1 - "drill/index.ts"
Cohesion: 0.06
Nodes (68): check(), checkDrill(), DRILL_FIXTURES, acceptedFor(), DrillVerdict, gradeAnswer(), gradeFreeText(), GradeResult (+60 more)

### Community 2 - "metering/index.ts"
Cohesion: 0.16
Nodes (23): canStartSession(), CostModel, DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS (+15 more)

### Community 3 - "phonemes/index.ts"
Cohesion: 0.07
Nodes (65): CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor(), CefrLevel (+57 more)

### Community 4 - "DrillScreen.tsx"
Cohesion: 0.12
Nodes (28): authHeaders(), EarGlyph(), fitDisplay(), OptionCard(), ConvoScreen(), st, AppropriateReplyView(), BestSentenceView() (+20 more)

### Community 5 - "runEval.ts"
Cohesion: 0.21
Nodes (14): CoachKind, applyNonSpokenInput(), defaultModel(), EVAL_CASES, EvalCase, EvalExpectation, expectationMisses(), hardRules() (+6 more)

### Community 6 - "useLiveSession.ts"
Cohesion: 0.13
Nodes (21): classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), TokenServerError, ensureAudioSession(), ensureLiveKitGlobals() (+13 more)

### Community 7 - "sessionLoop.ts"
Cohesion: 0.13
Nodes (34): supportViewFor(), createProfile(), learnerSnapshotFrom(), main(), pickClient(), Command, COMMAND_HELP, parseCommand() (+26 more)

### Community 8 - "expo"
Cohesion: 0.05
Nodes (35): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+27 more)

### Community 9 - "App.tsx"
Cohesion: 0.12
Nodes (20): App(), Gate(), SignedInRoot(), st, LiveProvider(), auth, AuthFlow(), AuthProvider() (+12 more)

### Community 10 - "dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "buildSystemBlocks"
Cohesion: 0.20
Nodes (17): ZERO_USAGE, buildScenarioRequest(), buildSystemBlocks(), main(), pickClient(), PROFILES, checkFrame(), main() (+9 more)

### Community 12 - "review/store.ts"
Cohesion: 0.07
Nodes (53): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+45 more)

### Community 13 - "loop.mjs"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "conversation.ts"
Cohesion: 0.09
Nodes (43): Assessment, CoachItem, NewPhrase, SessionRecap, SpeakerLine, SupportView, BASE_RUNG_BY_CEFR, beatOf() (+35 more)

### Community 15 - "AuthAdapter"
Cohesion: 0.09
Nodes (15): build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore, readStore() (+7 more)

### Community 16 - "convo.ts"
Cohesion: 0.11
Nodes (17): LearnerTurnInput, BrainParseError, BrainRefusalError, brainClient(), chooseFrame(), CONVO_LINES, ConvoView, parseStoredProfile() (+9 more)

### Community 17 - "utterance.test.ts"
Cohesion: 0.20
Nodes (7): audioScoringEnabled(), CapturedUtterance, observeEvents(), observeFrames(), feed(), frame(), UtteranceTap

### Community 18 - "paper"
Cohesion: 0.14
Nodes (16): st, WelcomeScreen(), GhostButton(), LiveErrorView(), show(), st, LiveSessionScreen(), st (+8 more)

### Community 19 - "ladder.ts"
Cohesion: 0.16
Nodes (24): contextInput(), applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState, nextSessionRung() (+16 more)

### Community 20 - "SignUpScreen.tsx"
Cohesion: 0.17
Nodes (20): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, AuthContext (+12 more)

### Community 21 - "brain/package.json"
Cohesion: 0.08
Nodes (24): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+16 more)

### Community 22 - "token-server/package.json"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "brain-playground/package.json"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "session/session.ts"
Cohesion: 0.15
Nodes (23): SessionViewProps, TurnQuality, LessonTurn, PhonemeObservation, feedbackMessage(), grade(), INTELLIGIBLE, LearnerInput (+15 more)

### Community 25 - "OnboardingFlow.tsx"
Cohesion: 0.11
Nodes (23): Label(), HeroCafe(), LearnStack(), OnboardCake(), OnboardClock(), OnboardSuitcase(), OnboardWave(), RecapPostcard() (+15 more)

### Community 26 - "ParleConversation"
Cohesion: 0.15
Nodes (9): MemoryFact, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request(), tennis (+1 more)

### Community 27 - "src/theme.ts"
Cohesion: 0.15
Nodes (16): bubbleStyle(), Scene(), SplashScreen(), st, decorative, font, STROKE, type (+8 more)

### Community 28 - "core/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "tutor.ts"
Cohesion: 0.18
Nodes (9): Rung, Lesson, baseInstructions(), buildPrompt(), turnInstructions(), TurnQueue, Publisher, reportUsage() (+1 more)

### Community 30 - "compilerOptions"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "drill/store.ts"
Cohesion: 0.22
Nodes (17): defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY(), loadDrillBank() (+9 more)

### Community 33 - "openaiCompat.ts"
Cohesion: 0.11
Nodes (19): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+11 more)

### Community 34 - "mobile/tsconfig.json"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "package.json"
Cohesion: 0.11
Nodes (17): description, engines, node, name, private, scripts, gate, gate:bless (+9 more)

### Community 36 - "profile.ts"
Cohesion: 0.22
Nodes (15): applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW, finishSession(), MASTERY_USES (+7 more)

### Community 37 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-crypto, livekit-client, @parle/brain, react, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "mobile/package.json"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "protocol.ts"
Cohesion: 0.12
Nodes (25): LiveSession, CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine, ConvoSupportView, ConvoView (+17 more)

### Community 40 - "SessionScreen.tsx"
Cohesion: 0.16
Nodes (17): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+9 more)

### Community 41 - "brain/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 42 - "core/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 43 - "brain-playground/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 44 - "token-server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 45 - "tutor-agent/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 46 - "RootNavigator.tsx"
Cohesion: 0.13
Nodes (22): Ctx, LiveValue, useLive(), useProfile(), Stat(), StationLine(), asRung(), ConvoRoute() (+14 more)

### Community 47 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, start, test, typecheck, web

### Community 49 - "Entitlement"
Cohesion: 0.23
Nodes (6): Entitlement, Plan, rollPeriod(), EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore

### Community 50 - "agent.ts"
Cohesion: 0.21
Nodes (15): TokenMeta, tutorLLM(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired(), preflight() (+7 more)

### Community 51 - "activity.ts"
Cohesion: 0.20
Nodes (16): ActivityEntry, ActivityKind, backfillFrom(), chain, earnedXp(), empty(), loadActivity(), prune() (+8 more)

### Community 52 - "client.ts"
Cohesion: 0.24
Nodes (12): MemoryExtraction, ScenarioFrame, TutorTurn, DrillBatch, BrainDrillsRequest, BrainExtractRequest, BrainFrameRequest, BrainTurnRequest (+4 more)

### Community 53 - "anthropic.ts"
Cohesion: 0.25
Nodes (11): AnthropicBrainConfig, ParseCapableSdk, ParsedResponse, BrainActivity, BrainEffort, BrainRouting, DEFAULT_ROUTING, EFFORTS (+3 more)

### Community 60 - "server.ts"
Cohesion: 0.20
Nodes (11): agentDebitAllowed(), config, json(), livekitUrl, PORT, readAudio(), readJson(), scoreCounts (+3 more)

### Community 63 - "ttsCache.test.ts"
Cohesion: 0.24
Nodes (7): CachedChunkedStream, CachedTTSOptions, normaliseLine(), NO_RETRY, decodeWav(), encodeWav(), WavData

### Community 66 - "client.test.ts"
Cohesion: 0.10
Nodes (22): sampleCoachItem(), sampleSupport(), sampleTurn(), SupportMaterial, createConversation(), MAX_ATTEMPTS_PER_BEAT, openingRungFor(), englishTurn() (+14 more)

### Community 68 - "levels.ts"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 69 - "LlmUsage"
Cohesion: 0.47
Nodes (4): LlmUsage, jsonSchemaText(), OpenAiCompatBrainClient, CaseResult

### Community 70 - "gate.mjs"
Cohesion: 0.12
Nodes (13): args, asJson, bless, counts, entries, failures, floors, FLOORS_PATH (+5 more)

### Community 71 - "brain/src/index.ts"
Cohesion: 0.18
Nodes (13): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, historyViewOfTurn() (+5 more)

### Community 72 - "Format"
Cohesion: 0.10
Nodes (21): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+13 more)

### Community 73 - "LearnerProfile"
Cohesion: 0.30
Nodes (12): Ctx, ProfileGate(), ProfileValue, KEY(), loadProfile(), OnboardingAnswers, saveProfile(), StoredProfile (+4 more)

### Community 74 - "Never stranded and never scolded"
Cohesion: 0.29
Nodes (7): Chrome is plain English, French only where it is content, No number and no scolding mid-session, Never stranded and never scolded, Live when reachable, Demo fallback otherwise, Accounts work without Supabase via a local on-device store, A missing score is never an invented penalty, Mock speech pipeline runs the full loop with no API keys

### Community 75 - "shared/speechace.ts"
Cohesion: 0.20
Nodes (8): ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance(), RESPONSE

### Community 76 - "AnthropicBrainClient"
Cohesion: 0.33
Nodes (5): AnthropicBrainClient, outputConfig(), parse(), toProviderMessages(), usageOf()

### Community 77 - "copy.ts"
Cohesion: 0.23
Nodes (12): coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, FILLER_RE, outsideQuotes(), RECOVERY_LINE, RESCUE_LINE (+4 more)

### Community 79 - "ProfileTab.tsx"
Cohesion: 0.19
Nodes (10): ArrowRight(), Card(), Acknowledgements(), Notice, NOTICES, st, SettingsRow(), st (+2 more)

### Community 85 - "SummaryScreen.tsx"
Cohesion: 0.24
Nodes (7): PathNodeRow(), st, statusLine(), saveTextFile(), st, SummaryScreen(), radius

### Community 86 - "components.tsx"
Cohesion: 0.12
Nodes (19): HelpGlyph(), LineBullet(), MicGlyph(), ProgressDots(), s, SpeakCircle(), TabBar(), st (+11 more)

### Community 87 - "tokens.ts"
Cohesion: 0.29
Nodes (9): GrantResult, grantSession(), roomNameFor(), SessionGrant, SessionMode, config, metadataFor(), TokenConfig (+1 more)

### Community 88 - "The pedagogy"
Cohesion: 0.25
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 90 - "The live path"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "The loop"
Cohesion: 0.29
Nodes (6): Giving it a goal, Running it, The agents, The bar, The loop, Verifying UI work

### Community 92 - "State and storage"
Cohesion: 0.29
Nodes (6): On the device, Server side, Sessions and progress, State and storage, The brain's learner model, The round trip, and where it broke

### Community 93 - "Testing"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "bug-hunter.md"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Architecture"
Cohesion: 0.33
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 100 - "auth.ts"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 102 - "warmCache.ts"
Cohesion: 0.43
Nodes (5): buildTTS(), DEFAULT_CACHE_DIR, main(), scriptedLines(), splitter

### Community 103 - "Expo + TypeScript npm-workspaces monorepo"
Cohesion: 0.33
Nodes (6): Read the exact versioned Expo docs before writing code, Parle (working name), Expo + TypeScript npm-workspaces monorepo, The agent is authoritative over session state, packages/core is deliberately platform-free, Repo path contains a space

### Community 104 - "nav/theme.ts"
Cohesion: 0.40
Nodes (4): linking, navTheme, RootStackParamList, TabParamList

## Knowledge Gaps
- **502 isolated node(s):** `st`, `name`, `slug`, `version`, `orientation` (+497 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ParleConversation` connect `ParleConversation` to `protocol.ts`, `LearnerProfile`, `buildSystemBlocks`, `conversation.ts`, `convo.ts`, `agent.ts`, `client.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `Rung` connect `tutor.ts` to `phonemes/index.ts`, `profile.ts`, `useLiveSession.ts`, `protocol.ts`, `SessionScreen.tsx`, `LearnerProfile`, `RootNavigator.tsx`, `conversation.ts`, `paper`, `ladder.ts`, `agent.ts`, `components.tsx`, `session/session.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `DrillExercise` connect `drill/index.ts` to `generate.ts`, `DrillScreen.tsx`, `useLiveSession.ts`, `protocol.ts`, `review/store.ts`, `drill/store.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `st`, `name`, `slug` to the rest of the system?**
  _502 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08547008547008547 - nodes in this community are weakly interconnected._
- **Should `drill/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06456908344733242 - nodes in this community are weakly interconnected._
- **Should `phonemes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06613924050632912 - nodes in this community are weakly interconnected._