-- Evidência documental de composição; não comprova campos operacionais.
alter type public.sanitario_evidence_status_v2_enum add value if not exists 'SIM_COMPOSICAO_FABRICANTE';

-- Campo documental restrito: não pode ser reaproveitado como fonte clínica.
create function public.sanitario_composition_evidence_field_guard_v2() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.sanitario_fontes_tecnicas_v2 where id=new.source_id and evidence_status::text='SIM_COMPOSICAO_FABRICANTE')
    and new.field_key not in ('composition','product_class') then
    raise exception 'COMPOSITION_EVIDENCE_FIELD_ONLY';
  end if;
  return new;
end;
$$;
create trigger sanitario_composition_evidence_field_guard_v2 before insert or update of source_id,field_key on public.sanitario_fonte_cobertura_campos_v2
for each row execute function public.sanitario_composition_evidence_field_guard_v2();
