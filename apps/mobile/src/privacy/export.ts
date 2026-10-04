/** A portable JSON copy of the signed-in learner's server and device data. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { scopeGeneration, USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { saveTextFile } from '../progress/saveFile.ts';
import { downloadPagedAccountData } from './pagedExport.ts';
import type { ExportFile } from './exportFile.ts';

export interface ExportDependencies {
  request?: typeof fetch;
  readDevice?: (keys: readonly string[]) => Promise<readonly (readonly [string, string | null])[]>;
  save?: (filename: string, content: string, mime: string) => Promise<void>;
  now?: () => Date;
  createFile?: (bytes:number)=>Promise<ExportFile>;
  sha256?: (bytes:Uint8Array)=>Promise<Uint8Array>;
  exportId?:()=>string;
  pause?:(milliseconds:number,signal:AbortSignal)=>Promise<void>;
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
  if(adapter.kind==='supabase')return downloadPagedAccountData(user,adapter,dependencies);
  const owner = scopeGeneration();
  const current = async () => owner === scopeGeneration() && (await adapter.getSession())?.id === user.id;
  const readDevice = dependencies.readDevice ?? ((keys) => AsyncStorage.multiGet([...keys]));
  const save = dependencies.save ?? saveTextFile;
  const now = dependencies.now?.() ?? new Date();
  const keys = USER_KEY_SUFFIXES.map((suffix) => `luvani.u.${user.id}.${suffix}`);

  try {
    if (!await current()) return { ok: false, message: 'Sign in again, then ask for your data.' };
    const devicePairs = await readDevice(keys);
    const serverData = null;

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
    if (!await current()) return { ok: false, message: 'The account changed. Ask for your data again.' };
    await save('luvani-account-data.json', `${JSON.stringify(payload, null, 2)}\n`, 'application/json');
    return { ok: true };
  } catch {
    return { ok: false, message: 'Your data could not be prepared just now. Nothing was changed.' };
  }
}


/** The learner explicitly confirms this sensitive export before reauthentication. */
export async function downloadVerifiedAccountData(
  user: AuthUser,
  adapter: AuthAdapter,
  secret?: string,
  dependencies: ExportDependencies = {},
): Promise<AccountExportResult> {
  const owner = scopeGeneration();
  try {
    if ((await adapter.getSession())?.id !== user.id) return { ok: false, message: 'Sign in again, then ask for your data.' };
    if (adapter.kind === 'supabase') {
      const confirmed = await adapter.reauthenticateForDeletion(secret, 'export');
      if (!confirmed.ok) return confirmed;
    }
    if (owner !== scopeGeneration()) return { ok: false, message: 'The account changed. Ask for your data again.' };
    return downloadAccountData(user, adapter, dependencies);
  } catch {
    return { ok: false, message: 'Your sign-in could not be confirmed. Try again.' };
  }
}
