# PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO

**Status:** Gate Pós-MVP Comercial/Patrimonial/Classificação/Custo
**Subfase:** 9A — Inventário Operacional
**Commit Baseline:** `8cd5534`
**Criado:** 2026-06-04

---

## Objetivo — O que entregar

Consolidar a base comercial e patrimonial da fazenda após conclusão de Fase 6-8,
validar custo operacional por inventário, garantir idempotência de baixa,
isolamento de sociedade patrimonial, e preparar sistema para leitura
de classificação operacional.

---

## Estado consolidado anterior — Fases 1-8

**Fase 1-5:** Baseline MVP, animais, agenda, sanitário (SLC).
**Fase 6:** Sanitário avançado, carência, protocolo, evento separados.
**Gates 6:** Validação de contrato sanitário e separação de agenda/evento/estado.
**Fase 7:** Compra/venda, sociedade, primeira visão comercial.
**Fase 8:** Relatórios Fase 1-8, limpeza de warnings, baseline estável.

**Commitments já ativos:**

- RLS por `fazenda_id` (multi-tenant)
- Offline-first (Dexie/IndexedDB + sync via RPCs)
- Agenda/Eventos/`state_*` separados
- Carência sanitária não autoriza venda/abate (sinal, não autorização)
- Produto/dose/lote limitados e rastreáveis
- Sync idempotente (upsert, retry-safe)

---

## Primeira entrega — Subfase 9A: Inventário Operacional

### 9A.1 — Unidade de Compra/Apresentação vs Unidade Base

**O quê:**

- Registrar unidade de compra/apresentação (ex: frasco, saco, lote comercial)
- Converter para unidade base (ex: mL, kg, doses)
- Preservar multiplicador de conversão

**Por quê:**

- Produtor compra em unidades comerciais (frasco de 50 doses)
- Sistema opera em unidades base (doses)
- Sem conversão explícita, custo por dose fica ambíguo

**Exemplos:**

```
Compra: 4 frascos @ R$ 200/frasco
Unidade apresentação: frasco
Conteúdo: 50 doses/frasco
Custo unitário base: R$ 200 / 50 = R$ 4/dose
Custo total: 4 * 50 = 200 doses @ R$ 4/dose = R$ 800
```

**Contrato:**

- Conversão é determinística (não há ambiguidade)
- Multiplicador >= 1
- Conversão é registrada, não inferida
- Sem conversão, unidade apresentação == unidade base

---

### 9A.2 — Custo Operacional por Inventário

**O quê:**

- Registrar custo de cada entrada de inventário (compra, produção, consumo)
- Modelar "custo ausente" como diferente de "custo zero"
- Não permitir custo implícito

**Por quê:**

- Produtor precisa saber custo operacional
- Custo ausente (desconhecido) != custo zero (cortesia/lucro bruto)
- Sem distinção, relatório de custo é falso

**Exemplos:**

```
Vacina comprada: 200 doses @ R$ 4/dose = R$ 800 (custo = 800, conhecido)
Vacina produzida: 500 doses (custo = null, desconhecido; não = 0)
Vacina doada: 100 doses (custo = 0, explícito cortesia)

Relatório de custo operacional inclui APENAS 800 (comprada).
Produzida e doada aparecem em volume, custo separado.
```

**Contrato:**

- Custo é número real >= 0 ou null (não há "zero implícito")
- Entrada sem custo não entra em cálculo de custo total
- Relatório diferencia custo conhecido de desconhecido
- Sem custo, indicador de custo/dose não é calculável (não = 0)

---

### 9A.3 — Snapshot Econômico Preservado

**O quê:**

- Registrar snapshot de estado econômico (custo, valor de venda, margem potencial)
- Snapshot é imutável (histórico)
- Alteração futura de custo não recalcula snapshot passado

**Por quê:**

- Produtor precisa de auditoria financeira
- Decisão de venda era baseada em custo X, não em recálculo posterior
- Retroatividade quebra accountability

**Exemplos:**

```
Snapshot 2026-06-01:
- 200 doses @ R$ 4/dose = R$ 800 (custo)
- Valor de mercado: R$ 6/dose = R$ 1200
- Margem potencial: R$ 400

2026-06-15: Descobre-se que compra anterior tinha cupom de desconto (custo real = R$ 3/dose)
Snapshot de 2026-06-01 NÃO ALTERA.
Nova entrada de "ajuste" pode ser registrada, mas histórico não muda.
```

**Contrato:**

- Snapshot criado no momento de entrada/evento
- Snapshot não sofre recálculo retroativo
- Correção é nova entrada, não edição histórica
- Relatório de snapshot pode agregar, mas elemento único é imutável

---

### 9A.4 — Baixa de Inventário Idempotente

