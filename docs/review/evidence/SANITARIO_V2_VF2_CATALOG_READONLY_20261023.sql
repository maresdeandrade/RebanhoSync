select jsonb_build_object(
 'protocols',(select jsonb_agg(to_jsonb(p) order by p.family_code) from public.sanitario_protocolos_v2 p where p.scope='global' and p.fazenda_id is null),
 'items',(select jsonb_agg(to_jsonb(i) order by i.protocol_id,i.logical_item_key,i.version) from public.sanitario_protocolo_itens_versions_v2 i join public.sanitario_protocolos_v2 p on p.id=i.protocol_id where p.scope='global' and p.fazenda_id is null),
 'sources',(select jsonb_agg(to_jsonb(s) order by s.id) from public.sanitario_fontes_tecnicas_v2 s where s.scope='global' and s.fazenda_id is null),
 'coverage',(select jsonb_agg(to_jsonb(c) order by c.id) from public.sanitario_fonte_cobertura_campos_v2 c join public.sanitario_fontes_tecnicas_v2 s on s.id=c.source_id where s.scope='global' and s.fazenda_id is null),
 'groups',(select jsonb_agg(to_jsonb(g) order by g.id) from public.sanitario_product_class_groups_v2 g where g.scope='global' and g.fazenda_id is null),
 'groupMembers',(select jsonb_agg(to_jsonb(m) order by m.id) from public.sanitario_product_class_group_members_v2 m where m.scope='global' and m.fazenda_id is null),
 'gates',(select jsonb_build_object('total',count(*),'enabled',count(*) filter(where enabled)) from public.sanitario_sync_v2_gates)
) as snapshot;
