/** Offline drill evidence inventory, not a backup/restore implementation. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validHash } from '../scripts/verifyRelease.mjs';
export const COVERAGE=['applicationSchemasAndData','authUsersAndSessions','rolesAclsAndDefaults','migrationHistory',
  'extensionsAndEncryptionKeys','storageMetadataAndBodies','platformAndProviderConfiguration','immutableReleaseArtifacts',
  'offBackupDeletionJournal'];
export const PHASES=['isolateAndDisableAdmission','restoreDatabaseAuthRoles','restoreStorageBodiesAndConfiguration',
  'replayPostBackupDeletions','validateSecurityAndIdentity','validateSettlementQueuesAndRoomStops','measureRecoveryAndQuarantine'];
export function verifyDrill(drill) {
  if(drill?.version!==1 || drill.isolatedTarget!==true || !drill.sourceProjectRef || !drill.targetProjectRef || drill.sourceProjectRef===drill.targetProjectRef)throw new Error('A distinct isolated target is required');
  if(!Array.isArray(drill.coverage) || drill.coverage.length!==COVERAGE.length || new Set(drill.coverage.map(x=>x.name)).size!==COVERAGE.length)throw new Error('Complete recovery coverage required');
  const evidence=item=>{
    let u;try{u=new URL(item.evidenceUrl);}catch{throw new Error('Evidence URL required');}
    if(item.status!=='passed' || u.protocol!=='https:' || u.username || u.password || /example\.(com|org|net)$/.test(u.hostname) || !validHash(item.sha256))throw new Error('Passed review with real evidence URL/hash required');
  };
  for(const name of COVERAGE){const item=drill.coverage.find(x=>x.name===name);if(!item)throw new Error(`Missing coverage: ${name}`);evidence(item);}
  if(!Array.isArray(drill.phases) || drill.phases.length!==PHASES.length)throw new Error('Every isolated restore phase is required');
  let first,last;
  for(let i=0;i<PHASES.length;i++) {
    const phase=drill.phases[i];if(phase.name!==PHASES[i])throw new Error('Restore phase order differs');evidence(phase);
    const start=Date.parse(phase.startedAt),end=Date.parse(phase.completedAt);
    if(!Number.isFinite(start) || !Number.isFinite(end) || end<start || (last!==undefined && start<last))throw new Error('Invalid restore phase timing');
    first??=start;last=end;
  }
  for(const key of ['approvedRpoSeconds','approvedRtoSeconds','observedRpoSeconds','deletionsExpected','deletionsReplayed','journalHighWaterBefore','journalHighWaterAfter'])if(!Number.isSafeInteger(drill[key]) || drill[key]<0)throw new Error(`Missing measured ${key}`);
  const observedRtoSeconds=Math.ceil((last-first)/1000);
  if(drill.approvedRpoSeconds<1 || drill.approvedRtoSeconds<1 || drill.observedRpoSeconds>drill.approvedRpoSeconds || observedRtoSeconds>drill.approvedRtoSeconds)throw new Error('Measured recovery exceeds approved target');
  if(drill.deletionsReplayed!==drill.deletionsExpected || drill.journalHighWaterAfter<drill.journalHighWaterBefore)throw new Error('Post-backup deletion replay incomplete');
  return {observedRtoSeconds,observedRpoSeconds:drill.observedRpoSeconds,deletionsReplayed:drill.deletionsReplayed,targetProjectRef:drill.targetProjectRef,
    verification:'operator evidence inventory only; actual restore/checks require independent review'};
}
async function main(args) {
  if(args.length!==2 || !['--template','--verify'].includes(args[0]))throw new Error('Usage: node deployment/recoveryDrill.mjs --template NEW_FILE | --verify FILE');
  if(args[0]==='--verify'){console.log(JSON.stringify(verifyDrill(JSON.parse(await readFile(resolve(args[1]),'utf8')))));return;}
  const pending=name=>({name,status:'pending',evidenceUrl:null,sha256:null});
  await writeFile(resolve(args[1]),`${JSON.stringify({version:1,sourceProjectRef:null,targetProjectRef:null,isolatedTarget:false,
    approvedRpoSeconds:null,approvedRtoSeconds:null,observedRpoSeconds:null,deletionsExpected:null,deletionsReplayed:null,
    journalHighWaterBefore:null,journalHighWaterAfter:null,coverage:COVERAGE.map(pending),
    phases:PHASES.map(name=>({...pending(name),startedAt:null,completedAt:null}))},null,2)}\n`,{flag:'wx',mode:0o600});
  console.log('Drill template created with every phase pending. No restore performed.');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
