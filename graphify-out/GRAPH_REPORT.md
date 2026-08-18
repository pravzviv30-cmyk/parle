# Graph Report - Parle  (2026-08-19)

## Corpus Check
- 205 files · ~135,221 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1573 nodes · 4111 edges · 85 communities (60 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `857e92b9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generate.ts
- drill/index.ts
- server.ts
- phonemes/index.ts
- components.tsx
- engine/grading.ts
- useLiveSession.ts
- sessionLoop.ts
- expo
- App.tsx
- dependencies
- brain/src/index.ts
- review/store.ts
- copy.ts
- convo.ts
- AuthAdapter
- contract/types.ts
- warmCache.ts
- frameEval.ts
- ladder.ts
- SignUpScreen.tsx
- brain/package.json
- token-server/package.json
- brain-playground/package.json
- session/session.ts
- OnboardingFlow.tsx
- ParleConversation
- DrillScreen.tsx
- core/package.json
- lessons/index.ts
- compilerOptions
- drill/store.ts
- ParleTutor
- SessionScreen.tsx
- mobile/tsconfig.json
- package.json
- STUCK_SILENCE_MS
- dependencies
- mobile/package.json
- extractPrompt.ts
- tutorVoice.ts
- brain/tsconfig.json
- core/tsconfig.json
- brain-playground/tsconfig.json
- token-server/tsconfig.json
- tutor-agent/tsconfig.json
- RootNavigator.tsx
- scripts
- globals.native.ts
- src/theme.ts
- expo
- expo-crypto
- client.ts
- anthropic.ts
- expo-linking
- @expo/metro-runtime
- expo-sharing
- expo-speech
- expo-status-bar
- expo-web-browser
- livekit-client
- @livekit/react-native-expo-plugin
- @parle/core
- react
- react-native
- @react-native-async-storage/async-storage
- conversation.ts
- react-native-svg
- levels.ts
- runEval.ts
- LearnerProfile
- activity.ts
- AnthropicBrainClient
- LiveErrorView.tsx
- LlmUsage
- scope.ts
- SplashScreen.tsx
- prompt.ts
- @livekit/react-native-webrtc
- @parle/brain
- react-dom
- react-native-screens
- @react-navigation/bottom-tabs
- @react-navigation/native
- @supabase/supabase-js

## God Nodes (most connected - your core abstractions)
1. `space()` - 62 edges
2. `paper` - 35 edges
3. `type` - 28 edges
4. `ParleConversation` - 27 edges
5. `LlmUsage` - 23 edges
6. `integrateTurn()` - 21 edges
7. `Rung` - 21 edges
8. `ScenarioFrame` - 20 edges
9. `createConversation()` - 20 edges
10. `DrillExercise` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `A real spoken exchange inside one five-minute session` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  PRODUCT.md → packages/core/src/lessons/cafe.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx
- `Signal colours kept out of the rung set` --rationale_for--> `signal`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/theme.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (85 total, 25 thin omitted)

### Community 0 - "generate.ts"
Cohesion: 0.09
Nodes (21): AppropriateReplyZ, BASE, BestSentenceZ, DrillBatchSchema, DrillGenerationInput, FillBlankZ, GeneratedExerciseZ, INSTRUCTION (+13 more)

### Community 1 - "drill/index.ts"
Cohesion: 0.07
Nodes (67): check(), checkDrill(), DRILL_FIXTURES, acceptedFor(), damerauLevenshtein(), DrillVerdict, gradeAnswer(), gradeFreeText() (+59 more)

### Community 2 - "server.ts"
Cohesion: 0.06
Nodes (53): canStartSession(), CostModel, DEFAULT_COST_MODEL, Entitlement, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, Plan (+45 more)

### Community 3 - "phonemes/index.ts"
Cohesion: 0.09
Nodes (47): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+39 more)

### Community 4 - "components.tsx"
Cohesion: 0.10
Nodes (29): Card(), HelpGlyph(), Label(), LineBullet(), MicGlyph(), ProgressDots(), s, SpeakCircle() (+21 more)

### Community 5 - "engine/grading.ts"
Cohesion: 0.11
Nodes (24): Assessment, assessmentToQuality(), INLINE_CAP, KIND_PRIORITY, splitCoach(), SURFACE, surfacePolicy(), assembleRecap() (+16 more)

### Community 6 - "useLiveSession.ts"
Cohesion: 0.06
Nodes (57): authHeaders(), scoreAttempt(), classifyFailure(), COPY, LiveFailure, micApiUnavailable(), TokenServerError, ensureAudioSession() (+49 more)

### Community 7 - "sessionLoop.ts"
Cohesion: 0.13
Nodes (34): SessionRecap, createProfile(), main(), pickClient(), Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS (+26 more)

### Community 8 - "expo"
Cohesion: 0.05
Nodes (34): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+26 more)

### Community 9 - "App.tsx"
Cohesion: 0.11
Nodes (21): Read the exact versioned Expo docs before writing code, App(), Gate(), SignedInRoot(), st, LiveProvider(), AuthFlow(), AuthProvider() (+13 more)

### Community 10 - "dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "brain/src/index.ts"
Cohesion: 0.23
Nodes (12): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, contextInput() (+4 more)

### Community 12 - "review/store.ts"
Cohesion: 0.07
Nodes (50): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+42 more)

### Community 13 - "copy.ts"
Cohesion: 0.18
Nodes (14): coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, FILLER_RE, outsideQuotes(), RECOVERY_LINE, RESCUE_LINE (+6 more)

### Community 14 - "convo.ts"
Cohesion: 0.08
Nodes (40): sampleCoachItem(), sampleSupport(), sampleTurn(), createConversation(), MAX_ATTEMPTS_PER_BEAT, englishTurn(), fresh(), poorTurn() (+32 more)

### Community 15 - "AuthAdapter"
Cohesion: 0.08
Nodes (17): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+9 more)

### Community 16 - "contract/types.ts"
Cohesion: 0.14
Nodes (18): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+10 more)

### Community 17 - "warmCache.ts"
Cohesion: 0.08
Nodes (17): CONVO_LINES, CachedChunkedStream, CachedTTS, CachedTTSOptions, normaliseLine(), FakeChunkedStream, FakeTTS, NO_RETRY (+9 more)

### Community 18 - "frameEval.ts"
Cohesion: 0.18
Nodes (18): buildDrillGenerationRequest(), phraseLine(), ZERO_USAGE, buildScenarioRequest(), main(), pickClient(), PROFILES, checkFrame() (+10 more)

### Community 19 - "ladder.ts"
Cohesion: 0.20
Nodes (18): applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState, nextSessionRung(), PROMOTION_STREAK (+10 more)

### Community 20 - "SignUpScreen.tsx"
Cohesion: 0.15
Nodes (22): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, AuthContext (+14 more)

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
Cohesion: 0.18
Nodes (20): SessionViewProps, LadderDirective, TurnQuality, PhonemeObservation, feedbackMessage(), grade(), INTELLIGIBLE, LearnerInput (+12 more)

### Community 25 - "OnboardingFlow.tsx"
Cohesion: 0.12
Nodes (21): HeroCafe(), LearnStack(), OnboardCake(), OnboardClock(), OnboardSuitcase(), OnboardWave(), RecapPostcard(), SpeakBubbles() (+13 more)

### Community 27 - "DrillScreen.tsx"
Cohesion: 0.14
Nodes (24): EarGlyph(), fitDisplay(), OptionCard(), ConvoScreen(), AppropriateReplyView(), BestSentenceView(), ds, FillBlankView() (+16 more)

### Community 28 - "core/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "lessons/index.ts"
Cohesion: 0.30
Nodes (10): CAFE_LESSON, BY_ID, getLesson(), LESSONS, CefrLevel, isAcceptable(), Lesson, LessonTurn (+2 more)

### Community 30 - "compilerOptions"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "drill/store.ts"
Cohesion: 0.24
Nodes (16): defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY(), loadDrillBank() (+8 more)

### Community 33 - "SessionScreen.tsx"
Cohesion: 0.21
Nodes (13): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+5 more)

### Community 34 - "mobile/tsconfig.json"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "package.json"
Cohesion: 0.13
Nodes (14): description, engines, node, name, private, scripts, test, typecheck (+6 more)

### Community 36 - "STUCK_SILENCE_MS"
Cohesion: 0.11
Nodes (20): Chrome is plain English, French only where it is content, No number and no scolding mid-session, STUCK_SILENCE_MS, Absolute-beginner audience (CEFR A0-A2), Never stranded and never scolded, Parle (working name), Four-rung scaffolding ladder, Expo + TypeScript npm-workspaces monorepo (+12 more)

### Community 37 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo-audio, expo-file-system, expo-font, @livekit/react-native, react-native-safe-area-context, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "mobile/package.json"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "extractPrompt.ts"
Cohesion: 0.31
Nodes (9): MemoryFact, ChatMessage, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request() (+1 more)

### Community 40 - "tutorVoice.ts"
Cohesion: 0.43
Nodes (6): available(), frenchVoice(), loadVoices(), speak(), speakLines(), withTimeout()

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
Nodes (21): Ctx, LiveValue, useLive(), useProfile(), asRung(), ConvoRoute(), DrillRoute(), LessonRoute() (+13 more)

### Community 47 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, android, ios, start, typecheck, web

### Community 49 - "src/theme.ts"
Cohesion: 0.09
Nodes (36): ArrowRight(), st, Acknowledgements(), Notice, NOTICES, st, PathNodeRow(), st (+28 more)

### Community 52 - "client.ts"
Cohesion: 0.20
Nodes (14): MemoryExtraction, ScenarioFrame, TutorTurn, DrillBatch, CAFE_FRAME, FIXTURE_FRAMES, BrainDrillsRequest, BrainExtractRequest (+6 more)

### Community 53 - "anthropic.ts"
Cohesion: 0.14
Nodes (15): APERO_FRAME, AnthropicBrainConfig, ParseCapableSdk, ParsedResponse, BrainParseError, BrainRefusalError, AnyRecord, BrainActivity (+7 more)

### Community 66 - "conversation.ts"
Cohesion: 0.16
Nodes (23): CoachItem, NewPhrase, SpeakerLine, SupportMaterial, SupportView, BASE_RUNG_BY_CEFR, beatOf(), clampRung() (+15 more)

### Community 68 - "levels.ts"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 69 - "runEval.ts"
Cohesion: 0.22
Nodes (14): CoachKind, applyNonSpokenInput(), EVAL_CASES, EvalCase, EvalExpectation, CaseResult, expectationMisses(), hardRules() (+6 more)

### Community 70 - "LearnerProfile"
Cohesion: 0.35
Nodes (10): Ctx, ProfileGate(), ProfileValue, KEY(), loadProfile(), OnboardingAnswers, saveProfile(), StoredProfile (+2 more)

### Community 71 - "activity.ts"
Cohesion: 0.26
Nodes (11): ActivityEntry, ActivityKind, backfillFrom(), chain, earnedXp(), empty(), loadActivity(), prune() (+3 more)

### Community 72 - "AnthropicBrainClient"
Cohesion: 0.33
Nodes (5): AnthropicBrainClient, outputConfig(), parse(), toProviderMessages(), usageOf()

### Community 73 - "LiveErrorView.tsx"
Cohesion: 0.27
Nodes (7): failureCopy, LiveErrorView(), show(), st, LiveSessionScreen(), st, SessionView()

### Community 74 - "LlmUsage"
Cohesion: 0.47
Nodes (3): LlmUsage, jsonSchemaText(), OpenAiCompatBrainClient

### Community 75 - "scope.ts"
Cohesion: 0.31
Nodes (6): LEGACY_KEYS, onUserScopeReset(), resetHooks, userKey(), hasSeenTutorIntro(), markTutorIntroSeen()

### Community 76 - "SplashScreen.tsx"
Cohesion: 0.40
Nodes (5): bubbleStyle(), Scene(), SplashScreen(), st, STROKE

### Community 77 - "prompt.ts"
Cohesion: 0.90
Nodes (3): baseInstructions(), buildPrompt(), turnInstructions()

## Knowledge Gaps
- **399 isolated node(s):** `st`, `name`, `slug`, `version`, `orientation` (+394 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rung` connect `conversation.ts` to `ParleTutor`, `SessionScreen.tsx`, `phonemes/index.ts`, `components.tsx`, `useLiveSession.ts`, `LearnerProfile`, `LiveErrorView.tsx`, `RootNavigator.tsx`, `convo.ts`, `ladder.ts`, `session/session.ts`, `lessons/index.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `plugins` connect `expo` to `AuthAdapter`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `st`, `name`, `slug` to the rest of the system?**
  _399 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08666666666666667 - nodes in this community are weakly interconnected._
- **Should `drill/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06540447504302926 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05859969558599695 - nodes in this community are weakly interconnected._
- **Should `phonemes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09335839598997493 - nodes in this community are weakly interconnected._