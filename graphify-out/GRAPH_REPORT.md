# Graph Report - Parle  (2026-08-19)

## Corpus Check
- 228 files · ~161,802 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1787 nodes · 4464 edges · 100 communities (72 shown, 28 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cde77aa6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generate.ts
- drill/index.ts
- server.ts
- phonemes/index.ts
- space
- runEval.ts
- useLiveSession.ts
- sessionLoop.ts
- expo
- App.tsx
- dependencies
- frameEval.ts
- review/store.ts
- loop.mjs
- conversation.ts
- AuthAdapter
- drill/validate.ts
- warmCache.ts
- drill/types.ts
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
- core/src/index.ts
- compilerOptions
- DrillScreen.tsx
- ParleTutor
- contract/types.ts
- mobile/tsconfig.json
- package.json
- profile.ts
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
- path.ts
- preflight.ts
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
- convo.ts
- react-native-svg
- activity.ts
- LlmUsage
- gate.mjs
- brain/src/index.ts
- Format
- engine/grading.ts
- CAFE_LESSON
- shared/speechace.ts
- AnthropicBrainClient
- drill/grading.ts
- @livekit/react-native-webrtc
- @parle/brain
- react-dom
- react-native-screens
- @react-navigation/bottom-tabs
- @react-navigation/native
- @supabase/supabase-js
- SummaryScreen.tsx
- LeaderboardTab.tsx
- TurnQueue
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
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx
- `fitDisplay length-stepped French line` --rationale_for--> `fitDisplay()`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/components.tsx
- `Paper colour token set` --rationale_for--> `paper`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/theme.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (100 total, 28 thin omitted)

### Community 0 - "generate.ts"
Cohesion: 0.08
Nodes (22): AppropriateReplyZ, BASE, BestSentenceZ, DrillBatchSchema, DrillGenerationInput, FillBlankZ, GeneratedExerciseZ, INSTRUCTION (+14 more)

### Community 1 - "drill/index.ts"
Cohesion: 0.15
Nodes (24): DrillVerdict, answerCurrent(), AnsweredExercise, applyDrillResults(), buildDrillSession(), DRILL_STAGES, DrillFeedback, DrillOutcome (+16 more)

### Community 2 - "server.ts"
Cohesion: 0.05
Nodes (54): canStartSession(), CostModel, DEFAULT_COST_MODEL, Entitlement, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, Plan (+46 more)

### Community 3 - "phonemes/index.ts"
Cohesion: 0.06
Nodes (69): Paper colour token set, Paper & Ink design world, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute, candidatesFor() (+61 more)

### Community 4 - "space"
Cohesion: 0.08
Nodes (48): Card(), EarGlyph(), fitDisplay(), HelpGlyph(), Label(), LineBullet(), MicGlyph(), OptionCard() (+40 more)

### Community 5 - "runEval.ts"
Cohesion: 0.12
Nodes (26): CoachKind, coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, FILLER_RE, outsideQuotes(), RECOVERY_LINE (+18 more)

### Community 6 - "useLiveSession.ts"
Cohesion: 0.10
Nodes (29): classifyFailure(), COPY, LiveFailure, micApiUnavailable(), TokenServerError, ensureAudioSession(), ensureLiveKitGlobals(), releaseAudioSession() (+21 more)

### Community 7 - "sessionLoop.ts"
Cohesion: 0.13
Nodes (35): SessionRecap, createProfile(), main(), pickClient(), Command, COMMAND_HELP, parseCommand(), STRICTNESS_LEVELS (+27 more)

### Community 8 - "expo"
Cohesion: 0.05
Nodes (34): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+26 more)

### Community 9 - "App.tsx"
Cohesion: 0.14
Nodes (15): Read the exact versioned Expo docs before writing code, App(), Gate(), st, AuthFlow(), RootNavigator(), linking, navTheme (+7 more)

### Community 10 - "dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "frameEval.ts"
Cohesion: 0.18
Nodes (17): buildDrillGenerationRequest(), buildScenarioRequest(), main(), pickClient(), PROFILES, checkFrame(), main(), pickClient() (+9 more)

