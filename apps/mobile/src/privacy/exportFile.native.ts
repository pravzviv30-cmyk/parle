/** Expo57 FileHandle appends verified fragments without a whole-account JS string. */
import { File, FileMode } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { scopeGeneration, writeInUserScope } from '../storage/scope.ts';
import { nativeExportFiles, nativeExportUri, recoverNativeExports, trackNativeExport } from '../progress/temporaryExportCache.native.ts';
import type { ExportFile } from './exportFile.ts';
export async function createExportFile(expectedBytes:number):Promise<ExportFile> {
  if(!Number.isSafeInteger(expectedBytes) || expectedBytes<1 || expectedBytes>144*1024*1024)throw new Error('export-size-limit');
  const owner=scopeGeneration();const current=()=>owner===scopeGeneration();
  await recoverNativeExports();if(!current())throw new Error('account-changed');
  if(!await Sharing.isAvailableAsync() || !current())throw new Error('sharing-unavailable');
  const uri=nativeExportUri('account-data.ndjson');const file=new File(uri);trackNativeExport(uri);
  let handle:ReturnType<File['open']>;
  try {file.create({overwrite:false});handle=file.open(FileMode.WriteOnly);}
  catch(error){await nativeExportFiles.discard(uri);throw error;}
  let closed=false;let bytes=0;
  const close=()=>{if(!closed){handle.close();closed=true;}};trackNativeExport(uri,close);
  let discardWork:Promise<void>|undefined;
  return {
    append:async part=>{
      if(part.byteLength>65536 || closed || !current())throw new Error('invalid-export-write');
      bytes+=part.byteLength;if(bytes>144*1024*1024)throw new Error('export-size-limit');
      if(!await writeInUserScope(owner,async()=>{handle.writeBytes(part);}))throw new Error('account-changed');
    },
    share:async()=>{if(!current())throw new Error('account-changed');close();await Sharing.shareAsync(uri,{mimeType:'application/x-ndjson',dialogTitle:'Luvani account data'});if(!current())throw new Error('account-changed');},
    discard:()=>{discardWork??=nativeExportFiles.discard(uri).catch(error=>{discardWork=undefined;throw error;});return discardWork;},
  };
}
