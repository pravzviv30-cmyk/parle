import { tutorSessionRpc } from '../../shared/tutorLifecycle.ts';
import { deleteSupabaseUser, requestRevenueCatErasure } from './accountDeletion.ts';
import type { DeletionJournal } from './deletionJournal.ts';

export function privacyJobs(baseUrl: string, serviceKey: string, processorKey?: string, request: typeof fetch = fetch, journal?: DeletionJournal) {
  const rpc = tutorSessionRpc(baseUrl, serviceKey, request);
  return {
    configure: () => rpc('configure_privacy_processor_v1', { p_configured: !!processorKey }),
    begin: (userId: string) => rpc('begin_account_erasure_v1', { p_user_id: userId, p_processor_configured: !!processorKey }),
    async process(): Promise<'idle' | 'complete' | 'retry' | 'superseded'> {
      const job = await rpc('claim_account_erasure_v1', {});
      if (job.kind === 'idle') return 'idle';
      if (job.kind !== 'claimed' || typeof job.userId !== 'string' || typeof job.lease !== 'string'
        || ![job.userId,job.lease].every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
        || typeof job.processorRequired !== 'boolean' || typeof job.processorAccepted !== 'boolean') throw new Error('invalid-erasure-job');
      const advance = (stage: string) => rpc('advance_account_erasure_v1', { p_user_id: job.userId, p_lease: job.lease, p_stage: stage });
      try {
        if (!journal) throw new Error('deletion-journal-required');
        await journal.record(job.userId);
      } catch { await advance('storage-failed'); return 'retry'; }
      if (job.processorRequired && !job.processorAccepted) {
        if (!await requestRevenueCatErasure(job.userId, processorKey, request)) {
          await advance('processor-failed'); return 'retry';
        }
        if ((await advance('processor-accepted')).kind !== 'recorded') return 'superseded';
      }
      try { await deleteSupabaseUser(baseUrl, serviceKey, job.userId, request); }
      catch { await advance('identity-failed'); return 'retry'; }
      return (await advance('identity-deleted')).kind === 'recorded' ? 'complete' : 'superseded';
    },
  };
}
