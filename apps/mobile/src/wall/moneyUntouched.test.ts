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

/** The whole files: nothing the paywall redesign had any reason to open. */
const FILES: Record<string, string> = {
  'apps/mobile/src/purchases/adapter.ts': '53ba449b12c8ee5976f20c587dedebf4874a4dce496e1abec6796eb411972b52',
  'apps/mobile/src/purchases/adapter.native.ts': 'ac9f1be8630a486807c315e6c24a0c5f0e565ee34ff232b44010ed37a8361aa7',
  'apps/mobile/src/purchases/restore.ts': '4be4eb27ae6b7182a85878b74cb57043ff5a2987d62df0e57d29aa15ade34915',
  'apps/mobile/src/purchases/client.ts': 'd7e40a93942a3605f99ea48033797d5b6955cff9e49e3667d3a50a67139c1628',
  // 2026-09-27: comment-only change (the F541 wall carve-out); `git diff` shows no code line moved.
  'apps/mobile/src/purchases/billingStatus.ts': '3104923354eec188303c25d0fc1e78abe4954daad392d7ad1427d32ce15392b1',
  'apps/mobile/src/purchases/capabilities.ts': 'fe15969f716eaa618e58dfb5bc3c45fa0a36f0a4353db6c3029e62e317387e84',
  'packages/core/src/metering/meter.ts': '4f5724e2e6885cd4a7df29a6f044d5358a7a5173958a59a6ce21a25925f896f8',
  'services/token-server/src/billing/revenuecat.ts': 'aef072ea9cccf1d244738d65e1ca9024a6d4403eb91c65898433db94a6b1b340',
  'services/token-server/src/billingStatus.ts': '4007af875bbddd777b4511db6143b9dabca82c1ef1174de5f9b4bd99fda8e1c6',
  // 2026-09-27, Fable paywall review: the entitlement gate, the debit, core metering's entry point, the
  // client subscription state and every billing or entitlement migration were missing, so a change to
  // them would have ridden past this pin. Each hash was read at 0cb39ad and equals the working tree.
  'services/token-server/src/tokens.ts': 'f0120883b1e44221c85a7e9bc5e44c1cb257f98d57a3fd1d8033de6e32baa562',
  'services/token-server/src/store.ts': '22c4fb32b14a95a095a514f819f276f3f3faf4c2c7dda214d28dc01c6fafd4a8',
  'packages/core/src/metering/index.ts': 'f7f45e8b95c398e8cfb44eb1205d5abf6619df185f8b47f4b8f8def9c911b100',
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
};

/**
 * The money functions inside files the redesign did edit, each cut from its
 * first line to its own closing brace. The cut is by text, so the pin covers
 * the indentation and the comments inside the function as well as the code.
 */
const FUNCTIONS: ReadonlyArray<{ file: string; from: string; to: string; hash: string }> = [
  { file: 'apps/mobile/src/purchases/paywallView.ts', from: 'export function purchasable(', to: '\n}\n', hash: '43b7a449f84496d510760ee14a60d455c11f7be43951e3cd6880e86b4e233526' },
  { file: 'apps/mobile/src/purchases/paywallView.ts', from: 'export function paywallSurface(', to: '\n}\n', hash: 'd84931dc6e9138415641ca4acde9fd0fc746b4032c318ffe52fbe22d0b8935a9' },
  { file: 'apps/mobile/src/purchases/paywallView.ts', from: 'export function restoreTrouble(', to: '\n}\n', hash: 'a42a8dbf9d09d8b44260a42e20ff35956cd51e104fdc815ee3f27a4cd0e943db' },
  { file: 'apps/mobile/src/purchases/Paywall.tsx', from: '  const finish = async (', to: '\n  };\n', hash: '2825eb55cb82bce3b93f0e81391c001b26c41eb9388201c173247d2f572cb3f8' },
  { file: 'apps/mobile/src/wall/WallScreen.tsx', from: '  const settle = async (', to: '\n  };\n', hash: '03d7855be18033911a2361a60c6e48da1bf9aa880902908b7eafd0a19f1a83a8' },
  { file: 'apps/mobile/src/wall/WallScreen.tsx', from: '  const buy = async () => {', to: '\n  };\n', hash: '3c2d133766003725381c4467aeda36826699190703f8f85fda940b3b5d494e59' },
  { file: 'apps/mobile/src/wall/WallScreen.tsx', from: '  const restore = async () => {', to: '\n  };\n', hash: 'a253152e9807f233e2fd8f81b6b683a1684a8be715b8f299582e16451eb06886' },
  // 2026-09-27, Fable paywall review: the token server's billing routes, cut out of server.ts rather than
  // pinning the whole server, so an unrelated server change does not trip a money pin.
  { file: 'services/token-server/src/server.ts', from: "if (req.method === 'POST' && url.pathname === '/billing/webhook') {", to: '\n    }\n', hash: '972d4cf610466980a3e2fe4cc5962b4bf81b5ffffe42e07799ad641e0d2106d4' },
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
