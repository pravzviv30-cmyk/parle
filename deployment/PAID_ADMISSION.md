# Paid provider admission contract and local evidence

This document describes the A20 authority implemented by the existing Codex `industry_research` role and independently reviewed by the Codex database audit role. It does not approve production prices, provider adapters, deployment, hosted concurrency or activation. The shipped operator contract is disabled, with zero budgets and no quotes. No provider calls, hosted mutations or infrastructure provisioning were used for these proofs.

## Accounting and limits

`20261004010327_whole_product_paid_admission.sql` adds private RLS tables whose direct read/write privileges are denied to PUBLIC, anon, authenticated and service_role. Only the SQL owner configures budgets and immutable quote revisions. Service callers may execute four fixed SECURITY DEFINER RPCs with an empty search path. No caller supplies its own budget, price, day or clock.

A reviewed quote binds one supported activity and the configuration SHA256 to one to sixteen components. Each component binds its key, kind, provider, model, voice, component configuration SHA256, maximum logical effects, maximum provider attempts per effect, finite integer input bytes/output tokens/audio milliseconds/text bytes, and a strictly positive integer microUSD envelope. The envelope must cover the complete `maxEffects × maxProviderAttempts` quantity budget, including provider minimums, pricing dimensions, reasoning/cache rules and permitted retries. Unused dimensions must be exactly zero; applicable dimensions must be positive. There are no estimated vendor rates in this change.

There are two independent ceilings using the same reviewed global/account/vendor cost and call caps:

1. Reservation UTC day books every complete component envelope and all permitted provider attempts once. Cancellation, failure, process death and uncertain acknowledgement do not return capacity. Global/account/vendor operation-count caps apply here too.
2. Execution-start UTC day books a complete component envelope once per operation/component/day, even when the reservation was made on an earlier day. Each new effect also books its finite provider-attempt allowance on that day. Exact effect replay books nothing and returns `dispatch: false`. Every budget refusal precedes every execution counter/component/effect write.

The SQL clock is refreshed after lock waits. Connection timezone and client time cannot choose the bucket. A permit ends at the earliest of quote expiry, budget review expiry or next UTC midnight. The helper refuses to start its callback at or after that deadline. A controlled transport must combine the deadline with the request/session cancellation signal and an enforced connection duration. The selected production integration will gate individual provider attempts; quote retries must reflect that implementation. An unaudited adapter or invisible SDK retry path must stay disabled.

These are conservative admitted exposure limits, not a certified reconciliation of invoice timestamps or exact measured spending. Calls started before midnight can be billed later; provider billing allocation and cancellation semantics require operator acceptance. The counter includes the maximum permitted attempt envelope, rather than relying on an untrusted reported call count. No hard money ceiling is established until the quote and the actual transport enforce the same envelope.

## API and response contracts

All UUIDs, configuration/request SHA256 strings, exact context fields, integer dimensions and applicable maxima are validated before any counter write. RPC names and parameters are:

```text
reserve_paid_operation_v1(
 p_user_id uuid, p_operation_id uuid, p_quote_id uuid,
 p_configuration_sha256 text, p_context jsonb, p_request_digest text)

claim_paid_effect_v1(
 p_user_id uuid, p_operation_id uuid, p_effect_id uuid,
 p_component_key text, p_configuration_sha256 text,
 p_quantities jsonb, p_max_provider_attempts integer, p_context jsonb)

resume_paid_tutor_v1(
 p_user_id uuid, p_session_id uuid, p_claim_nonce uuid)

paid_admission_schema_v1()
```

Contexts are exact objects:

```json
{"kind":"api","authSessionId":"<uuid>","operationId":"<same operation uuid>"}
{"kind":"tutor","sessionId":"<uuid>"}
{"kind":"tutor","sessionId":"<uuid>","claimNonce":"<current worker uuid>"}
{"kind":"practice","packId":"<uuid>","leaseToken":"<current lease uuid>"}
```

