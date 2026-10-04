import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { RoomServiceClient } from 'livekit-server-sdk';
import { TutorSessionRepository } from './tutorSessions.ts';
import { privacyJobs } from './privacyJobs.ts';
import { reconcileTutorRooms } from './maintenance.ts';
import { safeError } from '../../shared/safeError.ts';
import { journalFromEnv } from './deletionJournal.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const livekit = process.env.LIVEKIT_URL;
if (!url || !key || !livekit || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET
  || (process.env.NODE_ENV === 'production' && (!url.startsWith('https://') || !livekit.startsWith('wss://') || process.env.LUVANI_LOCAL_DEVELOPMENT === '1'))) {
  throw new Error('Maintenance requires secure database and room-control configuration.');
}
const repository = new TutorSessionRepository(url, key);
const erasures = privacyJobs(url, key, process.env.REVENUECAT_SECRET_API_KEY, fetch, journalFromEnv());
const rooms = new RoomServiceClient(livekit.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { requestTimeout: 3, failover: false });
const workerId = randomUUID();
let stopping = false;
let healthy = false;
let nextRetention = 0;
const stoppingController = new AbortController();
const heartbeat = () => repository.rpc('publish_backend_heartbeat_v1', { p_role: 'maintenance', p_worker_id: workerId, p_ready: healthy && !stopping });
let heartbeatWork = Promise.resolve();
const heartbeatTimer = setInterval(() => {
  heartbeatWork = heartbeatWork.then(heartbeat).then(() => {}).catch(() => { healthy = false; });
}, 15_000);
const stop = () => { stopping = true; healthy = false; stoppingController.abort(); };
process.once('SIGTERM', stop); process.once('SIGINT', stop);
try {
  await erasures.configure();
  while (!stopping) {
    try {
      const reconciliation = await reconcileTutorRooms(repository, rooms);
      const erasure = await erasures.process();
      if (Date.now() >= nextRetention) {
        const retained = await repository.rpc('run_data_retention_v1', { p_batch_size: 500 });
        console.log(JSON.stringify({ event: 'retention', analyticsDeleted: retained.analyticsDeleted, expiredRequestsDeleted: retained.expiredRequestsDeleted, installationMarkersDeleted: retained.installationMarkersDeleted }));
        const exports=await repository.rpc('cleanup_account_exports_v2',{p_batch_size:100});
        const details=await repository.rpc('expire_session_details_v2',{p_batch_size:500});
        const practice=await repository.rpc('reconcile_practice_jobs_v1',{p_limit:100});
        console.log(JSON.stringify({event:'bounded_maintenance',exportsDeleted:exports.jobsDeleted,detailsExpired:details.detailsExpired,unknownLegacyDue:details.unknownLegacyDue,unknownLegacyDueCapped:details.unknownLegacyDueCapped,practiceFinalized:practice.exhaustedJobsEnded}));
        nextRetention = Date.now() + 5 * 60_000;
      }
      healthy = reconciliation.requested === reconciliation.closed;
      console.log(JSON.stringify({ event: 'maintenance', ...reconciliation, erasure }));
      await heartbeat();
    } catch (error) {
      healthy = false; console.error(JSON.stringify({ event: 'maintenance_failure', ...safeError(error) }));
    }
    if (!stopping) await delay(5000, undefined, { signal: stoppingController.signal }).catch(() => {});
  }
} finally {
  clearInterval(heartbeatTimer);
  await heartbeatWork;
  await heartbeat().catch(() => {});
}
