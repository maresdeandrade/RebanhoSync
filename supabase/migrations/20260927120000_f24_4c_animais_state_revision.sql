-- F24.4C: server-authoritative optimistic concurrency for animais current state.
-- Forward-only and additive: existing rows start at revision 1.

alter table public.animais
  add column if not exists revision bigint not null default 1;

alter table public.animais
  drop constraint if exists chk_animais_revision_positive;

alter table public.animais
  add constraint chk_animais_revision_positive check (revision >= 1);

create or replace function public.bump_animais_state_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;

drop trigger if exists trg_animais_state_revision on public.animais;
create trigger trg_animais_state_revision
before update on public.animais
for each row execute function public.bump_animais_state_revision();

revoke all on function public.bump_animais_state_revision() from public;
revoke all on function public.bump_animais_state_revision() from anon;
revoke all on function public.bump_animais_state_revision() from authenticated;
