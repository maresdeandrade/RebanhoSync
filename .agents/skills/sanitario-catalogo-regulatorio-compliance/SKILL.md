---
name: sanitario-catalogo-regulatorio-compliance
description: Use when the task is about catálogo oficial sanitário, overlay estadual, fazenda_sanidade_config, pack oficial, conformidade, feed-ban, suspeita/notificação sanitária, bloqueios regulatórios, regulatory read model, ou materialização operacional do domínio sanitário regulatório.
---

# Sanitário — Catálogo Regulatório e Compliance

## Missão

Orientar mudanças e decisões na camada **regulatória e de conformidade** do sanitário:
- catálogo oficial global
- overlay estadual
- ativação do pack por fazenda
- `fazenda_sanidade_config`
- runtime de `conformidade`
- `feed-ban`
- suspeita/notificação sanitária
- bloqueios contextuais em movimentação, nutrição, venda/trânsito
- `regulatoryReadModel`

Esta skill é para a frente **normativa/operacional regulatória**, não para o registro sanitário simples do dia a dia.

---

## Quando usar

Use esta skill quando a tarefa envolver:

- `src/lib/sanitario/officialCatalog.ts`
- `src/lib/sanitario/compliance.ts`
- `src/lib/sanitario/complianceAttention.ts`
- `src/lib/sanitario/complianceGuards.ts`
- `src/lib/sanitario/regulatoryReadModel.ts`
- `src/lib/sanitario/transit.ts`
- `src/lib/sanitario/alerts.ts`
- `src/components/sanitario/OfficialSanitaryPackManager.tsx`
- `src/components/sanitario/RegulatoryOverlayManager.tsx`
- `src/pages/ProtocolosSanitarios.tsx`
- `src/pages/Registrar.tsx` quando houver bloqueio regulatório
- `src/pages/Home.tsx`, `Dashboard.tsx`, `Eventos.tsx`, `Relatorios.tsx`, `Animais.tsx`, `LoteDetalhe.tsx` quando a tarefa tocar projeção regulatória compartilhada
- tabelas:
  - `catalogo_protocolos_oficiais`
  - `catalogo_protocolos_oficiais_itens`
  - `catalogo_doencas_notificaveis`
  - `fazenda_sanidade_config`

Capabilities/tracks prováveis:
- `sanitario.agenda_link`
- `sanitario.catalogo_regulatorio`
- `infra.compliance`
- `agenda.recalculo` quando houver materialização/recompute

---

## Quando NÃO usar

Não use esta skill para:
- simples registro de vacina/vermífugo/medicamento
- autocomplete de produto
- ajuste pequeno de formulário sanitário manual
- fluxo sanitário puramente operacional sem impacto regulatório

Nesses casos, usar:
- `sanitario-registro-operacional`

---

## Ler primeiro

1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DB.md`

Ler só se necessário:
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`
- `docs/RLS.md`

Arquivos-alvo mais comuns:
- `src/lib/sanitario/officialCatalog.ts`
- `src/lib/sanitario/compliance.ts`
- `src/lib/sanitario/complianceGuards.ts`
- `src/lib/sanitario/regulatoryReadModel.ts`
- `src/lib/sanitario/transit.ts`
- `src/lib/sanitario/alerts.ts`
- `src/components/sanitario/OfficialSanitaryPackManager.tsx`
- `src/components/sanitario/RegulatoryOverlayManager.tsx`
- `src/pages/ProtocolosSanitarios.tsx`
- `supabase/migrations/**` quando houver mudança estrutural

---

## Modelo mental obrigatório

O sanitário regulatório tem **3 camadas distintas**:

1. **base regulatória oficial**
   - conteúdo global e versionado
   - não fica hardcoded na UI da fazenda

2. **overlay operacional do pack**
   - runtime/checklists/restrições
   - `conformidade`
   - `feed-ban`
   - documental, quarentena, água/limpeza etc.

3. **protocolos operacionais da fazenda**
   - materialização prática e execução no dia a dia

Essas camadas:
- **não competem** como se fossem a mesma coisa
- **não devem ser colapsadas** num único fluxo simplificado
- devem alimentar leitura compartilhada nas superfícies operacionais

---

## Decisão rápida

### Caso A — Seleção do pack oficial
A mudança deve viver na camada:
- catálogo global
- seleção por UF / risco / modo calendário / aptidão / sistema
- ativação em `fazenda_sanidade_config`

### Caso B — Bloqueio de fluxo operacional
A regra deve entrar em:
- `complianceGuards`
- `regulatoryReadModel`
- runtime de overlay
- e só depois ser projetada em UI

### Caso C — Suspeita/notificação sanitária
Separar:
- evento append-only de alerta/suspeita
- estado mutável do bloqueio/contexto no payload/runtime adequado
- leitura compartilhada das restrições

### Caso D — Trânsito/GTA/e-GTA
Separar:
- checklist operacional/documental
- bloqueio de continuidade
- pre-check regulatório
- sem transformar isso em emissão fiscal/documental completa por padrão

---

## Invariantes obrigatórias

- catálogo oficial global não vira configuração tenant-scoped por acidente
- `fazenda_sanidade_config` continua sendo overlay da fazenda
- `conformidade` é domínio append-only para eventos/checks relevantes
- runtime mutável de overlay não deve ser confundido com evento histórico
- bloqueios contextuais devem nascer do read model compartilhado, não de lógica duplicada por tela
- `feed-ban`, quarentena, documental e água/limpeza mantêm semântica separada
- não reintroduzir aftosa como base vacinal padrão
- não inflar o registro sanitário operacional com exigência regulatória indevida

---

## Anti-padrões

- hardcode do pack oficial em UI local
- duplicar lógica regulatória em `Home`, `Dashboard`, `Agenda`, `Eventos`, `Animais` e `Relatorios`
- bloquear fluxo direto na página sem passar pelo read model/guards compartilhados
- tratar checklist/overlay como se fosse protocolo operacional comum
- usar regra estadual como default nacional
- modelar GTA/NF completas quando o fluxo atual é checklist/vínculo documental operacional

---

## Checklist antes de alterar

1. A mudança é de **conteúdo oficial**, **overlay runtime** ou **projeção compartilhada**?
2. A regra nasce no catálogo, no runtime, no guard ou no read model?
3. O bloqueio é de movimento, nutrição, venda/trânsito ou outro?
4. A superfície derivada está consumindo regra central ou reinterpretando localmente?
5. Há impacto em agenda/recompute/materialização?

---

## Forma de entrega

Retornar:
- diff mínimo
- camada afetada
- invariante preservada
- até 3 riscos
- testes focados

---

## Validação mínima

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Se tocar materialização, catálogo ou schema:
- revisar migração
- revisar cache offline
- revisar coerência entre pack oficial, overlay e protocolos da fazenda

---

## Escalonamento

Escalar para `migrations-rls-contracts` quando tocar:
- tabelas globais
- `fazenda_sanidade_config`
- enums/views/RLS
- decisão estrutural de catálogo

Escalar para `sync-offline-rollback` quando tocar:
- Dexie cache do catálogo
- pull/sync
- stores locais
- rollback

Escalar para `sanitario-registro-operacional` quando a mudança for só no registro/evento do dia a dia