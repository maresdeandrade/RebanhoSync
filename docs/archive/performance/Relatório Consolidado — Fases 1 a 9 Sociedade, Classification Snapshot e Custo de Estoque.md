```markdown
# Relatório Consolidado — Fases 1 a 9 Sociedade, Classification Snapshot e Custo de Estoque — RebanhoSync

**Arquivos avaliados**

* **Arquivo 1:** Markdown.md colado — contexto anterior, com Fase 9 ainda planejada como “Compra/Venda Pecuária Estruturada”, após Fases 1–8. O arquivo preserva contratos centrais: offline-first, eventos append-only, agenda como intenção, `state_*` como read model, snapshot histórico e financeiro separado.
* **Arquivo 2:** Texto colado (2).txt — relatório posterior, já incorporando Fase 9 base, sociedade pecuária, `classificationSnapshot` e custo de estoque/snapshot econômico.

---

## 1. Diagnóstico da frente

### Objetivo da frente
Endurecer três bases pós-MVP:
1.  **Comercial/patrimonial:** compra, venda e sociedade pecuária estruturadas.
2.  **Classificação animal:** leitura padronizada de categoria, fase, estado e estágio.
3.  **Custo de estoque:** custo real por lote de insumo e snapshot econômico no consumo.

**Objetivo final:** preparar o app para relatórios produtivos, KPIs econômicos e fases futuras sem misturar fontes de verdade.

### Estado atual consolidado

| Domínio | Estado consolidado | Origem |
| :--- | :--- | :--- |
| **Compra/Venda estruturada** | Planejada no Arquivo 1; base implementada/estruturada no Arquivo 2 | Ambos |
| **Sociedade pecuária** | Base existente; patch de entrada/saída ainda pendente | Arquivo 2 |
| **Status retirado** | Validado conceitualmente, ainda não implementado | Arquivo 2 |
| **`classificationSnapshot`** | Tecnicamente concluído; pendente conferência final de `git/diff` | Arquivo 2 |
| **Custo de estoque/snapshot econômico** | Implementado no core e UI `/insumos`; pendente validação ampliada | Arquivo 2 |
| **KPIs econômicos** | Ainda não implementados | Ambos |
| **Rateio/DRE/ROI/custo por arroba** | Futuro, não faz parte do fechamento atual | Ambos |

### Principais entregas
* Fase 9 base de compra/venda/sociedade estruturada.
* Definição de sociedade como vínculo patrimonial, não evento sanitário/regulatório.
* Validação conceitual do status `retirado`.
* Criação de `src/lib/animals/classificationSnapshot.ts`.
* Criação de `src/lib/inventory/costing.ts`.
* UI `/insumos` passou a coletar custo total/unitário.
* Snapshot econômico preservado no consumo.
* Decisão de não gerar `finance_transaction` automaticamente.

### Principais pendências
* Implementar patch de entrada/saída física e patrimonial em sociedade.
* Criar migration/status `retirado`.
* Atualizar `AnimalStatusEnum`.
* Auditar todos os filtros de status animal.
* Fechar validação ampliada do patch de custo.
* Confirmar `git status`, `git diff --stat`, `git diff --name-only`.
* Justificar alteração em `baseProtocols.test.ts`.
* Integrar `classificationSnapshot` em leituras passivas.

### Principais riscos

| Risco | Gravidade | Motivo |
| :--- | :--- | :--- |
| **`retirado` contaminar métricas de ativo/vendido/morto** | Alto | Afeta rebanho ativo, mortalidade, venda e relatórios |
| **Sociedade gerar evento de conformidade indevido** | Alto | Mistura domínio patrimonial com sanitário/regulatório |
| **Financeiro automático duplicar lançamentos** | Alto | Compra/venda/estoque têm impacto financeiro, mas não são ledger por si só |
| **Custo de lote alterar histórico retroativamente** | Alto | Quebra snapshot econômico e KPIs futuros |
| **`classificationSnapshot` virar fonte persistida** | Médio | Deve ser resolvedor de leitura, não fonte primária |
| **KPI econômico ser criado antes de validar custo/snapshot** | Alto | Produz DRE/ROI/margem frágil ou enganosa |

---

## 2. O que já foi construído

### Funcionalidades

| Funcionalidade | Estado | Origem |
| :--- | :--- | :--- |
| **Base de compra/venda estruturada** | Implementada/estruturada no Arquivo 2; planejada no Arquivo 1 | Ambos |
| **Sociedade pecuária como vínculo patrimonial** | Construído conceitualmente/base existente | Arquivo 2 |
| **Compra/Venda como operação comercial estruturada** | Construído na base da Fase 9 | Arquivo 2 |
| **Financeiro separado de compra/venda/sociedade** | Construído como decisão | Ambos |
| **`classificationSnapshot`** | Construído | Arquivo 2 |
| **Custo de estoque por lote** | Construído | Arquivo 2 |
| **Snapshot econômico de consumo** | Construído | Arquivo 2 |
| **UI de custo em `/insumos`** | Construído | Arquivo 2 |
| **Microcopy de não retroatividade de custo** | Construído | Arquivo 2 |
| **Validação de coerência custo total/unitário** | Construído | Arquivo 2 |

### Telas / Componentes

| Tela / componente | Papel | Origem |
| :--- | :--- | :--- |
| **UI de compra/venda** | Operações comerciais estruturadas | Arquivo 2 |
| **`RegistrarSociedadeSection.tsx`** | Alvo futuro do patch de entrada/saída de sociedade | Arquivo 2 |
| **`/insumos` / `src/pages/Insumos.tsx`** | Coleta e edição de custo do lote de estoque | Arquivo 2 |
| **`Home.tsx`** | Integração futura passiva de classificação | Arquivo 2 |
| **`operationalInsightsAdapter.ts`** | Integração futura passiva de classificação | Arquivo 2 |
| **`herdStageSummary.ts`** | Integração futura passiva de classificação | Arquivo 2 |

### APIs / Serviços

| Serviço/helper | Estado | Origem |
| :--- | :--- | :--- |
| `src/lib/comercial/commercialOperation.ts` | Base da Fase 9 | Arquivo 2 |
| Sync de eventos comerciais | Existente no escopo da Fase 9 | Arquivo 2 |
| `src/lib/animals/classificationSnapshot.ts` | Criado | Arquivo 2 |
| `src/lib/inventory/costing.ts` | Criado | Arquivo 2 |
| `resolveInventoryLotUnitCost(lot)` | Implementado | Arquivo 2 |
| `buildInventoryCostSnapshot({ lot, quantidadeBase })` | Implementado | Arquivo 2 |
| `src/lib/inventory/snapshotBuilder.ts` | Alterado | Arquivo 2 |
| `src/lib/inventory/consumoGesture.ts` | Alterado | Arquivo 2 |
| `src/lib/events/buildEventGesture.ts` | Alterado | Arquivo 2 |

### Banco de dados / Models / Schemas

| Entidade / campo | Estado | Origem |
| :--- | :--- | :--- |
| `eventos_comercial` | No escopo da Fase 9 | Arquivo 2 |
| `sociedades_pecuarias` | No escopo da Fase 9 | Arquivo 2 |
| `sociedade_animais` | No escopo da Fase 9 | Arquivo 2 |
| Stores Dexie comerciais | No escopo da Fase 9 | Arquivo 2 |
| `insumo_lotes.custo_total` | Já existia | Arquivo 2 |
| `insumo_lotes.custo_unitario` | Já existia | Arquivo 2 |
| `insumo_movimentacoes.custo_unitario_snapshot` | Já existia | Arquivo 2 |
| `insumo_movimentacoes.custo_total_snapshot` | Já existia | Arquivo 2 |
| `finance_transactions` | Ledger separado já existente desde Fase 8 | Arquivo 1 |
| `finance_categories` | Ledger separado já existente desde Fase 8 | Arquivo 1 |
| Status `retirado` | Ainda pendente de migration/enum | Arquivo 2 |

O Arquivo 1 informa que Fase 8 criou `finance_transactions`, `finance_categories`, RLS por `fazenda_id`, sync-batch e cockpit financeiro mínimo, mas explicitamente não implementou DRE, ROI, margem, custo por cabeça ou custo por arroba.

### Arquivos / Pastas

* `src/lib/comercial/commercialOperation.ts`
* `eventos_comercial`
* `sociedades_pecuarias`
* `sociedade_animais`
* stores Dexie relacionados a operação comercial
* sync de eventos comerciais
* UI de compra/venda
* `src/lib/animals/classificationSnapshot.ts`
* `src/lib/animals/__tests__/classificationSnapshot.test.ts`
* `src/lib/animals/categoriaHelper.ts`
* `src/lib/inventory/costing.ts`
* `src/lib/inventory/__tests__/costing.test.ts`
* `src/lib/inventory/snapshotBuilder.ts`
* `src/lib/inventory/consumoGesture.ts`
* `src/lib/events/buildEventGesture.ts`
* `src/pages/Insumos.tsx`
* `src/lib/inventory/__tests__/consumoGesture.test.ts`
* `src/lib/.../baseProtocols.test.ts`

**Origem:** Arquivo 2.

### Regras de negócio

| Regra | Decisão consolidada | Origem |
| :--- | :--- | :--- |
| **Agenda** | Intenção/tarefa futura | Ambos |
| **Evento** | Fato histórico executado | Ambos |
| **`state_*`** | Read model / estado atual | Ambos |
| **Compra/Venda** | Operação comercial estruturada | Arquivo 2 |
| **Sociedade** | Vínculo patrimonial entre animal e contraparte/sociedade | Arquivo 2 |
| **Financeiro** | Ledger separado, não automático | Ambos |
| **`classificationSnapshot`** | Resolvedor de leitura, não fonte de verdade | Arquivo 2 |
| **Custo** | Pertence ao lote de estoque, não ao cadastro do insumo | Arquivo 2 |
| **Consumo** | Deve gravar snapshot econômico | Arquivo 2 |
| **Edição de custo** | Afeta apenas consumos futuros | Arquivo 2 |
| **Lotes legados sem custo** | Continuam como custo ausente/parcial | Arquivo 2 |
| **KPIs econômicos** | Não criar sem método/fonte/período/limitação | Ambos |

---

## 3. O que está parcialmente feito

| Item | Estado atual | O que falta | Risco |
| :--- | :--- | :--- | :--- |
| **Entrada/Saída de Animais em Sociedade** | Validada conceitualmente, não executada | Migration, enum, gestures, UI, testes e auditoria de status | Alto |
| **Status `retirado`** | Conceito aprovado | Criar status, atualizar filtros globais e garantir que não conte como ativo/vendido/morto | Alto |
| **`RegistrarSociedadeSection.tsx`** | Identificado como alvo | Reorganizar em quatro fluxos | Médio |
| **`classificationSnapshot`** | Implementado tecnicamente | Conferência final de `git/diff` e integração passiva gradual | Médio |
| **Custo de Estoque** | Implementado no core e UI | Validação ampliada em eventos, Registrar, páginas e suíte global | Médio |
| **`baseProtocols.test.ts`** | Alterado lateralmente | Justificar que foi só label/teste, sem regra sanitária funcional | Alto |
| **KPIs econômicos** | Não implementados | Desenhar regra, fonte, método, período e tratamento de custo ausente | Alto |
| **Conciliação financeira** | Não implementada | Decidir integração futura com `finance_transactions` sem duplicidade | Alto |
| **Lotes legados sem custo** | Aceitos como custo ausente/parcial | Definir política de correção/manualização | Médio |

---

## 4. O que está planejado

### Agora
* Fechar validação do patch de custo.
* Confirmar `baseProtocols.test.ts`.
* Rodar validação ampliada.
* Depois executar patch de entrada/saída em sociedade.

Comandos exigidos no Arquivo 2:
```bash
pnpm test -- src/lib/events
pnpm test -- src/pages/Registrar
pnpm test -- src/pages
pnpm test -- --run
pnpm run lint
pnpm run build
node scripts/codex/validate-supabase-baseline-functional.mjs
git status --short --untracked-files=all
git diff --stat
git diff --name-only

