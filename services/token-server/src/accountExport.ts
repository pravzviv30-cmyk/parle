/**
 * A learner's server-side data, through the same admin boundary as deletion.
 *
 * Every table is filtered by the user id resolved from the bearer token. The
 * caller never supplies an id, and the deliberately unlinkable trial-installation
 * HMACs are absent: exporting them would require inventing a link the schema was
 * designed not to retain.
 */

const OWNED_TABLES = [
  'learner_state',
  'product_events',
  'entitlements',
  'session_usage',
  'billing_events',
  'conversation_packs',
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
  const tableRequests = OWNED_TABLES.map(async (table) => {
    const response = await request(
      `${root}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}&select=*`,
      { headers, signal: AbortSignal.timeout(5_000) },
    );
    const body = await responseJson(response, `${table} export`);
    if (!Array.isArray(body)) throw new Error(`${table} export returned an invalid payload`);
    return [table, body] as const;
  });

  const [accountBody, rows] = await Promise.all([
    accountRequest.then((response) => responseJson(response, 'account export')),
    Promise.all(tableRequests),
  ]);
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
    serverData: Object.fromEntries(rows) as Record<ExportedTable, unknown[]>,
    notes: [
      'Raw learner audio and full transcripts are not stored, so they are not present.',
      'The free-trial antifraud marker is deliberately not linkable back to an account.',
    ],
  };
}
