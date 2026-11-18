-- Variant is a declaration, not an authorization or an Agenda.
begin;
create function public.guard_sanitary_strategic_calendar_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare old_value jsonb; new_value jsonb;
begin
 if tg_op <> 'INSERT' then old_value:=old.payload->'sanitary_strategic_calendar_v1'; end if;
 if tg_op='DELETE' then
   if old_value is not null then raise exception 'STRATEGIC_CALENDAR_DELETE_PROTECTED'; end if;
   return old;
 end if;
 if old_value is not null and jsonb_typeof(new.payload) is distinct from 'object' then raise exception 'STRATEGIC_CALENDAR_PAYLOAD_INVALID'; end if;
 if tg_op='UPDATE' and new.fazenda_id<>old.fazenda_id and old_value is not null then raise exception 'STRATEGIC_CALENDAR_FARM_IMMUTABLE'; end if;
 new_value:=new.payload->'sanitary_strategic_calendar_v1';
 if new_value is distinct from old_value and not exists (
   select 1 from public.sanitary_protocol_adoption_receipts_v1 r where r.fazenda_id=new.fazenda_id and r.authorized_tx=txid_current()
     and not r.namespace_written and r.receipt->>'status'='APPLIED' and r.receipt->'calendar'=new_value
 ) then
   new.payload:=coalesce(new.payload,'{}'::jsonb)-'sanitary_strategic_calendar_v1';
   if old_value is not null then new.payload:=new.payload||jsonb_build_object('sanitary_strategic_calendar_v1',old_value); end if;
 elsif new_value is distinct from old_value then
   update public.sanitary_protocol_adoption_receipts_v1 set namespace_written=true where fazenda_id=new.fazenda_id and authorized_tx=txid_current() and not namespace_written and receipt->'calendar'=new_value;
 end if;
 if old_value is not null and new.deleted_at is not null then raise exception 'STRATEGIC_CALENDAR_DELETE_PROTECTED'; end if;
 return new;
end $$;
revoke all on function public.guard_sanitary_strategic_calendar_v1() from public,anon,authenticated,service_role;
create trigger guard_sanitary_strategic_calendar_v1 before insert or update or delete on public.fazenda_sanidade_config for each row execute function public.guard_sanitary_strategic_calendar_v1();

create function public.set_sanitary_strategic_calendar_v1(p_command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid:=auth.uid(); farm uuid; operation uuid; expected bigint; current_revision bigint:=0; current_value jsonb; current_payload jsonb; result jsonb; preference jsonb; prior public.sanitary_protocol_adoption_receipts_v1%rowtype;
begin
 if actor is null then raise exception 'STRATEGIC_CALENDAR_UNAUTHENTICATED' using errcode='42501'; end if;
 if jsonb_typeof(p_command) is distinct from 'object' or p_command->'contract_version' is distinct from '1'::jsonb or p_command->>'domain' is distinct from 'sanitary_strategic_calendar_v1'
   or not(p_command ?& array['fazenda_id','client_op_id','client_tx_id','expected_revision','variant'])
   or exists(select 1 from jsonb_object_keys(p_command) k where k<>all(array['domain','contract_version','fazenda_id','client_op_id','client_tx_id','expected_revision','variant']))
   or p_command->>'variant' not in ('5-7-9','5-6-9') or p_command->>'variant' is null
   or jsonb_typeof(p_command->'expected_revision') is distinct from 'number' or p_command->>'expected_revision' !~ '^(0|[1-9][0-9]{0,14})$'
 then raise exception 'STRATEGIC_CALENDAR_INVALID'; end if;
 farm:=(p_command->>'fazenda_id')::uuid; operation:=(p_command->>'client_op_id')::uuid; perform (p_command->>'client_tx_id')::uuid;
 if not public.role_in_fazenda(farm,array['owner','manager']::public.farm_role_enum[]) then raise exception 'STRATEGIC_CALENDAR_FORBIDDEN' using errcode='42501'; end if;
 expected:=(p_command->>'expected_revision')::bigint;
 perform pg_advisory_xact_lock(hashtextextended('protocol-adoption-op:'||operation::text,0));
 select * into prior from public.sanitary_protocol_adoption_receipts_v1 where client_op_id=operation;
 if found then
   if prior.actor_user_id<>actor or prior.fazenda_id<>farm or prior.command<>p_command then raise exception 'STRATEGIC_CALENDAR_IDENTITY_REUSE'; end if;
   return prior.receipt;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('protocol-adoption-farm:'||farm::text,0));
 insert into public.fazenda_sanidade_config(fazenda_id) values(farm) on conflict(fazenda_id) do nothing;
 select payload into current_payload from public.fazenda_sanidade_config where fazenda_id=farm and deleted_at is null for update;
 if not found or jsonb_typeof(current_payload) is distinct from 'object' then raise exception 'STRATEGIC_CALENDAR_CONFIG_UNAVAILABLE'; end if;
 current_value:=current_payload->'sanitary_strategic_calendar_v1';
 if current_value is not null then
   if jsonb_typeof(current_value) is distinct from 'object' or current_value->'schemaVersion' is distinct from '1'::jsonb or
      jsonb_typeof(current_value->'revision') is distinct from 'number' or coalesce(current_value->>'revision','') !~ '^[1-9][0-9]{0,14}$' or
      coalesce(current_value->>'variant','') not in ('5-7-9','5-6-9') or current_value->>'provenance' is distinct from 'farm_declared' or
      nullif(current_value->>'declaredAt','') is null or nullif(current_value->>'declaredBy','') is null or coalesce(current_value->>'effectiveFrom','') !~ '^\d{4}-\d{2}-\d{2}$'
   then raise exception 'STRATEGIC_CALENDAR_CONFIG_UNAVAILABLE'; end if;
   current_revision:=(current_value->>'revision')::bigint;
 end if;
 if expected<>current_revision then result:=jsonb_build_object('status','CONFLICT','reason_code','STRATEGIC_CALENDAR_STALE_REVISION','revision',current_revision);
 else
   preference:=jsonb_build_object('schemaVersion',1,'revision',current_revision+1,'variant',p_command->>'variant','declaredAt',clock_timestamp(),'declaredBy',actor,'provenance','farm_declared','effectiveFrom',(clock_timestamp() at time zone 'America/Sao_Paulo')::date);
   result:=jsonb_build_object('status','APPLIED','reason_code','STRATEGIC_CALENDAR_APPLIED','calendar',preference);
 end if;
 insert into public.sanitary_protocol_adoption_receipts_v1(client_op_id,fazenda_id,actor_user_id,command,receipt,authorized_tx) values(operation,farm,actor,p_command,result,txid_current());
 if result->>'status'='APPLIED' then update public.fazenda_sanidade_config set payload=jsonb_set(payload,'{sanitary_strategic_calendar_v1}',preference),updated_at=clock_timestamp(),server_received_at=clock_timestamp() where fazenda_id=farm; end if;
 return result;
end $$;
revoke all on function public.set_sanitary_strategic_calendar_v1(jsonb) from public,anon,service_role;
grant execute on function public.set_sanitary_strategic_calendar_v1(jsonb) to authenticated;
commit;