**O quê:**

- Registrar saída de inventário (uso, venda, descarte, etc.)
- Retry de sincronização não duplica baixa
- Custo de saída reflete multiplicador de unidade

**Por quê:**

- Offline-first: sincronização pode falhar e repetir
- Duplicação de baixa quebra contabilidade
- Sem idempotência, relatório de saldo é falso

**Exemplos:**

```
Baixa 1: 50 doses usadas (custo = 50 * R$ 4 = R$ 200)
Sync falha, retry com mesma transação ID
Resultado: 50 doses baixadas 1x (idempotente)

Sem idempotência (bug): 100 doses baixadas (duplicate entry)
```

**Contrato:**

- Baixa tem ID único (transação, timestamp, etc.)
- Retry com mesmo ID não duplica
- Baixa automática de estoque por evento/source é protegida remotamente por índice único parcial para consumo sanitário e nutricional
- Custo de saída = quantidade * (custo unitário * multiplicador)
- Testes obrigatórios para retry-safety

---

### 9A.5 — Isolamento de Sociedade Patrimonial

**O quê:**

- Registrar possibilidade de "sociedade" (co-propriedade de animal/rebanho)
- Isolamento por RLS: cada usuário/fazenda vê apenas sua fatia
- Custo/inventário não "vazam" entre sócios

**Por quê:**

- Propriedade compartilhada é comum em fazendas
- Sem isolamento, custo de um sócio vira transparente para outro
- RLS deve defender no DB, não na UI

**Exemplos:**

```
Animal X: 50% Sócio A, 50% Sócio B
Custo de vacinação: R$ 100 (da propriedade compartilhada)
Sócio A vê: custo = R$ 100, mas não vê fatia de B isoladamente
RLS: apenas Sócio A vê linha de custo com sua fazenda_id
```

**Contrato:**

- Sociedade é metadado de animal/lote (frações % de propriedade)
- RLS filtra por `fazenda_id` + societário (se existir)
- Custo compartilhado é registrado uma vez, mas visão filtrada por RLS
- Sem visão cruzada entre sócios

---

### 9A.6 — Classificação Operacional (Leitura)

**O quê:**

- Permitir leitura de classificação operacional (ex: "vacinado", "pronto para processamento", "em quarentena")
- Classificação é SNAPSHOT, não altera estado de animal
- Classificação não autoriza ação (venda, abate, etc.)

**Por quê:**

- Produtor precisa entender "por que este animal pode/não pode vender"
- Classificação deve ser RESULTADO de análise, não gatilho automático
- Sem separação, falsa liberação estatutária é possível

**Exemplos:**

```
Animal X:
- Carência: false (sanitário OK)
- Custo registrado: true
- Peso mínimo: true
- Classificação operacional (snapshot): "pronto_processamento"

Mas:
- Venda ainda requer autorização explícita
- Classificação é LEITURA, não gatilho
- Se carência mudar amanhã, classificação anterior não apaga
```

**Contrato:**

- Classificação é snapshot (não altera histórico anterior)
- Leitura de classificação não autoriza ação
- Classificação é RESULTADO, não REGRA DE NEGÓCIO
- Sem automação de venda/abate baseada em classificação sozinha

---

## Contratos obrigatórios — 6 regras

1. **Conversão de unidade:** Determinística, registrada, não inferida
2. **Idempotência de baixa:** Retry não duplica, ID único obrigatório
3. **Custo ausente != zero:** Null e 0 são diferentes, ambos válidos
4. **Snapshot econômico:** Imutável, sem recálculo retroativo
5. **Isolamento patrimonial:** RLS enforces por `fazenda_id`, sem cross-view
6. **Classificação leitura:** Snapshot apenas, não autoriza ação, não altera estado

---

## Diagnóstico obrigatório — Auditar status

```bash
# 1. Conversão de unidade registrada?
git grep -n "multiplicador\|conversion\|unidade_apresentacao" -- src/

# 2. Custo diferencia null vs 0?
git grep -n "custo === null\|custo === 0\|cost_absent" -- src/

# 3. Snapshot preservado (migrations)?
git grep -n "snapshot\|immutable\|created_at.*NOT NULL" -- supabase/migrations/

# 4. Baixa idempotente (testes)?
git grep -n "idempotent\|transaction_id\|retry" -- tests/

# 5. RLS isolamento sociedade?
git grep -n "fazenda_id\|society\|fraction" -- supabase/migrations/ | grep "POLICY\|WHERE"

# 6. Classificação leitura apenas?
git grep -n "classification.*read\|snapshot.*frozen" -- src/features/
```

---

## Áreas candidatas para auditoria