The tutor context without nonce is only for reservation. Dispatch and resume require the actual current nonce. API requires the exact live Auth session. Tutor also checks entitlement epoch, mode, owner, Auth session, active state, lease and hard deadline. Practice checks the existing pack advisory lock, ready owner pack, current running job lease and absence of deletion tombstone. Fenced/deleted/banned owners cannot admit or dispatch new work. Auth erasure and a provider call already admitted just before erasure cannot be one distributed atomic transaction; admitted in-flight work remains bounded and must receive cancellation from the runtime.

Reserve and resume return:

```text
{kind:"reserved",version:1,operationId,quoteId,configurationSha256,
 activity,requestDigest,components,expiresAt,day,microUsd,providerCalls,replayed}
```

`expiresAt` remains the immutable original quote expiry; resume creates no operation, quote or expiry extension. It returns only the operation already bound to the exact tutor owner/session after current-nonce validation. It does not return Auth session identifiers, worker nonces or learner content. A missing operation, wrong owner, old nonce, cancellation or expired lease refuses. The protected API bridge uses its own service credential; the tutor worker never receives a DB service key.

Claim returns:

```text
{kind:"claimed",version:1,dispatch,operationId,effectId,componentKey,
 executionDay,executionMicroUsdCharged,executionProviderCalls,dispatchUntil}
```

A first claim books the full component or zero when already booked that execution day, plus its permitted attempts. Replay returns zero new cost/calls and `dispatch:false` with the original dispatch deadline. Changed bodies under the same operation/effect identity raise PT409. Explicit refusal reasons include global/account/vendor reservation or execution budget, inactive context, unavailable quote, quantity limit and effect limit. There is no automatic RPC retry. Unknown acknowledgement may consume a slot without a provider call; the safe retry uses the same durable identity and cannot dispatch twice.

## Shared helper integration

`services/shared/paidAdmission.ts` accepts an injected fixed-name RPC function and a configuration binding map. It exports `paidAdmission`, `paidAdmissionRpc`, strict `decodePaidComponent` and typed contracts. The service-side HTTPS adapter has a 5-second timeout, a 32-KiB response bound, no redirects and no automatic retries. Transport errors contain no service credentials or learner content.

```typescript
const admission = paidAdmission({ rpc: protectedBridge, bindings: reviewedBindings });
// API reserves after authoritative tutor admission and before token minting.
const reserved = await admission.reserve({
  userId, operationId, activity: 'lesson-text',
  context: { kind: 'tutor', sessionId }, requestDigest, signal,
});
// Worker resumes the same receipt after the authoritative tutor claim.
const resumed = await admission.resume({ userId, sessionId, claimNonce, signal });
const permit = await resumed.claim({
  effectId, componentKey,
  provider: actualProvider, model: actualModel, voice: actualVoice,
  configurationSha256: actualComponentConfigSha256,
  maxProviderAttempts: actualExplicitAttemptBound,
  quantities: { inputBytes, outputTokens, audioMillis, textBytes },
  context: { kind: 'tutor', sessionId, claimNonce }, signal,
});
// Runtime must abort transport by permit.dispatchUntil and by original signal.
await permit.run(() => controlledProviderCall(combinedDeadlineSignal));
```

A `PaidReservation` exposes immutable operationId, quoteId, activity, requestDigest, configurationSha256, expiresAt (epoch milliseconds), components and `claim`. `PaidPermit` exposes dispatchUntil (epoch milliseconds) and one-use `run`. All provider/model/voice/configuration/retry identity and declared actual dimensions are checked before the claim RPC. One-use is set before entering the callback, including if the callback fails. A timeout or replay never authorizes another paid callback. Different providers/fallbacks require independently admitted and quoted effects; no implicit fallback is granted.

API STT/scoring duration must be decoded or conservatively proven before admission; compressed file bytes do not establish billed audio duration. Session voice quotes must include LLM, STT and TTS, and the STT envelope must cover the authoritative reserved session duration. Practice admission uses its actual current job lease. Phrase audio participates in the same global exposure. Pre-account guest speech does not: it is an anonymous Redis budget of seconds with its own service-wide daily ceiling (`LUVANI_GUEST_SPEECH_DAILY_SECONDS`, default 3,600), off unless `LUVANI_GUEST_SPEECH=1`, and each take is decoded and cut to the reserved twenty seconds before dispatch. Its ceiling must be priced and added to the launch exposure separately (see `docs/BACKEND_RELEASE_RUNBOOK.md`, Guest speech). Standalone warm-cache, voice-samples and native-evaluation tools refuse production execution; their development-only calls have no whole-product admission guarantee. Operator warming/evaluation in production needs a separately implemented admitted adapter and reviewed quote. OpenAI prompt_cache_key is validated as finite activity cache addressing and excluded from configuration identity; its bytes still count as input, and every quote must conservatively price all input as uncached. Model, output limits, reasoning, storage, schemas and service tier remain bound.

