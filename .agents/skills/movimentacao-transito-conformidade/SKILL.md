---
name: movimentacao-transito-conformidade
description: Use when the task is about movimentação entre lotes/pastos, anti-teleporte, trânsito externo, GTA/e-GTA, PNCEBT, bloqueio por suspeita sanitária, bloqueio por compliance/overlay, venda com impacto regulatório, ou tracing operacional de origem-destino.
---

# Movimentação — Trânsito e Conformidade

## Missão

Orientar mudanças e decisões no domínio de movimentação, cobrindo:
- movimentação interna entre lotes/pastos
- anti-teleporte
- trânsito externo
- GTA/e-GTA como checklist operacional
- pre-check PNCEBT
- bloqueios por suspeita sanitária
- bloqueios por compliance/overlay regulatório
- interseção com venda/trânsito quando houver impacto operacional

Esta skill substitui a visão antiga que tratava movimentação só como `evento_movimentacao + update lote`.

---

## Quando usar

Use esta skill quando a tarefa envolver:

- `src/pages/Registrar.tsx`
- `src/components/manejo/MoverAnimalLote.tsx`
- `src/components/manejo/AdicionarAnimaisLote.tsx`
- `src/pages/AnimaisTransicoes.tsx`
- `src/pages/LoteDetalhe.tsx`
- `src/lib/sanitario/transit.ts`
- `src/lib/sanitario/alerts.ts`
- `src/lib/sanitario/complianceGuards.ts`
- `src/lib/sanitario/regulatoryReadModel.ts`
- `src/lib/offline/**` se houver impacto em gesture/order/rollback
- `supabase/functions/sync-batch/**` se houver impacto em validação autoritativa anti-teleporte

Capabilities prováveis:
- `movimentacao.registro`
- `movimentacao.historico`
- `movimentacao.anti_teleport_client`
- faixas cross-cutting de `infra.compliance`

---

## Quando NÃO usar

Não use esta skill para:
- cadastro-base simples do animal
- fluxo reprodutivo de parto/pós-parto/cria
- registro sanitário operacional simples
- catálogo regulatório oficial fora do impacto em movimentação/trânsito

Nesses casos, usar:
- `animal-cadastro-origem-destino`
- `reproducao-parto-posparto-cria`
- `sanitario-*`

---

## Ler primeiro

1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/CONTRACTS.md`

Ler só se necessário:
- `docs/OFFLINE.md`
- `docs/DB.md`
- `docs/RLS.md`

Arquivos-alvo mais comuns:
- `src/pages/Registrar.tsx`
- `src/components/manejo/MoverAnimalLote.tsx`
- `src/components/manejo/AdicionarAnimaisLote.tsx`
- `src/pages/AnimaisTransicoes.tsx`
- `src/pages/LoteDetalhe.tsx`
- `src/lib/sanitario/transit.ts`
- `src/lib/sanitario/alerts.ts`
- `src/lib/sanitario/complianceGuards.ts`
- `src/lib/sanitario/regulatoryReadModel.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/syncWorker.ts`
- `supabase/functions/sync-batch/**`

Evitar abrir por padrão:
- docs derivados
- catálogo sanitário completo se a tarefa for só fluxo operacional de movimento
- histórico antigo do projeto

---

## Modelo mental obrigatório

Separar sempre:

### A. Movimentação interna
- troca de lote/pasto
- histórico operacional
- anti-teleporte
- update do estado atual do animal

### B. Trânsito externo
- operação externa
- checklist GTA/e-GTA
- destino/finalidade
- requisitos documentais/interestaduais
- pode intersectar venda

### C. Bloqueios sanitários/regulatórios
- suspeita sanitária aberta
- quarentena
- documental
- `feed-ban` / compliance runtime quando aplicável
- leitura nasce do read model/guards compartilhados

### D. Histórico vs estado atual
- evento de movimentação = fato passado
- `animais.lote_id` = estado atual
- ambos precisam continuar coerentes

---

## Regra dura: anti-teleporte

Você **não** pode atualizar `animais.lote_id` sem o evento correspondente no mesmo gesto quando o fluxo for movimentação interna com mudança de lote.

Ordem lógica:
1. criar evento base (`eventos`, domínio `movimentacao`)
2. criar detalhe (`eventos_movimentacao`)
3. atualizar `animais.lote_id`

Não quebrar essa ordem sem justificativa muito forte e alinhamento com o `sync-batch`.

---

## Decisão rápida

### Caso A — Movimento interno entre lotes
Exigir:
- evento base
- detalhe de movimentação
- update do lote atual
- tudo coerente no mesmo gesto

### Caso B — Movimento entre pastos sem troca de lote
Registrar o histórico adequado.
Não assumir update de `lote_id` se o lote não mudou.

### Caso C — Trânsito externo
Separar:
- não é só “movimentação interna mais campos”
- pode exigir checklist GTA/e-GTA
- pode exigir `destination_uf`
- pode exigir pre-check PNCEBT no caso reprodutivo interestadual

### Caso D — Animal com suspeita sanitária aberta
Movimentação/venda/trânsito podem estar bloqueados.
A regra deve nascer de `alerts` / `complianceGuards` / `regulatoryReadModel`, não de if solto na UI.

### Caso E — Overlay/compliance bloqueando
Bloqueios contextuais devem ser compartilhados entre:
- `Registrar`
- fluxo auxiliar de lote
- transições em massa
- superfícies derivadas como `LoteDetalhe`

---

## Invariantes obrigatórias

- evento + detalhe + update continuam coerentes
- não quebrar anti-teleporte
- não duplicar guardas regulatórias em várias telas sem usar o read model/guards compartilhados
- trânsito externo continua distinto de movimentação interna
- GTA/e-GTA permanece checklist operacional/documental, não emissão documental completa por padrão
- suspeita sanitária aberta continua podendo bloquear movimento/venda
- PNCEBT interestadual reprodutivo continua tratado como pre-check específico, não regra genérica em tudo

---

## Anti-padrões

- atualizar `lote_id` sem evento de movimentação correspondente
- tratar trânsito externo como simples troca de lote
- duplicar guardas de compliance em várias páginas
- embutir regra interestadual rígida em todo movimento interno
- contornar bloqueio sanitário/regulatório via fluxo auxiliar de lote
- modelar GTA completa/fiscal completa dentro de um fluxo que hoje é checklist operacional

---

## Checklist antes de alterar

1. É movimentação interna, pasto, ou trânsito externo?
2. O fluxo exige update de `animais.lote_id`?
3. Existe bloqueio sanitário aberto?
4. Existe bloqueio regulatório/compliance ativo?
5. Há impacto em venda/trânsito externo?
6. A regra precisa viver em `transit.ts`, `alerts.ts`, `complianceGuards.ts`, `regulatoryReadModel.ts` ou no `sync-batch`?

---

## Forma de entrega

Retornar:
- diff mínimo
- fluxo afetado
- invariantes preservadas
- até 3 riscos
- testes focados

---

## Validação mínima

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Se tocar anti-teleporte/sync:
- revisar order do gesto
- revisar rollback
- revisar validação cliente/servidor

Se tocar trânsito/compliance:
- revisar bloqueios compartilhados
- revisar CTA/sinalização em superfícies derivadas quando aplicável

---

## Escalonamento

Escalar para `sync-offline-rollback` quando tocar:
- gestures
- rollback
- order de ops
- queue/sync worker

Escalar para `migrations-rls-contracts` quando tocar:
- FK
- schema
- constraint
- policy
- enum

Escalar para `sanitario-catalogo-regulatorio-compliance` quando a mudança for principalmente sobre overlay, compliance runtime ou catálogo oficial