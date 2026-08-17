/**
 * Web build: hand the browser a download. Metro picks saveFile.native.ts on iOS
 * and Android.
 */

export async function saveTextFile(filename: string, content: string, mime: string): Promise<void> {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
