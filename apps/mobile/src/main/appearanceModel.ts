export type DisplayPreference = 'system' | 'light' | 'dark';
export type MainMode = 'light' | 'dark';
export function displayPreference(value: unknown): DisplayPreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function mainMode(preference: DisplayPreference, system: string | null | undefined): MainMode {
  return preference === 'system' ? system === 'dark' ? 'dark' : 'light' : preference;
}
