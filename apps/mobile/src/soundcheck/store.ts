import AsyncStorage from '@react-native-async-storage/async-storage';
import { userKey } from '../storage/scope.ts';
import type { SoundCheckEvidence, SoundCheckKind } from './model.ts';

const KEY = () => userKey('soundChecks');
const VERSION = 1;
const MAX_EVIDENCE = 60;

interface StoredSoundChecks {
  version: typeof VERSION;
  evidence: SoundCheckEvidence[];
}

let writeChain: Promise<unknown> = Promise.resolve();

function isKind(value: unknown): value is SoundCheckKind {
  return value === 'assessed-clear' || value === 'assessed-focus' || value === 'self-guided' || value === 'unavailable';
}

function isEvidence(value: unknown): value is SoundCheckEvidence {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.missionId === 'string' &&
    typeof item.reference === 'string' &&
    typeof item.at === 'number' &&
    isKind(item.kind) &&
    (item.focus === null || typeof item.focus === 'string')
  );
}

async function read(key: string): Promise<SoundCheckEvidence[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredSoundChecks> | null;
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.evidence)) return [];
    return parsed.evidence.filter(isEvidence);
  } catch {
    return [];
  }
}

export function loadSoundChecks(): Promise<SoundCheckEvidence[]> {
  return read(KEY());
}

export function recordSoundCheck(evidence: SoundCheckEvidence): Promise<void> {
  const key = KEY();
  const run = async () => {
    const current = await read(key);
    const next = [...current, evidence].sort((a, b) => a.at - b.at).slice(-MAX_EVIDENCE);
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ version: VERSION, evidence: next } satisfies StoredSoundChecks));
    } catch {
      // The learner still completed the check; a full device must not block the screen.
    }
  };
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => undefined);
  return next;
}
