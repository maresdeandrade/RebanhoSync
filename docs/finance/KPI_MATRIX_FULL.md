# KPI Matrix Full — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir matriz completa de KPIs financeiros e operacionais do RebanhoSync, com fonte, fórmula, status e limitações.

Este arquivo pode ser extenso.  
Não deve ser leitura padrão de agentes para tarefas simples.

Para consulta curta, usar:

- `docs/finance/KPI_INDEX.md`
- `docs/finance/FINANCIAL_LIMITS.md`

---

## Regras gerais

Todo KPI deve declarar:

- nome;
- objetivo;
- fonte;
- período;
- escopo;
- fórmula;
- status;
- limitações;
- riscos de interpretação.

---

## Status

| Status | Significado |
|---|---|
| MVP | Pode ser priorizado no MVP. |
| Parcial | Pode existir com limitação. |
| Futuro | Requer modelagem adicional. |
| Bloqueado | Não calcular sem contrato/fonte. |
| Fora de escopo | Não pertence ao MVP. |

---

# 1. Rebanho

## Animais ativos

| Campo | Valor |
|---|---|
| Status | MVP |
| Fonte | `state_animais` |
| Período | Atual |
| Fórmula | Contagem de animais com status ativo |
| Limitação | Depende de read model atualizado |
| Risco | Animal vendido/morto ainda ativo por falha de sync |

---

## Animais por lote

| Campo | Valor |
|---|---|
| Status | MVP |
| Fonte | `state_animais` + lote atual |
| Período | Atual |
| Fórmula | Contagem por `lote_id` atual |
| Limitação | Não é histórico de permanência |
| Risco | Usar lote atual como histórico |

---

## Animais por pasto

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | `state_animais` + pasto atual |
| Período | Atual |
| Fórmula | Contagem por `pasto_id` atual |
| Limitação | Depende de estado atual confiável |
| Risco | Não representa ocupação histórica |

---

# 2. Agenda

## Pendências abertas

| Campo | Valor |
|---|---|
| Status | MVP |
| Fonte | Agenda aberta / `state_agenda_itens` |
| Período | Atual |
| Fórmula | Contagem de itens abertos |
| Limitação | Agenda não é histórico |
| Risco | Tratar pendência como execução |

---

## Pendências atrasadas

| Campo | Valor |
|---|---|
| Status | MVP |
| Fonte | Agenda aberta + data de referência |
| Período | Atual |
| Fórmula | Itens abertos com vencimento anterior à data de referência |
| Limitação | Depende de data de referência |
| Risco | Usar data local divergente sem controle |

---

## Pendências de hoje

| Campo | Valor |
|---|---|
| Status | MVP |
| Fonte | Agenda aberta + data |
| Período | Dia atual |
| Fórmula | Itens abertos com vencimento na data |
| Limitação | Não comprova execução |
| Risco | Confundir com eventos do dia |

---

# 3. Eventos

## Eventos no período

| Campo | Valor |
|---|---|
| Status | MVP |
| Fonte | `eventos` |
| Período | Definido pelo usuário |
| Fórmula | Contagem de eventos não deletados no período |
| Limitação | Exige período |
| Risco | Incluir eventos corrigidos/deletados indevidamente |

---

## Eventos por domínio

| Campo | Valor |
|---|---|
| Status | MVP |
| Fonte | `eventos` |
| Período | Definido |
| Fórmula | Agrupar eventos por domínio/tipo |
| Limitação | Depende da taxonomia de eventos |
| Risco | Misturar detail types incompatíveis |

---

# 4. Sanitário

## Eventos sanitários no período

| Campo | Valor |
|---|---|
| Status | MVP |
| Fonte | `eventos` + detalhe sanitário |
| Período | Definido |
| Fórmula | Contagem de eventos sanitários no período |
| Limitação | Evento sem detail reduz precisão |
| Risco | Usar agenda sanitária como execução |

---

## Custo sanitário por evento

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | Evento sanitário + snapshot econômico |
| Período | Evento ou período |
| Fórmula | Soma dos custos dos itens sanitários do evento |
| Limitação | Parcial se custo/produto/lote ausente |
| Risco | Tratar custo ausente como zero |

