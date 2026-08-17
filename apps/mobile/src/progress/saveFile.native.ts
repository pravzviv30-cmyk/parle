/**
 * Native build: write to the app's cache and open the share sheet, so the file
 * can land in Anki, Files, AirDrop, or wherever the learner keeps their cards.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export async function saveTextFile(filename: string, content: string, mime: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: filename });
  }
}
