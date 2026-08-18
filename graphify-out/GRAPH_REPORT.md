# Graph Report - Parle  (2026-08-19)

## Corpus Check
- 205 files · ~135,358 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1574 nodes · 4114 edges · 90 communities (65 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8e943c95`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generate.ts
- drill/index.ts
- server.ts
- phonemes/index.ts
- components.tsx
- conversation.ts
- useLiveSession.ts
- sessionLoop.ts
- expo
- App.tsx
- dependencies
- brain/src/index.ts
- review/store.ts
- copy.ts
- profile.ts
- AuthAdapter
- contract/types.ts
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
- space
- core/package.json
- lessons/index.ts
- compilerOptions
- DrillScreen.tsx
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
- agent.ts
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
- conversation.test.ts
- react-native-svg
- levels.ts
- runEval.ts
- LearnerProfile
- activity.ts
- AnthropicBrainClient
- LiveErrorView.tsx
- LlmUsage
- convo.ts
- src/theme.ts
- drill/validate.ts
- @livekit/react-native-webrtc
- @parle/brain
- react-dom
- react-native-screens
- @react-navigation/bottom-tabs
- @react-navigation/native
- @supabase/supabase-js
- core/src/index.ts
- DrillExercise
- drill/grading.ts
- plugins
- expo-file-system

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
- `Drill mode and the recognition-to-production ramp` --conceptually_related_to--> `bestDrillFor()`  [INFERRED]
  README.md → packages/core/src/phonemes/drills.ts
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `Words-right and sounds-right are separate questions` --rationale_for--> `grade()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (90 total, 25 thin omitted)

### Community 0 - "generate.ts"
Cohesion: 0.08
Nodes (26): AppropriateReplyZ, BASE, BestSentenceZ, buildDrillGenerationRequest(), DrillBatchSchema, DrillGenerationInput, FillBlankZ, GeneratedExerciseZ (+18 more)

### Community 1 - "drill/index.ts"
Cohesion: 0.15
Nodes (24): DrillVerdict, answerCurrent(), AnsweredExercise, applyDrillResults(), buildDrillSession(), DRILL_STAGES, DrillFeedback, DrillOutcome (+16 more)

### Community 2 - "server.ts"
Cohesion: 0.05
Nodes (57): canStartSession(), CostModel, DEFAULT_COST_MODEL, Entitlement, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, Plan (+49 more)

### Community 3 - "phonemes/index.ts"
Cohesion: 0.09
Nodes (48): bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor(), DrillWord, getDrill() (+40 more)

### Community 4 - "components.tsx"
Cohesion: 0.10
Nodes (26): Card(), ChevronLeft(), EarGlyph(), HelpGlyph(), Label(), LineBullet(), MicGlyph(), ProgressDots() (+18 more)

### Community 5 - "conversation.ts"
Cohesion: 0.10
Nodes (35): Assessment, CoachItem, NewPhrase, SpeakerLine, SupportView, BASE_RUNG_BY_CEFR, beatOf(), ConversationState (+27 more)

### Community 6 - "useLiveSession.ts"
Cohesion: 0.12
Nodes (26): classifyFailure(), COPY, LiveFailure, micApiUnavailable(), TokenServerError, ensureAudioSession(), ensureLiveKitGlobals(), releaseAudioSession() (+18 more)

### Community 7 - "sessionLoop.ts"
Cohesion: 0.10
Nodes (45): SessionRecap, createProfile(), buildScenarioRequest(), main(), pickClient(), Command, COMMAND_HELP, parseCommand() (+37 more)

### Community 8 - "expo"
Cohesion: 0.07
Nodes (29): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+21 more)

### Community 9 - "App.tsx"
Cohesion: 0.10
Nodes (23): App(), Gate(), SignedInRoot(), st, LiveProvider(), AuthFlow(), AuthProvider(), RootNavigator() (+15 more)

### Community 10 - "dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "brain/src/index.ts"
Cohesion: 0.18
Nodes (15): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, contextInput() (+7 more)

### Community 12 - "review/store.ts"
Cohesion: 0.07
Nodes (50): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+42 more)

### Community 13 - "copy.ts"
Cohesion: 0.23
Nodes (12): coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, FILLER_RE, outsideQuotes(), RECOVERY_LINE, RESCUE_LINE (+4 more)

