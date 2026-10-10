import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setActiveUser } from '../storage/scope.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';
import { clearSetupDraft, loadRepairDraft, loadSetupDraft, saveRepairDraft, saveSetupDraft, type RepairDraft } from './onboardingDraftStore.ts';

const disk = new Map<string, string>();
const storage = AsyncStorage as unknown as Record<string, unknown>;
storage.getItem = async (key: string) => disk.get(key) ?? null;
storage.setItem = async (key: string, value: string) => { disk.set(key, value); };
storage.removeItem = async (key: string) => { disk.delete(key); };
const repair: RepairDraft = { page: 'voice', name: 'Camille', oldEnough: true, voice: 'emilie', analyticsConsent: true, completedSteps: ['age', 'name', 'meet'] };

describe('unfinished onboarding stays inside its account', () => {
  test('restores page, typed name, deliberate tutor and completed history', async () => {
    disk.clear(); setActiveUser('learner-a');
    await saveRepairDraft(repair);
    assert.deepEqual(await loadRepairDraft(), repair);
    setActiveUser('learner-b');
    assert.equal(await loadRepairDraft(), null);
    setActiveUser('learner-a');
    assert.deepEqual(await loadRepairDraft(), repair);
  });
  test('a queued write cannot land after the account changes', async () => {
    disk.clear(); setActiveUser('writer-a');
    const pending = saveRepairDraft(repair);
    setActiveUser('writer-b');
    assert.equal(await pending, false);
    assert.equal(disk.size, 0);
  });
  test('refusal removes earlier personal answers and writes no refusal marker', async () => {
    disk.clear(); setActiveUser('gate-a');
    await saveRepairDraft(repair);
    await saveRepairDraft({ ...repair, page: 'age', oldEnough: false });
    assert.equal(await loadRepairDraft(), null);
    assert.equal(disk.size, 0);
  });
  test('signed-in setup restores its variant, skipped routes and selected voice', async () => {
    disk.clear(); setActiveUser('setup-a');
    const draft = { ...freshPreAccountDraft(), page: 'choose-tutor' as const, tutorChosen: true, tutorVoice: 'sarah' as const,
      onboardingVariant: 'five' as const, onboardingCompletedSteps: ['hear-it', 'reason', 'confidence', 'focus', 'time', 'plan'], onboardingSkippedSteps: ['remind'] };
    await saveSetupDraft(draft);
    assert.deepEqual(await loadSetupDraft(), draft);
    setActiveUser('setup-b'); assert.equal(await loadSetupDraft(), null);
  });
  test('a captured clear remains safe across sign-out and never clears another account', async () => {
    disk.clear(); setActiveUser('clear-a'); await saveSetupDraft(freshPreAccountDraft());
    setActiveUser('clear-b'); await saveSetupDraft({ ...freshPreAccountDraft(), reason: 'trip' });
    setActiveUser('clear-a'); const pending = clearSetupDraft(); setActiveUser('clear-b'); await pending;
    assert.equal((await loadSetupDraft())?.reason, 'trip');
    setActiveUser('clear-a'); assert.equal(await loadSetupDraft(), null);
  });
});