### Lesson and convo scoring and binding kinds

A binding in `LUVANI_PAID_QUOTE_BINDINGS` may carry `kinds`, a sorted list of the component kinds in the bound quote, for example `{"lesson":{"quoteId":"...","configurationSha256":"...","kinds":["llm","scoring","stt","tts"]}}`. When it is present, the helper refuses any reservation whose component kinds differ (`quote-mismatch`), and `validatePaidBudget.mjs` refuses a binding whose kinds differ from its quote. Startup can then check the quote shape without a database read.

Live scoring (`LUVANI_AUDIO_SCORING=1`) goes through the paid transport in lessons and in free-conversation missions (activity `convo`). The gate admits a Speechace call only if the bound quote for that activity has a matching scoring component. One flag covers both, so production startup (tutor preflight and `validateEnvironment.mjs tutor`) refuses live scoring unless BOTH the lesson and the convo binding declare `scoring` in their kinds, and names each binding that lacks it (F863).

The reviewed lesson scoring component is `LESSON_SCORING_COMPONENT` in `services/shared/lessonScoringQuote.ts`: key `scoring`, provider `speechace`, model `text-v9`, dialect `fr-fr`, one attempt, 48 effects, 900,000 audio milliseconds, 12,288 text bytes, 208,896 input bytes and 96,000 microUSD. The price comes from the cost model, not a verified vendor quote. `validatePaidBudget.mjs` requires any scoring component in a lesson quote to have exactly that identity and envelope. Only the price may be higher, so the price per score cannot fall.

The reviewed convo scoring component is `CONVO_SCORING_COMPONENT` in the same file. It has the same identity and configuration hash (one Speechace call shape) with its own envelope: 24 effects, 450,000 audio milliseconds, 6,144 text bytes, 104,448 input bytes and 48,000 microUSD, the lesson's per-score figures times 24. A mission scores only a line the learner said off the full-line help card, far fewer than a lesson's reference turns. 24 is a cost-model figure, not a vendor quote. `validatePaidBudget.mjs` holds a convo quote's scoring component to that envelope the same way.

SQL checks each component limit per effect. `reservationGate` also enforces the sum per session. So the database envelope for lesson scoring is 48 effects of up to 30 seconds each, and the 900-second total is enforced by the gate. Cost is still bounded by 48 × 2,000 microUSD, because pricing is per utterance.

The Speechace descriptor counts input bytes as text bytes plus 4,096 bytes of multipart overhead. The WAV body is not counted again: `pcmAudioMillis` accepts only the exact 16 kHz mono header, so audio milliseconds bound it exactly (32 bytes per millisecond plus 44, at most 960,044 bytes per call). Counting it twice capped a lesson at two 30-second clips.

Activation order for live scoring:

1. Enable the `speechace` vendor row with budgets sized for 96,000 microUSD and 48 calls per lesson, plus 48,000 microUSD and 24 calls per mission. The vendor daily budget must cover each envelope times the expected daily sessions. Otherwise sessions are refused as `vendor-budget` before learners run out of allowance.
2. Seed a NEW lesson quote with `LESSON_SCORING_COMPONENT` and a NEW convo quote with `CONVO_SCORING_COMPONENT`. Quotes are immutable.
3. Resize the global and account daily budgets for the larger lesson and convo envelopes.
4. Update `LUVANI_PAID_QUOTE_BINDINGS` on BOTH the token server and the tutor at the same time: the `lesson` and `convo` bindings each get their new `quoteId` and `"kinds":["llm","scoring","stt","tts"]`.
5. Set `LUVANI_AUDIO_SCORING=1`.

