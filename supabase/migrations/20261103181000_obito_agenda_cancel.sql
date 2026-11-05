begin;

create table public.obito_agenda_receipts (
  fazenda_id uuid not null references public.fazendas(id),
  client_op_id uuid not null,
  client_tx_id uuid not null,
  client_id text not null,
  actor_user_id uuid not null references auth.users(id),
  agenda_id uuid not null,
  animal_id uuid not null,
  death_event_id uuid not null,
  result jsonb not null check (jsonb_typeof(result)='object'),
  created_at timestamptz not null default now(),
  primary key (fazenda_id,client_op_id)
);

alter table public.obito_agenda_receipts enable row level security;
revoke all on public.obito_agenda_receipts from public,anon,authenticated;
grant select,insert on public.obito_agenda_receipts to service_role;

create function public.internal_obito_agenda_cancel(
  actor_user_id uuid,fazenda_id uuid,agenda_id uuid,animal_id uuid,death_event_id uuid,
  client_op_id uuid,client_tx_id uuid,client_id text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
#variable_conflict use_variable
declare
  receipt public.obito_agenda_receipts%rowtype;
  applied_id uuid;
  result jsonb;
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'OBITO_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if actor_user_id is null or fazenda_id is null or agenda_id is null or animal_id is null or death_event_id is null
     or client_op_id is null or client_tx_id is null or nullif(btrim(client_id),'') is null then
    raise exception 'OBITO_AGENDA_INVALID_COMMAND' using errcode='22004';
  end if;
  if not exists(
    select 1 from public.user_fazendas membership join public.fazendas farm on farm.id=membership.fazenda_id
    where membership.user_id=actor_user_id and membership.fazenda_id=fazenda_id
      and membership.deleted_at is null and farm.deleted_at is null
      and membership.role in ('owner','manager','cowboy')
  ) then raise exception 'OBITO_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('obito:agenda:'||fazenda_id::text||':'||client_op_id::text,0));
  select stored.* into receipt from public.obito_agenda_receipts stored
    where stored.fazenda_id=fazenda_id and stored.client_op_id=client_op_id;
  if found then
    if (receipt.actor_user_id,receipt.agenda_id,receipt.animal_id,receipt.death_event_id,receipt.client_tx_id,receipt.client_id)
       is distinct from (actor_user_id,agenda_id,animal_id,death_event_id,client_tx_id,client_id) then
      raise exception 'OBITO_AGENDA_IDENTITY_CONFLICT' using errcode='23505';
    end if;
    return receipt.result||jsonb_build_object('replayed',true);
  end if;
  if not exists(select 1 from public.eventos event where event.id=death_event_id and event.fazenda_id=fazenda_id
    and event.animal_id=animal_id and event.dominio='obito' and event.deleted_at is null) then
    return jsonb_build_object('outcome','dependency','agenda_id',agenda_id);
  end if;
  update public.agenda_itens item set status='cancelado'
    where item.id=agenda_id and item.fazenda_id=fazenda_id and item.animal_id=animal_id
      and item.deleted_at is null and item.status='agendado'
      and item.dominio <> 'sanitario'
    returning item.id into applied_id;
  if applied_id is not null then
    result := jsonb_build_object('outcome','applied','agenda_id',agenda_id,'replayed',false);
  elsif exists(select 1 from public.agenda_itens item where item.id=agenda_id and item.fazenda_id=fazenda_id
    and item.animal_id=animal_id and item.deleted_at is null
    and item.dominio <> 'sanitario') then
    result := jsonb_build_object('outcome','conflict','agenda_id',agenda_id,'replayed',false);
  else
    result := jsonb_build_object('outcome','not_found','agenda_id',agenda_id,'replayed',false);
  end if;
  insert into public.obito_agenda_receipts(fazenda_id,client_op_id,client_tx_id,client_id,actor_user_id,agenda_id,animal_id,death_event_id,result)
    values(fazenda_id,client_op_id,client_tx_id,client_id,actor_user_id,agenda_id,animal_id,death_event_id,result);
  return result;
end $$;

revoke all on function public.internal_obito_agenda_cancel(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.internal_obito_agenda_cancel(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) to service_role;

-- Pending generic mutations from another device must not reopen a cancellation.
-- The private immutable receipt is the authority; no client-side flag is trusted.
create function public.guard_obito_agenda_cancellation()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if old.status='cancelado' and
    (new.status is distinct from old.status or new.id is distinct from old.id or
     new.fazenda_id is distinct from old.fazenda_id or new.animal_id is distinct from old.animal_id) and
    exists(select 1 from public.obito_agenda_receipts receipt
      where receipt.fazenda_id=old.fazenda_id and receipt.agenda_id=old.id and receipt.animal_id=old.animal_id
        and receipt.result->>'outcome'='applied') then
    raise exception 'OBITO_AGENDA_CANCELLATION_IMMUTABLE' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.guard_obito_agenda_cancellation() from public,anon,authenticated,service_role;
create trigger obito_agenda_cancellation_guard before update on public.agenda_itens
  for each row execute function public.guard_obito_agenda_cancellation();

commit;