### Community 12 - "review/store.ts"
Cohesion: 0.16
Nodes (29): addFromSummary(), addPhrases(), dueCount(), gradeCard(), KEY(), loadDeck(), saveDeck(), serialized() (+21 more)

### Community 13 - "loop.mjs"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "conversation.ts"
Cohesion: 0.10
Nodes (33): ContrastPair, Filler, RegisterDef, SlangEntry, CoachItem, NewPhrase, SpeakerLine, SupportView (+25 more)

### Community 15 - "AuthAdapter"
Cohesion: 0.08
Nodes (20): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+12 more)

### Community 16 - "drill/validate.ts"
Cohesion: 0.17
Nodes (18): DrillStore, check(), checkDrill(), DRILL_FIXTURES, DrillDifficulty, DrillExercise, checkAccepted(), checkDistinct() (+10 more)

### Community 17 - "warmCache.ts"
Cohesion: 0.06
Nodes (23): CachedChunkedStream, CachedTTS, CachedTTSOptions, normaliseLine(), FakeChunkedStream, FakeTTS, NO_RETRY, synth() (+15 more)

### Community 18 - "drill/types.ts"
Cohesion: 0.17
Nodes (18): typed(), withOptions(), AppropriateReplyExercise, BestSentenceExercise, DrillExerciseBase, FillBlankExercise, ListenTypeExercise, RepeatThisExercise (+10 more)

### Community 19 - "ladder.ts"
Cohesion: 0.16
Nodes (24): applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState, nextSessionRung(), openingRung() (+16 more)

### Community 20 - "SignUpScreen.tsx"
Cohesion: 0.18
Nodes (19): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, useAuth() (+11 more)

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
Cohesion: 0.13
Nodes (28): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+20 more)

### Community 25 - "OnboardingFlow.tsx"
Cohesion: 0.09
Nodes (26): st, WelcomeScreen(), GhostButton(), HeroCafe(), LearnStack(), OnboardCake(), OnboardClock(), OnboardSuitcase() (+18 more)

### Community 26 - "ParleConversation"
Cohesion: 0.13
Nodes (11): MemoryFact, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request(), tennis (+3 more)

### Community 27 - "src/theme.ts"
Cohesion: 0.11
Nodes (22): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+14 more)

### Community 28 - "core/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "core/src/index.ts"
Cohesion: 0.29
Nodes (8): Rung, Lesson, baseInstructions(), buildPrompt(), turnInstructions(), Publisher, reportUsage(), UsageReport

### Community 30 - "compilerOptions"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "DrillScreen.tsx"
Cohesion: 0.14
Nodes (25): authHeaders(), defaultStore(), getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY(), loadDrillBank() (+17 more)

### Community 33 - "contract/types.ts"
Cohesion: 0.15
Nodes (16): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+8 more)

### Community 34 - "mobile/tsconfig.json"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "package.json"
Cohesion: 0.11
Nodes (17): description, engines, node, name, private, scripts, gate, gate:bless (+9 more)

### Community 36 - "profile.ts"
Cohesion: 0.18
Nodes (18): normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW, finishSession() (+10 more)

### Community 37 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-audio, expo-font, @livekit/react-native, react-native-safe-area-context, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "mobile/package.json"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "protocol.ts"
Cohesion: 0.13
Nodes (23): CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine, ConvoSupportView, decodeAs(), decodeClientMessage() (+15 more)

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
Cohesion: 0.11
Nodes (26): Ctx, LiveProvider(), LiveValue, useLive(), useProfile(), asRung(), ConvoRoute(), DrillRoute() (+18 more)

### Community 47 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, android, ios, start, typecheck, web

### Community 49 - "path.ts"
Cohesion: 0.20
Nodes (14): AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), GENERATED_PREFIX, NodeKind, NodeState (+6 more)