A wrong `kinds` in the environment fails closed for the whole lesson or mission. Preflight trusts the environment; the database comparison happens at resume, which then refuses the session as `quote-mismatch`. Unused envelope is never returned, by design.

## Tutor allowance, privacy and storage

The six-argument `reserve_tutor_session_v1` retains its signature, OID, service ACL, existing learner allowance economics, global concurrency and global issued-seconds accounting. New per-account daily session/issued-second caps default to zero, so tutor admission stays closed until configured. Cancellation and zero-charge learner settlement do not recycle issued count/seconds. Surviving v1 grants backfill owner counters from their original UTC creation timestamps; every existing grant, usage, completion, refund, pack and global budget field is preserved. Previously erased owners have no recoverable owner identifier; their global exposure remains.

Owned daily counters, operations, effects and component-day receipts cascade on Auth erasure. Global/vendor reservation and execution counters carry no owner identifier and survive erasure. Immutable quote revisions contain provider configuration/review evidence, no learner text. Counters have explicit finite CHECK bounds. At most 1,024 provider attempts and sixteen components may be reserved per operation; each component has finite effect/attempt limits. The retained quote ceiling is 4,096 revisions. Historical day aggregates grow by calendar day. Operator-reviewed daily ceilings must also budget ledger row growth and singleton-lock throughput. No automatic TTL deletes an operation/effect idempotency fence. A future governed archive/retention change must preserve necessary fences and financial proof.

Rollback is an atomic transaction that refuses by default. It requires the maintenance interlock, disabled admission and zero historical exposure; any existing global tutor issued seconds also refuse, even after an Auth erasure removed all owner counters. After any issued exposure, disable admission, drain and forward-fix. Never roll back by dropping issued financial/idempotency records.

## Lock order and local evidence

Paid calls lock Auth parent KEY SHARE, paid configuration singleton, then either entitlement/grant or practice advisory/pack/job. Reserve then locks global/account/sorted vendor reservation rows; effect claim locks the operation then execution global/account/vendor rows before component/effect insertion. The paid singleton serializes all competing paid first-day row creation. Resume uses Auth → paid configuration → tutor entitlement/grant → existing operation. Completion and erasure do not later acquire paid configuration. New tutor-only admission retains Auth → tutor configuration → entitlement/grant → tutor global/account rows. Administrative changes require controlled SQL-owner operation; they must not introduce reverse lock order.

Focused checks as of 2026-10-04:

- All 36 currently present migrations replayed sequentially in disposable PostgreSQL/WASM; thirteen proof groups passed.
- SQL proofs cover OFF defaults, all three app/service direct-access denials, public RPC client denials, strict/reviewed/immutable quote input, every cost/operation/call quota scope, atomic refusal, replay/body conflict, first dispatch only, expiry, current tutor nonce and cancellation, both owner tutor caps, full voice and phrase exposure, actual practice lease/tombstone, restricted Auth erasure, retained aggregate proof, UTC timezone and finite CHECK bounds.
- A controlled-clock fixture compiles the actual claim body with only its two clock reads substituted inside the disposable test. It crosses two UTC boundaries, checks once-per-component/day cost, call accounting, no partial writes on each execution budget refusal, original reservation retention, old-day lost-ACK replay, finite total effects and the midnight deadline. No clock override is present in production SQL.
- A separate pre-A20 fixture proves lossless baseline backfill and a tutor-only owner-erasure rollback refusal when no paid operation has ever been issued.
- A catalog source verifier checks the expected claim lock ordering and refresh of server time after the operation lock. This does not prove concurrent transaction behavior.
- Nine shared-helper tests and five operator-validator tests pass. Explicit strict TypeScript checking of both new shared files passes. All financial test units and evidence URLs are synthetic fixtures, never actual vendor quotes.

Actual independent PostgreSQL concurrency/deadlocks, hosted grants/catalog, migration promotion and restores, quote economics, the provider transport's output/timeout/retry bounds, invoice allocation, load and all paid call-site coverage remain mandatory acceptance. The local validator applies no configuration and always reports `pricesVerified:false` and `runtimeEnvelopeVerified:false`.
