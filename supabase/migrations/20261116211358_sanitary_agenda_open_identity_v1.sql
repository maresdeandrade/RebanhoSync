begin;

-- NULL deliberately denotes a pre-existing agenda whose original cycle cannot
-- be established after an earlier reschedule. No historical row is rewritten.
alter table public.sanitario_agenda_v2
 add column strategic_cycle_year_v1 integer,
 add column strategic_family_v1 text,
 add column strategic_stage_v1 text;

create function public.sanitario_agenda_cycle_year_v1_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare root_id uuid; root_year integer; resolved_family text; resolved_item text; root_family text; root_stage text;
begin
 if tg_op='UPDATE' then
  if (new.strategic_cycle_year_v1,new.strategic_family_v1,new.strategic_stage_v1) is distinct from (old.strategic_cycle_year_v1,old.strategic_family_v1,old.strategic_stage_v1) then
   raise exception 'SANITARIO_CYCLE_IDENTITY_IMMUTABLE' using errcode='23514';
  end if;
  return new;
 end if;
 root_id:=nullif(current_setting('rebanhosync.sanitario_continuation_root',true),'')::uuid;
 if root_id is not null then
  select a.strategic_cycle_year_v1,a.strategic_family_v1,a.strategic_stage_v1 into root_year,root_family,root_stage from public.sanitario_agenda_v2 a
   where a.id=root_id and a.fazenda_id=new.fazenda_id;
  new.strategic_cycle_year_v1:=root_year;
  new.strategic_family_v1:=root_family;
  new.strategic_stage_v1:=root_stage;
 else
  new.strategic_cycle_year_v1:=extract(year from new.data_programada)::integer;
  select p.family_code into resolved_family from public.sanitario_protocolos_v2 p
   where p.id=coalesce(new.catalog_protocolo_v2_id,new.protocolo_id) for share;
  select i.logical_item_key into resolved_item from public.sanitario_protocolo_itens_versions_v2 i
   where i.id=coalesce(new.catalog_protocol_item_version_v2_id,new.protocol_item_version_id)
    and i.protocol_id=coalesce(new.catalog_protocolo_v2_id,new.protocolo_id) for share;
  new.strategic_family_v1:=coalesce(resolved_family,new.protocol_item_snapshot->>'familyCode');
  new.strategic_stage_v1:=case coalesce(resolved_item,new.protocol_item_snapshot->>'itemKey')
   when 'recria_maio' then 'may' when 'recria_julho' then 'middle'
   when 'declared_june' then 'middle' when 'recria_setembro' then 'september' end;
 end if;
 return new;
end $$;
revoke all on function public.sanitario_agenda_cycle_year_v1_guard() from public,anon,authenticated,service_role;
create trigger sanitario_agenda_cycle_year_v1_guard before insert or update on public.sanitario_agenda_v2
 for each row execute function public.sanitario_agenda_cycle_year_v1_guard();

-- Resolve the active catalog first. Snapshot is a conservative fallback only
-- for old references that no longer identify a canonical catalog row.
create function public.sanitario_agenda_strategic_identity_v1(p_agenda uuid,p_farm uuid)
returns table(family text,stage text,cycle_year integer)
language sql stable security invoker set search_path=pg_catalog,public as $$
 select case when a.strategic_cycle_year_v1 is not null then a.strategic_family_v1
  when p.family_code='controle_parasitario_recria_5_7_9' or a.protocol_item_snapshot->>'familyCode'='controle_parasitario_recria_5_7_9' then 'controle_parasitario_recria_5_7_9'
  else coalesce(p.family_code,a.protocol_item_snapshot->>'familyCode') end,
  case when a.strategic_cycle_year_v1 is not null then a.strategic_stage_v1
   when i.logical_item_key is not null and a.protocol_item_snapshot->>'itemKey' is not null and i.logical_item_key <> a.protocol_item_snapshot->>'itemKey' then null
   else case coalesce(i.logical_item_key,a.protocol_item_snapshot->>'itemKey')
   when 'recria_maio' then 'may' when 'recria_julho' then 'middle'
   when 'declared_june' then 'middle' when 'recria_setembro' then 'september' end end,
  a.strategic_cycle_year_v1
 from public.sanitario_agenda_v2 a
 left join public.sanitario_protocolos_v2 p on p.id=a.catalog_protocolo_v2_id
 left join public.sanitario_protocolo_itens_versions_v2 i on i.id=a.catalog_protocol_item_version_v2_id and i.protocol_id=p.id
 where a.id=p_agenda and a.fazenda_id=p_farm
