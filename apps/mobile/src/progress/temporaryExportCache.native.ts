/** One cleanup registry for text and streamed native exports. */
import * as FileSystem from 'expo-file-system/legacy';
import { onUserScopeReset, onUserScopeCleanup } from '../storage/scope.ts';
import { exportRecovery, isTemporaryExportName, temporaryExports } from './temporaryExports.ts';
let sequence=0;
const closers=new Map<string,()=>void>();
export const nativeExportFiles=temporaryExports(async uri=>{
  closers.get(uri)?.();closers.delete(uri);await FileSystem.deleteAsync(uri,{idempotent:true});
},()=>console.error('[luvani] EXPORT_NOT_DISCARDED'),async()=>{
  if(!FileSystem.cacheDirectory)return [];
  return (await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory)).filter(isTemporaryExportName).map(name=>`${FileSystem.cacheDirectory}${name}`);
});
export const recoverNativeExports=exportRecovery(()=>nativeExportFiles.reset());
onUserScopeReset(()=>{void nativeExportFiles.reset().catch(()=>{});});onUserScopeCleanup(()=>nativeExportFiles.reset());
export function nativeExportUri(filename:string) {
  if(!FileSystem.cacheDirectory)throw new Error('export-cache-unavailable');
  return `${FileSystem.cacheDirectory}luvani-export-${Date.now()}-${++sequence}-${filename.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
}
export function trackNativeExport(uri:string,close?:()=>void) { nativeExportFiles.track(uri);if(close)closers.set(uri,close); }
