/** Execute only on an explicitly confirmed isolated restore, with admission OFF. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deletionJournal} from '../services/token-server/src/deletionJournal.ts';
import {privacyJobs} from '../services/token-server/src/privacyJobs.ts';
import {tutorSessionRpc} from '../services/shared/tutorLifecycle.ts';
import {paidAdmissionRpc} from '../services/shared/paidAdmission.ts';
const origin=value=>{const url=new URL(value);if(url.protocol!=='https:' || url.origin!==value)throw new Error('exact HTTPS origin required');return value;};
export function validateReplayInputs(env,evidence,now=Date.now()) {
  const target=origin(env.SUPABASE_URL),source=origin(env.LUVANI_DELETION_JOURNAL_PROJECT_URL);
  if(target===source || env.LUVANI_RESTORE_ISOLATED!=='1' || !env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('isolated restore target required');
  if(evidence?.version!==1 || evidence.sourceProjectUrl!==source || evidence.targetProjectUrl!==target || evidence.sourceWritersFrozen!==true
    || evidence.sourceAdmissionOff!==true || typeof evidence.reviewedBy!=='string' || !evidence.reviewedBy.trim() || evidence.reviewedBy.length>120
    || !/^[a-f0-9]{64}$/.test(evidence.evidenceSha256??'') || !Number.isFinite(Date.parse(evidence.expiresAt)) || Date.parse(evidence.expiresAt)<=now
    || Date.parse(evidence.expiresAt)>now+24*60*60_000)throw new Error('current source freeze/cutover evidence required');
  const url=new URL(evidence.evidenceUrl);if(url.protocol!=='https:' || url.username || url.password)throw new Error('HTTPS freeze evidence required');
  return {target,source};
}
export async function replayRestore(env,evidence,{request=fetch,maxRecords=100_000,maxJobs=1000}={}) {
  const {source,target}=validateReplayInputs(env,evidence);
  if(!Number.isSafeInteger(maxRecords) || maxRecords<1 || maxRecords>100_000 || !Number.isSafeInteger(maxJobs) || maxJobs<1 || maxJobs>10_000)throw new Error('bounded restore work required');
  const rpc=tutorSessionRpc(target,env.SUPABASE_SERVICE_ROLE_KEY,request);
  const paidRpc=paidAdmissionRpc(target,env.SUPABASE_SERVICE_ROLE_KEY,request);
  const disabled=async()=>{const schema=await rpc('tutor_session_schema_v1',{});const paid=await paidRpc('paid_admission_schema_v1',{});if(schema.enabled!==false || paid.enabled!==false)throw new Error('target admission must already be OFF');};
  await disabled();
  const journal=deletionJournal({endpoint:env.LUVANI_DELETION_JOURNAL_URL,token:env.LUVANI_DELETION_JOURNAL_TOKEN,key:env.LUVANI_DELETION_JOURNAL_KEY,projectUrl:source},request,{maxRecords});
  const jobs=privacyJobs(target,env.SUPABASE_SERVICE_ROLE_KEY,env.REVENUECAT_SECRET_API_KEY,request,journal);
  await jobs.configure();let verifiedSnapshot;
  const replayed=await journal.replay(async user=>{await disabled();const result=await jobs.begin(user);if(!['pending','completed','gone'].includes(result.kind))throw new Error('restored deletion fencing failed');},snapshot=>{verifiedSnapshot=snapshot;});
  let processed=0;
  for(;processed<maxJobs;processed++){await disabled();if(await jobs.process()==='idle')break;}
  await disabled();const status=await rpc('backend_status_v1',{});
  if(!Number.isSafeInteger(status.erasurePending) || status.erasurePending<0)throw new Error('invalid erasure reconciliation status');
  return {version:1,status:status.erasurePending===0?'replayed':'pending',replayed,processed,erasurePending:status.erasurePending,
    verifiedSnapshot,sourceProjectSha256:createHash('sha256').update(source).digest('hex'),targetProjectSha256:createHash('sha256').update(target).digest('hex'),
    completedAt:new Date().toISOString(),admissionEnabled:false,
    limitation:'Source write freeze, independent journal durability and target transport provenance require operator review. No admission is enabled.'};
}
async function main(args) {
  if(args.length!==5 || args[0]!=='--apply' || args[1]!=='--source-frozen-evidence' || args[3]!=='--output')throw new Error('Usage: node scripts/replayDeletionJournal.mjs --apply --source-frozen-evidence REVIEW.json --output NEW_REPORT.json');
  const evidence=JSON.parse(await readFile(resolve(args[2]),'utf8'));
  const result=await replayRestore(process.env,evidence);
  await writeFile(resolve(args[4]),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:result.status,replayed:result.replayed,processed:result.processed,erasurePending:result.erasurePending,admissionEnabled:false}));
  if(result.status!=='replayed')process.exitCode=1;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(()=>{console.error('Restore replay refused or incomplete. Keep target quarantined with admission OFF.');process.exitCode=1;});