### Community 50 - "preflight.ts"
Cohesion: 0.21
Nodes (14): tutorLLM(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired(), preflight(), probe() (+6 more)

### Community 52 - "openaiCompat.ts"
Cohesion: 0.18
Nodes (18): MemoryExtraction, ScenarioFrame, TutorTurn, DrillBatch, BrainDrillsRequest, BrainExtractRequest, BrainFrameRequest, BrainTurnRequest (+10 more)

### Community 53 - "anthropic.ts"
Cohesion: 0.14
Nodes (14): AnthropicBrainConfig, ParseCapableSdk, ParsedResponse, BrainParseError, BrainRefusalError, AnyRecord, BrainActivity, BrainEffort (+6 more)

### Community 66 - "convo.ts"
Cohesion: 0.08
Nodes (33): sampleCoachItem(), sampleSupport(), sampleTurn(), SupportMaterial, createConversation(), LearnerTurnInput, MAX_ATTEMPTS_PER_BEAT, openingRungFor() (+25 more)

### Community 68 - "activity.ts"
Cohesion: 0.07
Nodes (52): SignedInRoot(), Ctx, ProfileGate(), ProfileValue, completeProfile(), createStoredProfile(), KEY(), loadProfile() (+44 more)

### Community 69 - "LlmUsage"
Cohesion: 0.47
Nodes (4): LlmUsage, jsonSchemaText(), OpenAiCompatBrainClient, CaseResult

### Community 70 - "gate.mjs"
Cohesion: 0.12
Nodes (13): args, asJson, bless, counts, entries, failures, floors, FLOORS_PATH (+5 more)

### Community 71 - "brain/src/index.ts"
Cohesion: 0.30
Nodes (8): FR_PACK, renderAuthenticityPack(), AuthenticityPack, historyViewOfTurn(), contextInput(), buildSystemBlocks(), CONTRACT, PERSONA

### Community 72 - "Format"
Cohesion: 0.10
Nodes (21): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+13 more)

### Community 73 - "engine/grading.ts"
Cohesion: 0.23
Nodes (12): Assessment, assessmentToQuality(), INLINE_CAP, KIND_PRIORITY, splitCoach(), SURFACE, surfacePolicy(), assembleRecap() (+4 more)

### Community 74 - "CAFE_LESSON"
Cohesion: 0.18
Nodes (9): Chrome is plain English, French only where it is content, No number and no scolding mid-session, CAFE_LESSON, Never stranded and never scolded, A real spoken exchange inside one five-minute session, Live when reachable, Demo fallback otherwise, Accounts work without Supabase via a local on-device store, A missing score is never an invented penalty (+1 more)

### Community 75 - "shared/speechace.ts"
Cohesion: 0.20
Nodes (8): ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance(), RESPONSE

### Community 76 - "AnthropicBrainClient"
Cohesion: 0.33
Nodes (5): AnthropicBrainClient, outputConfig(), parse(), toProviderMessages(), usageOf()

### Community 77 - "drill/grading.ts"
Cohesion: 0.36
Nodes (9): acceptedFor(), gradeAnswer(), gradeFreeText(), GradeResult, realWordSet(), damerauLevenshtein(), sameWord(), TYPO_MAX_DISTANCE (+1 more)

### Community 85 - "SummaryScreen.tsx"
Cohesion: 0.16
Nodes (12): ArrowRight(), Stat(), PathNodeRow(), st, statusLine(), saveTextFile(), SettingsRow(), st (+4 more)

### Community 86 - "LeaderboardTab.tsx"
Cohesion: 0.29
Nodes (6): ProgressDots(), TabBar(), Board, LeaderboardTab(), st, Gate, onboarding, Home with Speak and Learn tabs

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

## Knowledge Gaps
- **501 isolated node(s):** `st`, `name`, `slug`, `version`, `orientation` (+496 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rung` connect `core/src/index.ts` to `phonemes/index.ts`, `space`, `profile.ts`, `useLiveSession.ts`, `activity.ts`, `protocol.ts`, `RootNavigator.tsx`, `conversation.ts`, `ladder.ts`, `session/session.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `plugins` connect `expo` to `AuthAdapter`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `ParleConversation` connect `ParleConversation` to `convo.ts`, `activity.ts`, `protocol.ts`, `conversation.ts`, `openaiCompat.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `st`, `name`, `slug` to the rest of the system?**
  _501 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08307692307692308 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05450165612767239 - nodes in this community are weakly interconnected._
- **Should `phonemes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05895061728395062 - nodes in this community are weakly interconnected._