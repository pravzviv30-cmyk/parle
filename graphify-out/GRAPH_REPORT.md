# Graph Report - Parle  (2026-08-20)

## Corpus Check
- 336 files · ~257,743 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2477 nodes · 6089 edges · 164 communities (128 shown, 36 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `29b12b0e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Entitlement
- drill/index.ts
- metering/index.ts
- phonemes/index.ts
- space
- LeaderboardTab.tsx
- activity.ts
- sessionLoop.ts
- Expo App Config
- App.tsx
- Tutor Agent Dependencies
- generate.ts
- Dev Launcher Script
- Autonomous Bug Loop
- conversation.ts
- Mock Auth Adapter
- path.ts
- utterance.test.ts
- illustrations/index.ts
- ladder.ts
- ConversationState
- Brain Package Manifest
- Token Server Manifest
- Playground Package Manifest
- session/session.ts
- OnboardingFlow.tsx
- ParleConversation
- anthropic.ts
- Core Package Manifest
- useLiveSession.ts
- Shared TypeScript Config
- runEval.ts
- ParleTutor
- localAdapter.ts
- Mobile TypeScript Config
- Root Workspace Scripts
- profile.ts
- dependencies
- Mobile Dev Dependencies
- SignUpScreen.tsx
- tutorVoice.ts
- Brain TypeScript Config
- Core TypeScript Config
- Playground TypeScript Config
- Token Server TypeScript Config
- Tutor Agent TypeScript Config
- RootNavigator.tsx
- Mobile Run Scripts
- Native Audio Globals Setup
- review/store.ts
- preflight.ts
- drill/store.ts
- client.ts
- src/theme.ts
- Expo Linking Dependency
- Metro Runtime Dependency
- Expo Sharing Dependency
- Expo Speech Dependency
- openaiCompat.ts
- Expo Web Browser Dependency
- server.ts
- LiveKit Expo Plugin
- Core Package Dependency
- Graph Guard Script
- React Native Dependency
- AsyncStorage Dependency
- contract/types.ts
- React Native SVG
- levels.ts
- drill/types.ts
- Gate Enforcement Script
- choosingView.ts
- Format
- Agent Fleet Validation
- Supabase Auth Adapter
- core/src/index.ts
- Auth Adapter Interface
- brain/src/index.ts
- LiveKit WebRTC Dependency
- extractPrompt.ts
- React DOM Dependency
- React Native Screens
- Bottom Tabs Navigation
- React Navigation Native
- Supabase Client Dependency
- components.tsx
- lessons/types.ts
- Android App Config
- Pedagogy Rules Doc
- normalise
- Live Voice Doc
- Forge Loop Guide
- State and Storage Docs
- Testing Guide
- Bug Hunter Role
- Architecture Overview Doc
- README.md
- convo.test.ts
- Fix Verifier Role
- client.test.ts
- profile/store.ts
- PathNodeRow.tsx
- Expo Plugins And Sharing
- convo.ts
- Deploy Engineer Agent
- Observability Engineer Agent
- Revenue Engineer Agent
- protocol.ts
- LiveKit React Native
- Safe Area Context
- iOS App Config
- Forge Workflow Docs
- palette.test.ts
- Copy Style Tests
- Expo Font Dependency
- buildSystemBlocks
- Expo File System
- API Engineer Agent
- Performance Engineer Agent
- Security Engineer Agent
- Auth Engineer Role
- Backend Engineer Role
- Data Engineer Role
- Frontend Engineer Role
- Team Roster Doc
- Design Architect Role
- Scaling Engineer Role
- createProfile
- release-engineer.md
- work-judge.md
- recap.ts
- Pre-commit Hook
- Pre-push Hook
- Git Hook Installer
- warmCache.ts
- tokens.ts
- curate.ts
- ttsCache.ts
- drill/grading.ts
- LlmUsage
- agent.ts
- ttsCache.test.ts
- auth.ts
- today.ts
- TurnQueue
- HomeTab.tsx
- land.md
- Expo Status Bar
- CachedChunkedStream
- motion.test.ts
- enterRecord.test.ts
- ConvoScreen.tsx
- labels.test.ts
- claudeCli.test.ts
- keyboardTaps.test.ts
- nav/theme.ts
- src/store.ts
- SlowBrain
- livekit-client
- KNOWN_ISSUES.md

## God Nodes (most connected - your core abstractions)
1. `space()` - 76 edges
2. `Format` - 59 edges
3. `paper` - 47 edges
4. `ParleConversation` - 41 edges
5. `LlmUsage` - 39 edges
6. `type` - 35 edges
7. `MockLlmClient` - 29 edges
8. `LlmClient` - 25 edges
9. `ScenarioFrame` - 24 edges
10. `ParleTutor` - 24 edges

## Surprising Connections (you probably didn't know these)
- `A real spoken exchange inside one five-minute session` --rationale_for--> `createSession()`  [INFERRED]
  PRODUCT.md → packages/core/src/session/session.ts
- `460pt centred web column` --rationale_for--> `App()`  [INFERRED]
  DESIGN.md → apps/mobile/App.tsx
- `Paper colour token set` --rationale_for--> `paper`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/theme.ts
- `Signal colours kept out of the rung set` --rationale_for--> `signal`  [EXTRACTED]
  DESIGN.md → apps/mobile/src/theme.ts
- `Inline SVG illustration style contract` --rationale_for--> `STROKE`  [INFERRED]
  DESIGN.md → apps/mobile/src/theme.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The four-rung scaffolding system, from principle to pixel** — product_scaffolding_ladder, product_never_stranded_never_scolded, design_support_colours_cool, packages_core_src_ladder_ladder_applyturn, apps_mobile_src_theme_rungcolor, readme_agent_authoritative [INFERRED 0.85]
- **The trustworthy-pronunciation chain** — product_trustworthy_pronunciation, product_french_only_depth, product_say_one_thing, readme_missing_score_no_penalty, packages_core_src_phonemes_inventory_french_phonemes, packages_core_src_phonemes_drills_drills, packages_core_src_phonemes_scoring_buildreport, services_shared_speechace_scoreutterance [INFERRED 0.85]
- **Unit economics and metering enforcement** — product_metered_minutes, product_cascaded_voice_pipeline, readme_metering_at_token_issuance, readme_tts_warm_cache, readme_risk_cost_per_session, packages_core_src_metering_meter_plans, packages_core_src_metering_meter_estimatesessioncost [INFERRED 0.85]

## Communities (164 total, 36 thin omitted)

### Community 0 - "Entitlement"
Cohesion: 0.19
Nodes (6): Entitlement, Plan, DevelopmentEntitlementStore, EntitlementStore, FileEntitlementStore, InMemoryEntitlementStore

### Community 1 - "drill/index.ts"
Cohesion: 0.14
Nodes (28): DrillVerdict, gradeAnswer(), answerCurrent(), AnsweredExercise, applyDrillResults(), buildDrillSession(), DRILL_STAGES, DrillFeedback (+20 more)

### Community 2 - "metering/index.ts"
Cohesion: 0.16
Nodes (21): CostModel, DEFAULT_COST_MODEL, estimateSessionCost(), Margin, MIN_VIABLE_SESSION_SEC, planMargin(), PlanSpec, recordUsage() (+13 more)

### Community 3 - "phonemes/index.ts"
Cohesion: 0.07
Nodes (54): Paper colour token set, Paper & Ink design world, bestDrillFor(), BY_ID, Drill, DrillKind, DRILLS, drillsFor() (+46 more)

### Community 4 - "space"
Cohesion: 0.12
Nodes (33): authHeaders(), fitDisplay(), OptionCard(), loadDrillBank(), AppropriateReplyView(), BestSentenceView(), DrillScreen(), ds (+25 more)

### Community 5 - "LeaderboardTab.tsx"
Cohesion: 0.15
Nodes (21): useProfile(), AuthContext, AuthStatus, useAuth(), friends, AddFriendsScreen(), Hit, RowStatus (+13 more)

### Community 6 - "activity.ts"
Cohesion: 0.26
Nodes (11): ActivityKind, backfillFrom(), chain, empty(), prune(), read(), Stored, write() (+3 more)

### Community 7 - "sessionLoop.ts"
Cohesion: 0.15
Nodes (31): SessionRecap, defaultModel(), learnerSnapshotFrom(), main(), pickClient(), Command, COMMAND_HELP, parseCommand() (+23 more)

### Community 8 - "Expo App Config"
Cohesion: 0.13
Nodes (14): expo, icon, name, newArchEnabled, orientation, scheme, slug, splash (+6 more)

### Community 9 - "App.tsx"
Cohesion: 0.13
Nodes (19): Read the exact versioned Expo docs before writing code, App(), Gate(), SignedInRoot(), st, LiveProvider(), AuthFlow(), AuthProvider() (+11 more)

### Community 10 - "Tutor Agent Dependencies"
Cohesion: 0.05
Nodes (37): @livekit/agents, @livekit/agents-plugin-anthropic, @livekit/agents-plugin-deepgram, @livekit/agents-plugin-elevenlabs, @livekit/agents-plugin-openai, @livekit/agents-plugin-silero, dependencies, dotenv (+29 more)

### Community 11 - "generate.ts"
Cohesion: 0.15
Nodes (12): AppropriateReplyZ, BASE, BestSentenceZ, FillBlankZ, GeneratedExerciseZ, INSTRUCTION, ListenTypeZ, NonMicExerciseZ (+4 more)

### Community 12 - "Dev Launcher Script"
Cohesion: 0.09
Nodes (36): AGENT_ENV_FILE, children, COLOURS, die(), hasClaudeCli(), launch(), main(), probe() (+28 more)

### Community 13 - "Autonomous Bug Loop"
Cohesion: 0.07
Nodes (18): ALLOWED_TOOLS, argv, BRANCH, branchNow, current, deadEnds, DRY_RUN, final (+10 more)

### Community 14 - "conversation.ts"
Cohesion: 0.13
Nodes (25): Assessment, CoachItem, SpeakerLine, SupportView, BASE_RUNG_BY_CEFR, beatOf(), frameMessage(), inputKindOf() (+17 more)

### Community 15 - "Mock Auth Adapter"
Cohesion: 0.21
Nodes (11): auth, build(), createMockAdapter(), notify(), setSession(), emptyStore(), MockAccount, MockStore (+3 more)

### Community 16 - "path.ts"
Cohesion: 0.17
Nodes (16): DRILL_FIXTURES, AUTHORED_PATH, AuthoredNode, authoredPhraseKeys(), AuthoredUnit, buildPath(), discussedInWords(), drillableKeys() (+8 more)

### Community 17 - "utterance.test.ts"
Cohesion: 0.17
Nodes (10): audioScoringEnabled(), CapturedUtterance, observeEvents(), observeFrames(), feed(), frame(), UtteranceTap, decodeWav() (+2 more)

### Community 18 - "illustrations/index.ts"
Cohesion: 0.16
Nodes (37): Frame(), Moving(), Scene(), SceneProps, Stipple(), SpeakBubbles(), HeroCafe(), NobodyYet() (+29 more)

### Community 19 - "ladder.ts"
Cohesion: 0.11
Nodes (31): applyTurn(), clamp(), initialState(), INSTRUCTION_BY_RUNG, LadderState, nextSessionRung(), openingRung(), PROMOTION_STREAK (+23 more)

### Community 20 - "ConversationState"
Cohesion: 0.12
Nodes (13): NewPhrase, CuratedTopic, CurationInput, DrillGenerationInput, appropriateReply, bestSentence, fillBlank, listenType (+5 more)

### Community 21 - "Brain Package Manifest"
Cohesion: 0.08
Nodes (24): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, @parle/core, zod, description, devDependencies, @types/node (+16 more)

### Community 22 - "Token Server Manifest"
Cohesion: 0.08
Nodes (24): jose, livekit-server-sdk, dependencies, dotenv, jose, livekit-server-sdk, @parle/core, devDependencies (+16 more)

### Community 23 - "Playground Package Manifest"
Cohesion: 0.08
Nodes (24): dependencies, dotenv, @parle/brain, @parle/core, description, devDependencies, @types/node, typescript (+16 more)

### Community 24 - "session/session.ts"
Cohesion: 0.11
Nodes (32): ANGLOPHONE_WEAKNESS, CARRIER, carrierWord(), estimateDurationSec(), jitter(), LearnerProfile, mockObservations(), Phase (+24 more)

### Community 25 - "OnboardingFlow.tsx"
Cohesion: 0.10
Nodes (21): ChevronLeft(), ProgressDots(), TabBar(), Acknowledgements(), Notice, NOTICES, st, ageOn() (+13 more)

### Community 26 - "ParleConversation"
Cohesion: 0.18
Nodes (4): LearnerTurnInput, ParleConversation, toRecapPayload(), withDeadline()

### Community 27 - "anthropic.ts"
Cohesion: 0.16
Nodes (16): AnthropicBrainClient, AnthropicBrainConfig, outputConfig(), parse(), ParsedResponse, toProviderMessages(), usageOf(), BrainRefusalError (+8 more)

### Community 28 - "Core Package Manifest"
Cohesion: 0.10
Nodes (19): devDependencies, @types/node, typescript, exports, ./ladder, ./lessons, ./metering, ./phonemes (+11 more)

### Community 29 - "useLiveSession.ts"
Cohesion: 0.13
Nodes (21): classifyFailure(), COPY, failureCopy, LiveFailure, micApiUnavailable(), EVERY_FAILURE, TokenServerError, ensureAudioSession() (+13 more)

### Community 30 - "Shared TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, ES2023, compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 31 - "runEval.ts"
Cohesion: 0.13
Nodes (25): CoachKind, coachFallbackLine(), CopyRule, copyViolations(), EM_DASH_RE, FILLER_RE, outsideQuotes(), RECOVERY_LINE (+17 more)

### Community 33 - "localAdapter.ts"
Cohesion: 0.09
Nodes (37): build(), createLocalAdapter(), defaultStore(), FriendsStore, isStore(), KEY(), listeners, loadStore() (+29 more)

### Community 34 - "Mobile TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, noEmit, noUncheckedIndexedAccess, strict, exclude, extends, include (+6 more)

### Community 35 - "Root Workspace Scripts"
Cohesion: 0.09
Nodes (21): description, engines, node, name, private, scripts, dev, gate (+13 more)

### Community 36 - "profile.ts"
Cohesion: 0.13
Nodes (22): LearnerSnapshot, normalizeErrorTag(), applyExtractionToProfile(), applyTurnToProfile(), bandIndex(), evictOverflowPhrases(), evictStalePatterns(), EVIDENCE_WINDOW (+14 more)

### Community 37 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-audio, expo-crypto, @parle/brain, react, react-native-web, @react-navigation/native-stack (+7 more)

### Community 38 - "Mobile Dev Dependencies"
Cohesion: 0.20
Nodes (9): devDependencies, @types/react, typescript, typescript, main, name, private, version (+1 more)

### Community 39 - "SignUpScreen.tsx"
Cohesion: 0.17
Nodes (17): AuthScreen, SetNewPasswordScreen(), st, SignInScreen(), st, SignUpScreen(), st, looksLikeEmail() (+9 more)

### Community 40 - "tutorVoice.ts"
Cohesion: 0.43
Nodes (6): available(), frenchVoice(), loadVoices(), speak(), speakLines(), withTimeout()

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

### Community 46 - "RootNavigator.tsx"
Cohesion: 0.11
Nodes (21): Ctx, LiveValue, useLive(), SRC, TOKEN_SERVER, ParleTabBar(), asRung(), LessonRoute() (+13 more)

### Community 47 - "Mobile Run Scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, start, test, typecheck, web

### Community 49 - "review/store.ts"
Cohesion: 0.06
Nodes (61): clearJournal(), journalRecap(), KEY(), recoverJournal(), serialized(), NOW, phrase(), recap() (+53 more)

### Community 50 - "preflight.ts"
Cohesion: 0.18
Nodes (16): tutorLLM(), frameDeadlineMs(), turnDeadlineMs(), Brain, BRAIN_KEY, Env, FetchLike, missingRequired() (+8 more)

### Community 51 - "drill/store.ts"
Cohesion: 0.17
Nodes (17): mergeExerciseBank(), defaultStore(), DrillStore, getMicSuppressedUntil(), hasGeneratedExercises(), isMicSuppressed(), isStore(), KEY() (+9 more)

### Community 52 - "client.ts"
Cohesion: 0.13
Nodes (19): MemoryExtraction, ScenarioFrame, TutorTurn, Curation, DrillBatch, BrainCurateRequest, BrainDrillsRequest, BrainExtractRequest (+11 more)

### Community 53 - "src/theme.ts"
Cohesion: 0.10
Nodes (24): HomeIcon(), LeaderboardIcon(), PracticeIcon(), ProfileIcon(), TabIconProps, TutorIcon(), ICONS, LABELS (+16 more)

### Community 58 - "openaiCompat.ts"
Cohesion: 0.13
Nodes (11): ChatCompletion, ContractSchema, FetchLike, jsonSchemaText(), OpenAiCompatBrainClient, OpenAiCompatConfig, retryAfterMs(), SleepLike (+3 more)

### Community 60 - "server.ts"
Cohesion: 0.17
Nodes (13): agentDebitAllowed(), config, developmentMinutes, json(), livekitUrl, PORT, readAudio(), readJson() (+5 more)

### Community 63 - "Graph Guard Script"
Cohesion: 0.29
Nodes (4): GRAPH, ROOT, ROUTING, SOURCE_EXTS

### Community 66 - "contract/types.ts"
Cohesion: 0.11
Nodes (23): AssessmentZ, CefrBandZ, CoachItemZ, CoachKindZ, MemoryExtractionSchema, MemoryFactZ, NewPhraseZ, OptionZ (+15 more)

### Community 68 - "levels.ts"
Cohesion: 0.25
Nodes (17): clamp(), ConversationEvidence, conversationXp(), DAILY_XP_CAP, DatedXp, DrillEvidence, drillXp(), LessonEvidence (+9 more)

### Community 69 - "drill/types.ts"
Cohesion: 0.16
Nodes (19): typed(), withOptions(), AppropriateReplyExercise, BestSentenceExercise, DrillDifficulty, DrillExerciseBase, FillBlankExercise, ListenTypeExercise (+11 more)

### Community 70 - "Gate Enforcement Script"
Cohesion: 0.10
Nodes (15): AGENT_MODELS, agentFiles, args, asJson, bless, counts, entries, failures (+7 more)

### Community 71 - "choosingView.ts"
Cohesion: 0.22
Nodes (13): MAX_TURNS, pushTurn(), TurnLine, ANYTHING_GOES, ChoosingOrb, ChoosingState, choosingView, LiveMode (+5 more)

### Community 72 - "Format"
Cohesion: 0.03
Nodes (59): A1 — A spoken answer has to match the script exactly, A2 — An empty transcript is graded as a wrong answer, A3 — A freeze at the top rung still asks the learner to invent French, A4 — A rescue can skip the beat the learner froze on, A5 — Two different opening-rung formulas, A6 — A focus point vanishes when the worst sound has no drill, A7 — A v2 snapshot with no memory crashes the worker, B0 — ParleTutor cannot be tested at all (+51 more)

### Community 73 - "Agent Fleet Validation"
Cohesion: 0.20
Nodes (11): AgentFrontmatter, agentProblems(), FRONTMATTER_FIELDS, frontmatterBlock(), parseAgentFrontmatter(), pinnedAgents(), READ_ONLY_AGENTS, routedAgents() (+3 more)

### Community 74 - "Supabase Auth Adapter"
Cohesion: 0.26
Nodes (4): startGoogleSignIn(), AuthResult, AuthUser, AuthContextValue

### Community 75 - "core/src/index.ts"
Cohesion: 0.15
Nodes (13): A missing score is never an invented penalty, ALIASES, FRENCH_IPA, toInventoryIpa(), parseSpeechace(), ScoreFetch, ScoreRequest, scoreUtterance() (+5 more)

### Community 77 - "brain/src/index.ts"
Cohesion: 0.21
Nodes (13): FR_PACK, renderAuthenticityPack(), AuthenticityPack, ContrastPair, Filler, RegisterDef, SlangEntry, historyViewOfTurn() (+5 more)

### Community 79 - "extractPrompt.ts"
Cohesion: 0.31
Nodes (9): MemoryFact, ChatMessage, buildExtractionRequest(), ExtractionInput, factLine(), INSTRUCTION, interview, request() (+1 more)

### Community 85 - "components.tsx"
Cohesion: 0.09
Nodes (34): ArrowRight(), Card(), EarGlyph(), GhostButton(), HelpGlyph(), Label(), LineBullet(), MicGlyph() (+26 more)

### Community 86 - "lessons/types.ts"
Cohesion: 0.15
Nodes (23): Chrome is plain English, French only where it is content, No number and no scolding mid-session, CAFE_LESSON, BY_ID, getLesson(), LESSONS, AcceptanceMatch, AcceptanceRoute (+15 more)

### Community 87 - "Android App Config"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+2 more)

### Community 88 - "Pedagogy Rules Doc"
Cohesion: 0.25
Nodes (8): One focus, one drill, The four rungs, The invariants, The pedagogy, The rescue, Two independent axes, What counts as a right answer, Where the next session opens

### Community 89 - "normalise"
Cohesion: 0.22
Nodes (14): check(), checkDrill(), checkAccepted(), checkDistinct(), englishGlosses(), expectedDifficulty(), inRange(), LabelledString (+6 more)

### Community 90 - "Live Voice Doc"
Cohesion: 0.25
Nodes (7): Audio, and what may be claimed about it, Serialisation, The four modes, The live path, The route, The wire, When it fails

### Community 91 - "Forge Loop Guide"
Cohesion: 0.29
Nodes (7): Giving it a goal, Running it, The agents, The bar, The loop, The other half: building something new, Verifying UI work

### Community 92 - "State and Storage Docs"
Cohesion: 0.29
Nodes (6): On the device, Server side, Sessions and progress, State and storage, The brain's learner model, The round trip, and where it broke

### Community 93 - "Testing Guide"
Cohesion: 0.29
Nodes (6): Never, Running, Testing, The rule that matters most, What is not covered, Writing

### Community 94 - "Bug Hunter Role"
Cohesion: 0.33
Nodes (5): House style, How you work, Product invariants — a change that breaks one of these is a bug, however green, What counts as a finding, What you must never do

### Community 95 - "Architecture Overview Doc"
Cohesion: 0.40
Nodes (5): Architecture, Mock or live, No build step, Two paths, one ladder, Who owns what

### Community 97 - "convo.test.ts"
Cohesion: 0.09
Nodes (13): BEATLESS_FRAME, buildConvo(), DeadBrain, FailingBrain, finishSessionWith(), heard(), inScene(), NoCuration (+5 more)

### Community 100 - "client.test.ts"
Cohesion: 0.09
Nodes (24): sampleCoachItem(), sampleSupport(), sampleTurn(), SupportMaterial, createConversation(), learnerSideSupport(), MAX_ATTEMPTS_PER_BEAT, MAX_SESSION_TOPICS (+16 more)

### Community 101 - "profile/store.ts"
Cohesion: 0.25
Nodes (12): Ctx, ProfileGate(), ProfileValue, KEY(), loadProfile(), OnboardingAnswers, saveProfile(), StoredProfile (+4 more)

### Community 102 - "PathNodeRow.tsx"
Cohesion: 0.24
Nodes (8): PathNodeRow(), st, statusLine(), offersTalkAgain(), seedTopicFor(), TALK_AGAIN, talkAgainLabel(), PathNode

### Community 103 - "Expo Plugins And Sharing"
Cohesion: 0.25
Nodes (6): plugins, expo-audio, expo-font, expo-sharing, expo-web-browser, @livekit/react-native-expo-plugin

### Community 104 - "convo.ts"
Cohesion: 0.15
Nodes (14): brainClient(), chooseFrame(), ConversationPhase, ConvoView, Publisher, RecapPayload, seededOpening(), SeedTopic (+6 more)

### Community 105 - "Deploy Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, Ship the smallest real thing, Start by being honest about where this is, The order this has to happen in, What you must never do, When there is nothing to deploy to, say so, Your territory

### Community 106 - "Observability Engineer Agent"
Cohesion: 0.22
Nodes (8): How you work, Product invariants — a change that breaks one of these is wrong, however green, The line you do not cross, The seam to cut, when the time comes, What exists, and what does not, What you must never do, When there is no seam yet, say so, Your territory

### Community 107 - "Revenue Engineer Agent"
Cohesion: 0.22
Nodes (8): Copy about money is still learner copy, How you work, Product invariants — a change that breaks one of these is wrong, however green, The rule enforcement lives at, What already exists, What you must never do, Where a purchase lands, Your territory

### Community 108 - "protocol.ts"
Cohesion: 0.12
Nodes (27): LiveSession, Rung, CLIENT_TAGS, ClientMessage, ConvoCoachItem, ConvoPhrase, ConvoSpeakerLine, ConvoSupportView (+19 more)

### Community 111 - "iOS App Config"
Cohesion: 0.40
Nodes (5): ios, NSMicrophoneUsageDescription, bundleIdentifier, infoPlist, supportsTablet

### Community 112 - "Forge Workflow Docs"
Cohesion: 0.22
Nodes (9): /forge, Looping it, Not wired yet: the unattended loop, The contract, The gate watches the wiring too, Watch for judge drift, Who actually builds it, Why the judge's findings go in the ledger (+1 more)

### Community 113 - "palette.test.ts"
Cohesion: 0.16
Nodes (15): accents, HASHED, ink, Paper, paperFor(), PaperName, ALL, CARRIED (+7 more)

### Community 116 - "buildSystemBlocks"
Cohesion: 0.15
Nodes (20): buildDrillGenerationRequest(), blocks(), blocks(), buildScenarioRequest(), buildSystemBlocks(), main(), pickClient(), PROFILES (+12 more)

### Community 118 - "API Engineer Agent"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The LLM layer, The rule that matters most, The shape of the API, What you must never do, Your territory

### Community 119 - "Performance Engineer Agent"
Cohesion: 0.25
Nodes (7): How the TTS cache actually works, How you work, Product invariants — a change that breaks one of these is wrong, however green, Prompt caching, The number, What you must never do, Your territory

### Community 120 - "Security Engineer Agent"
Cohesion: 0.25
Nodes (7): How you work, Product invariants — a change that breaks one of these is wrong, however green, The habits already in the code, which you should extend, What is actually true today, unvarnished, What you must never do, When dispatched by /ship, Your territory

### Community 121 - "Auth Engineer Role"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The seam, and why it is shaped this way, The server side, What you must never do, Your territory

### Community 122 - "Backend Engineer Role"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, Running it locally, What this stack does not have, What you must never do, Your territory

### Community 123 - "Data Engineer Role"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, What is actually true today, What you must never do, When a database is proposed, Your territory

### Community 124 - "Frontend Engineer Role"
Cohesion: 0.29
Nodes (6): How you work, Product invariants — a change that breaks one of these is wrong, however green, The constraints that are not negotiable, The one thing that catches everyone out, What you must never do, Your territory

### Community 125 - "Team Roster Doc"
Cohesion: 0.29
Nodes (7): Calling them, Territory is the point, The gate defends the fleet, The team, The two that answer rather than build, Three of them are ahead of the code, Who owns what

### Community 126 - "Design Architect Role"
Cohesion: 0.33
Nodes (5): Orienting yourself, The ledger format is parsed, not read, The question you are actually answering, What you must never do, Your output — the contract

### Community 127 - "Scaling Engineer Role"
Cohesion: 0.33
Nodes (5): Default answer, The checks, What genuinely blocks a second instance today, What you must never do, Your output

### Community 128 - "createProfile"
Cohesion: 0.26
Nodes (11): createProfile(), isRecord(), migrateProfile(), repairProfile(), DEFAULT_PROFILE_PATH, loadProfile(), resetProfile(), saveProfile() (+3 more)

### Community 129 - "release-engineer.md"
Cohesion: 0.40
Nodes (4): The bar, The checks, What you must never do, Your output

### Community 130 - "work-judge.md"
Cohesion: 0.40
Nodes (4): The bar for sending work back, The checks, You may not grow the job, Your output

### Community 131 - "recap.ts"
Cohesion: 0.43
Nodes (6): KIND_PRIORITY, assembleRecap(), dedupeFixes(), FOCUS_BY_TAG, focusFrom(), headlineFor()

### Community 138 - "warmCache.ts"
Cohesion: 0.32
Nodes (6): CONVO_LINES, buildTTS(), ENV_KEYS, main(), scriptedLines(), splitter

### Community 139 - "tokens.ts"
Cohesion: 0.29
Nodes (10): canStartSession(), secondsRemaining(), GrantResult, grantSession(), roomNameFor(), SeedTopic, SessionGrant, SessionMode (+2 more)

### Community 140 - "curate.ts"
Cohesion: 0.26
Nodes (9): applyCuration(), buildCurationRequest(), CurationSchema, INSTRUCTION, keyOf(), MAX_CURATED_TOPICS, MAX_KEPT_PHRASES, CAFE (+1 more)

### Community 141 - "ttsCache.ts"
Cohesion: 0.16
Nodes (7): CachedTTS, CachedTTSOptions, defaultMissTransport(), normaliseLine(), ResolvedCachedTTSOptions, DEFAULT_CACHE_DIR, VOICE_SETTINGS

### Community 142 - "drill/grading.ts"
Cohesion: 0.40
Nodes (8): acceptedFor(), gradeFreeText(), GradeResult, realWordSet(), damerauLevenshtein(), sameWord(), TYPO_MAX_DISTANCE, TYPO_MIN_LENGTH

### Community 143 - "LlmUsage"
Cohesion: 0.42
Nodes (3): ClaudeCliBrainClient, spawnClaude(), LlmUsage

### Community 144 - "agent.ts"
Cohesion: 0.33
Nodes (7): TokenMeta, createTurnTiming(), formatTiming(), mark(), SEGMENTS, TimingStage, TurnTiming

### Community 145 - "ttsCache.test.ts"
Cohesion: 0.15
Nodes (6): FakeChunkedStream, FakeSynthesizeStream, FakeTTS, NO_RETRY, rampFrames(), synth()

### Community 146 - "auth.ts"
Cohesion: 0.25
Nodes (5): createUserResolver(), ResolvedUser, SIGN_IN_REQUIRED, UserResolver, VerifierConfig

### Community 147 - "today.ts"
Cohesion: 0.27
Nodes (7): ActivityEntry, hasToday(), NOTHING, SITTINGS_IN_A_DAY, NOON, todayFrom(), localDayKey()

### Community 149 - "HomeTab.tsx"
Cohesion: 0.11
Nodes (24): PhrasebookCard(), st, TodayRow(), papers, buildPhrasebook(), hasPhrases(), Hold, holdFor() (+16 more)

### Community 150 - "land.md"
Cohesion: 0.25
Nodes (7): 1. Who else is in this tree, 2. Where you are standing, 3. The gate, 4. The shape of the branch, 5. Deciding, 6. Landing, 7. Say what happened

### Community 153 - "motion.test.ts"
Cohesion: 0.33
Nodes (3): FILES, SRC, stripComments()

### Community 154 - "enterRecord.test.ts"
Cohesion: 0.29
Nodes (5): GROUNDS, HERE, LEDGER, REPO, RULE_TEST

### Community 155 - "ConvoScreen.tsx"
Cohesion: 0.13
Nodes (19): ConvoScreen(), st, RecapScreen(), registerTag(), st, SettingsRow(), st, Sheet (+11 more)

### Community 156 - "labels.test.ts"
Cohesion: 0.40
Nodes (5): KEPT, labelsInSource(), RETIRED, sourceFiles(), SRC

### Community 157 - "claudeCli.test.ts"
Cohesion: 0.33
Nodes (5): ClaudeCliRun, envelope(), EXTRACTION, recordingRun(), BrainParseError

### Community 159 - "nav/theme.ts"
Cohesion: 0.40
Nodes (4): linking, navTheme, RootStackParamList, TabParamList

### Community 160 - "src/store.ts"
Cohesion: 0.47
Nodes (4): PLANS, developmentEntitlementsEnabled(), config, metadataFor()

## Knowledge Gaps
- **755 isolated node(s):** `st`, `name`, `slug`, `version`, `orientation` (+750 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `plugins` connect `Expo Plugins And Sharing` to `Expo App Config`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `Rung` connect `protocol.ts` to `ParleTutor`, `profile.ts`, `profile/store.ts`, `core/src/index.ts`, `RootNavigator.tsx`, `conversation.ts`, `agent.ts`, `ladder.ts`, `components.tsx`, `lessons/types.ts`, `session/session.ts`, `useLiveSession.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `expo` connect `Expo App Config` to `iOS App Config`, `Expo Plugins And Sharing`, `Android App Config`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `st`, `name`, `slug` to the rest of the system?**
  _755 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `drill/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14260249554367202 - nodes in this community are weakly interconnected._
- **Should `phonemes/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0741745816372682 - nodes in this community are weakly interconnected._
- **Should `space` be split into smaller, more focused modules?**
  _Cohesion score 0.12091038406827881 - nodes in this community are weakly interconnected._