---

## Custo sanitário por produto

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | Evento sanitário + produto + snapshot |
| Período | Definido |
| Fórmula | Soma de custo por produto no período |
| Limitação | Produto sem custo gera parcial |
| Risco | Usar preço atual para evento antigo |

---

## Estoque sanitário consumido

| Campo | Valor |
|---|---|
| Status | Parcial |
| Fonte | Baixas de estoque vinculadas a eventos |
| Período | Definido |
| Fórmula | Soma de quantidade consumida por produto/lote |
| Limitação | Depende de baixa idempotente |
| Risco | Retry duplicar consumo |

---

## Carência sanitária ativa como sinal

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | Evento sanitário estruturado + campos/regra de carência |
| Período | Atual/data de referência |
| Fórmula | Há carência vigente se `carencia_*_ate` >= data de referência |
| Limitação | Só é sinal sanitário |
| Risco | Interpretar como bloqueio/liberação comercial universal |

---

## Sem carência sanitária vigente como sinal

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | Eventos sanitários estruturados |
| Período | Atual/data de referência |
| Fórmula | Nenhuma carência vigente nas fontes estruturadas disponíveis |
| Limitação | Não equivale a liberação final |
| Risco | Interpretar como apto para venda/abate |

---

# 5. Compra/Venda

## Compras no período

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | Evento/operação de compra |
| Período | Definido |
| Fórmula | Contagem de compras ou animais comprados |
| Limitação | Depende de modelagem de compra |
| Risco | Confundir cadastro inicial com compra |

---

## Custo de aquisição

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | Compra + snapshot |
| Período | Evento ou período |
| Fórmula | Soma dos valores de aquisição registrados |
| Limitação | Pode não incluir custos adicionais |
| Risco | Tratar ausente como zero |

---

## Vendas no período

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | Evento/operação de venda |
| Período | Definido |
| Fórmula | Contagem de vendas ou animais vendidos |
| Limitação | Depende de modelagem de venda |
| Risco | Saída não comercial confundida com venda |

---

## Receita de venda

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | Venda + snapshot |
| Período | Definido |
| Fórmula | Soma dos valores de venda |
| Limitação | Receita bruta/declarada, não lucro |
| Risco | Usuário interpretar como resultado líquido |

---

## Margem parcial

| Campo | Valor |
|---|---|
| Status | Parcial |
| Fonte | Receita conhecida - custos conhecidos |
| Período | Definido |
| Fórmula | Receita registrada - custos registrados |
| Limitação | Não inclui custos ausentes |
| Risco | Ser tratada como lucro final |

---

# 6. Peso e desempenho

## Ganho de peso entre pesagens

| Campo | Valor |
|---|---|
| Status | Parcial |
| Fonte | Eventos de pesagem |
| Período | Entre duas pesagens |
| Fórmula | Peso final - peso inicial |
| Limitação | Exige duas pesagens válidas |
| Risco | Usar como projeção atual |

---

## GMD — ganho médio diário

| Campo | Valor |
|---|---|
| Status | Parcial |
| Fonte | Pesagens válidas |
| Período | Entre datas de pesagem |
| Fórmula | `(peso_final - peso_inicial) / dias` |
| Limitação | Exige datas válidas |
| Risco | Ignorar mudança de lote/pasto |

---

## Custo por kg ganho

| Campo | Valor |
|---|---|
| Status | Futuro/Parcial |
| Fonte | Custos conhecidos + ganho de peso |
| Período | Definido |
| Fórmula | Custos conhecidos / kg ganho |
| Limitação | Depende de custos completos e pesagens |
| Risco | Tratar como custo real completo |

---

## Custo por arroba

| Campo | Valor |
|---|---|
| Status | Bloqueado/Parcial futuro |
| Fonte | Custos + peso confiável |
| Período | Atual ou evento |
| Fórmula | Custos / arrobas |
| Limitação | Peso atual confiável não confirmado |
| Risco | Decisão comercial falsa |

---

# 7. Lotes e pastos

## Lotação atual

