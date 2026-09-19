export function friendUsernameFromUrl(url: string): string | null {
  const match = /^luvani:\/\/invite\/([a-z0-9][a-z0-9._]{2,23})\/?$/i.exec(url);
  return match ? match[1]!.toLowerCase() : null;
}
