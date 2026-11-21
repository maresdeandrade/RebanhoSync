-- Protect effective event safety flags without revoking legitimate manager edits.
-- Defaults match resolveEventosRolloutFlags: absent/non-boolean values mean true.
create function public.guard_fazenda_security_flags()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  flag text;
  old_value jsonb;
  new_value jsonb;
begin
  foreach flag in array array['strict_rules_enabled', 'strict_anti_teleporte'] loop
    old_value := old.metadata #> array['eventos_rollout', flag];
    new_value := new.metadata #> array['eventos_rollout', flag];
    if jsonb_typeof(old_value) is distinct from 'boolean' then old_value := 'true'::jsonb; end if;
    if jsonb_typeof(new_value) is distinct from 'boolean' then new_value := 'true'::jsonb; end if;
    if old_value is distinct from new_value then
      -- UPDATE already holds the farm row lock; J04 role changes use that same
      -- lock and revalidate membership. Evaluate authority after serialization.
      if auth.uid() is null or not public.role_in_fazenda(old.id, array['owner']::public.farm_role_enum[]) then
        raise exception using errcode = '42501',
          message = 'Somente o proprietário ativo desta fazenda pode alterar as flags de segurança. Recarregue os dados antes de tentar novamente.';
      end if;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.guard_fazenda_security_flags() from public, anon, authenticated;
create trigger trg_guard_fazenda_security_flags
before update of metadata on public.fazendas
for each row execute function public.guard_fazenda_security_flags();
