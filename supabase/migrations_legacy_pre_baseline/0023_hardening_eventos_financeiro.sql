-- Hardening financeiro: valor_total deve ser positivo.
-- NOT VALID evita falha imediata em historico legado inconsistente.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_evt_fin_valor_total_pos'
      and conrelid = 'public.eventos_financeiro'::regclass
  ) then
    alter table public.eventos_financeiro
      add constraint ck_evt_fin_valor_total_pos
      check (valor_total > 0)
      not valid;
  end if;
end $$;

