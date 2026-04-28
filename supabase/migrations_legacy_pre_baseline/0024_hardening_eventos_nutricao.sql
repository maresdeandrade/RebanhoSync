-- Hardening nutricao: quantidade_kg, quando informada, deve ser positiva.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_evt_nutricao_quantidade_pos_nullable'
      and conrelid = 'public.eventos_nutricao'::regclass
  ) then
    alter table public.eventos_nutricao
      add constraint ck_evt_nutricao_quantidade_pos_nullable
      check (quantidade_kg is null or quantidade_kg > 0)
      not valid;
  end if;
end $$;

