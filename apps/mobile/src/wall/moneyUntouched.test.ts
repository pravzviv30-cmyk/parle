/**
 * The paywall redesign moved words and boxes, and not one byte of money code.
 *
 * 2026-09-27, notebook Phase 6-E. The wall went from four pages to two and the
 * plans were priced in conversations a week, which is layout and copy only. The
 * brief for that phase says purchase, restore, entitlement and metering stay
 * byte-identical, and a promise like that is only worth something if the gate
 * can see it break. So every file that buys, restores, grants or meters is
 * pinned here by its SHA-256, and so is every money function that lives inside
 * a file the redesign did edit (the wall frame and the inline paywall).
 *
 * The hashes were read at `redesign/notebook` 0cb39ad, before the redesign
 * touched anything. Changing money code on purpose is allowed; it means reading
 * the new hash off this test's failure, writing it in with a dated comment that
 * says why, and getting the revenue reviewer to agree. What this refuses is a
 * money change riding in on a copy change without anybody noticing.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const read = (fromRepo: string): string => readFileSync(`${REPO}${fromRepo}`, 'utf8');
const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

// 2026-10-02: founder-authorized Report 2 billing hardening F263/F264/F266/F267.
// Independent gpt-6-sol reviewed atomic projection, readiness and original-owner
// settlement; all reported code blockers repaired. Updated pins reflect these
// deliberate security changes, not allowance, price or margin changes. Live
// vendor/store/database checks remain outstanding. Meter and historic SQL pins
// are unchanged. New billing helpers and migration are pinned below as well.
/** The whole files: nothing the paywall redesign had any reason to open. */
// 3 October 2026, F704/F708: founder-authorised UX billing recovery, independently
// accepted by gpt-6-sol after fresh period/owner/storage review and 11/11 checks.
// Native packages must verify P1M. Wall checkout writes a scoped durable fence
// before its store sheet, refuses active duplicate plans, and reconciles after
// reopening only with a matching newly established or advanced paid period.
// Unknown grant, period or storage never enables another purchase. Existing
// prices, allowance/debit, restore settlement and historic SQL pins are unchanged.
// Native sandbox and cross-device transaction proof remain explicitly unverified.
// 9 October 2026: user approved Direction B and restoration of Starter Weekly.
// Explicit weekly product mapping grants 2700 seconds through the existing
// replay-safe projection; matching public client/server configuration gates sales.
// Localized weekly offers and authoritative allowance reporting are intentional.
// Monthly new offers are paid immediately; historical trial restore is preserved.
// Purchase/restore settlement, usage debit and historical SQL pins are unchanged.
// Native StoreKit sandbox qualification remains outstanding before release.
// 10 October 2026: user explicitly requested the first-live onboarding source merge
// with production guest admission disabled. Independent revenue review approved
// guest room/session/budget binding and validated personalisation metadata in
// tokens.ts; 43 token/guest checks pass. Account entitlement, prices, allowances,
// debit and every other money pin stay unchanged. This is source-merge review,
// not approval to enable production guests or invent provider quotes/budgets.
const FILES: Record<string, string> = {
  // 5 October 2026, F733/F734: founder decisions D16 and D4 (come-alive Phase 0,
  // step F1). A store free trial grants a week of the plan (allowance x 7/30) and
  // a yearly product refills the monthly allowance one 30-day window at a time,
  // computed in core's meter.ts and enforced by the server projection (state.ts,
  // revenuecat.ts, store.ts calling apply_billing_projection_v2, readiness at
  // database version 2), with renewals.ts granting each next window on time.
  // The client contract gains period, intro and introEligible; the native adapter
  // reads the yearly ids, the store's free trial and its eligibility answer;
  // readiness pairs yearly ids (billingReadiness.ts, client.ts); capabilities.ts
  // gains streakProtection. Monthly prices, allowances, the debit and every
  // FUNCTIONS pin are unchanged. Independent revenue review of these hashes is
  // owed before this lands.
  // 5 October 2026, F733 review repair (D16, same step): the first build wrote a
  // yearly window as period_end, so a read a day after any window the sweep
  // missed lapsed a paying yearly learner. period_end is the paid year again and
  // the window sits beside it (meter.ts Entitlement.windowEnd, state.ts,
  // revenuecat.ts, store.ts, the migration's allowance_window_end); the
  // projection lapses only on the vendor's "nothing held"; /billing/status
  // reports the window as when minutes start fresh (token-server
  // billingStatus.ts); the sweep logs a full page (renewals.ts); core's refusal
  // says "for now" instead of "this month". Prices, allowances, margins and every
  // FUNCTIONS pin unchanged. Independent revenue review still owed.
  // 6 October 2026, F733 second review repair (D16, same step): two independent
  // reviews found an immediate Apple upgrade from Starter yearly to Max monthly
  // read as a stale answer, keeping the learner on Starter with no refill.
  // Store answers are now ordered by when their period started (meter.ts
  // Entitlement.periodStart and withheldSeconds, state.ts, revenuecat.ts passing
  // the purchase date, store.ts sending p_period_start and reading both back,
  // the migration's period_start and withheld_seconds columns). The withheld part
  // of a window is swapped, not kept, so a lagging trial read cannot short a
  // payer; a billing grace period and a missing entitlement id hold rather than
  // grant or lapse; the sweep asks longest-unasked rows first and reports stuck
  // rows (renewals.ts); the migration is idempotent. Prices, allowances, the
  // trial week, margins and every FUNCTIONS pin unchanged. Independent revenue
  // review of these hashes is owed before this lands.
  // 3 October 2026, F692: simulator exposed Metro's native adapter self-cycle.
  // Unchanged shared contract moved to a neutral filename; native's sole code
  // change is the import target. Root and independent Sol reconstructed both
  // previous pinned hashes exactly and accepted this split. New contract pinned
  // too; every other money pin and purchase/restore/allowance rule is unchanged.
  // 19 October 2026: store trial facts for the trial-ending reminder, read only, reviewed 2026-10-19
  // (orchestrator review of the revenue-engineer diff; purchase, restore, manage and grant paths unchanged).
  // 2026-10-19, review P1 #1 / P2 #2: let a checkout fence clear only when the store holds no purchase or the server confirms; keep the approval state durable; founder approved in chat 2026-10-19.
  'apps/mobile/src/purchases/adapter.ts': '6868f03bd7c7e2a6521dbd439ba56e35d7854bda6c2c08f8bf9cbf9bfb2ba605',
  // 7 October 2026, F772 (come-alive Phase 4, ca/p4-wall): the plans page says a
  // yearly price with the store's own monthly figure ("about ... a month"), so
  // the contract gains an optional display-only `localizedPricePerMonth` and the
  // native adapter reads it from the yearly package's `pricePerMonthString`. One
  // added line each: no period, id, eligibility, purchase, restore or grant
  // rule moved, and every FUNCTIONS pin is unchanged. 7 October 2026: the
  // independent P4-C review (Opus 5.5, read-only) accepted this adapter hash and
  // the contract's b98dcaa1... as display-only, which is the revenue sign-off.
  // 18 October 2026: user authorised seven-day monthly/yearly trials and genuine
  // annual savings. profile_settings_scope independently accepted these exact
  // adapter/contract bytes: valid free intros on both periods, SDK numeric facts,
  // unchanged identity/readiness/revalidation and no paid-intro misdescription.
  // Six new offer proofs plus existing purchase/readiness suites pass. Vendor
  // setup and sandbox qualification remain separate release prerequisites.
  // 19 October 2026: store trial facts for the trial-ending reminder, read only, reviewed 2026-10-19
  // (orchestrator review of the revenue-engineer diff; purchase, restore, manage and grant paths unchanged).
  // 2026-10-19, F845: add the non-granting awaiting-approval (Ask to Buy) store outcome; founder approved the re-pin.
  // 2026-10-19, review P1 #1 / P2 #2: let a checkout fence clear only when the store holds no purchase or the server confirms; keep the approval state durable; founder approved in chat 2026-10-19.
  'apps/mobile/src/purchases/adapter.native.ts': 'c65a65c860e71b90454684a35f7e1115950f14b9581a996627fb73a9c608dc91',
  // 2026-10-19, review P1 #1 / P2 #2: let a checkout fence clear only when the store holds no purchase or the server confirms; keep the approval state durable; founder approved in chat 2026-10-19.
  'apps/mobile/src/purchases/pendingPurchase.ts': 'ab1249bc6f38e96c3a808c4193a035639a669fb767c3256f83d0108a7d83b89d',
  // 3 October 2026: final whitespace cleanup removed one extra EOF blank line.
  // Appending exactly one newline reconstructs the previous 653fc97ff413... pin;
  // no contract text, imports or purchase behavior changed. Sol independently
  // reconstructed that prior hash and accepted this exact-byte correction.
  // 7 October 2026, F772 review repair (ca/p4-wall-r1): comment-only. The
  // review asked the `localizedPricePerMonth` doc to say RevenueCat divides the
  // yearly price by twelve on the device rather than "the store works it out".
  // `git diff` against the accepted b98dcaa1... shows only that doc comment.
  // 19 October 2026: store trial facts for the trial-ending reminder, read only, reviewed 2026-10-19
  // (orchestrator review of the revenue-engineer diff; purchase, restore, manage and grant paths unchanged).
  // 2026-10-19, F845: add the non-granting awaiting-approval (Ask to Buy) store outcome; founder approved the re-pin.
  // 2026-10-19, review P1 #1 / P2 #2: let a checkout fence clear only when the store holds no purchase or the server confirms; keep the approval state durable; founder approved in chat 2026-10-19.
  'apps/mobile/src/purchases/contract.ts': 'c0f706ff234505dc3bb0bd71875435e020153571f47d15413fc9ae3682152efc',
  // 2026-10-19, F845: add the non-granting awaiting-approval (Ask to Buy) store outcome; founder approved the re-pin.
  'apps/mobile/src/purchases/restore.ts': 'f625d4062beab096ea5b4802d19c3069e146d3d2223f242d70330325a7148dfe',
  // 7 October 2026: authorized completion adds account-scoped invalidation after
  // validated billing refresh (F783); listeners re-read server authority. No grant
  // or pricing rule changes here. billingChanges.test.ts covers the boundary.
  // 18 October 2026: paywall_scope independently accepted this exact bounded
  // status-read hash and reconstructed the previous hash by removing only the
  // five-second abort signal. Executed timeout proof returns unread, never a
  // guessed plan; authenticated POST and payload are unchanged.
  'apps/mobile/src/purchases/client.ts': '8ba9d565b58d0cac90cbb7e5a533f94aa88a703e0b5e98b0e9a2d6c440369c8a',
  // 2026-09-27: comment-only change (the F541 wall carve-out); `git diff` shows no code line moved.
  'apps/mobile/src/purchases/billingStatus.ts': '188b49983524e85464e01c6d18e9066d5cd2ebd4d4f0e1d721295e3ed28844f1',
  // 7 October 2026, F734 (come-alive Phase 4, ca/p4-wall): INCLUSIONS gains the
  // one streak line the plans page says for every plan on it, "Every plan
  // includes streak freezes and a one-tap repair.", now that F718 retired the
  // word from the shared ban. Copy only: capabilitiesFor, streakProtection and
  // planInclusions are unchanged, so no plan opens or gates anything new.
  // 9 October 2026: founder-authorized paywall copy adds INCLUSIONS.maxCompact.
  // Capability predicates and all purchase/grant/meter functions are unchanged.
  // 2026-10-20, D24/D23/Core (one re-pin for the free-tier change set; it covers
  // capabilities.ts, meter.ts and billingStatus.ts here, and store.ts and the
  // metering index.ts below). D24, the Headspace model: the one-off 30 free
  // minutes became a 5-minute weekly taste that refills on a rolling 7 days from
  // first use, one claim per device, and a lapse falls back to the taste
  // (meter.ts refillTaste/TASTE_REFILL_DAYS, exported from index.ts);
  // capabilitiesFor gains `unlocks` for the eight locked features; billing status
  // sends the taste's refill time as periodEnd; the local stores refill
  // (store.ts). D23: the free plan holds one streak freeze. Core: PLANS.starter.label
  // is "Core", id unchanged. Paid prices and allowances are unchanged. Approval:
  // founder decisions 2026-10-20. Independent review: the Opus orchestrator read
  // the meter, capabilities, billing status and store diffs before this pin.
  'apps/mobile/src/purchases/capabilities.ts': '9c160bfe9ccb4ee1534f0c6569d1d34aec25e9bf3e5560f0bf2e36f3573babe5',
  // 2026-10-23, VOICE-008: DEFAULT_COST_MODEL corrected to measured vendor
  // rates (sttPerMin 0.0043->0.009, llmPerMin 0.025->0.006, ttsPerMin
  // 0.045->0.109, tutorSpeakingShare 0.5->0.25; evidence docs/cogs-evidence/
  // rates.md), plus the prose figures that quote it. Founder approved
  // 2026-10-23. Prices, allowances, plans and every function body are
  // unchanged; meter.test.ts floors were tightened, none lowered.
  'packages/core/src/metering/meter.ts': 'fa1fc525f50e867dd179fafe35fccdd114065275db63a154495e1e124eaf2f2e',
  'services/token-server/src/billing/revenuecat.ts': '33964e5a51bf18aa5cb3f7198c9cc377dc2b815eeb13a26a0ebd2a4a0b9ba8ff',
  'services/token-server/src/billingStatus.ts': '416fcc27cc92be9e3c745decf147517c2dd3aa8f33c66ab69a6a1d5657acb025',
  // 3 October 2026: founder-authorized Report 36 confirmed service-failure
  // refunds and Report 32 approved audio spending ceilings. Sol independently
  // reviewed bounded charge/epoch/ownership/disabled-cap repairs; disposable SQL
  // and actual isolated PostgreSQL refund races passed. Hosted/native/crash
  // reconciliation remain release holds. Prices, allowances and margin floors
  // retain their original pins. These new pins guard the deliberate new rules.
  'packages/core/src/sessionSettlement.ts': '3daea2582cd956bd060215f0ad241bdccd5a08cff4c778ffbfab87d47faf43be',
  'supabase/migrations/20261002233520_failed_session_refunds.sql': 'e2159b5fa5079ac44a68fc84bbb8717ba891324c000b488be4d4ee6af606b122',
  'supabase/migrations/20261003001510_approved_phrase_audio_caps.sql': '4dcb7de1e44d95cd10c3914ae59d3b8e9d435ea9714e0cb0264cd42d451252c6',
  // 2026-09-27, Fable paywall review: the entitlement gate, the debit, core metering's entry point, the
  // client subscription state and every billing or entitlement migration were missing, so a change to
  // them would have ridden past this pin. Each hash was read at 0cb39ad and equals the working tree.
  // 4 October 2026: founder-authorized production backend restructure. Independent
  // database/revenue reviewer accepted these exact hashes after real repository
  // reservation→cryptographically verified SDK JWT proof, malformed RPC/owner
  // tests and 38 billing tests. SQL admission supersedes stale snapshots;
  // store changes remove raw error logging only. Prices/allowances remain pinned.
  // 2026-10-20, D24 follow-up: grantSession signs `memoryLocked: true` for free, lapsed and
  // guest sessions so the tutor neither reads nor writes memory. No allowance, debit or
  // price logic changed. Approval: founder 2026-10-20. Review: the Opus orchestrator reads
  // the tokens.ts diff before landing.
  // 2026-10-23, UI-011: grantSession signs guest first scene rooms (`scene`, lesson
  // `cafe-guest`, `memoryLocked: true`, at most 180 s, no brief, seed topic or mission).
  // No allowance, debit, price or trial logic changed. Approval: founder 2026-10-23 (the
  // guest first scene plan named this tokens.ts change). Review: revenue-engineer read-only
  // and the Opus orchestrator read the diff.
  'services/token-server/src/tokens.ts': '1f5ede4809154d4817a00e570768fe0a62eb1dd37d6a749f51cab4b429a5e620',
  'services/token-server/src/store.ts': '2d6d42ea21964bd640ad0f4f2e3b931c0e245364cc39f0d76791165b436fb019',
  'packages/core/src/metering/index.ts': '430ac2a2da7a53dac3d083dccb7a713e4d85d61c910c122128abef675d1c0efa',
  'apps/mobile/src/purchases/subscription.ts': 'a9c8873857eedacec2a5ed02895a65146ae91ec2bc61fd457c641b367ba2a69a',
  'apps/mobile/src/purchases/useContinueArc.ts': '122bbc57861e4bd52bf1207d39f0da89a297357369b865a9bed84ee7e505b3c8',
  'supabase/migrations/202608220001_luvani_learning.sql': '837130edcd96955383936bb34814c38a6cf9357e5031355156dd5398eb1f8c23',
  'supabase/migrations/202608230001_session_usage_idempotency.sql': '40b8eeb9315d766972434c6b5abb7b8a525f03d9cdd65b06812f06fff02b1a95',
  'supabase/migrations/202608240001_claim_trial_null_fix.sql': '4d002c9f2399b4b9b9d2cf7b8779f2631614155a1748fd5cf99046cdc69130aa',
  'supabase/migrations/202608250001_consume_entitlement_null_fix.sql': 'fd4793858c9c625f4e972be96cd7d22b2b38fec83380b60535e388429923fe25',
  'supabase/migrations/202608300001_billing_events.sql': '9cca723b62cfa72c5e107407e742a292c3642615ab76bc4db1c3eb08f471b340',
  'supabase/migrations/202608300002_paid_period_lapse.sql': '0a9defce38d24c790112b3af5518b442da6e8ff6527e88dcfc7a151fbe985026',
  'supabase/migrations/202608300003_paid_lapse_marker.sql': 'f62c7f5af3db814128873c98903f5161e1dd215a80071d0f66f9727b7e4c3b41',
  'supabase/migrations/202609100001_max_allowance_three_hundred.sql': '0e0982a4a43efa7100674848e8698eb5a7d15f44e39e4cbeac1e866c7069aadc',
  // 2026-10-19, F845: add the non-granting awaiting-approval (Ask to Buy) store outcome; founder approved the re-pin.
  'apps/mobile/src/purchases/storeSettlement.ts': '8dd08774be07a8d9b8bd6053d1aca93b144dc0de33cbadda0b8f4d1fd8199674',
  'apps/mobile/src/purchases/storeQueue.ts': 'e082c5feb556e5eda675884e56255ebf2ef4365ddfa783d26ad0005c271d9c74',
  'apps/mobile/src/purchases/billingReadiness.ts': '00d56ec03d31717376149bf4d9e50738452d55e8cd7d2951114e70f858ec5cd6',
  'services/token-server/src/billing/state.ts': 'e564bd2e58a25fea9dc942c7e4a52563802bbcc309fc3caa4cbeaea2ec3abc17',
  // 2 October 2026, Report 45: founder-authorized optional consented funnel evidence.
  // Sol accepted the separate-savepoint trial RPC, strict server event boundaries
  // and ordered ownership-bound restore tracking; allowance/debit policy is unchanged.
  'services/token-server/src/sessionEvents.ts': 'ef4f9bf949f4c320bfdf92eaaf6ad7b7da8a2ac1477e28599332319069cff176',
  'supabase/migrations/20261002192210_consented_product_funnel.sql': '3d07ab4e30a75ebe1664b0c907e531ec41fcf723d727f86580cae3b223585649',
  'supabase/migrations/20261002154637_atomic_billing_projection.sql': '9353bfd992c71eb42cb581b169c16dc320a509323a240e5913d8812c8f3bb40c',
  // 5 October 2026, F733: the trial and yearly projection and the renewal sweep, new money code pinned as written.
  // Same day, review repair: the window column, its trigger and lapse-only-on-inactive; the sweep's backlog log.
  // 6 October 2026, second review repair: period_start ordering, withheld_seconds, idempotent DDL, the
  // trigger clearing what a non-v2 writer leaves behind; the sweep's longest-unasked order and stuck log.
  'supabase/migrations/20261005231742_store_trial_yearly_allowance.sql': '367afb228236bfe4f5a28d50cabc25317b49ee28eedecb305e5418d78addc4f0',
  'services/token-server/src/billing/renewals.ts': '77df4d1f06a8870a21a65330d84885a90ab2743d3dbfcd8a0639b6c95e65e481',
};

