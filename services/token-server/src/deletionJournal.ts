/** Encrypted erasure ledger stored independently of database backups. */
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface DeletionJournal { record(userId: string): Promise<void> }
export interface JournalConfig { endpoint: string; token: string; key: string; projectUrl: string }
/** Contract: conditional immutable PUT; bounded authenticated GET/list; TLS. */
export function deletionJournal(config: JournalConfig, request: typeof fetch = fetch, options:{timeoutMs?:number;maxRecords?:number}={}) {
  const endpoint = new URL(config.endpoint);
  const source=new URL(config.projectUrl);
  const timeoutMs=options.timeoutMs ?? 5000;
  const maxRecords=options.maxRecords ?? 10_000_000;
  if(!Number.isSafeInteger(maxRecords) || maxRecords<0 || maxRecords>10_000_000)throw new Error('invalid-journal-replay-limit');
  if(source.protocol!=='https:' || source.origin!==config.projectUrl.replace(/\/+$/,'') || !Number.isInteger(timeoutMs) || timeoutMs<1 || timeoutMs>5000)throw new Error('invalid-deletion-journal-configuration');
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
    || config.token.length < 32 || !/^[A-Za-z0-9_-]{43}$/.test(config.key)) throw new Error('invalid-deletion-journal-configuration');
  const master = Buffer.from(config.key, 'base64url');
  if (master.length !== 32 || master.toString('base64url') !== config.key) throw new Error('invalid-deletion-journal-key');
  const encryption = Buffer.from(hkdfSync('sha256', master, '', 'luvani-erasure-encryption-v1', 32));
  const indexKey = Buffer.from(hkdfSync('sha256', master, '', 'luvani-erasure-index-v1', 32));
  const project = createHash('sha256').update(config.projectUrl.replace(/\/+$/, '')).digest('hex');
  const root = endpoint.href.replace(/\/+$/, '');
  const nameFor = (userId: string) => createHmac('sha256', indexKey).update(`${project}:${userId.toLowerCase()}`).digest('hex');
  async function bounded(path: string, init: RequestInit = {}): Promise<{ status: number; body: string }> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = async () => {
      const response = await request(`${root}${path}`, { ...init, headers: { authorization: `Bearer ${config.token}`, ...init.headers }, signal: controller.signal, redirect: 'error' });
      const reader = response.body?.getReader();
      const parts: Uint8Array[] = []; let bytes = 0;
      if (reader) try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 16_384) throw new Error('journal-response-limit');
          parts.push(chunk.value);
        }
      } finally { void reader.cancel().catch(() => {}); }
      return { status: response.status, body: Buffer.concat(parts).toString('utf8') };
    };
    try {
      return await Promise.race([operation(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('journal-timeout')); }, timeoutMs); })]);
    } finally { if (timer) clearTimeout(timer); controller.abort(); }
  }
  function unpack(name: string, text: string): string {
    if (!/^[a-f0-9]{64}$/.test(name) || Buffer.byteLength(text) > 2048) throw new Error('invalid-journal-record');
    const value = JSON.parse(text);
    if (value?.version !== 1 || Object.keys(value).length !== 4
      || !['nonce','ciphertext','tag'].every(k => typeof value[k] === 'string' && /^[A-Za-z0-9_-]+$/.test(value[k]))) throw new Error('invalid-journal-record');
    const nonce = Buffer.from(value.nonce, 'base64url'); const tag = Buffer.from(value.tag, 'base64url');
    if (nonce.length !== 12 || tag.length !== 16) throw new Error('invalid-journal-record');
    const decipher = createDecipheriv('aes-256-gcm', encryption, nonce);
    decipher.setAAD(Buffer.from(`luvani-erasure-v1:${project}:${name}`)); decipher.setAuthTag(tag);
    const record = JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64url')), decipher.final()]).toString('utf8'));
    if (record?.version !== 1 || record.project !== project || !uuid.test(record.userId) || nameFor(record.userId) !== name
      || typeof record.requestedAt !== 'string' || !Number.isFinite(Date.parse(record.requestedAt))) throw new Error('invalid-journal-record');
    return record.userId;
  }
  async function read(name: string) {
    const response = await bounded(`/records/${name}`);
    if (response.status !== 200) throw new Error('journal-read-unavailable');
    return unpack(name, response.body);
  }
  return {
    async record(userId: string): Promise<void> {
      if (!uuid.test(userId)) throw new Error('invalid-erasure-owner');
      const owner = userId.toLowerCase(); const name = nameFor(owner); const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encryption, nonce);
      cipher.setAAD(Buffer.from(`luvani-erasure-v1:${project}:${name}`));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ version: 1, project, userId: owner, requestedAt: new Date().toISOString() }), 'utf8'), cipher.final()]);
      const response = await bounded(`/records/${name}`, { method: 'PUT', headers: { 'content-type': 'application/json', 'if-none-match': '*' },
        body: JSON.stringify({ version: 1, nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') }) });
      if (![201, 409, 412].includes(response.status)) throw new Error('journal-write-unavailable');
      if (await read(name) !== owner) throw new Error('journal-owner-mismatch');
    },
    /** Replay a provider-sealed immutable listing. Live keyset EOF is insufficient. */
    async replay(apply: (userId: string) => Promise<void>, onVerified?: (snapshot:{snapshotId:string;project:string;totalRecords:number;keysSha256:string;expiresAt:string})=>void): Promise<number> {
      const sealed=await bounded('/snapshots',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({version:1,project})});
      if(sealed.status!==201)throw new Error('journal-snapshot-unavailable');
      const snapshot=JSON.parse(sealed.body);
      if(snapshot?.version!==1 || !uuid.test(snapshot.snapshotId) || snapshot.project!==project || !Number.isSafeInteger(snapshot.totalRecords)
        || snapshot.totalRecords<0 || snapshot.totalRecords>maxRecords || typeof snapshot.keysSha256!=='string' || !/^[a-f0-9]{64}$/.test(snapshot.keysSha256)
        || typeof snapshot.expiresAt!=='string' || !Number.isFinite(Date.parse(snapshot.expiresAt)) || Date.parse(snapshot.expiresAt)<=Date.now())throw new Error('invalid-journal-snapshot');
      let cursor: string | null = null; let count = 0;
      let pages = 0;
      const keysHash=createHash('sha256');
      do {
        if(Date.parse(snapshot.expiresAt)<=Date.now())throw new Error('journal-snapshot-expired');
        const response = await bounded(`/snapshots/${snapshot.snapshotId}/records${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`);
        if (response.status !== 200) throw new Error('journal-list-unavailable');
        const page = JSON.parse(response.body);
        if (page?.snapshotId!==snapshot.snapshotId || !Array.isArray(page.keys) || page.keys.length > 100 || !page.keys.every((key: unknown) => typeof key === 'string' && /^[a-f0-9]{64}$/.test(key))
          || (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !/^[a-f0-9]{64}$/.test(page.nextCursor) || page.nextCursor !== page.keys.at(-1)))
          || (page.keys.length === 0 && page.nextCursor !== null)) throw new Error('invalid-journal-page');
        let previous = cursor ?? '';
        for (const name of page.keys) {
          if (name <= previous) throw new Error('journal-key-order');
          keysHash.update(Buffer.from(name,'hex'));
          await apply(await read(name)); count++; previous = name;
        }
        cursor = page.nextCursor;
        if (++pages > 100_000) throw new Error('journal-page-limit');
      } while (cursor !== null);
      if(Date.parse(snapshot.expiresAt)<=Date.now())throw new Error('journal-snapshot-expired');
      if(count!==snapshot.totalRecords || keysHash.digest('hex')!==snapshot.keysSha256)throw new Error('journal-snapshot-incomplete');
      onVerified?.({snapshotId:snapshot.snapshotId,project,totalRecords:count,keysSha256:snapshot.keysSha256,expiresAt:snapshot.expiresAt});
      return count;
    },
  };
}
export function journalFromEnv(env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch) {
  const { LUVANI_DELETION_JOURNAL_URL: endpoint, LUVANI_DELETION_JOURNAL_TOKEN: token, LUVANI_DELETION_JOURNAL_KEY: key, LUVANI_DELETION_JOURNAL_PROJECT_URL: projectUrl } = env;
  if (!endpoint || !token || !key || !projectUrl) throw new Error('deletion-journal-required');
  return deletionJournal({ endpoint, token, key, projectUrl }, request);
}