| Campo | Valor |
|---|---|
| Status | Parcial |
| Fonte | Estado atual + área do pasto |
| Período | Atual |
| Fórmula | Animais ou UA / área |
| Limitação | Unidade animal pode não estar modelada |
| Risco | Interpretar como capacidade produtiva |

---

## Lotação histórica

| Campo | Valor |
|---|---|
| Status | Parcial/Futuro |
| Fonte | Eventos de movimentação + área |
| Período | Definido |
| Fórmula | Animais/UA no período por área |
| Limitação | Exige entrada/saída consistentes |
| Risco | Usar estado atual como histórico |

---

## Tempo de permanência em pasto

| Campo | Valor |
|---|---|
| Status | Parcial |
| Fonte | Eventos de movimentação |
| Período | Definido |
| Fórmula | Data saída - data entrada |
| Limitação | Entrada/saída precisam existir |
| Risco | Lacunas de histórico |

---

## ECC médio do lote

| Campo | Valor |
|---|---|
| Status | Parcial |
| Fonte | ECC individual estruturado ou registros vinculados |
| Período | Atual ou data de avaliação |
| Fórmula | Média dos ECCs válidos |
| Limitação | Depende de coleta individual |
| Risco | Usar ECC global de pasto como animal |

---

# 8. Reprodução

## Nascimentos no período

| Campo | Valor |
|---|---|
| Status | MVP/Parcial |
| Fonte | Evento de parto/cria |
| Período | Definido |
| Fórmula | Contagem de crias/eventos de nascimento |
| Limitação | Depende de vínculo mãe-cria |
| Risco | Duplicidade por retry |

---

## Mortalidade de cria

| Campo | Valor |
|---|---|
| Status | Parcial |
| Fonte | Evento de óbito + vínculo cria |
| Período | Definido |
| Fórmula | Óbitos de cria / nascimentos |
| Limitação | Exige eventos de óbito e nascimento |
| Risco | Status atual sem evento histórico |

---

## Taxa de prenhez

| Campo | Valor |
|---|---|
| Status | Futuro/Bloqueado |
| Fonte | Diagnóstico de gestação validado |
| Período | Estação/lote |
| Fórmula | Prenhes / avaliadas |
| Limitação | Motor reprodutivo amplo não confirmado |
| Risco | Inferência reprodutiva indevida |

---

# 9. Bloqueados

## Pronto para venda

| Campo | Valor |
|---|---|
| Status | Bloqueado |
| Fonte necessária | Contrato comercial/técnico composto |
| Motivo | Exige peso, sanidade, carência, mercado, status, documentação e decisão operacional |
| Risco | Venda indevida |

---

## Apto para abate

| Campo | Valor |
|---|---|
| Status | Bloqueado |
| Fonte necessária | Contrato técnico/sanitário/documental composto |
| Motivo | Carência isolada não basta |
| Risco | Risco sanitário, legal e comercial |

---

## Peso atual confiável

| Campo | Valor |
|---|---|
| Status | Bloqueado |
| Fonte necessária | Política técnica de validade do peso |
| Motivo | Última pesagem pode estar desatualizada |
| Risco | Decisão comercial falsa |

---

## Lucro final

| Campo | Valor |
|---|---|
| Status | Bloqueado/Futuro |
| Fonte necessária | Custos completos, receitas, despesas, rateios e período |
| Motivo | MVP não é contabilidade completa |
| Risco | Resultado econômico falso |

---

## ROI

| Campo | Valor |
|---|---|
| Status | Futuro |
| Fonte necessária | Investimento, período, receitas, custos, rateios |
| Motivo | Exige modelagem financeira avançada |
| Risco | Indicador enganoso |

---

## DRE completa

| Campo | Valor |
|---|---|
| Status | Fora de escopo |
| Fonte necessária | Contabilidade estruturada |
| Motivo | MVP não é ERP contábil |
| Risco | Expansão indevida |

---

## Critério de aceite da matriz

Um KPI da matriz pode ser implementado quando:

- status permite;
- fonte existe no código/dados;
- fórmula é clara;
- período é definido;
- limitações são exibidas;
- não há inferência crítica indevida;
- custo ausente não vira zero;
- teste cobre caso normal e edge case;
- UX não promete decisão comercial automática.