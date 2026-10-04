/** Native exports exist in cache only while the system share sheet needs them. */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { scopeGeneration, writeInUserScope } from '../storage/scope.ts';
import { nativeExportFiles as files, nativeExportUri, recoverNativeExports as recover } from './temporaryExportCache.native.ts';
import { temporaryTextShare } from './temporaryTextShare.ts';

export async function saveTextFile(filename: string, content: string, mime: string): Promise<void> {
  const owner = scopeGeneration();
  await recover();
  if (owner !== scopeGeneration()) throw new Error('Account changed');
  if (!FileSystem.cacheDirectory) throw new Error('Export cache is unavailable');
  // Concurrent exports never overwrite a file already held by a share sheet.
  const uri = nativeExportUri(filename);
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
