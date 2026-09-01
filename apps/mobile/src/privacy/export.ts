/** A portable JSON copy of the signed-in learner's server and device data. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { saveTextFile } from '../progress/saveFile.ts';

export interface ExportDependencies {
  request?: typeof fetch;
  readDevice?: (keys: readonly string[]) => Promise<readonly (readonly [string, string | null])[]>;
  save?: (filename: string, content: string, mime: string) => Promise<void>;
  now?: () => Date;
}

export type AccountExportResult = { ok: true } | { ok: false; message: string };

function parsed(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export async function downloadAccountData(
  user: AuthUser,
  adapter: AuthAdapter,
  dependencies: ExportDependencies = {},
): Promise<AccountExportResult> {
  const request = dependencies.request ?? fetch;
  const readDevice = dependencies.readDevice ?? ((keys) => AsyncStorage.multiGet([...keys]));
  const save = dependencies.save ?? saveTextFile;
  const now = dependencies.now?.() ?? new Date();
  const keys = USER_KEY_SUFFIXES.map((suffix) => `luvani.u.${user.id}.${suffix}`);

  try {
    const [devicePairs, token] = await Promise.all([readDevice(keys), adapter.getAccessToken()]);
    let serverData: unknown = null;
    if (adapter.kind === 'supabase') {
      if (!token) return { ok: false, message: 'Sign in again, then ask for your data.' };
      const response = await request(`${TOKEN_SERVER}/account/export`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return {
          ok: false,
          message: response.status === 429
            ? 'That needs a short pause. Try the export again later.'
            : 'Your data could not be prepared just now. Nothing was changed.',
        };
      }
      serverData = await response.json();
    }

    const deviceData = Object.fromEntries(
      devicePairs.map(([key, value]) => [key.slice(`luvani.u.${user.id}.`.length), parsed(value)]),
    );
    const payload = {
      format: 'luvani-complete-export-v1',
      exportedAt: now.toISOString(),
      account: { id: user.id, email: user.email, provider: user.provider },
      deviceData,
      serverData,
      notes: adapter.kind === 'mock'
        ? ['This development account exists only on this device, so there is no server copy.']
        : [],
    };
    await save('luvani-account-data.json', `${JSON.stringify(payload, null, 2)}\n`, 'application/json');
    return { ok: true };
  } catch {
    return { ok: false, message: 'Your data could not be prepared just now. Nothing was changed.' };
  }
}
