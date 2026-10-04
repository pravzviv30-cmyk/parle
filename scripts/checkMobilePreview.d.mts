export type PreviewEnvironment = Record<string, string | undefined>;
export interface PreviewEndpoints { api: string; supabase: string }
export function publicEndpoint(value: string | undefined, name: string): string;
export function previewEnvironment(env: PreviewEnvironment): PreviewEndpoints;
export function checkHostedPreview(
  env?: PreviewEnvironment,
  fetcher?: (url: string, options: RequestInit) => Promise<Response>,
): Promise<PreviewEndpoints>;