### Community 14 - "profile.ts"
Cohesion: 0.15
Nodes (20): LearnerSnapshot, applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW, finishSession() (+12 more)

### Community 15 - "AuthAdapter"
Cohesion: 0.09
Nodes (16): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+8 more)

### Community 16 - "contract/types.ts"
Cohesion: 0.12
Nodes (22): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+14 more)

### Community 17 - "warmCache.ts"
Cohesion: 0.08
Nodes (17): CONVO_LINES, CachedChunkedStream, CachedTTS, CachedTTSOptions, normaliseLine(), FakeChunkedStream, FakeTTS, NO_RETRY (+9 more)

### Community 18 - "drill/types.ts"
Cohesion: 0.17
Nodes (18): typed(), withOptions(), AppropriateReplyExercise, BestSentenceExercise, DrillExerciseBase, FillBlankExercise, ListenTypeExercise, RepeatThisExercise (+10 more)

### Community 19 - "ladder.ts"
Cohesion: 0.13
Nodes (28): Chrome is plain English, French only where it is content, No number and no scolding mid-session, applyTurn(), clamp(), directiveFor(), initialState(), INSTRUCTION_BY_RUNG, LadderState (+20 more)

### Community 20 - "SignUpScreen.tsx"
Cohesion: 0.19
Nodes (17): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, AuthContext (+9 more)

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
Cohesion: 0.21
Nodes (17): SessionViewProps, LadderDirective, createSession(), feedbackMessage(), grade(), INTELLIGIBLE, LearnerInput, MAX_ATTEMPTS_PER_TURN (+9 more)

### Community 25 - "OnboardingFlow.tsx"
Cohesion: 0.10
Nodes (25): OptionCard(), HeroCafe(), LearnStack(), OnboardCake(), OnboardClock(), OnboardSuitcase(), OnboardWave(), RecapPostcard() (+17 more)

### Community 27 - "space"
Cohesion: 0.14
Nodes (23): fitDisplay(), ConvoScreen(), st, FillBlankView(), RepeatThisView(), recordActivity(), frenchSide(), KIND_TAG (+15 more)

### Community 28 - "core/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "lessons/index.ts"
Cohesion: 0.22
Nodes (14): CAFE_LESSON, BY_ID, getLesson(), LESSONS, CefrLevel, isAcceptable(), Lesson, LessonTurn (+6 more)

### Community 30 - "compilerOptions"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "DrillScreen.tsx"
Cohesion: 0.14
Nodes (25): authHeaders(), defaultStore(), getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY(), loadDrillBank() (+17 more)

### Community 33 - "SessionScreen.tsx"
Cohesion: 0.24
Nodes (11): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+3 more)

### Community 34 - "mobile/tsconfig.json"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "package.json"
Cohesion: 0.13
Nodes (14): description, engines, node, name, private, scripts, test, typecheck (+6 more)

### Community 36 - "Expo + TypeScript npm-workspaces monorepo"
Cohesion: 0.25
Nodes (8): Read the exact versioned Expo docs before writing code, Absolute-beginner audience (CEFR A0-A2), Parle (working name), Expo + TypeScript npm-workspaces monorepo, Trustworthy pronunciation needs a reference text, The alignment thesis, packages/core is deliberately platform-free, Repo path contains a space

### Community 37 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-audio, expo-font, @livekit/react-native, react-native-safe-area-context, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "mobile/package.json"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "protocol.ts"
Cohesion: 0.18
Nodes (19): CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine, ConvoSupportView, decodeAs(), decodeClientMessage() (+11 more)

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
Cohesion: 0.12
Nodes (25): Ctx, LiveValue, useLive(), useProfile(), Stat(), StationLine(), asRung(), ConvoRoute() (+17 more)

### Community 47 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, android, ios, start, typecheck, web

### Community 49 - "paper"
Cohesion: 0.19
Nodes (13): Acknowledgements(), SettingsRow(), st, Sheet, st, HAIRLINE, HIT, paper (+5 more)

### Community 50 - "agent.ts"
Cohesion: 0.21
Nodes (13): Publisher, TokenMeta, tutorLLM(), Brain, BRAIN_KEY, Env, missingRequired(), preflight() (+5 more)

### Community 52 - "openaiCompat.ts"
Cohesion: 0.18
Nodes (18): MemoryExtraction, ScenarioFrame, TutorTurn, DrillBatch, BrainDrillsRequest, BrainExtractRequest, BrainFrameRequest, BrainTurnRequest (+10 more)

