import 'dotenv/config';
import { setTimeout as delay } from 'node:timers/promises';
import { brainClientFromEnv } from '@luvani/brain/llm';
import { practiceJobs, processPracticeJob } from './practiceJobs.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (process.env.LUVANI_DURABLE_PRACTICE !== '1' || !url || !key) {
  throw new Error('Practice worker requires LUVANI_DURABLE_PRACTICE=1 and server-side Supabase credentials.');
}
const jobs = practiceJobs(url, key);
const client = brainClientFromEnv();
let stopping = false;
const stop = () => { stopping = true; };
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
while (!stopping) {
  try {
    const result = await processPracticeJob(jobs, client);
    if (result !== 'idle') console.log(`[luvani:practice-worker] ${result}`);
    if (result === 'idle' && !stopping) await delay(5_000);
  } catch {
    console.error('[luvani:practice-worker] storage unavailable; retrying later');
    if (!stopping) await delay(10_000);
  }
}
