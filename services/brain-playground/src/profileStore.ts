/**
 * The learner profile on disk.
 *
 * A JSON file, written atomically (tmp then rename) so a crash mid-save never
 * leaves half a profile. A corrupt file is renamed to .bak and replaced with a
 * fresh one rather than crashing the session — losing history is bad, losing
 * the learner's session to a stack trace is worse.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createProfile, migrateProfile, type LearnerProfile } from '@luvani/brain';

const SERVICE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_PROFILE_PATH = join(SERVICE_ROOT, '.data', 'profile.json');

export function loadProfile(path = DEFAULT_PROFILE_PATH): LearnerProfile {
  if (!existsSync(path)) return createProfile();
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const version = (parsed as { version?: unknown } | null)?.version;
    if (typeof parsed !== 'object' || parsed === null || (version !== 1 && version !== 2)) {
      throw new Error('unrecognized profile shape');
    }
    return migrateProfile(parsed as LearnerProfile);
  } catch {
    renameSync(path, `${path}.bak`);
    return createProfile();
  }
}

export function saveProfile(profile: LearnerProfile, path = DEFAULT_PROFILE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

export function resetProfile(path = DEFAULT_PROFILE_PATH): LearnerProfile {
  const fresh = createProfile();
  saveProfile(fresh, path);
  return fresh;
}
