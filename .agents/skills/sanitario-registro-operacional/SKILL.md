---
name: sanitario-registro-operacional
description: Use when the task is about registrar evento sanitário, concluir item de agenda sanitária, vacinar, vermifugar, aplicar medicamento, registrar exame sanitário, usar produtos_veterinarios, target por animal ou lote, ou corrigir fluxo operacional sanitário sem alterar o catálogo regulatório oficial.
---

# Sanitário — Registro Operacional

## Missão

Orientar mudanças e decisões no fluxo **operacional** do sanitário:
- registro manual de evento sanitário
- conclusão/cancelamento de agenda sanitária
- uso de `produtos_veterinarios`
- alvo por `animal_id` ou `lote_id`
- vínculo entre agenda, evento e payload sanitário
- leitura operacional em `Registrar`, `Agenda`, `Eventos`, `Relatorios`

Esta skill **não** é para reestruturar o catálogo oficial/regulatório.  
Para isso, usar `sanitario-catalogo-regulatorio-compliance`.

---

## Quando usar

Use esta skill quando a tarefa envolver:

- `src/pages/Registrar.tsx`
- `src/pages/Agenda.tsx`
- `src/pages/Eventos.tsx`
- `src/pages/Relatorios.tsx`
- `src/lib/sanitario/products.ts`
- `src/lib/sanitario/service.ts`
- `src/lib/sanitario/attention.ts`
- fluxo de registro sanitário manual ou a partir da agenda
- sugestão/autocomplete de `produtos_veterinarios`
- persistência de referência estruturada de produto no payload
- conclusão de agenda sanitária com evento correspondente

Capabilities mais prováveis:
- `sanitario.registro`
- `sanitario.historico`
- `agenda.concluir`

---

## Quando NÃO usar

Não use esta skill se a tarefa for principalmente sobre:

- pack oficial regulatório
- overlay estadual
- `fazenda_sanidade_config`
- `conformidade`
- `feed-ban`
- suspeita/notificação sanitária
- seleção/materialização do catálogo oficial
- engine declarativa de agenda por `calendario_base`

Nesses casos, usar:
- `sanitario-catalogo-regulatorio-compliance`
- `migrations-rls-contracts`
- `sync-offline-rollback` se houver impacto no sync

---

## Ler primeiro

1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`

Ler só se necessário:
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`
- `docs/DB.md`

Arquivos-alvo mais comuns:
- `src/pages/Registrar.tsx`
- `src/pages/Agenda.tsx`
- `src/pages/Eventos.tsx`
- `src/pages/Relatorios.tsx`
- `src/lib/sanitario/products.ts`
- `src/lib/sanitario/service.ts`
- `src/lib/sanitario/attention.ts`
- `src/lib/offline/db.ts` apenas se houver impacto de cache/local store

Evitar abrir por padrão:
- `docs/archive/**`
- docs derivados (`IMPLEMENTATION_STATUS`, `ROADMAP`, `TECH_DEBT`) se a tarefa for só de implementação local

---

## Modelo mental

Separar sempre:

1. **evento sanitário**
   - fato passado
   - append-only
   - vive em `eventos` + `eventos_sanitario`

2. **agenda sanitária**
   - intenção futura
   - mutável
   - vive em `agenda_itens`

3. **produto veterinário**
   - referência estruturada
   - catálogo global com cache local
   - não deve voltar a ser só string livre por padrão

4. **semântica de calendário**
   - próxima ação pertence à agenda
   - não persistir `proxima_dose` ou `proximo_reforco` dentro do evento

---

## Decisão rápida

### Caso A — Registro manual sem agenda
Criar:
- `eventos`
- `eventos_sanitario`

Não concluir agenda inexistente.

### Caso B — Execução de item vindo da agenda
Criar:
- `eventos`
- `eventos_sanitario`

Atualizar:
- `agenda_itens.status = concluido` ou regra equivalente do fluxo atual

Manter vínculo lógico:
- `source_task_id` / referência operacional equivalente do fluxo atual

### Caso C — Registro por lote
Verificar se o comportamento esperado é:
- um evento por animal afetado
- ou gesto em lote que se desdobra em múltiplos eventos

Nunca assumir bulk simplificado sem conferir a superfície atual.

### Caso D — Produto catalogado
Preferir:
- `produto_veterinario_id`
- `produto_nome_catalogo`
- `produto_categoria`
- `produto_origem`

Só cair para texto livre quando o fluxo explicitamente permitir fallback.

---

## Invariantes obrigatórias

- evento sanitário continua append-only
- agenda continua separada do evento
- `produtos_veterinarios` permanece referência canônica do produto
- o payload do evento não deve carregar “próxima ação” como fonte de verdade
- leitura operacional de agenda/home/dashboard/relatórios não deve duplicar regra localmente
- não reintroduzir protocolo base hardcoded na UI
- não reduzir tudo a string livre quando já existe referência estruturada

---

## Anti-padrões

- salvar `proxima_dose` ou `proximo_reforco` no evento sanitário
- tratar produto catalogado como texto livre por default
- duplicar regra de prioridade sanitária entre telas
- concluir agenda sem registrar o fato correspondente quando o fluxo exige ambos
- misturar lógica regulatória pesada no fluxo operacional comum
- reintroduzir aftosa como default de biblioteca base

---

## Checklist antes de alterar

1. O alvo é `animal_id` ou `lote_id`?
2. É registro manual, execução de agenda ou ambos?
3. O produto vem do catálogo ou precisa fallback?
4. A próxima ação pertence ao evento ou à agenda?
5. A leitura compartilhada em agenda/relatórios/home vai continuar coerente?

---

## Forma de entrega

Retornar:
- diff mínimo
- arquivos afetados
- regra alterada em 1 frase
- até 3 riscos
- testes focados

---

## Validação mínima

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Se tocar cache/offline:
- revisar store local do catálogo
- revisar fallback offline
- revisar se o payload continua sincronizável

---

## Escalonamento

Escalar para `sanitario-catalogo-regulatorio-compliance` quando a tarefa tocar:
- catálogo oficial
- overlay
- `fazenda_sanidade_config`
- `conformidade`
- bloqueios regulatórios

Escalar para `sync-offline-rollback` quando tocar:
- gestures
- Dexie schema
- rollback
- `tableMap`
- sync/pull

Escalar para `migrations-rls-contracts` quando tocar:
- schema SQL
- catálogo global
- enums/views/RLS