$$;
revoke all on function public.sanitario_agenda_strategic_identity_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.sanitario_agenda_strategic_identity_v1(uuid,uuid) to service_role;

alter function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) rename to internal_sanitario_admit_v3_before_open_identity;
create function public.internal_sanitario_admit_v3(actor_user_id uuid,fazenda_id uuid,command text,operation_args jsonb,receipt_only boolean default false)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
#variable_conflict use_variable
declare receipt jsonb; result jsonb; target uuid; ident record; conflict_animal uuid; conflict_agenda uuid;
begin
 if command not in ('create_agenda','replace_agenda_animals','reschedule_agenda') and not coalesce(command='manage_agenda' and operation_args->'payload'->>'action'='decide_continuation',false) then
  return public.internal_sanitario_admit_v3_before_open_identity(actor_user_id,fazenda_id,command,operation_args,receipt_only);
 end if;
 -- The existing admission performs authentication, context validation and the
 -- immutable receipt lookup before the new-write lock and conflict guard.
 receipt:=public.internal_sanitario_admit_v3_before_open_identity(actor_user_id,fazenda_id,command,operation_args,true);
 if receipt_only then return receipt; end if;
 if receipt->>'outcome'='found' then return receipt->'canonical_result'; end if;
 perform pg_advisory_xact_lock(hashtextextended('sanitario:open-strategic-v1:'||fazenda_id::text,0));
 result:=public.internal_sanitario_admit_v3_before_open_identity(actor_user_id,fazenda_id,command,operation_args,false);
 target:=case when command='create_agenda' then (operation_args->'payload'->>'id')::uuid when command='manage_agenda' then (result->>'continuation_id')::uuid else (operation_args->>'agenda_id')::uuid end;
 -- June is a contextual proposal without an approved catalog/window contract.
 -- A lost-ACK receipt has already returned above; existing agendas remain intact.
 if command='create_agenda' and exists (
  select 1 from public.sanitario_agenda_v2 a
  left join public.sanitario_protocolo_itens_versions_v2 i on i.id=a.catalog_protocol_item_version_v2_id
  where a.id=target and a.fazenda_id=fazenda_id
   and (a.protocol_item_snapshot->>'itemKey'='declared_june' or i.logical_item_key='declared_june')
 ) then raise exception 'SANITARIO_CONTEXTUAL_JUNE_NOT_ENABLED' using errcode='55000'; end if;
 select * into ident from public.sanitario_agenda_strategic_identity_v1(target,fazenda_id);
 if ident.family='controle_parasitario_recria_5_7_9' or ident.family is null then
  select aa.animal_id,other.id into conflict_animal,conflict_agenda
  from public.sanitario_agenda_v2 other
  cross join lateral public.sanitario_agenda_strategic_identity_v1(other.id,fazenda_id) oi
  left join public.sanitario_agenda_animais_v2 aa on aa.agenda_id=target and aa.fazenda_id=fazenda_id
  where other.fazenda_id=fazenda_id and other.id<>target and other.status='programada' and other.deleted_at is null
   and (ident.family='controle_parasitario_recria_5_7_9' or oi.family='controle_parasitario_recria_5_7_9')
   and (oi.family=ident.family or oi.family is null or (ident.family is null and oi.family='controle_parasitario_recria_5_7_9'))
   and (oi.stage is null or ident.stage is null or oi.stage=ident.stage)
   and (oi.cycle_year is null or ident.cycle_year is null or oi.cycle_year=ident.cycle_year)
   and (aa.animal_id is null or exists(select 1 from public.sanitario_agenda_animais_v2 oa where oa.fazenda_id=fazenda_id and oa.agenda_id=other.id and oa.animal_id=aa.animal_id)
    or not exists(select 1 from public.sanitario_agenda_animais_v2 oa where oa.fazenda_id=fazenda_id and oa.agenda_id=other.id))
  order by aa.animal_id,other.id limit 1;
  if conflict_agenda is not null then
   raise exception 'SANITARIO_OPEN_OBLIGATION_CONFLICT animal_id=% agenda_id=%',conflict_animal,conflict_agenda using errcode='23505';
  end if;
 end if;
 return result;
end $$;
revoke all on function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) to service_role;
commit;
