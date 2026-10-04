/** Web cleanup covers both active handles and files left by a previous process. */
import { onUserScopeReset,onUserScopeCleanup } from '../storage/scope.ts';
import {exportRecovery,isTemporaryExportName} from './temporaryExports.ts';
const removers=new Map<string,()=>Promise<void>>();
let directory:FileSystemDirectoryHandle|null=null;
async function sweep() {
  const storage=typeof navigator!=='undefined'?navigator.storage:undefined;
  if(!storage || typeof storage.getDirectory!=='function')return;
  directory??=await(await storage.getDirectory()).getDirectoryHandle('luvani-temporary-exports',{create:true});
  for await(const [name] of directory.entries()) {
    // Registered handles must close/abort through their own remover first.
    if(isTemporaryExportName(name) && !removers.has(name))await directory.removeEntry(name);
  }
}
const recover=exportRecovery(sweep);
export async function webExportDirectory() {await recover();return directory;}
export function trackWebExport(name:string,remove:()=>Promise<void>) {
  let pending:Promise<void>|undefined;
  const discard=()=>{pending??=remove().then(()=>{removers.delete(name);}).catch(error=>{pending=undefined;throw error;});return pending;};
  removers.set(name,discard);return discard;
}
export async function resetWebExports() {
  await recover();
  const outcomes=await Promise.allSettled([...removers].map(async([name,remove])=>{await remove();removers.delete(name);}));
  await sweep();
  if(outcomes.some(result=>result.status==='rejected'))throw new Error('export-cleanup-required');
}
onUserScopeReset(()=>{void resetWebExports().catch(()=>{});});onUserScopeCleanup(resetWebExports);