```

**Origem:** Arquivo 2.

### Depois

* Implementar status = `"retirado"`.
* Criar migration.
* Atualizar `AnimalStatusEnum`.
* Auditar todos os filtros de status.
* Reorganizar `RegistrarSociedadeSection.tsx`.
* Criar/ajustar gestures Dexie idempotentes.
* Garantir que `retirado` não contamine KPIs de venda, morte ou rebanho ativo.
* Integrar `classificationSnapshot` em:
* `operationalInsightsAdapter.ts`;
* `herdStageSummary.ts`;
* `Home.tsx`;
* relatórios de composição do rebanho.



### Futuro

* **KPIs econômicos:**
* custo sanitário por animal/lote;
* custo nutricional por lote;
* custo por categoria zootécnica;
* custo por período;
* custo por protocolo;
* custo total operacional parcial.


* Fase 10 — Reprodução Gerencial.
* Fase 11 — Projeções e Cenários.
* Fase 12 — Rateio, DRE Gerencial e Custo por Arroba.

O Arquivo 1 já posicionava Fase 11 e Fase 12 como etapas futuras, com projeções assistivas e rateio/DRE dependentes de fontes, premissas, método e limitações.

---

## 5. Duplicidades entre os arquivos

| Item repetido | Arquivo 1 | Arquivo 2 | Versão consolidada correta |
| --- | --- | --- | --- |
| **Fase 9** | Planejada como Compra/Venda Pecuária Estruturada | Base implementada/estruturada com sociedade | Usar Arquivo 2 como estado mais recente |
| **Financeiro separado** | Ledger administrativo separado de eventos | Financeiro não deve ser automático | Preservar separação; sem geração automática |
| **KPIs econômicos** | Ainda não existem DRE, margem, ROI, custo/@ | Ainda não implementar KPI econômico | Não criar KPIs agora |
| **Snapshot** | Snapshot histórico de insumo/produto no evento | Snapshot econômico de consumo | Preservar snapshot como fonte histórica |
| **Custo por lote** | Fase 6 já tinha custo em snapshot | Patch capturou custo na UI e consumo | Consolidar como implementado, pendente validação ampliada |
| **Fase 12** | Rateio/DRE futuro | KPIs econômicos futuros exigem desenho | Manter para etapa futura |
| **Agenda/evento/state** | Contrato central preservado | Premissas mantidas | Preservar integralmente |

---

## 6. Conflitos entre os arquivos

| Tema | Arquivo 1 | Arquivo 2 | Decisão recomendada | Risco |
| --- | --- | --- | --- | --- |
| **Status da Fase 9** | Ainda planejada | Base implementada/estruturada | Usar Arquivo 2 como estado atual | Médio |
| **Compra/Venda** | Escopo previsto, sem implementação | Base comercial já estruturada | Considerar base feita, mas pendente robustez e sociedade | Médio |
| **Sociedade** | Não detalhada | Sociedade pecuária virou eixo da Fase 9 | Incorporar sociedade como subfrente da Fase 9 | Médio |
| **`retirado`** | Não mencionado | Validado conceitualmente, pendente execução | Implementar só após auditoria global de status | Alto |
| **Custo de estoque** | Snapshot e baixa assistida já existiam | UI `/insumos` e `costing.ts` corrigem lacuna | Considerar custo implementado parcialmente, pendente validação ampliada | Médio |
| **`baseProtocols.test.ts`** | Não mencionado | Alteração lateral pendente de justificativa | Bloquear aceite final se alterar regra sanitária | Alto |
| **KPIs econômicos** | Fase futura | Ainda não implementar | Manter fora do escopo atual | Alto |
| **Financeiro automático** | Fora do escopo | Proibido | Não gerar `finance_transaction` automaticamente | Alto |
| **`classificationSnapshot`** | Não existia como item central | Implementado | Aceitar como pré-Fase 10, sem persistência derivada | Médio |

---

## 7. Pendências consolidadas

| Prioridade | Pendência | Origem | Observação |
| --- | --- | --- | --- |
| **Alta** | Fechar validação ampliada do patch de custo | Arquivo 2 | Eventos, Registrar, páginas, suíte global, lint, build, baseline |
| **Alta** | Justificar `baseProtocols.test.ts` | Arquivo 2 | Aceitar só se for label/teste, sem regra sanitária funcional |
| **Alta** | Implementar status = `"retirado"` com migration/enum | Arquivo 2 | Exige auditoria global |
| **Alta** | Auditar filtros globais de status animal | Arquivo 2 | Não limitar a `useOccupancyData.ts` |
| **Alta** | Garantir que `retirado` não conte como ativo/vendido/morto | Arquivo 2 | Protege KPIs e relatórios |
| **Alta** | Não gerar financeiro automático | Ambos | Evita duplicidade |
| **Média** | Reorganizar `RegistrarSociedadeSection.tsx` em quatro fluxos | Arquivo 2 | Entrada, vincular, retirar, encerrar |
| **Média** | Criar/ajustar gestures Dexie idempotentes para sociedade | Arquivo 2 | Usar nomes remotos corretos |
| **Média** | Integrar `classificationSnapshot` passivamente | Arquivo 2 | Começar por adapter, resumo de estágio, Home e relatórios |
| **Média** | Definir política para lotes legados sem custo | Arquivo 2 | Custo ausente/parcial |
| **Média** | Confirmar `git status/diff` do `classificationSnapshot` | Arquivo 2 | Fechamento formal |
| **Baixa** | KPIs econômicos | Ambos | Só após desenho específico |
| **Baixa** | DRE/ROI/margem/custo por arroba | Ambos | Fase futura |
| **Baixa** | Fase 10 Reprodução Gerencial | Ambos | Usar classificação como apoio, não fonte factual |

---

## 8. Decisões técnicas consolidadas

**Preservar**

* Agenda = intenção/tarefa futura.
* Evento = fato histórico executado.
* `state_*` = read model atual.
* Protocolo = regra/configuração.
* Tags/sinais/insights = auxiliares, nunca fonte primária.
* Financeiro = ledger administrativo separado.
* Compra/Venda/Sociedade não geram financeiro automaticamente.
* Sociedade = vínculo patrimonial, não conformidade sanitária.
* Custo pertence ao lote de estoque.
* Consumo grava snapshot econômico.
* Snapshot histórico não é reprocessado.
* `classificationSnapshot` = resolvedor de leitura, não fonte persistida.

**Revisar/implementar com cuidado**

* status `retirado`
* `AnimalStatusEnum`
* migration de status
* filtros globais de animal ativo/vendido/morto
* gestures Dexie idempotentes de sociedade
* `baseProtocols.test.ts`
* integração passiva do `classificationSnapshot`
* tratamento de custo ausente em lotes legados

**Não fazer agora**

* financeiro automático
* rateio
* DRE
* ROI
* margem
* custo por arroba
* prontidão comercial automática
* apto para venda
* liberado para abate
* inferência reprodutiva crítica por idade/sexo

---

## 9. Lacunas de informação

* Informação não identificada nos arquivos: diff real da Fase 9 base.
* Informação não identificada nos arquivos: migrations já aplicadas para `eventos_comercial`/`sociedades_pecuarias`/`sociedade_animais`.
* Informação não identificada nos arquivos: schema completo de `sociedades_pecuarias`.
* Informação não identificada nos arquivos: schema completo de `sociedade_animais`.
* Informação não identificada nos arquivos: detalhes do sync de eventos comerciais.
* Informação não identificada nos arquivos: testes atuais de UI de compra/venda.
* Informação não identificada nos arquivos: shape exato de `commercialOperation.ts`.
* Informação não identificada nos arquivos: se existe `RegistrarSociedadeSection.tsx` no estado atual do repo.
* Informação não identificada nos arquivos: diff real de `baseProtocols.test.ts`.
* Informação não identificada nos arquivos: se `git status/diff` final do `classificationSnapshot` foi rodado.
* Informação não identificada nos arquivos: se `pnpm test` global pós-custo foi executado.
* Informação não identificada nos arquivos: regra final para lotes legados sem custo.
* Informação não identificada nos arquivos: política futura de conciliação com `finance_transactions`.

---

## 10. Próximo passo recomendado

### Decisão

**Antes de mexer em sociedade, fechar o aceite do patch de custo.**

### Sequência técnica recomendada

**Passo 1 — Fechar custo de estoque**
Rodar e registrar:

```bash
pnpm test -- src/lib/events
pnpm test -- src/pages/Registrar
pnpm test -- src/pages
pnpm test -- --run
pnpm run lint
pnpm run build
node scripts/codex/validate-supabase-baseline-functional.mjs
git status --short --untracked-files=all
git diff --stat
git diff --name-only

```

**Critério obrigatório:**

* `baseProtocols.test.ts` só pode ser aceito se for ajuste de label/asserção.
* Não pode alterar regra sanitária, protocolo, agenda, carência ou biblioteca vacinal funcional.

**Passo 2 — Executar Patch Fase 9 — Entrada/Saída Física e Patrimonial em Sociedade**
Escopo mínimo:

1. Criar status `retirado`.
2. Atualizar `AnimalStatusEnum`.
3. Auditar filtros globais de status.
4. Ajustar `RegistrarSociedadeSection.tsx`.
5. Criar/ajustar gestures Dexie idempotentes.
6. Usar nomes remotos: `animais`, `sociedades_pecuarias`, `sociedade_animais`.
7. Separar retirada patrimonial de retirada física.
8. Garantir que encerramento de sociedade não sobrescreva vendido/morto/retirado.
9. Testar que `retirado` não conta como ativo, vendido ou morto.

**Passo 3 — Integrar `classificationSnapshot` passivamente**
Começar por:

* `operationalInsightsAdapter.ts`
* `herdStageSummary.ts`
* `Home.tsx`
* relatórios de composição do rebanho

*Sem persistir classificação derivada.*

```

```