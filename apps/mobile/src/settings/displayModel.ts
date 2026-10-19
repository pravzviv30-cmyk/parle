import type { DisplayPreference } from '../main/appearanceModel.ts';

export const DISPLAY_OPTIONS = [
  { value: 'system', label: 'Follow device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export function displayPreferenceLabel(value: DisplayPreference): string {
  return DISPLAY_OPTIONS.find(option => option.value === value)?.label ?? DISPLAY_OPTIONS[0].label;
}
