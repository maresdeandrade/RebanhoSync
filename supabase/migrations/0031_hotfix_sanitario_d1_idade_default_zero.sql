-- 0031_hotfix_sanitario_d1_idade_default_zero.sql
-- Hotfix: quando idade_minima_dias nao estiver preenchida no item D1,
-- usar 0 dia (data_nascimento + 0) para permitir geracao inicial da pendencia.

do $$
declare
  v_fn regprocedure;
  v_def text;
begin
  v_fn := to_regprocedure('public.sanitario_recompute_agenda_core(uuid,uuid,date)');
  if v_fn is null then
    raise exception 'Funcao public.sanitario_recompute_agenda_core(uuid,uuid,date) nao encontrada';
  end if;

  select pg_get_functiondef(v_fn) into v_def;

  v_def := replace(
    v_def,
    'when dc.data_nascimento is null or dc.idade_min_dias_eff is null then null::date',
    'when dc.data_nascimento is null then null::date'
  );
  v_def := replace(
    v_def,
    'dc.data_nascimento + dc.idade_min_dias_eff',
    'dc.data_nascimento + coalesce(dc.idade_min_dias_eff, 0)'
  );

  execute v_def;
end $$;

-- Reconciliacao inicial: aplica motor para fazendas existentes apos hotfix.
do $$
declare
  f record;
begin
  for f in
    select id
    from public.fazendas
    where deleted_at is null
  loop
    perform public.sanitario_recompute_agenda_for_fazenda(f.id);
  end loop;
end $$;
