/** Deterministic application catalog from every migration. No hosted connection. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

// Same query may be executed read-only by an operator in the hosted database.
// Managed Auth/Storage schemas are deliberately separate from app-owned objects.
export const CATALOG_SQL = String.raw`
select jsonb_build_object(
 'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypassRls',rolbypassrls) order by rolname)
   from pg_roles where rolname in ('anon','authenticated','service_role')),
 'schemas',(select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname,'privileges',
   (select jsonb_object_agg(r,jsonb_build_object('usage',has_schema_privilege(r,n.oid,'USAGE'),'create',has_schema_privilege(r,n.oid,'CREATE')))
    from unnest(array['anon','authenticated','service_role']) r)) order by n.nspname),'[]')
   from pg_namespace n where n.nspname in ('public','luvani_private')),
 'tables',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
   'columns',(select coalesce(jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
     'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),
     'privileges',(select jsonb_object_agg(r,jsonb_build_object('select',has_column_privilege(r,c.oid,a.attnum,'SELECT'),
       'insert',has_column_privilege(r,c.oid,a.attnum,'INSERT'),'update',has_column_privilege(r,c.oid,a.attnum,'UPDATE'),'references',has_column_privilege(r,c.oid,a.attnum,'REFERENCES')))
       from unnest(array['anon','authenticated','service_role']) r)) order by a.attnum),'[]')
     from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',co.conname,'type',co.contype,'definition',pg_get_constraintdef(co.oid,true),'validated',co.convalidated) order by co.conname),'[]') from pg_constraint co where co.conrelid=c.oid),
   'indexes',(select coalesce(jsonb_agg(jsonb_build_object('name',ic.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready) order by ic.relname),'[]') from pg_index i join pg_class ic on ic.oid=i.indexrelid where i.indrelid=c.oid),
   'triggers',(select coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,true)) order by t.tgname),'[]') from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),
   'privileges',(select jsonb_object_agg(r,jsonb_build_object('select',has_table_privilege(r,c.oid,'SELECT'),'insert',has_table_privilege(r,c.oid,'INSERT'),
     'update',has_table_privilege(r,c.oid,'UPDATE'),'delete',has_table_privilege(r,c.oid,'DELETE'),'truncate',has_table_privilege(r,c.oid,'TRUNCATE'),
     'references',has_table_privilege(r,c.oid,'REFERENCES'),'trigger',has_table_privilege(r,c.oid,'TRIGGER'))) from unnest(array['anon','authenticated','service_role']) r)
   ) order by n.nspname,c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','luvani_private') and c.relkind in ('r','p','v','m','f')),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname),'[]') from pg_policies p where p.schemaname in ('public','luvani_private')),
 'routines',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
   'result',pg_get_function_result(p.oid),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'configuration',p.proconfig,
   'definitionMd5',md5(pg_get_functiondef(p.oid)),
   'execute',(select jsonb_object_agg(r,has_function_privilege(r,p.oid,'EXECUTE')) from unnest(array['anon','authenticated','service_role']) r))
   order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','luvani_private') and p.prokind in ('f','p')),
 'sequences',(select coalesce(jsonb_agg(jsonb_build_object('schema',s.schemaname,'name',s.sequencename,'type',s.data_type,'start',s.start_value,
   'minimum',s.min_value,'maximum',s.max_value,'increment',s.increment_by,'cycle',s.cycle,'cache',s.cache_size,
   'privileges',(select jsonb_object_agg(r,jsonb_build_object('usage',has_sequence_privilege(r,quote_ident(s.schemaname)||'.'||quote_ident(s.sequencename),'USAGE'),
     'select',has_sequence_privilege(r,quote_ident(s.schemaname)||'.'||quote_ident(s.sequencename),'SELECT'),'update',has_sequence_privilege(r,quote_ident(s.schemaname)||'.'||quote_ident(s.sequencename),'UPDATE')))
     from unnest(array['anon','authenticated','service_role']) r)) order by s.schemaname,s.sequencename),'[]') from pg_sequences s where s.schemaname in ('public','luvani_private')),
 'defaultPrivileges',(select coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',coalesce(n.nspname,'*'),'kind',d.defaclobjtype,
   'acl',(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable)
     order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) from aclexplode(d.defaclacl) a)) order by pg_get_userbyid(d.defaclrole),coalesce(n.nspname,'*'),d.defaclobjtype),'[]')
   from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclnamespace=0 or n.nspname in ('public','luvani_private'))
) as catalog;
`;

export async function migrationInventory(root = ROOT) {
  const directory = resolve(root, 'supabase/migrations');
  const names = (await readdir(directory)).filter(n => n.endsWith('.sql')).sort();
  if (!names.length || names.some(n => !/^\d{12,14}_[a-z0-9_]+\.sql$/.test(n))) throw new Error('invalid migration inventory');
  if (new Set(names.map(n => n.split('_')[0])).size !== names.length) throw new Error('duplicate migration version');
  return Promise.all(names.map(async name => {
    const bytes = await readFile(resolve(directory,name));
    if (!bytes.length) throw new Error(`empty migration: ${name}`);
    return { name, version: name.split('_')[0], sha256: sha256(bytes) };
  }));
}

export async function buildSchemaManifest(root = ROOT) {
  const migrations = await migrationInventory(root);
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
    for (const item of migrations) await db.exec(await readFile(resolve(root,'supabase/migrations',item.name),'utf8'));
    const catalog = (await db.query(CATALOG_SQL)).rows[0].catalog;
    const critical = ['active_tutor_identity_v1','reserve_tutor_session_v1','claim_tutor_session_v1','checkpoint_tutor_session_v1',
      'complete_tutor_session_v1','abandon_tutor_session_v1','receipt_tutor_session_v1','reconcile_tutor_sessions_v1',
      'fence_tutor_account_v1','tutor_session_schema_v1','begin_account_erasure_v1','claim_account_erasure_v1',
      'advance_account_erasure_v1','configure_privacy_processor_v1','publish_backend_heartbeat_v1','backend_status_v1','backend_catalog_v1','run_data_retention_v1',
      'export_account_data','configure_account_export_v2','prepare_account_export_v2','account_export_part_v2','purge_account_export_v2','cleanup_account_exports_v2'];
    for (const name of critical) {
      const rpc = catalog.routines.find(r => r.schema==='public' && r.name===name);
      if (!rpc || !rpc.securityDefiner || !rpc.configuration?.includes('search_path=""') || rpc.execute.anon || rpc.execute.authenticated || !rpc.execute.service_role) throw new Error(`unsafe or missing critical RPC: ${name}`);
    }
    if (catalog.tables.some(t => ['r','p'].includes(t.kind) && !t.rls)) throw new Error('application table without RLS');
    return { version:1, migrationCount:migrations.length, migrations, catalog, catalogSha256:sha256(canonical(catalog)),
      replay:{kind:'disposable-sequential-PGlite',postgresVersion:(await db.query('show server_version')).rows[0].server_version,hostedVerified:false,concurrentVerified:false},
      managedAuthContract:{schemas:['auth','storage'],authUserFields:['id','banned_until','deleted_at'],authSessionFields:['id','user_id','not_after'],
        note:'Minimal platform fixture only. Hosted Auth/config/roles/extensions/storage and independent concurrency require separate acceptance.'} };
  } finally { await db.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if (args[0]==='--sql' && args.length===2) await writeFile(resolve(args[1]),CATALOG_SQL,{flag:'wx',mode:0o600});
  else if (args[0]==='--output' && args.length===2) {
    const manifest=await buildSchemaManifest();
    await writeFile(resolve(args[1]),`${JSON.stringify(manifest,null,2)}\n`,{flag:'wx',mode:0o600});
    console.log(`schema: ${manifest.migrationCount} migrations, ${manifest.catalog.tables.length} tables, ${manifest.catalog.routines.length} routines; sha256:${manifest.catalogSha256}`);
  } else throw new Error('Usage: node scripts/releaseSchemaManifest.mjs --output NEW_FILE | --sql NEW_FILE');
}
