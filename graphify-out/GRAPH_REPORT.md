# Graph Report - Parle  (2026-08-19)

## Corpus Check
- 228 files · ~156,788 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1765 nodes · 4420 edges · 100 communities (74 shown, 26 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4753fa81`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generate.ts
- drill/index.ts
- metering/index.ts
- phonemes/index.ts
- components.tsx
- conversation.ts
- useLiveSession.ts
- sessionLoop.ts
- expo
- App.tsx
- dependencies
- buildSystemBlocks
- review/store.ts
- loop.mjs
- profile.ts
- AuthAdapter
- extractPrompt.ts
- ttsCache.test.ts
- DrillScreen.tsx
- ladder.ts
- SignUpScreen.tsx
- brain/package.json
- token-server/package.json
- brain-playground/package.json
- session/session.ts
- OnboardingFlow.tsx
- convo.ts
- ConvoScreen.tsx
- core/package.json
- tutor.ts
- compilerOptions
- drill/store.ts
- ParleTutor
- SessionScreen.tsx
- mobile/tsconfig.json
- package.json
- Expo + TypeScript npm-workspaces monorepo
- dependencies
- mobile/package.json
- protocol.ts
- tutorVoice.ts
- brain/tsconfig.json
- core/tsconfig.json
- brain-playground/tsconfig.json
- token-server/tsconfig.json
- tutor-agent/tsconfig.json
- RootNavigator.tsx
- scripts
- globals.native.ts
- paper
- Entitlement
- expo-crypto
- openaiCompat.ts
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
- contract/types.ts
- react-native-svg
- levels.ts
- runEval.ts
- gate.mjs
- activity.ts
- Format
- server.ts
- tokens.ts
- shared/speechace.ts
- SplashScreen.tsx
- nav/theme.ts
- @livekit/react-native-webrtc
- @parle/brain
- react-dom
- react-native-screens
- @react-navigation/bottom-tabs
- @react-navigation/native
- @supabase/supabase-js
- SummaryScreen.tsx
- scope.ts
- auth.ts
- The pedagogy
- expo-file-system
- The live path
- The loop
- State and storage
- Testing
- bug-hunter.md
- Architecture
- README.md
- Cascaded STT to LLM to TTS voice pipeline
- fix-verifier.md

## God Nodes (most connected - your core abstractions)
1. `space()` - 62 edges
2. `paper` - 35 edges
3. `ParleConversation` - 29 edges
4. `type` - 28 edges
5. `ParleTutor` - 24 edges
6. `LlmUsage` - 23 edges
7. `Rung` - 23 edges
8. `integrateTurn()` - 21 edges
9. `ScenarioFrame` - 20 edges
10. `createConversation()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Chrome is plain English, French only where it is content` --rationale_for--> `CAFE_LESSON`  [INFERRED]
  DESIGN.md → packages/core/src/lessons/cafe.ts
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
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

## Communities (100 total, 26 thin omitted)

### Community 0 - "generate.ts"
Cohesion: 0.09
Nodes (24): NewPhrase, AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), DrillBatchSchema, DrillGenerationInput, FillBlankZ (+16 more)

### Community 1 - "drill/index.ts"
Cohesion: 0.05
Nodes (85): check(), checkDrill(), DRILL_FIXTURES, acceptedFor(), DrillVerdict, gradeAnswer(), gradeFreeText(), GradeResult (+77 more)

### Community 2 - "metering/index.ts"
Cohesion: 0.20
Nodes (18): CostModel, DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PLANS, PlanSpec (+10 more)

### Community 3 - "phonemes/index.ts"
Cohesion: 0.10
Nodes (45): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+37 more)

### Community 4 - "components.tsx"
Cohesion: 0.10
Nodes (28): HelpGlyph(), Label(), LineBullet(), MicGlyph(), ProgressDots(), s, SpeakCircle(), StationLine() (+20 more)

### Community 5 - "conversation.ts"
Cohesion: 0.10
Nodes (34): FR_PACK, renderAuthenticityPack(), AuthenticityPack, CoachItem, SpeakerLine, SupportView, coachFallbackLine(), CopyRule (+26 more)

### Community 6 - "useLiveSession.ts"
Cohesion: 0.14
Nodes (21): authHeaders(), scoreAttempt(), classifyFailure(), COPY, LiveFailure, micApiUnavailable(), TokenServerError, ensureAudioSession() (+13 more)

### Community 7 - "sessionLoop.ts"
Cohesion: 0.13
Nodes (34): SessionRecap, createProfile(), main(), pickClient(), Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS (+26 more)

### Community 8 - "expo"
Cohesion: 0.05
Nodes (34): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+26 more)

### Community 9 - "App.tsx"
Cohesion: 0.16
Nodes (15): App(), Gate(), SignedInRoot(), st, LiveProvider(), AuthFlow(), RootNavigator(), completeProfile() (+7 more)

### Community 10 - "dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "buildSystemBlocks"
Cohesion: 0.18
Nodes (18): ZERO_USAGE, learnerSnapshotFrom(), buildScenarioRequest(), buildSystemBlocks(), main(), pickClient(), PROFILES, checkFrame() (+10 more)

### Community 12 - "review/store.ts"
Cohesion: 0.07
Nodes (50): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+42 more)

### Community 13 - "loop.mjs"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "profile.ts"
Cohesion: 0.07
Nodes (47): Ctx, ProfileGate(), ProfileValue, KEY(), loadProfile(), OnboardingAnswers, saveProfile(), StoredProfile (+39 more)

### Community 15 - "AuthAdapter"
Cohesion: 0.08
Nodes (20): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+12 more)

### Community 16 - "extractPrompt.ts"
Cohesion: 0.33
Nodes (8): MemoryFact, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request(), tennis

### Community 17 - "ttsCache.test.ts"
Cohesion: 0.07
Nodes (18): CachedChunkedStream, CachedTTS, CachedTTSOptions, normaliseLine(), FakeChunkedStream, FakeTTS, NO_RETRY, synth() (+10 more)

### Community 18 - "DrillScreen.tsx"
Cohesion: 0.17
Nodes (21): EarGlyph(), fitDisplay(), OptionCard(), ConvoScreen(), AppropriateReplyView(), BestSentenceView(), ds, FillBlankView() (+13 more)

### Community 19 - "ladder.ts"
Cohesion: 0.13
Nodes (29): Chrome is plain English, French only where it is content, No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderDirective (+21 more)

### Community 20 - "SignUpScreen.tsx"
Cohesion: 0.21
Nodes (16): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, useAuth() (+8 more)

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
Nodes (23): SessionViewProps, TurnQuality, LessonTurn, PhonemeObservation, SessionPhonemeReport, feedbackMessage(), grade(), INTELLIGIBLE (+15 more)

### Community 25 - "OnboardingFlow.tsx"
Cohesion: 0.09
Nodes (29): st, WelcomeScreen(), Card(), GhostButton(), PillButton(), HeroCafe(), LearnStack(), OnboardCake() (+21 more)

### Community 26 - "convo.ts"
Cohesion: 0.06
Nodes (38): LearnerTurnInput, encodeMessage(), TokenMeta, tutorLLM(), brainClient(), chooseFrame(), CONVO_LINES, ConvoView (+30 more)

### Community 27 - "ConvoScreen.tsx"
Cohesion: 0.15
Nodes (16): st, RecapScreen(), registerTag(), st, HAIRLINE, type, Line(), Recast() (+8 more)

### Community 28 - "core/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "tutor.ts"
Cohesion: 0.20
Nodes (10): Rung, CAFE_LESSON, Lesson, A real spoken exchange inside one five-minute session, baseInstructions(), buildPrompt(), turnInstructions(), Publisher (+2 more)

### Community 30 - "compilerOptions"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "drill/store.ts"
Cohesion: 0.24
Nodes (16): defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY(), loadDrillBank() (+8 more)

### Community 33 - "SessionScreen.tsx"
Cohesion: 0.23
Nodes (12): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+4 more)

### Community 34 - "mobile/tsconfig.json"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "package.json"
Cohesion: 0.11
Nodes (17): description, engines, node, name, private, scripts, gate, gate:bless (+9 more)

### Community 36 - "Expo + TypeScript npm-workspaces monorepo"
Cohesion: 0.22
Nodes (9): Read the exact versioned Expo docs before writing code, Absolute-beginner audience (CEFR A0-A2), Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text, The agent is authoritative over session state, The alignment thesis, packages/core is deliberately platform-free (+1 more)

### Community 37 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-audio, expo-font, @livekit/react-native, react-native-safe-area-context, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "mobile/package.json"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "protocol.ts"
Cohesion: 0.17
Nodes (20): LiveSession, CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine, ConvoSupportView, ConvoView (+12 more)

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
Cohesion: 0.15
Nodes (20): Ctx, LiveValue, useLive(), LiveSessionScreen(), asRung(), DrillRoute(), LessonRoute(), st (+12 more)

### Community 47 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, android, ios, start, typecheck, web

### Community 49 - "paper"
Cohesion: 0.12
Nodes (18): useProfile(), ArrowRight(), Acknowledgements(), Notice, NOTICES, st, ConvoRoute(), SettingsRow() (+10 more)

### Community 50 - "Entitlement"
Cohesion: 0.24
Nodes (5): Entitlement, Plan, EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore

### Community 52 - "openaiCompat.ts"
Cohesion: 0.15
Nodes (21): MemoryExtraction, ScenarioFrame, TutorTurn, DrillBatch, BrainDrillsRequest, BrainExtractRequest, BrainFrameRequest, BrainParseError (+13 more)

### Community 53 - "anthropic.ts"
Cohesion: 0.13
Nodes (18): AnthropicBrainClient, AnthropicBrainConfig, outputConfig(), parse(), ParseCapableSdk, ParsedResponse, toProviderMessages(), usageOf() (+10 more)

### Community 66 - "contract/types.ts"
Cohesion: 0.07
Nodes (46): sampleCoachItem(), sampleSupport(), sampleTurn(), AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema (+38 more)

### Community 68 - "levels.ts"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 69 - "runEval.ts"
Cohesion: 0.19
Nodes (15): CoachKind, applyNonSpokenInput(), defaultModel(), EVAL_CASES, EvalCase, EvalExpectation, CaseResult, expectationMisses() (+7 more)

### Community 70 - "gate.mjs"
Cohesion: 0.12
Nodes (13): args, asJson, bless, counts, entries, failures, floors, FLOORS_PATH (+5 more)

### Community 71 - "activity.ts"
Cohesion: 0.26
Nodes (11): ActivityEntry, ActivityKind, backfillFrom(), chain, earnedXp(), empty(), loadActivity(), prune() (+3 more)

### Community 72 - "Format"
Cohesion: 0.13
Nodes (15): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+7 more)

### Community 73 - "server.ts"
Cohesion: 0.20
Nodes (11): agentDebitAllowed(), config, json(), livekitUrl, PORT, readAudio(), readJson(), scoreCounts (+3 more)

### Community 74 - "tokens.ts"
Cohesion: 0.27
Nodes (11): canStartSession(), secondsRemaining(), GrantResult, grantSession(), roomNameFor(), SessionGrant, SessionMode, config (+3 more)

### Community 75 - "shared/speechace.ts"
Cohesion: 0.27
Nodes (7): ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreRequest, scoreUtterance(), RESPONSE

### Community 76 - "SplashScreen.tsx"
Cohesion: 0.40
Nodes (5): bubbleStyle(), Scene(), SplashScreen(), st, decorative

### Community 77 - "nav/theme.ts"
Cohesion: 0.25
Nodes (7): linking, navTheme, RootStackParamList, TabParamList, font, fitDisplay length-stepped French line, Fraunces speaks, DM Sans is furniture

### Community 85 - "SummaryScreen.tsx"
Cohesion: 0.21
Nodes (8): Stat(), PathNodeRow(), st, statusLine(), saveTextFile(), st, SummaryScreen(), radius

### Community 86 - "scope.ts"
Cohesion: 0.31
Nodes (6): LEGACY_KEYS, onUserScopeReset(), resetHooks, userKey(), hasSeenTutorIntro(), markTutorIntroSeen()

### Community 87 - "auth.ts"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 88 - "The pedagogy"
Cohesion: 0.25
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 90 - "The live path"
Cohesion: 0.29
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

### Community 97 - "Cascaded STT to LLM to TTS voice pipeline"
Cohesion: 0.50
Nodes (4): Learner-accented French breaks ordinary STT, Cascaded STT to LLM to TTS voice pipeline, Risk 1: STT on real learner French, Self-hosted open-source LiveKit, the $0 stack

## Knowledge Gaps
- **494 isolated node(s):** `st`, `name`, `slug`, `version`, `orientation` (+489 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rung` connect `tutor.ts` to `SessionScreen.tsx`, `drill/index.ts`, `components.tsx`, `conversation.ts`, `useLiveSession.ts`, `protocol.ts`, `RootNavigator.tsx`, `profile.ts`, `ladder.ts`, `session/session.ts`, `convo.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `plugins` connect `expo` to `AuthAdapter`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `ParleConversation` connect `convo.ts` to `contract/types.ts`, `protocol.ts`, `buildSystemBlocks`, `profile.ts`, `openaiCompat.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `st`, `name`, `slug` to the rest of the system?**
  _494 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0873015873015873 - nodes in this community are weakly interconnected._
- **Should `drill/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05175202156334232 - nodes in this community are weakly interconnected._
- **Should `phonemes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0962962962962963 - nodes in this community are weakly interconnected._