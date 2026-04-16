---
name: reproducao-parto-posparto-cria
description: Use when the task is about cobertura, IA, diagnóstico de gestação, parto, pós-parto, cria inicial, ficha reprodutiva, episode linking, status reprodutivo derivado, ou fatos event-driven que projetam taxonomy_facts no fluxo reprodutivo.
---

# Reprodução — Parto, Pós-parto e Cria Inicial

## Missão

Orientar mudanças e decisões no fluxo reprodutivo completo:
- cobertura / IA
- diagnóstico
- parto
- pós-parto neonatal
- cria inicial
- ficha reprodutiva
- episode linking
- status reprodutivo derivado
- projeção de fatos reprodutivos em `taxonomy_facts`

Esta skill cobre o fluxo **operacional reprodutivo**.  
Ela não é para cadastro-base simples do animal nem para movimentação/trânsito.

---

## Quando usar

Use esta skill quando a tarefa envolver:

- `src/lib/reproduction/**`
- `src/pages/AnimalReproducao.tsx`
- `src/pages/ReproductionDashboard.tsx`
- `src/pages/AnimalPosParto.tsx`
- `src/pages/AnimalCriaInicial.tsx`
- `src/pages/AnimalDetalhe.tsx` quando tocar leitura reprodutiva
- `src/lib/animals/taxonomy.ts`
- `src/lib/animals/taxonomyFactsContract.ts`
- `src/lib/offline/ops.ts` se houver impacto na validação local de fatos reprodutivos
- `supabase/functions/sync-batch/taxonomy.ts` se houver impacto na validação autoritativa

Capabilities prováveis:
- `reproducao.registro`
- `reproducao.historico`
- `reproducao.episode_linking`

---

## Quando NÃO usar

Não use esta skill para:
- simples criação/edição cadastral do animal
- compra/venda/saída
- movimentação entre lotes/pastos
- trânsito externo/GTA/e-GTA
- catálogo sanitário/regulatório
- ajustes genéricos de UI sem impacto reprodutivo

Nesses casos, usar:
- `animal-cadastro-origem-destino`
- `movimentacao-transito-conformidade`
- `sanitario-*`

---

## Ler primeiro

1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/CONTRACTS.md`

Ler só se necessário:
- `docs/OFFLINE.md`
- `docs/DB.md`

Arquivos-alvo mais comuns:
- `src/lib/reproduction/linking.ts`
- `src/lib/reproduction/status.ts`
- `src/lib/reproduction/selectors.ts`
- `src/lib/reproduction/types.ts`
- `src/pages/AnimalReproducao.tsx`
- `src/pages/AnimalPosParto.tsx`
- `src/pages/AnimalCriaInicial.tsx`
- `src/pages/ReproductionDashboard.tsx`
- `src/lib/animals/taxonomy.ts`
- `src/lib/animals/taxonomyFactsContract.ts`

Evitar abrir por padrão:
- docs derivados
- histórico/auditorias antigas
- sanitário/movimentação sem necessidade explícita

---

## Modelo mental obrigatório

Fluxo principal:
1. cobertura / IA
2. diagnóstico de gestação
3. parto
4. pós-parto
5. cria inicial

Separar sempre:

### A. Evento reprodutivo
- fato passado
- append-only
- vive em `eventos` + `eventos_reproducao`

### B. Estado/visão derivada
- status reprodutivo
- leitura da ficha reprodutiva
- projeção em `taxonomy_facts`

### C. Episode linking
- vínculo lógico e determinístico entre eventos do mesmo episódio
- não depende de edição destrutiva do histórico

### D. Fluxo mãe vs cria
- parto pertence ao episódio reprodutivo da matriz
- pós-parto e cria inicial expandem a jornada operacional
- não colapsar tudo em “cadastro da cria”

---

## Decisão rápida

### Caso A — Cobertura / IA
Criar evento reprodutivo adequado.
Se houver linking/episode reference, preservar a lógica determinística.

### Caso B — Diagnóstico
O diagnóstico pode projetar fatos reprodutivos, inclusive:
- `prenhez_confirmada`
- `data_prevista_parto`

Esses fatos não devem ser tratados como simples edição manual arbitrária.

### Caso C — Parto
Separar:
- evento reprodutivo da matriz
- efeitos derivados no status/taxonomia
- transição para pós-parto
- eventual criação da cria no fluxo apropriado

### Caso D — Pós-parto neonatal
Tratar como etapa operacional própria do fluxo, não como detalhe cosmético.

### Caso E — Cria inicial
Tratar como continuação do parto/pós-parto:
- identificação final
- lote inicial
- pesagem neonatal
- gesto atômico quando o fluxo exigir isso

---

## Ownership de fatos reprodutivos

Respeitar sempre o contrato atual:

### Event-driven
- `prenhez_confirmada`
- `data_prevista_parto`
- `data_ultimo_parto`

### Manual / híbrido conforme contrato
- `puberdade_confirmada`
- `secagem_realizada`
- `data_secagem`
- `em_lactacao`

Regra central:
- campos event-driven críticos não aceitam override manual arbitrário
- correção deve acontecer por novo evento / fluxo apropriado
- cliente e servidor validam o contrato

---

## Invariantes obrigatórias

- não quebrar episode linking
- não persistir label derivado como fonte de verdade
- não substituir evento por simples update silencioso do status
- não mover regra reprodutiva forte para página/UI dispersa
- manter coerência entre histórico reprodutivo e estado derivado
- não quebrar fluxo parto -> pós-parto -> cria inicial
- respeitar `taxonomy_facts.schema_version = 1`
- não introduzir conflito entre validação local e servidor

---

## Anti-padrões

- tratar parto como simples criação de animal sem jornada posterior
- editar diretamente fatos event-driven para “corrigir” histórico
- duplicar regra de status reprodutivo em várias telas
- gravar labels derivados como se fossem fonte primária
- separar demais mãe, parto, pós-parto e cria a ponto de perder o encadeamento operacional
- misturar cadastro-base do animal com fluxo reprodutivo completo

---

## Checklist antes de alterar

1. A mudança é de registro, linking, status ou apresentação?
2. O dado pertence ao evento, ao payload derivado ou só à projeção?
3. Existe risco de drift entre histórico e leitura atual?
4. O fluxo pós-parto/cria inicial continua navegável e coerente?
5. Há impacto em `taxonomyFactsContract`, `ops.ts` ou `sync-batch/taxonomy.ts`?

---

## Forma de entrega

Retornar:
- diff mínimo
- impacto no fluxo em até 5 bullets
- invariantes tocadas
- até 3 riscos
- testes focados

---

## Validação mínima

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Se tocar jornada ou status:
- rodar testes unitários/integrados do fluxo reprodutivo
- rodar o E2E/guiado parto -> pós-parto -> cria inicial quando aplicável

---

## Escalonamento

Escalar para `sync-offline-rollback` quando tocar:
- gestures
- rollback
- stores locais
- sync/pull

Escalar para `migrations-rls-contracts` quando tocar:
- schema
- FK
- enum
- view
- contrato SQL/TS de taxonomia

Escalar para `animal-cadastro-origem-destino` quando a tarefa for só cadastro/base do animal