/**
 * The money functions inside files the redesign did edit, each cut from its
 * first line to its own closing brace. The cut is by text, so the pin covers
 * the indentation and the comments inside the function as well as the code.
 */
const FUNCTIONS: ReadonlyArray<{ file: string; from: string; to: string; hash: string }> = [
  { file: 'apps/mobile/src/purchases/paywallView.ts', from: 'export function purchasable(', to: '\n}\n', hash: '356663b565acadb4db7149d52bb3b19a34db93da9cb7045dc65dcdb4381cc9d3' },
  { file: 'apps/mobile/src/purchases/paywallView.ts', from: 'export function paywallSurface(', to: '\n}\n', hash: 'd84931dc6e9138415641ca4acde9fd0fc746b4032c318ffe52fbe22d0b8935a9' },
  // 2026-10-19, F845: add the non-granting awaiting-approval (Ask to Buy) store outcome; founder approved the re-pin.
  { file: 'apps/mobile/src/purchases/paywallView.ts', from: 'export function restoreTrouble(', to: '\n}\n', hash: 'b0b7d80154b7438209dc99dda1583b7a9b3269b5f663915b5f1ba5bab6b9a094' },
  { file: 'apps/mobile/src/purchases/Paywall.tsx', from: '  const finish = async (', to: '\n  };\n', hash: '84b76d1009e37cb18928dba63a23fbe243160a42d96fcc48581f6bebd76e508d' },
    // 2026-10-19, review P1 #1 / P2 #2: let a checkout fence clear only when the store holds no purchase or the server confirms; keep the approval state durable; founder approved in chat 2026-10-19.
{ file: 'apps/mobile/src/wall/WallScreen.tsx', from: '  const settle = async (', to: '\n  };\n', hash: 'a487d6486c9eacc5cda384cce61adc599787feec6eff0e238be7d0a3a0962abd' },
  { file: 'apps/mobile/src/wall/WallScreen.tsx', from: '  const buy = async () => {', to: '\n  };\n', hash: '722a6d7ab28faaa9751d1e3ae938b92983f44f2f125228cd1c654cb7d98a3c40' },
  { file: 'apps/mobile/src/wall/WallScreen.tsx', from: '  const restore = async () => {', to: '\n  };\n', hash: 'eb161316f3375fefd7f77bd06e7c9196839976c64e51c9a1f1a0e42cf96f3b14' },
  // 2026-10-19, review P1 #1 / P2 #2: let a checkout fence clear only when the store holds no purchase or the server confirms; keep the approval state durable; founder approved in chat 2026-10-19.
  { file: 'apps/mobile/src/wall/WallScreen.tsx', from: '  const startAgain = async () => {', to: '\n  };\n', hash: '99719e14ee6805a55b3f655979574e57bb9adf7b49bf64565946227eaad5c277' },
  { file: 'apps/mobile/src/wall/WallScreen.tsx', from: '  const checkAcceptedPurchase = async () => {', to: '\n  };\n', hash: 'a1c162349a5a3655958a1b6bf0d64614aa46812ca6265a81f672072829030c19' },
  // 2026-09-27, Fable paywall review: the token server's billing routes, cut out of server.ts rather than
  // pinning the whole server, so an unrelated server change does not trip a money pin.
  { file: 'services/token-server/src/server.ts', from: "if (req.method === 'POST' && url.pathname === '/billing/webhook') {", to: '\n    }\n', hash: 'bea88b27886862ceed72a873b9f4f5980818c82c6b9c85254a65145eba36a9dd' },
  { file: 'services/token-server/src/server.ts', from: "if (req.method === 'POST' && url.pathname === '/billing/refresh') {", to: '\n    }\n', hash: '3fec25dc6d1e7bf7691dcd06e2f14c1b64b8667f2578303993e1e0b2469f593d' },
  { file: 'services/token-server/src/server.ts', from: "if (req.method === 'POST' && url.pathname === '/billing/status') {", to: '\n    }\n', hash: 'e04ae269c2ef774524d3fcfbd0e0654a65030af2de073e5cd4730778ca123e83' },
];

