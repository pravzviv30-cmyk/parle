import { authenticationIsRecent } from '@luvani/core';
import { signedInRecently } from './accountDeletion.ts';

/**
 * A learner's server-side data, through the same admin boundary as deletion.
 *
 * Every table is filtered by the user id resolved from the bearer token. The
 * caller never supplies an id. Trial-installation HMACs are pseudonymous
 * antifraud data retained separately, including after account deletion.
 */

const OWNED_TABLES = [
  'session_grants',
  'learner_state',
  'product_events',
  'entitlements',
  'session_usage',
  'billing_events',
  'conversation_packs',
  'saved_conversation_text',
  'phrase_audio_budgets',
  'social_profiles',
  'social_blocks',
  'social_reports',
  'social_notices',
  'social_reactions',
  'social_edges',
  'social_challenges',
] as const;

export type ExportedTable = (typeof OWNED_TABLES)[number];

export interface AccountDataExport {
  format: 'luvani-account-export-v1';
  exportedAt: string;
  account: {
    id: string;
    email: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
  };
  serverData: Record<ExportedTable, unknown[]>;
  notes: string[];
}

function adminHeaders(serviceRoleKey: string): Record<string, string> {
  return { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` };
}

async function responseJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${label} failed (${response.status})`);
  return response.json();
}

export async function exportSupabaseAccountData(
  baseUrl: string,
  serviceRoleKey: string,
  userId: string,
  request: typeof fetch = fetch,
  now = new Date(),
): Promise<AccountDataExport> {
  const root = baseUrl.replace(/\/+$/, '');
  const headers = adminHeaders(serviceRoleKey);
  const accountRequest = request(`${root}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  const serverRowsRequest = request(`${root}/rest/v1/rpc/export_account_data`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ p_user_id: userId }), signal: AbortSignal.timeout(5_000),
  }).then(response => responseJson(response, 'server data export'));

  const [accountBody, serverData] = await Promise.all([
    accountRequest.then((response) => responseJson(response, 'account export')),
    serverRowsRequest,
  ]);
  if (typeof serverData !== 'object' || serverData === null || Array.isArray(serverData) ||
    Object.keys(serverData).length !== OWNED_TABLES.length || OWNED_TABLES.some(table => !Array.isArray((serverData as Record<string, unknown>)[table]) || ((serverData as Record<string, unknown[]>)[table]!.length > 10000)) ||
    new TextEncoder().encode(JSON.stringify(serverData)).byteLength > 32 * 1024 * 1024) throw new Error('server data export returned an invalid or oversized snapshot');
  const account = (typeof accountBody === 'object' && accountBody !== null ? accountBody : {}) as Record<string, unknown>;

  return {
    format: 'luvani-account-export-v1',
    exportedAt: now.toISOString(),
    account: {
      id: userId,
      email: typeof account.email === 'string' ? account.email : null,
      createdAt: typeof account.created_at === 'string' ? account.created_at : null,
      lastSignInAt: typeof account.last_sign_in_at === 'string' ? account.last_sign_in_at : null,
    },
    serverData: serverData as Record<ExportedTable, unknown[]>,
    notes: [
      'Raw learner audio is not stored. Conversation text is present only for sessions you explicitly chose to save; deleted text leaves a word-free retry marker until account deletion.',
      'Pseudonymous free-trial antifraud markers are retained separately after account deletion. The server can match their keyed hashes to an account or installation; these markers are not included in this export.',
    ],
  };
}


/** Refreshing a bearer alone cannot authorize an account-data download. */
export async function exportRecentlyAuthenticatedAccountData(
  baseUrl: string,
  serviceRoleKey: string,
  userId: string,
  authenticatedAt: number | undefined,
  request: typeof fetch = fetch,
  now = new Date(),
): Promise<AccountDataExport | null> {
  if (!authenticationIsRecent(authenticatedAt, now.getTime())) return null;
  if (!await signedInRecently(baseUrl, serviceRoleKey, userId, request, now.getTime())) return null;
  return exportSupabaseAccountData(baseUrl, serviceRoleKey, userId, request, now);
}
