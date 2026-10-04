/** A deadline covers headers and streamed body, even for an uncooperative adapter. */
export async function boundedFetchJson(
  request: typeof fetch, url: string, init: RequestInit,
  options: { timeoutMs?: number; maxBytes?: number; signal?: AbortSignal; parse?:'json'|'ignore' } = {},
): Promise<{ status: number; headers: Headers; value: unknown }> {
  const timeout = options.timeoutMs ?? 5000; const maxBytes = options.maxBytes ?? 160 * 1024;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 30_000 || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 4 * 1024 * 1024) throw new Error('invalid-network-budget');
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal,...(init.signal ? [init.signal] : []),...(options.signal ? [options.signal] : [])]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort = (_error: unknown) => {};
  const abort = () => rejectAbort(new Error('network-operation-stopped'));
  const stopped = new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});
  signal.addEventListener('abort',abort,{once:true});
  try {
    if (signal.aborted) throw new Error('network-operation-stopped');
    timer = setTimeout(()=>controller.abort(),timeout);
    const operation = async () => {
      const response = await request(url,{...init,signal,redirect:'error'});
      if (signal.aborted) { void response.body?.cancel().catch(()=>{}); throw new Error('network-operation-stopped'); }
      const reader=response.body?.getReader(); const parts:Uint8Array[]=[];let bytes=0;
      if (reader) try {
        while(true) {
          const part=await reader.read();if(part.done)break;
          if(signal.aborted)throw new Error('network-operation-stopped');
          bytes+=part.value.byteLength;if(bytes>maxBytes)throw new Error('network-response-limit');parts.push(part.value);
        }
      } finally { void reader.cancel().catch(()=>{}); }
      const text = Buffer.concat(parts).toString('utf8');
      return {status:response.status,headers:response.headers,value:options.parse==='ignore' ? null : text ? JSON.parse(text) as unknown : null};
    };
    return await Promise.race([operation(),stopped]);
  } finally {
    if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);controller.abort();
  }
}