- [ ] Tela "Status do Animal" — conversão visível?
- [ ] Tela "Inventário de Insumos" — custo/unidade claros?
- [ ] Tela "Histórico de Movimentações" — snapshot preservado?
- [ ] Tela "Baixa de Inventário" — retry testado?
- [ ] Central Operacional — sociedade isolada?
- [ ] Eventos Sanitários — classificação visível mas read-only?
- [ ] Relatório de Custo — diferencia conhecido vs desconhecido?
- [ ] RLS queries — fazenda_id + society filters?
- [ ] Testes unitários — cobertura de casos edge?
- [ ] Logs de sincronização — retry sem duplicate?

---

## Validação técnica

**Comandos obrigatórios:**

```bash
# Testes
pnpm run test

# Lint
pnpm run lint

# Build
pnpm run build

# Git checks
git diff --check
git status

# Supabase RLS validation (se disponível)
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## Exemplo obrigatório — Caso de uso aceito

**Cenário:** Compra de vacina, registro de custo, aplicação, snapshot, classificação

```
1. Compra: 4 frascos de vacina @ R$ 200/frasco
   - Unidade apresentação: frasco
   - Conteúdo: 50 doses/frasco
   - Custo unitário base: R$ 4/dose
   - Total: 200 doses @ R$ 4/dose = R$ 800
   - Snapshot criado: {data, 200 doses, R$ 800}

2. Registro de aplicação: Vacinação de 150 doses em lote A
   - Custo desta aplicação: 150 * R$ 4 = R$ 600
   - Saldo restante: 50 doses

3. Retry de sincronização:
   - Mesmo registro de aplicação novamente
   - Sistema reconhece transaction_id, NÃO duplica
   - Saldo continua: 50 doses

4. Classificação operacional:
   - Lote A após vacinação: "vacinado", não = decisão automática de venda
   - Classificação é snapshot (read-only)
   - Venda ainda requer autorização explícita

5. Auditoria:
   - Custo conhecido: R$ 800 (compra)
   - Custo aplicado: R$ 600
   - Saldo econômico: R$ 200 (50 doses x R$ 4)
   - Histórico imutável, sem recálculo retroativo
```

---

## Critérios de aceite — 11 itens

1. [ ] Conversão de unidade funciona e é testada
2. [ ] Custo diferencia null vs 0 explicitamente
3. [ ] Snapshot econômico é imutável
4. [ ] Baixa de inventário é idempotente (retry tested)
5. [ ] Isolamento de sociedade por RLS validado
6. [ ] Classificação é leitura apenas (read-only snapshot)
7. [ ] Testes cobrem todos os 6 contratos
8. [ ] Sem warnings TypeScript/ESLint em código novo
9. [ ] Documentação interna reflete contratos
10. [ ] git diff --check passa
11. [ ] Supabase RLS baseline funcional

---

## Resultado esperado

**Ao fim de Subfase 9A:**

- Inventário operacional consolidado (unidade/custo/snapshot)
- Idempotência de baixa confirmada
- Isolamento de sociedade patrimonial ativo
- Classificação operacional legível (read-only)
- Todos os testes passam
- Baseline preparado para Subfase 9B (Relatórios Operacionais de Custo Parcial)

---

---

## Fechamento — Subfase 9B: Relatórios Operacionais de Custo Parcial

**Status:** concluída localmente, com patch validado.

Entregue na 9B:

- leitura operacional parcial de custo no relatório existente;
- `inventory.partialCost` em `src/lib/reports/operationalSummary.ts`;
- cálculo fora da UI;
- apresentação em `src/pages/Relatorios.tsx`;
- leitura derivada/read model;
- custo operacional parcial conhecido;
- custo conhecido de entradas separado de custo ausente;
- custo conhecido de saídas/consumos separado de custo ausente;
- saldo econômico parcial conhecido por lote ativo;
- lotes e movimentações com custo ausente preservados como limitação explícita;
- `0` tratado como custo válido;
- `null`/`undefined` tratados como custo ausente;
- ausência de inferência de custo quando snapshot está ausente.

Validações registradas:

- `git diff --check`: passou;
- `pnpm test -- src/lib/reports/__tests__/operationalSummary.test.ts`: passou;
- `pnpm test -- src/pages/__tests__/Relatorios.e2e.test.tsx`: passou;
- `pnpm test`: passou (260 arquivos, 1747 testes);
- `pnpm run lint`: passou;
- `pnpm run build`: passou com warnings conhecidos de Browserslist/chunks.

Limites preservados:

- sem DRE;
- sem ROI;
- sem venda/abate;
- sem margem;
- sem custo por arroba;
- sem motor comercial avançado.

**Próximo:** continuar Fase 9 sem marcar a fase inteira como concluída.