### Community 53 - "anthropic.ts"
Cohesion: 0.14
Nodes (14): AnthropicBrainConfig, ParseCapableSdk, ParsedResponse, BrainParseError, BrainRefusalError, AnyRecord, BrainActivity, BrainEffort (+6 more)

### Community 66 - "conversation.test.ts"
Cohesion: 0.12
Nodes (21): sampleCoachItem(), sampleSupport(), sampleTurn(), SupportMaterial, clampRung(), createConversation(), MAX_ATTEMPTS_PER_BEAT, openingRungFor() (+13 more)

### Community 68 - "levels.ts"
Cohesion: 0.24
Nodes (18): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+10 more)

### Community 69 - "runEval.ts"
Cohesion: 0.22
Nodes (14): CoachKind, applyNonSpokenInput(), EVAL_CASES, EvalCase, EvalExpectation, CaseResult, expectationMisses(), hardRules() (+6 more)

### Community 70 - "LearnerProfile"
Cohesion: 0.31
Nodes (11): Ctx, ProfileGate(), ProfileValue, KEY(), loadProfile(), OnboardingAnswers, saveProfile(), StoredProfile (+3 more)

### Community 71 - "activity.ts"
Cohesion: 0.21
Nodes (14): ActivityEntry, ActivityKind, backfillFrom(), chain, earnedXp(), empty(), loadActivity(), prune() (+6 more)

### Community 72 - "AnthropicBrainClient"
Cohesion: 0.33
Nodes (5): AnthropicBrainClient, outputConfig(), parse(), toProviderMessages(), usageOf()

### Community 73 - "LiveErrorView.tsx"
Cohesion: 0.17
Nodes (12): st, WelcomeScreen(), GhostButton(), PillButton(), failureCopy, LiveErrorView(), show(), st (+4 more)

### Community 74 - "LlmUsage"
Cohesion: 0.47
Nodes (3): LlmUsage, jsonSchemaText(), OpenAiCompatBrainClient

### Community 75 - "convo.ts"
Cohesion: 0.20
Nodes (12): supportViewFor(), APERO_FRAME, brainClient(), chooseFrame(), ConvoView, isRecord(), parseStoredProfile(), Publisher (+4 more)

### Community 76 - "src/theme.ts"
Cohesion: 0.24
Nodes (10): bubbleStyle(), Scene(), SplashScreen(), st, decorative, font, STROKE, type (+2 more)

### Community 77 - "drill/validate.ts"
Cohesion: 0.27
Nodes (13): DrillDifficulty, checkAccepted(), checkDistinct(), englishGlosses(), expectedDifficulty(), inRange(), LabelledString, learnerVisibleStrings() (+5 more)

### Community 85 - "core/src/index.ts"
Cohesion: 0.23
Nodes (7): ArrowRight(), PathNodeRow(), st, statusLine(), saveTextFile(), st, SummaryScreen()

### Community 86 - "DrillExercise"
Cohesion: 0.33
Nodes (5): DrillStore, check(), checkDrill(), DRILL_FIXTURES, DrillExercise

### Community 87 - "drill/grading.ts"
Cohesion: 0.36
Nodes (8): acceptedFor(), damerauLevenshtein(), gradeAnswer(), gradeFreeText(), GradeResult, realWordSet(), TYPO_MAX_DISTANCE, TYPO_MIN_LENGTH

### Community 88 - "plugins"
Cohesion: 0.25
Nodes (6): plugins, expo-audio, expo-font, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

## Knowledge Gaps
- **399 isolated node(s):** `st`, `name`, `slug`, `version`, `orientation` (+394 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `plugins` connect `plugins` to `expo`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `Rung` connect `useLiveSession.ts` to `ParleTutor`, `SessionScreen.tsx`, `phonemes/index.ts`, `components.tsx`, `conversation.ts`, `LearnerProfile`, `protocol.ts`, `LiveErrorView.tsx`, `RootNavigator.tsx`, `profile.ts`, `agent.ts`, `ladder.ts`, `session/session.ts`, `lessons/index.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `expo` connect `expo` to `plugins`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `st`, `name`, `slug` to the rest of the system?**
  _399 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07741935483870968 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052531645569620256 - nodes in this community are weakly interconnected._
- **Should `phonemes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09234365867913501 - nodes in this community are weakly interconnected._