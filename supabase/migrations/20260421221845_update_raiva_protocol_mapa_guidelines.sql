-- Atualizar protocolo de raiva para conformidade com diretrizes MAPA
-- Remover age_start_days do reforco de 30 dias, mantendo dependencia temporal

update public.catalogo_protocolos_oficiais_itens
set payload = payload - 'age_start_days'
where codigo = 'raiva-reforco-30d'
  and protocolo_id in (
    select id from public.catalogo_protocolos_oficiais
    where slug = 'raiva-herbivoros-risco'
  );

-- Verificar se a primeira dose ja tem age_start_days = 90
-- Se necessario, ajustar:
-- update public.catalogo_protocolos_oficiais_itens
-- set payload = jsonb_set(payload, '{age_start_days}', '90')
-- where codigo = 'raiva-d1'
--   and protocolo_id in (
--     select id from public.catalogo_protocolos_oficiais
--     where slug = 'raiva-herbivoros-risco'
--   );