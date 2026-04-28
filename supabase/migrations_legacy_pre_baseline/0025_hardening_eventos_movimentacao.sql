-- Hardening movimentacao:
-- 1) destino obrigatorio (lote ou pasto)
-- 2) origem e destino nao podem ser iguais quando ambos informados
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_evt_mov_destino_required'
      and conrelid = 'public.eventos_movimentacao'::regclass
  ) then
    alter table public.eventos_movimentacao
      add constraint ck_evt_mov_destino_required
      check (to_lote_id is not null or to_pasto_id is not null)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_evt_mov_from_to_diff'
      and conrelid = 'public.eventos_movimentacao'::regclass
  ) then
    alter table public.eventos_movimentacao
      add constraint ck_evt_mov_from_to_diff
      check (
        (from_lote_id is null or to_lote_id is null or from_lote_id <> to_lote_id)
        and
        (from_pasto_id is null or to_pasto_id is null or from_pasto_id <> to_pasto_id)
      )
      not valid;
  end if;
end $$;

