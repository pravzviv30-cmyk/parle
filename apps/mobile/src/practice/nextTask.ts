import type { Recommendation } from './recommendation.ts';
import type { HomeBilling } from '../home/nextAction.ts';
/** Resume/owned practice first. Purchase and live scene gates never strand local work. */
export function nextTaskKind(rec: Recommendation, live: boolean, billing: HomeBilling | null, reviewReady = false): 'practice' | 'review' | 'local' | 'plans' | 'scene' {
  if (rec.kind !== 'none') return 'practice';
  if (reviewReady) return 'review';
  if (!live) return 'local';
  if (billing?.plan === 'trial' && (billing.reason === 'exhausted' || billing.reason === 'insufficient-for-session')) return 'plans';
  return 'scene';
}
