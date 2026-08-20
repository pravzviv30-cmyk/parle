# Graph Report - Parle  (2026-08-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1939 nodes · 4888 edges · 116 communities (82 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.83)
- Token cost: 105,654 input · 1,514 output

## Graph Freshness
- Built from commit: `187f9ee9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- French Authenticity Pack
- Drill Session Flow
- Session Metering & Plans
- Drill Bank & Phonemes
- Drill Screen Views
- Drill Types & Fixtures
- Live Failure Handling
- Playground CLI Commands
- Expo App Config
- Mobile App Root
- Tutor Agent Dependencies
- Drill Generation Prompts
- Review Scheduler
- Bug Loop Runner
- Turn Integration & Copy Rules
- Mock Auth Adapter
- Authored Learning Path
- Utterance Capture
- Conversation Screen UI
- Difficulty Ladder
- Auth Screens
- Brain Package Manifest
- Token Server Manifest
- Brain Playground Manifest
- Lesson Session Engine
- Onboarding Illustrations
- Live Conversation Orchestrator
- Convo Frames & Usage
- Core Package Manifest
- Lesson Content & Matching
- Shared TypeScript Config
- Tab Bar Icons
- Tutor Turn Controller
- Friends Store Adapter
- Mobile TypeScript Config
- Root Scripts & Gate
- Learner Profile Model
- Mobile Dependencies
- Mobile Package Manifest
- Add Friends UI
- Mock Speech & Session Screen
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- Navigation & Live Context
- Mobile Scripts
- Native Audio Globals
- Drill Answer Grading
- Agent Env Preflight
- Drill Store
- LLM Client Adapters
- Export & History Reports
- Expo Linking
- Metro Runtime
- Expo Sharing
- Expo Speech
- Expo Status Bar
- Expo Web Browser
- Topics Store
- LiveKit Expo Plugin
- Core Package Dependency
- Graphify Guard Hook
- React Native Framework
- Async Storage Library
- Contract Schemas & Samples
- SVG Rendering Library
- Levels & XP
- Expo Audio Playback
- Gate Script
- Topic Curation
- Known Issues Ledger
- Profile Store & Upgrade
- Supabase Auth Adapter
- Speechace Phoneme Mapping
- Auth Adapter Interface
- Activity Log
- LiveKit WebRTC Transport
- Memory Extraction Prompt
- React DOM Renderer
- Native Screen Primitives
- Bottom Tab Navigation
- React Navigation Core
- Supabase Client SDK
- Shared UI Components
- Drill Generation Tests
- Android App Config
- Pedagogy Doc
- Expo File System
- Live Voice Doc
- Loop Doc
- State And Storage Doc
- Testing Doc
- Bug Hunter Agent Spec
- Architecture Doc
- Docs Index & Known Issues
- Conversation Engine Tests
- Fix Verifier Spec
- Conversation State Pipeline
- TTS Cache & WAV
- Cached TTS Client
- Expo Plugins & File Saving
- Cached Audio Stream
- TTS Test Fakes
- Voice Builder Config
- Navigation Theme & Types
- Turn Queue
- LiveKit React Native SDK
- Safe Area Insets
- iOS App Config
- Tutor Prompt Builder
- Fake TTS
- Mobile Copy Test
- Expo Font Loading

## God Nodes (most connected - your core abstractions)
1. `space()` - 67 edges
2. `ParleConversation` - 38 edges
3. `paper` - 37 edges
4. `type` - 30 edges
5. `LlmUsage` - 26 edges
6. `ParleTutor` - 24 edges
7. `MockLlmClient` - 24 edges
8. `Rung` - 23 edges
9. `integrateTurn()` - 21 edges
10. `Format` - 21 edges

## Surprising Connections (you probably didn't know these)
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `TurnFeedback`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `A missing score is never an invented penalty` --rationale_for--> `grade()`  [INFERRED]
  README.md → packages/core/src/session/session.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (116 total, 34 thin omitted)

### Community 0 - "French Authenticity Pack"
Cohesion: 0.22
Nodes (12): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, check() (+4 more)

### Community 1 - "Drill Session Flow"
Cohesion: 0.11
Nodes (25): check(), checkDrill(), AnsweredExercise, applyDrillResults(), buildDrillSession(), DRILL_STAGES, DrillOutcome, DrillSessionState (+17 more)

### Community 2 - "Session Metering & Plans"
Cohesion: 0.05
Nodes (54): canStartSession(), CostModel, DEFAULT_COST_MODEL, Entitlement, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, Plan (+46 more)

### Community 3 - "Drill Bank & Phonemes"
Cohesion: 0.15
Nodes (32): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+24 more)

### Community 4 - "Drill Screen Views"
Cohesion: 0.13
Nodes (32): fitDisplay(), ConvoScreen(), AppropriateReplyView(), BestSentenceView(), DrillScreen(), ds, FillBlankView(), kindTag() (+24 more)

### Community 5 - "Drill Types & Fixtures"
Cohesion: 0.11
Nodes (31): typed(), withOptions(), AppropriateReplyExercise, BestSentenceExercise, DrillDifficulty, DrillExercise, DrillExerciseBase, FillBlankExercise (+23 more)

### Community 6 - "Live Failure Handling"
Cohesion: 0.06
Nodes (53): Read the exact versioned Expo docs before writing code, authHeaders(), classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), TokenServerError (+45 more)

### Community 7 - "Playground CLI Commands"
Cohesion: 0.13
Nodes (33): SessionRecap, defaultModel(), main(), pickClient(), Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS (+25 more)

### Community 8 - "Expo App Config"
Cohesion: 0.13
Nodes (14): expo, icon, name, newArchEnabled, orientation, scheme, slug, splash (+6 more)

### Community 9 - "Mobile App Root"
Cohesion: 0.14
Nodes (18): App(), Gate(), SignedInRoot(), st, LiveProvider(), AuthFlow(), AuthProvider(), RootNavigator() (+10 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "Drill Generation Prompts"
Cohesion: 0.10
Nodes (29): AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), FillBlankZ, GeneratedExerciseZ, INSTRUCTION, ListenTypeZ (+21 more)

### Community 12 - "Review Scheduler"
Cohesion: 0.28
Nodes (14): AGAIN_RETRY_MS, applyGrade(), DEFAULT_EASE, DUE_CAP, dueCards(), goodIntervalDays(), GRADUATION_INTERVALS_DAYS, mergeCards() (+6 more)

### Community 13 - "Bug Loop Runner"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "Turn Integration & Copy Rules"
Cohesion: 0.07
Nodes (49): CoachItem, CoachKind, SpeakerLine, SupportView, coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE (+41 more)

### Community 15 - "Mock Auth Adapter"
Cohesion: 0.21
Nodes (11): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+3 more)

### Community 16 - "Authored Learning Path"
Cohesion: 0.17
Nodes (16): DRILL_FIXTURES, AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), GENERATED_PREFIX (+8 more)

### Community 17 - "Utterance Capture"
Cohesion: 0.19
Nodes (8): Publisher, audioScoringEnabled(), CapturedUtterance, observeEvents(), observeFrames(), feed(), frame(), UtteranceTap

### Community 18 - "Conversation Screen UI"
Cohesion: 0.09
Nodes (27): Card(), Label(), st, Acknowledgements(), Notice, NOTICES, st, LiveErrorView() (+19 more)

### Community 19 - "Difficulty Ladder"
Cohesion: 0.11
Nodes (33): No number and no scolding mid-session, contextInput(), applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState (+25 more)

### Community 20 - "Auth Screens"
Cohesion: 0.15
Nodes (22): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, AuthContext (+14 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.08
Nodes (24): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+16 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Brain Playground Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "Lesson Session Engine"
Cohesion: 0.15
Nodes (24): SessionViewProps, LadderDirective, LessonTurn, PhonemeObservation, createSession(), feedbackMessage(), grade(), INTELLIGIBLE (+16 more)

### Community 25 - "Onboarding Illustrations"
Cohesion: 0.08
Nodes (31): ProgressDots(), TabBar(), HeroCafe(), LearnStack(), OnboardCake(), OnboardClock(), OnboardSuitcase(), OnboardWave() (+23 more)

### Community 27 - "Convo Frames & Usage"
Cohesion: 0.15
Nodes (13): APERO_FRAME, brainClient(), chooseFrame(), CONVO_LINES, ConvoView, parseStoredProfile(), Publisher, RecapPayload (+5 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "Lesson Content & Matching"
Cohesion: 0.15
Nodes (23): Chrome is plain English, French only where it is content, CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor() (+15 more)

### Community 30 - "Shared TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "Tab Bar Icons"
Cohesion: 0.15
Nodes (15): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+7 more)

### Community 33 - "Friends Store Adapter"
Cohesion: 0.08
Nodes (38): build(), createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners, loadStore() (+30 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "Root Scripts & Gate"
Cohesion: 0.11
Nodes (17): description, engines, node, name, private, scripts, gate, gate:bless (+9 more)

### Community 36 - "Learner Profile Model"
Cohesion: 0.10
Nodes (32): applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), createProfile(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW, finishSession() (+24 more)

### Community 37 - "Mobile Dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-crypto, livekit-client, @parle/brain, react, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "Mobile Package Manifest"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "Add Friends UI"
Cohesion: 0.17
Nodes (17): useProfile(), friends, AddFriendsScreen(), Hit, RowStatus, st, Monogram(), PersonPlusGlyph() (+9 more)

### Community 40 - "Mock Speech & Session Screen"
Cohesion: 0.18
Nodes (15): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+7 more)

### Community 41 - "Brain TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 42 - "Core TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 43 - "Playground TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 44 - "Token Server TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 45 - "Tutor Agent TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src/**/*.ts, ../../tsconfig.base.json

### Community 46 - "Navigation & Live Context"
Cohesion: 0.12
Nodes (25): Ctx, LiveValue, useLive(), loadDrillBank(), ParleTabBar(), asRung(), DrillRoute(), LessonRoute() (+17 more)

### Community 47 - "Mobile Scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, start, test, typecheck, web

### Community 49 - "Drill Answer Grading"
Cohesion: 0.28
Nodes (13): acceptedFor(), DrillVerdict, gradeAnswer(), gradeFreeText(), GradeResult, realWordSet(), answerCurrent(), DrillFeedback (+5 more)

### Community 50 - "Agent Env Preflight"
Cohesion: 0.14
Nodes (21): TokenMeta, tutorLLM(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired(), preflight() (+13 more)

### Community 51 - "Drill Store"
Cohesion: 0.27
Nodes (14): defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY(), loadStore() (+6 more)

### Community 52 - "LLM Client Adapters"
Cohesion: 0.08
Nodes (43): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, DrillBatchSchema, AnthropicBrainClient, AnthropicBrainConfig (+35 more)

### Community 53 - "Export & History Reports"
Cohesion: 0.23
Nodes (14): buildEntries(), csvField(), ExportEntry, toAnkiTsv(), toCsv(), buildReport(), buildTrends(), mean() (+6 more)

### Community 60 - "Topics Store"
Cohesion: 0.22
Nodes (14): KEY(), loadTopics(), mergeSessionTopics(), serialized(), StoredTopics, writeChain, IncomingTopic, MAX_DISCUSSED_DATES (+6 more)

### Community 63 - "Graphify Guard Hook"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "Contract Schemas & Samples"
Cohesion: 0.08
Nodes (38): sampleCoachItem(), sampleSupport(), sampleTurn(), AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema (+30 more)

### Community 68 - "Levels & XP"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 70 - "Gate Script"
Cohesion: 0.12
Nodes (13): args, asJson, bless, counts, entries, failures, floors, FLOORS_PATH (+5 more)

### Community 71 - "Topic Curation"
Cohesion: 0.20
Nodes (13): NewPhrase, applyCuration(), buildCurationRequest(), CuratedTopic, CurationInput, CurationSchema, INSTRUCTION, keyOf() (+5 more)

### Community 72 - "Known Issues Ledger"
Cohesion: 0.10
Nodes (21): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+13 more)

### Community 73 - "Profile Store & Upgrade"
Cohesion: 0.28
Nodes (11): Ctx, ProfileGate(), ProfileValue, KEY(), loadProfile(), saveProfile(), StoredProfile, NOW (+3 more)

### Community 74 - "Supabase Auth Adapter"
Cohesion: 0.26
Nodes (4): startGoogleSignIn(), AuthResult, AuthUser, AuthContextValue

### Community 75 - "Speechace Phoneme Mapping"
Cohesion: 0.20
Nodes (7): ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, RESPONSE

### Community 77 - "Activity Log"
Cohesion: 0.22
Nodes (13): ActivityEntry, ActivityKind, backfillFrom(), chain, empty(), loadActivity(), prune(), read() (+5 more)

### Community 79 - "Memory Extraction Prompt"
Cohesion: 0.31
Nodes (9): MemoryFact, ChatMessage, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request() (+1 more)

### Community 85 - "Shared UI Components"
Cohesion: 0.10
Nodes (33): ArrowRight(), EarGlyph(), HelpGlyph(), LineBullet(), MicGlyph(), OptionCard(), s, SpeakCircle() (+25 more)

### Community 86 - "Drill Generation Tests"
Cohesion: 0.18
Nodes (8): appropriateReply, bestSentence, fillBlank, listenType, profilePhrase, repeatThis, sessionPhrase, tapTranslate

### Community 87 - "Android App Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 88 - "Pedagogy Doc"
Cohesion: 0.25
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Loop Doc"
Cohesion: 0.29
Nodes (6): Giving it a goal, Running it, The agents, The bar, The loop, Verifying UI work

### Community 92 - "State And Storage Doc"
Cohesion: 0.29
Nodes (6): On the device, Server side, Sessions and progress, State and storage, The brain's learner model, The round trip, and where it broke

### Community 93 - "Testing Doc"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Agent Spec"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Architecture Doc"
Cohesion: 0.33
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 97 - "Conversation Engine Tests"
Cohesion: 0.14
Nodes (11): supportViewFor(), buildConvo(), FailingBrain, finishSessionWith(), heard(), inScene(), NoCuration, stubSession() (+3 more)

### Community 101 - "TTS Cache & WAV"
Cohesion: 0.33
Nodes (6): normaliseLine(), ResolvedCachedTTSOptions, NO_RETRY, decodeWav(), encodeWav(), WavData

### Community 103 - "Expo Plugins & File Saving"
Cohesion: 0.25
Nodes (6): plugins, expo-audio, expo-font, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

### Community 105 - "TTS Test Fakes"
Cohesion: 0.25
Nodes (3): FakeChunkedStream, FakeSynthesizeStream, rampFrames()

### Community 106 - "Voice Builder Config"
Cohesion: 0.33
Nodes (5): CachedTTSOptions, buildTTS(), DEFAULT_CACHE_DIR, ENV_KEYS, VOICE_SETTINGS

### Community 107 - "Navigation Theme & Types"
Cohesion: 0.40
Nodes (4): linking, navTheme, RootStackParamList, TabParamList

### Community 111 - "iOS App Config"
Cohesion: 0.40
Nodes (5): ios, NSMicrophoneUsageDescription, bundleIdentifier, infoPlist, supportsTablet

### Community 112 - "Tutor Prompt Builder"
Cohesion: 0.90
Nodes (3): baseInstructions(), buildPrompt(), turnInstructions()

## Knowledge Gaps
- **529 isolated node(s):** `ResolvedCachedTTSOptions`, `WavData`, `MtokPrices`, `CopyRule`, `MockAccount` (+524 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rung` connect `Turn Integration & Copy Rules` to `Tutor Turn Controller`, `Learner Profile Model`, `Live Failure Handling`, `Mock Speech & Session Screen`, `Profile Store & Upgrade`, `Navigation & Live Context`, `Utterance Capture`, `Conversation Screen UI`, `Difficulty Ladder`, `Agent Env Preflight`, `Shared UI Components`, `Export & History Reports`, `Lesson Session Engine`, `Lesson Content & Matching`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `plugins` connect `Expo Plugins & File Saving` to `Expo App Config`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `expo` connect `Expo App Config` to `iOS App Config`, `Expo Plugins & File Saving`, `Android App Config`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `ResolvedCachedTTSOptions`, `WavData`, `MtokPrices` to the rest of the system?**
  _529 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Drill Session Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.11290322580645161 - nodes in this community are weakly interconnected._
- **Should `Session Metering & Plans` be split into smaller, more focused modules?**
  _Cohesion score 0.05450165612767239 - nodes in this community are weakly interconnected._
- **Should `Drill Screen Views` be split into smaller, more focused modules?**
  _Cohesion score 0.12912912912912913 - nodes in this community are weakly interconnected._