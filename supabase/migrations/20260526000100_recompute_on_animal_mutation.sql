-- Phase 1C: Trigger de Recompute por Mutação do Animal (F6)
-- Fires sanitario_recompute_agenda_for_animal when relevant animal attributes change.

create or replace function public.trg_sanitario_recompute_on_animal_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    OLD.sexo IS DISTINCT FROM NEW.sexo
    OR OLD.data_nascimento IS DISTINCT FROM NEW.data_nascimento
    OR OLD.especie IS DISTINCT FROM NEW.especie
    OR OLD.status IS DISTINCT FROM NEW.status
  ) then
    perform public.sanitario_recompute_agenda_for_animal(NEW.id, NEW.fazenda_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_animais_sanitario_recompute on public.animais;

create trigger trg_animais_sanitario_recompute
  after update on public.animais
  for each row
  execute function public.trg_sanitario_recompute_on_animal_mutation();
