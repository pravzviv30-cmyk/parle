/** Browser exports stream to origin-private temporary files when supported. */
import { scopeGeneration } from '../storage/scope.ts';
import { trackWebExport,webExportDirectory } from '../progress/temporaryExportCache.ts';
export interface ExportFile { append(bytes: Uint8Array): Promise<void>; share(): Promise<void>; discard(): Promise<void> }
let sequence=0;
export async function createExportFile(expectedBytes:number):Promise<ExportFile> {
  if(!Number.isSafeInteger(expectedBytes) || expectedBytes<1 || expectedBytes>128*1024*1024)throw new Error('export-size-limit');
  const owner=scopeGeneration();const current=()=>owner===scopeGeneration();
  const filename=`luvani-export-${Date.now()}-${++sequence}-account-data.ndjson`;
  let append:(bytes:Uint8Array)=>Promise<void>;let finish:()=>Promise<Blob>;let remove:()=>Promise<void>;
  const dir=await webExportDirectory();if(!current())throw new Error('account-changed');
  if(dir) {
    let stream:FileSystemWritableFileStream|undefined;let closed=false;
    // Register before creating/opening: a failed cleanup is retried on reset.
    let prepared:Promise<FileSystemFileHandle>;
    remove=trackWebExport(filename,async()=>{
      await prepared.catch(()=>{});
      if(stream && !closed){await stream.abort();closed=true;}
      try{await dir.removeEntry(filename);}catch(error){if(!(error instanceof Error) || error.name!=='NotFoundError')throw error;}
    });
    prepared=(async()=>{const handle=await dir.getFileHandle(filename,{create:true});stream=await handle.createWritable();return handle;})();
    let handle:FileSystemFileHandle;
    try{handle=await prepared;if(!current())throw new Error('account-changed');}
    catch(error){await remove();throw error;}
    append=async bytes=>{if(closed || !stream)throw new Error('export-closed');await stream.write(new Uint8Array(bytes));};
    finish=async()=>{if(!stream || closed)throw new Error('export-closed');await stream.close();closed=true;return handle.getFile();};
  } else {
    if(expectedBytes>8*1024*1024)throw new Error('large-browser-export-requires-streaming-storage');
    const chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;
    append=async part=>{bytes+=part.byteLength;if(bytes>8*1024*1024)throw new Error('browser-export-limit');chunks.push(new Uint8Array(part));};
    finish=async()=>new Blob(chunks,{type:'application/x-ndjson'});
    remove=trackWebExport(filename,async()=>{chunks.length=0;});
  }
  let bytesWritten=0;let discardWork:Promise<void>|undefined;let discarded=false;
  const file:ExportFile={
    append:async bytes=>{
      if(discarded || bytes.byteLength>65536 || !current())throw new Error('invalid-export-write');
      bytesWritten+=bytes.byteLength;if(bytesWritten>136*1024*1024)throw new Error('export-size-limit');
      await append(bytes);if(!current())throw new Error('account-changed');
    },
    share:async()=>{
      if(discarded || !current())throw new Error('account-changed');const blob=await finish();if(!current())throw new Error('account-changed');
      const url=URL.createObjectURL(blob);try {const link=document.createElement('a');link.href=url;link.download='luvani-account-data.ndjson';link.click();}finally{URL.revokeObjectURL(url);}
    },
    discard:()=>{discardWork??=(async()=>{await remove();discarded=true;})().catch(error=>{discardWork=undefined;throw error;});return discardWork;},
  };
  if(!current()){await file.discard();throw new Error('account-changed');}return file;
}
