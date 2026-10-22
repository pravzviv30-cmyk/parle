import {PaidAdmissionError,validBindingKinds,PAID_ACTIVITIES,type PaidActivity,type PaidQuoteBinding} from './paidAdmission.ts';
export function paidBindings(env:Record<string,string|undefined>):Partial<Record<PaidActivity,PaidQuoteBinding>> {
 const raw=env.LUVANI_PAID_QUOTE_BINDINGS;if(!raw)return {};
 if(Buffer.byteLength(raw)>8192)throw new PaidAdmissionError('quote-mismatch');
 const value:unknown=JSON.parse(raw);if(!value || typeof value!=='object' || Array.isArray(value))throw new PaidAdmissionError('quote-mismatch');
 for(const [key,binding] of Object.entries(value)) {
  if(!PAID_ACTIVITIES.includes(key as PaidActivity) || !binding || typeof binding!=='object' || Array.isArray(binding) || !['configurationSha256,quoteId','configurationSha256,kinds,quoteId'].includes(Object.keys(binding).sort().join(',')) || ('kinds' in binding && !validBindingKinds(binding.kinds))
   || typeof binding.quoteId!=='string' || typeof binding.configurationSha256!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(binding.quoteId??'') || !/^[a-f0-9]{64}$/.test(binding.configurationSha256??''))throw new PaidAdmissionError('quote-mismatch');
 }
 return value as Partial<Record<PaidActivity,PaidQuoteBinding>>;
}
