-- Forward-only correction: Lote→Pasto also carries from/to_lote_id.
-- Keep the private executor bypass and existing trigger ACL/RLS unchanged.
create or replace function public.guard_animal_lot_fact_insert_v1()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
declare v_animal_movement boolean;
begin
  if current_user = 'rebanhosync_movement_executor' then return new; end if;
  if tg_table_name = 'eventos' then
    v_animal_movement := new.dominio = 'movimentacao' and new.animal_id is not null;
  else
    v_animal_movement := exists (select 1 from public.eventos e
      where e.id = new.evento_id and e.fazenda_id = new.fazenda_id
        and e.dominio = 'movimentacao' and e.animal_id is not null);
  end if;
  if v_animal_movement then
    raise exception using errcode = '42501', message = 'GENERIC_ANIMAL_MOVEMENT_WRITER_DISABLED';
  end if;
  return new;
end;
$$;
