-- 0030_hotfix_sanitario_core_protocolo_payload.sql
-- Corrige referencia invalida a p.protocolo_payload dentro de sanitario_recompute_agenda_core.
-- O erro gerava SQLSTATE 42703 durante INSERT/UPDATE de animais.

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
    'p.protocolo_payload -> ''especies''',
    'p.payload -> ''especies'''
  );
  v_def := replace(
    v_def,
    'p.protocolo_payload -> ''categorias_produtivas''',
    'p.payload -> ''categorias_produtivas'''
  );

  execute v_def;
end $$;

