/** Validate the full Choice distribution before consuming its selected probability. */
export function selectedChoiceProbability(value:unknown,options:readonly string[]): {id:string;probability:number}|null {
  if (!value||typeof value!=='object'||Array.isArray(value)||new Set(options).size!==options.length) return null;
  const row=value as Record<string,unknown>;
  if (row.type!=='choice'||typeof row.choice!=='string'||!options.includes(row.choice)
    ||typeof row.confidence!=='number'||!Number.isFinite(row.confidence)||row.confidence<0||row.confidence>1
    ||!row.probabilities||typeof row.probabilities!=='object'||Array.isArray(row.probabilities)) return null;
  const p=row.probabilities as Record<string,unknown>;
  if (Object.keys(p).length!==options.length||!Object.keys(p).every(key=>options.includes(key))) return null;
  let sum=0;for (const key of options) {const n=p[key];if (typeof n!=='number'||!Number.isFinite(n)||n<0||n>1) return null;sum+=n;}
  const probability=p[row.choice] as number;
  return Math.abs(sum-1)<=0.000001&&options.every(key=>Number(p[key])<=probability)?{id:row.choice,probability}:null;
}
