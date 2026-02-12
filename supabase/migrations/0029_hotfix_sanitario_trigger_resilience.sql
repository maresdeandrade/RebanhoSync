-- 0029_hotfix_sanitario_trigger_resilience.sql
-- Hotfix: evita que falha no recompute sanitario bloqueie INSERT/UPDATE em animais.

create or replace function public.trg_sanitario_recompute_agenda_on_animais()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    begin
      perform public.sanitario_recompute_agenda_for_animal(new.id);
    exception
      when others then
        raise warning
          'sanitario_recompute (INSERT animais) falhou para animal %: [%] %',
          new.id,
          sqlstate,
          sqlerrm;
    end;
    return new;
  end if;

  if new.data_nascimento is distinct from old.data_nascimento
    or new.sexo is distinct from old.sexo
    or new.status is distinct from old.status
    or new.lote_id is distinct from old.lote_id
    or new.payload is distinct from old.payload
    or new.deleted_at is distinct from old.deleted_at then
    begin
      perform public.sanitario_recompute_agenda_for_animal(new.id);
    exception
      when others then
        raise warning
          'sanitario_recompute (UPDATE animais) falhou para animal %: [%] %',
          new.id,
          sqlstate,
          sqlerrm;
    end;
  end if;

  return new;
end;
$$;

