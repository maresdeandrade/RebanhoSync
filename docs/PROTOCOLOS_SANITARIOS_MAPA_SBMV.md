# Protocolos Sanitarios Padrao (MAPA + SBMV)

Data: 2026-02-11  
Escopo: templates para `protocolos_sanitarios` e `protocolos_sanitarios_itens` no modelo atual.

## 1. Objetivo

Padronizar protocolos sanitarios iniciais para:

1. `vacinacao`
2. `vermifugacao`
3. `medicamento`

Os templates foram estruturados para funcionar com o pipeline atual (`Registrar` -> `buildEventGesture` -> `agenda_itens`).

## 2. O que foi implantado

Migration: `supabase/migrations/0027_seed_protocolos_sanitarios_mapa_sbmv.sql`

Entregas da migration:

1. Funcao `public.seed_default_sanitary_protocols(fazenda_id)` (idempotente por `template_code` e `item_code`).
2. Trigger em `public.fazendas` para semear protocolos em novas fazendas.
3. Backfill para todas as fazendas ativas existentes.
4. Controle de concorrencia por `pg_advisory_xact_lock` por fazenda.
5. `client_tx_id` preenchido em todos os inserts do seed.

## 3. Protocolos criados

### 3.1 Vacinacao (MAPA)

1. `MAPA | Brucelose femeas 3-8 meses (B19/RB51)`
   1. Tipo: `vacinacao`
   2. Item: dose unica (sem agenda automatica recorrente)
   3. Regras de uso: aplicacao oficial sob supervisao/registro veterinario e comprovacao junto ao SVO.

2. `MAPA | Raiva herbivoros - primovacinacao (areas de risco)`
   1. Tipo: `vacinacao`
   2. Itens:
      1. `D1` com reforco em `30` dias (`gera_agenda=true`)
      2. `D2` explicito no protocolo (`gera_agenda=false`)

3. `MAPA | Raiva herbivoros - revacinacao anual (areas de risco)`
   1. Tipo: `vacinacao`
   2. Item: recorrencia em `365` dias (`gera_agenda=true`).

### 3.2 Vermifugacao (SBMV + ajuste por RT)

1. `SBMV | Vermifugacao estrategica com base em risco`
   1. Tipo: `vermifugacao`
   2. Item: ciclo inicial `120` dias (`gera_agenda=true`).
   3. Regra de uso: intervalo inicial, com ajuste obrigatorio por copro/OPG, categoria animal e sazonalidade local.

### 3.3 Medicacao (SBMV/MAPA - uso prudente)

1. `SBMV/MAPA | Medicacao terapeutica com uso prudente`
   1. Tipo: `medicamento`
   2. Item: reavaliacao em `72h` (`intervalo_dias=3`, `gera_agenda=true`).
   3. Regra de uso: prescricao veterinaria, justificativa clinica e registro de periodo de carencia.

## 4. Mapeamento no schema atual

Tabela `protocolos_sanitarios`:

1. `nome`, `descricao`, `ativo`
2. `payload.template_code` para idempotencia
3. `payload.seed_origin = MAPA_SBMV`
4. `payload.fonte` com links de referencia

Tabela `protocolos_sanitarios_itens`:

1. `tipo` (`vacinacao` | `vermifugacao` | `medicamento`)
2. `produto`
3. `intervalo_dias`
4. `dose_num`
5. `gera_agenda`
6. `dedup_template`
7. `payload.item_code` para idempotencia por item

## 5. Observacoes tecnicas importantes

1. Os protocolos sao templates iniciais e nao substituem prescricao/RT.
2. Parametros podem variar por UF e por orientacao do Servico Veterinario Oficial local.
3. O protocolo de brucelose foi configurado sem recorrencia automatica.
   Observacao: `intervalo_dias=1` e apenas tecnico, pois o schema exige valor > 0 mesmo para dose unica.
4. O protocolo de raiva foi separado em primovacinacao e revacinacao para facilitar operacao.
5. O protocolo de vermifugacao usa intervalo inicial conservador; ajuste por diagnostico e historico da fazenda.
6. O protocolo de medicacao prioriza evento de reavaliacao para reduzir uso empirico prolongado.
7. Nao foi criado protocolo vacinal de febre aftosa, pois o Brasil foi reconhecido como livre sem vacinacao e o MAPA encerrou a estrategia nacional de vacinacao rotineira.
8. O seed respeita soft-delete historico por `template_code/item_code` e nao recria templates apagados.

## 6. Fontes

1. MAPA - Brucelose (PNCEBT):  
   `https://www.gov.br/agricultura/pt-br/assuntos/saude-animal-e-sanidade-vegetal/saude-animal/programas-de-saude-animal/brucelose-e-tuberculose-pncetb`
2. MAPA - Vacinacao contra brucelose (regras operacionais):  
   `https://www.gov.br/agricultura/pt-br/assuntos/noticias/mapa-reforca-a-importancia-da-vacinacao-contra-brucelose`
3. MAPA - Vacina antirrabica para herbivoros:  
   `https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/raiva-dos-herbivoros-e-eeb/vacina-antirrabica`
4. Texto da IN MAPA no 5/2002 (resumo operacional publicado por orgao estadual):  
   `https://www.defesa.agricultura.sp.gov.br/legislacoes/instrucao-normativa-mapa-5-de-01-03-2002%2C728.html`
5. MAPA - Resistencia a antimicrobianos (uso prudente):  
   `https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/insumos-pecuarios/resistencia-aos-antimicrobianos/antimicrobianos`
6. MAPA - Forum RAM no agro (diagnostico laboratorial e uso racional):  
   `https://www.gov.br/agricultura/pt-br/assuntos/noticias/mapa-realiza-forum-sobre-resistencia-aos-antimicrobianos`
7. SBMV - referencia institucional:  
   `https://sbmv.org/`
8. MAPA - OMSA reconhece Brasil livre de febre aftosa sem vacinacao (2025):  
   `https://www.gov.br/agricultura/pt-br/assuntos/noticias/omsa-reconhece-brasil-como-livre-de-febre-aftosa-sem-vacinacao`
9. MAPA - Portaria SDA no 665/2024 (transicao e proibicao da vacinacao contra febre aftosa):  
   `https://www.gov.br/agricultura/pt-br/assuntos/noticias/publicada-portaria-que-determina-criterios-para-proibicao-da-vacinacao-contra-febre-aftosa-em-todo-o-territorio-nacional`

## 7. Limite de referencia SBMV

A fonte publica institucional da SBMV consultada nao apresenta, hoje, um calendario nacional fechado com doses/intervalos unicos para bovinos por categoria.  
Por isso, os itens de `vermifugacao` e `medicacao` foram implementados como templates base, explicitamente marcados para ajuste pelo medico veterinario responsavel da fazenda.
