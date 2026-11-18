-- Additive preference namespace; no Agenda, factual V3 or activation changes.
begin;
create table public.sanitary_protocol_adoption_receipts_v1 (
 client_op_id uuid primary key,
 fazenda_id uuid not null references public.fazendas(id),
 actor_user_id uuid not null references auth.users(id),
 command jsonb not null,
 receipt jsonb not null,
 authorized_tx bigint not null,
 namespace_written boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.sanitary_protocol_adoption_receipts_v1 enable row level security;
revoke all on public.sanitary_protocol_adoption_receipts_v1 from public, anon, authenticated, service_role;

-- No caller-settable GUC can authorize the namespace: only a transaction-local
-- receipt inserted by the dedicated definer function authorizes its exact value.
create function public.guard_sanitary_protocol_adoption_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_new jsonb; v_old jsonb;
begin
 if TG_OP <> 'INSERT' then v_old := old.payload->'sanitary_protocol_adoption_v1'; end if;
 if TG_OP = 'DELETE' then
   if v_old is not null then raise exception 'PROTOCOL_ADOPTION_DELETE_PROTECTED'; end if;
   return old;
 end if;
 if v_old is not null and jsonb_typeof(new.payload) is distinct from 'object' then
   raise exception 'PROTOCOL_ADOPTION_PAYLOAD_INVALID';
 end if;
 v_new := new.payload->'sanitary_protocol_adoption_v1';
 if TG_OP = 'UPDATE' and new.fazenda_id <> old.fazenda_id and v_old is not null then
   raise exception 'PROTOCOL_ADOPTION_FARM_IMMUTABLE';
 end if;
 if v_new is distinct from v_old and not exists (
   select 1 from public.sanitary_protocol_adoption_receipts_v1 r
   where r.fazenda_id = new.fazenda_id and r.authorized_tx = txid_current()
   and not r.namespace_written and r.receipt->>'status' = 'APPLIED' and r.receipt->'adoption' = v_new
 ) then
   new.payload := coalesce(new.payload,'{}'::jsonb) - 'sanitary_protocol_adoption_v1';
   if v_old is not null then new.payload := new.payload || jsonb_build_object('sanitary_protocol_adoption_v1',v_old); end if;
 elsif v_new is distinct from v_old then
   update public.sanitary_protocol_adoption_receipts_v1 set namespace_written=true
   where fazenda_id=new.fazenda_id and authorized_tx=txid_current()
   and not namespace_written and receipt->'adoption'=v_new;
 end if;
 if v_old is not null and new.deleted_at is not null then
   raise exception 'PROTOCOL_ADOPTION_DELETE_PROTECTED';
 end if;
 return new;
end $$;
revoke all on function public.guard_sanitary_protocol_adoption_v1() from public, anon, authenticated, service_role;
create trigger guard_sanitary_protocol_adoption_v1 before insert or update or delete
on public.fazenda_sanidade_config for each row execute function public.guard_sanitary_protocol_adoption_v1();

create function public.set_sanitary_protocol_adoption_v1(p_command jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
 v_actor uuid := auth.uid(); v_farm uuid; v_op uuid; v_expected bigint;
 v_revision bigint := 0; v_current jsonb; v_adoption jsonb; v_receipt jsonb; v_payload jsonb;
 v_existing public.sanitary_protocol_adoption_receipts_v1%rowtype;
 v_codes text[] := array['brucelose_b19','clostridioses','raiva_herbivoros','ibr_bvd','leptospirose','vermifugacao_pre_desmama','matrizes_pre_parto','controle_parasitario_recria_5_7_9','vermifugacao_pre_confinamento_pasto_vedado'];
begin
 if v_actor is null then raise exception 'PROTOCOL_ADOPTION_UNAUTHENTICATED' using errcode='42501'; end if;
 if jsonb_typeof(p_command) is distinct from 'object' or p_command->'contract_version' is distinct from '1'::jsonb or
   p_command->>'domain' is distinct from 'sanitary_protocol_adoption_v1' or
   not (p_command ?& array['fazenda_id','client_op_id','client_tx_id','expected_revision','families']) or
   exists(select 1 from jsonb_object_keys(p_command) k where k <> all(array['domain','contract_version','fazenda_id','client_op_id','client_tx_id','expected_revision','families'])) then
   raise exception 'PROTOCOL_ADOPTION_INVALID';
 end if;
 v_farm := (p_command->>'fazenda_id')::uuid;
 v_op := (p_command->>'client_op_id')::uuid;
 perform (p_command->>'client_tx_id')::uuid;
 if not public.role_in_fazenda(v_farm,array['owner','manager']::public.farm_role_enum[]) then
   raise exception 'PROTOCOL_ADOPTION_FORBIDDEN' using errcode='42501';
 end if;
 if jsonb_typeof(p_command->'expected_revision') is distinct from 'number' or
    (p_command->>'expected_revision') !~ '^(0|[1-9][0-9]{0,14})$' or
    jsonb_typeof(p_command->'families') is distinct from 'object' then raise exception 'PROTOCOL_ADOPTION_INVALID'; end if;
 v_expected := (p_command->>'expected_revision')::bigint;
 if (select count(*) from jsonb_object_keys(p_command->'families')) <> 9 or
   exists(select 1 from jsonb_each(p_command->'families') f where
     f.key <> all(v_codes) or jsonb_typeof(f.value) <> 'object' or
     not(f.value ? 'monitoringEnabled') or
     jsonb_typeof(f.value->'monitoringEnabled') <> 'boolean' or
     f.value - 'monitoringEnabled' <> '{}'::jsonb) then raise exception 'PROTOCOL_ADOPTION_INVALID_FAMILIES'; end if;
 -- Serialize identity globally and farm state, including initially absent config.
 perform pg_advisory_xact_lock(hashtextextended('protocol-adoption-op:'||v_op::text,0));
 select * into v_existing from public.sanitary_protocol_adoption_receipts_v1 where client_op_id=v_op;
 if found then
   if v_existing.actor_user_id <> v_actor or v_existing.fazenda_id <> v_farm or v_existing.command <> p_command then
     raise exception 'PROTOCOL_ADOPTION_IDENTITY_REUSE';
   end if;
   return v_existing.receipt;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('protocol-adoption-farm:'||v_farm::text,0));
 insert into public.fazenda_sanidade_config(fazenda_id) values(v_farm) on conflict(fazenda_id) do nothing;
 select payload into v_payload
 from public.fazenda_sanidade_config where fazenda_id=v_farm and deleted_at is null for update;
 if not found then raise exception 'PROTOCOL_ADOPTION_CONFIG_UNAVAILABLE'; end if;
 if jsonb_typeof(v_payload) is distinct from 'object' then raise exception 'PROTOCOL_ADOPTION_CONFIG_UNAVAILABLE'; end if;
 v_current := v_payload->'sanitary_protocol_adoption_v1';
 if v_current->'schemaVersion' = '1'::jsonb and jsonb_typeof(v_current->'revision')='number' and
    v_current->>'revision' ~ '^[1-9][0-9]{0,14}$' and jsonb_typeof(v_current->'families')='object' then
   if (select count(*) from jsonb_object_keys(v_current->'families'))=9 and
     not exists(select 1 from jsonb_each(v_current->'families') f where
       f.key <> all(v_codes) or jsonb_typeof(f.value) is distinct from 'object' or
       jsonb_typeof(f.value->'monitoringEnabled') is distinct from 'boolean') then
     v_revision := (v_current->>'revision')::bigint;
   end if;
 end if;
 if v_current is not null and v_revision = 0 then
   raise exception 'PROTOCOL_ADOPTION_CONFIG_UNAVAILABLE';
 end if;
 if v_expected <> v_revision then
   v_receipt := jsonb_build_object('status','CONFLICT','reason_code','PROTOCOL_ADOPTION_STALE_REVISION','revision',v_revision);
 else
   v_adoption := jsonb_build_object('schemaVersion',1,'revision',v_revision+1,'families',p_command->'families','updatedBy',v_actor,'updatedAt',clock_timestamp());
   v_receipt := jsonb_build_object('status','APPLIED','reason_code','PROTOCOL_ADOPTION_APPLIED','adoption',v_adoption);
 end if;
 insert into public.sanitary_protocol_adoption_receipts_v1(client_op_id,fazenda_id,actor_user_id,command,receipt,authorized_tx)
 values(v_op,v_farm,v_actor,p_command,v_receipt,txid_current());
 if v_receipt->>'status'='APPLIED' then
   update public.fazenda_sanidade_config set payload=jsonb_set(coalesce(payload,'{}'::jsonb),'{sanitary_protocol_adoption_v1}',v_adoption),updated_at=clock_timestamp(),server_received_at=clock_timestamp()
   where fazenda_id=v_farm;
 end if;
 return v_receipt;
end $$;
revoke all on function public.set_sanitary_protocol_adoption_v1(jsonb) from public, anon, service_role;
grant execute on function public.set_sanitary_protocol_adoption_v1(jsonb) to authenticated;
commit;
