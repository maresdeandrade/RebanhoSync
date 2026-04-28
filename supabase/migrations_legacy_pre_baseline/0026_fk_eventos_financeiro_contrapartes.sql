-- FK tenant-safe entre eventos_financeiro e contrapartes.
-- Permite contraparte nula, mas quando preenchida exige mesma fazenda.

create unique index if not exists ux_contrapartes_id_fazenda
on public.contrapartes(id, fazenda_id);

create index if not exists ix_evt_fin_contraparte_fazenda
on public.eventos_financeiro(contraparte_id, fazenda_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_evt_fin_contraparte_fazenda'
      and conrelid = 'public.eventos_financeiro'::regclass
  ) then
    alter table public.eventos_financeiro
      add constraint fk_evt_fin_contraparte_fazenda
      foreign key (contraparte_id, fazenda_id)
      references public.contrapartes(id, fazenda_id)
      deferrable initially deferred
      not valid;
  end if;
end $$;

