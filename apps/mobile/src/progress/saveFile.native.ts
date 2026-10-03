/** Native exports exist in cache only while the system share sheet needs them. */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { onUserScopeReset, onUserScopeCleanup, scopeGeneration, writeInUserScope } from '../storage/scope.ts';
import { exportRecovery, isTemporaryExportName, temporaryExports } from './temporaryExports.ts';
import { temporaryTextShare } from './temporaryTextShare.ts';

let sequence = 0;
const files = temporaryExports(uri => FileSystem.deleteAsync(uri, { idempotent: true }),
  () => console.error('[luvani] EXPORT_NOT_DISCARDED'), async () => {
    if (!FileSystem.cacheDirectory) return [];
    const names = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    return names.filter(isTemporaryExportName).map(name => `${FileSystem.cacheDirectory}${name}`);
  });
// Recover previous-process failed deletes before another export can write bytes.
const recover = exportRecovery(() => files.reset());
onUserScopeReset(() => { void files.reset().catch(() => {}); });
onUserScopeCleanup(() => files.reset());

export async function saveTextFile(filename: string, content: string, mime: string): Promise<void> {
  const owner = scopeGeneration();
  await recover();
  if (owner !== scopeGeneration()) throw new Error('Account changed');
  if (!FileSystem.cacheDirectory) throw new Error('Export cache is unavailable');
  // Concurrent exports never overwrite a file already held by a share sheet.
  const uri = `${FileSystem.cacheDirectory}luvani-export-${Date.now()}-${++sequence}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await temporaryTextShare({
      available: () => Sharing.isAvailableAsync(),
      current: () => owner === scopeGeneration(),
      write: async () => {
        files.track(uri);
        const written = await writeInUserScope(owner, () => FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 }));
        if (!written) throw new Error('Account changed');
      },
      share: () => Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: filename }),
      remove: () => files.discard(uri),
    });
}
