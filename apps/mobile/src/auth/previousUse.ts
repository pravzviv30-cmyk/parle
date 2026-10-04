import AsyncStorage from '@react-native-async-storage/async-storage';

/** Upgrade hint: inspect only completion metadata in pre-existing local profiles. */
export async function hasCompletedLocalAccount(): Promise<boolean> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      /^luvani\.u\..+\.profile$/.test(key),
    );
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const profile: unknown = JSON.parse(raw);
        if (
          profile &&
          typeof profile === 'object' &&
          'onboardedAt' in profile &&
          typeof profile.onboardedAt === 'number' &&
          Number.isFinite(profile.onboardedAt) &&
          profile.onboardedAt > 0
        )
          return true;
      } catch {
        /* A damaged profile is not evidence of completion. */
      }
    }
  } catch {
    /* Missing disk evidence leaves the first-install door available. */
  }
  return false;
}