function cut(body: string, from: string, to: string): string {
  const start = body.indexOf(from);
  assert.notEqual(start, -1, `${from.trim()} is gone, so the pin is guarding nothing`);
  assert.equal(body.indexOf(from, start + 1), -1, `${from.trim()} appears twice, so the cut is ambiguous`);
  const end = body.indexOf(to, start);
  assert.notEqual(end, -1, `${from.trim()} has no closing brace where one was expected`);
  return body.slice(start, end + to.length);
}

describe('the paywall redesign left the money alone', () => {
  test('every file that buys, restores, grants or meters is byte-identical', () => {
    const moved: string[] = [];
    for (const [file, hash] of Object.entries(FILES)) {
      const now = sha(read(file));
      if (now !== hash) moved.push(`${file}: ${now}`);
    }
    assert.deepEqual(moved, [], 'money code changed; if that was meant, pin the new hash with a dated reason');
  });

  test('every money function inside an edited file is byte-identical', () => {
    const moved: string[] = [];
    for (const { file, from, to, hash } of FUNCTIONS) {
      const now = sha(cut(read(file), from, to));
      if (now !== hash) moved.push(`${file} ${from.trim()}: ${now}`);
    }
    assert.deepEqual(moved, [], 'a money function changed; if that was meant, pin the new hash with a dated reason');
  });
});
