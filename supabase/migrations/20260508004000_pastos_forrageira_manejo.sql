-- Migration: P2 - Detalhamento de Pastagens
-- Adiciona campos para tipo de área, forrageira, cultivar e metas de manejo (alturas e UA)
-- Mantém compatibilidade com tipo_pasto legado

alter table public.pastos
  add column if not exists tipo_area text,
  add column if not exists forrageira_nome text,
  add column if not exists forrageira_genero text,
  add column if not exists forrageira_cultivar text,
  add column if not exists altura_entrada_alvo_cm numeric(6,2),
  add column if not exists altura_saida_alvo_cm numeric(6,2),
  add column if not exists capacidade_ua_alvo numeric(10,2);

-- Constraints para integridade das metas de manejo
do $$ begin
  alter table public.pastos
    add constraint ck_pastos_altura_entrada_pos
    check (altura_entrada_alvo_cm is null or altura_entrada_alvo_cm > 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.pastos
    add constraint ck_pastos_altura_saida_pos
    check (altura_saida_alvo_cm is null or altura_saida_alvo_cm > 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.pastos
    add constraint ck_pastos_altura_saida_menor_entrada
    check (
      altura_entrada_alvo_cm is null
      or altura_saida_alvo_cm is null
      or altura_saida_alvo_cm < altura_entrada_alvo_cm
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.pastos
    add constraint ck_pastos_capacidade_ua_alvo_pos
    check (capacidade_ua_alvo is null or capacidade_ua_alvo >= 0);
exception when duplicate_object then null;
end $$;
