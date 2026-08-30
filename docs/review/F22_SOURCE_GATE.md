# Fase 22 — Gate de fontes 22A/22B

Atualizado em: 2026-08-30
Baseline: `origin/main@b110f0a566d9aa99c83769032d6b7ffdc7956c01`
Branch: `feat/f22-source-gate`
Decisão do gate: **READY WITH CAVEATS**

```text
F22_SOURCE_GATE = CLOSED
22A = PARTIAL
22B = PARTIAL
22C = SOURCE_GATE_UNBLOCKED
```

## Escopo e pergunta

Este artefato responde exclusivamente quais análises de peso/desempenho e de resultado econômico podem ser construídas com as fontes atuais. Não implementa métrica, selector, writer, UI, migration, RLS, RPC, Dexie ou sync.

Decisões:

- `22A_PARTIAL`;
- `22B_PARTIAL`;
- `22C_SOURCE_GATE_UNBLOCKED` após a integração da evidência B4 na `main`.

## Baseline

`main` estava vinculada a outro worktree. Para não usar a branch anteriormente aberta nem incorporar seu estado, a branch desta entrega foi criada diretamente de `origin/main@b110f0a566d9aa99c83769032d6b7ffdc7956c01`. A worktree ficou limpa e sem diff antes do inventário.

## Critério de classificação

| Status | Critério |
|---|---|
| `READY` | Fonte factual/configuração necessária presente, tenant e tempo explícitos, convergência e cobertura verificáveis e sem conflito silencioso. |
| `PARTIAL` | Há evidência útil, mas falta campo, cobertura, política ou vínculo para fechar a interpretação. |
| `BLOCKED` | A capacidade não pode ser calculada com segurança pelas fontes atuais. |
| `NOT_CANONICAL` | Implementação/read model existente não satisfaz os guardrails da F22 e não deve ser reutilizado como autoridade. |

`coverage` abaixo significa cobertura declarada do recorte consultado. Coleção vazia só comprova zero quando o carregamento/convergência do recorte estiver verificado e não houver operação local pendente.

## Inventário 22A — peso e desempenho

| Fonte | Categoria | Natureza | `fazendaId` | Data temporal | Origem | Coverage / convergência | Idempotência | Limitações | Consumidores atuais | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `eventos` + `eventos_pesagem` | pesagem zootécnica | factual | `fazenda_id` nas duas tabelas e FK composta | `eventos.occurred_at` | Evento base + detail; `peso_kg` em kg | pull padrão, refresh pós-sync e proteção de pending; F17 declara convergência das duas fontes | `client_op_id`/`client_tx_id`; detail único por `evento_id` | não há campos canônicos de método/origem; o detail recebe `payload: {}` e o payload opcional do Evento-base é livre, inconsistente entre callers | AnimalDetalhe, Relatórios, occupancy, `weight_data_quality` | `PARTIAL` |
| `DecisionRecommendation.weight_data_quality` | qualidade/freshness | read model derivado | filtra novamente `fazendaId` e animal | cutoff, `occurred_at`, timezone e idade em dias | `eventos` + `eventos_pesagem` | expõe modo/verificação por fonte, detail ausente e conflito no instante mais recente | pura e reconstruível | exige limite técnico externo `freshnessLimitDays`; não expõe método/origem da medição | Home / decisão assistida | `READY` para qualidade do último peso observado; não para “peso atual” |
| `MetricResult` de `pesagem_eventos`, `pesagem_media_kg`, `pesagem_ultimo_kg` | KPI histórico | read model derivado | escopo de `OperationalSummaryInput.fazendaId` | período inclusivo e timezone declarado | Eventos/detail | status `complete`, `partial` ou `unavailable`; detail faltante reduz cobertura | pura e reconstruível | média é das pesagens do recorte, não do rebanho; último peso é do período, não peso atual | Relatórios/exportações | `READY` com cobertura verificada e limitações preservadas |
| `eventos_comercial` v2 | peso comercial | factual comercial | `fazenda_id` + FKs compostas | `occurred_at` | declaração/snapshot comercial, incluindo `weight_source` nas linhas de pricing | pull padrão e fluxo composto; `calculation_status`/`limitations` registram incompletude | `client_op_id`, `domain_op_id` e `evento_id` | peso comercial não é pesagem zootécnica e não atualiza peso do animal | Financeiro, Relatórios, histórico comercial | `READY` somente para análise da operação comercial factual |
| `vw_animais_peso_atual` | estado corrente derivado remoto | read model | `animal_id` + `fazenda_id` | `pesado_em`, idade e stale fixo em 90 dias | última linha por timestamp | não declara cobertura/convergência; `current_date` e timezone fixo | reconstruível | nome induz “peso atual”; não detecta empate conflitante, não guarda método/origem e escolhe sem desempate determinístico além do timestamp | referência espelhada por `pesoAtual.ts` | `NOT_CANONICAL` para F22 |
| `resolveCurrentWeight` | estado corrente derivado local | read model puro | retorna fazenda/animal da linha escolhida | `occurred_at`, idade e stale fixo em 90 dias | coleção recebida | não carrega nem declara cobertura; não valida tenant/animal único, data inválida/futura ou conflito | pura | “último observado” é nomeado `CurrentWeight`; sem método/origem e com relógio runtime default | AnimalDetalhe | `NOT_CANONICAL` para F22 |
| `buildWeightGainForOccupancy` | GMD por ocupação | derivação | depende do período/coleções recebidos | pesagens próximas da entrada/saída | `eventos` + detail local | não declara coverage/convergência | pura | usa pesagens mais próximas, inclusive fora do intervalo; usa relógio global para ocupação aberta; não trata conflitos; intervalo não positivo vira GMD zero | occupancy de lote/pasto | `NOT_CANONICAL` para F22A/F22C |

### Gate técnico 22A

A fonte factual permite representar hoje:

- última **pesagem observada** por animal;
- valor em kg e data da medição (`occurred_at`);
- identidade técnica da fonte (Evento + detail), idade do dado, cutoff, timezone, freshness com limite técnico explícito, coverage, convergência, conflitos e limitações.

Não permite representar hoje de forma canônica:

- método da medição;
- origem semântica da medição (balança, compra, venda, importação etc.); alguns callers registram pistas no payload livre do Evento-base, mas não existe contrato tipado, obrigatório e convergente de origem;
- “peso atual” como fato.

Regra obrigatória: **último peso observado ≠ peso atual automaticamente**.

GMD não está autorizado neste gate. A matéria-prima existe porque todas as pesagens usam `peso_kg`, porém uma futura implementação precisa exigir simultaneamente: duas pesagens factuais do mesmo animal/fazenda, datas válidas e ordenadas, avaliação por política contextual, cobertura/convergência verificadas, details presentes e ausência de conflito factual. O selector de occupancy atual não satisfaz esse contrato.

### Atualização F22A.2 — contrato factual do intervalo

O incremento F22A.2 implementa somente a seleção e validação do intervalo factual. `selectFactualGmdInterval` reutiliza a evidência de `eventos` + `eventos_pesagem`, bloqueia conflito factual e escolhe as duas observações válidas mais recentes em instantes distintos. A saída contém observações inicial/final, ordem temporal, intervalo em dias, unidade, coverage e limitações; não contém diferença de peso, ganho diário ou GMD.

```ini
F22A_LAST_OBSERVED_WEIGHT = IMPLEMENTED
F22A_GMD_INTERVAL_CONTRACT = IMPLEMENTED
F22A_GMD_POLICY = DEFINED_CONTEXTUAL
F22A_GMD_CALCULATION = READY_WITH_POLICY_CONSTRAINTS
```

A [política técnica F22A.2B](./F22A_GMD_INTERVAL_POLICY.md) confirmou que não há mínimo universal transferível entre contextos. Intervalo positivo autoriza somente cálculo matemático com confiabilidade não classificada e uso operacional não autorizado. Classificar confiabilidade permanece dependente de política contextual e coverage de medição.

## Inventário 22B — eficiência econômica

| Fonte | Categoria | Natureza | `fazendaId` | Data temporal | Origem | Coverage / convergência | Idempotência | Limitações | Consumidores atuais | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `finance_transactions` | ledger gerencial | read model financeiro persistido | `fazenda_id`, FKs compostas | `occurred_at`, `competence_date`, `due_date`, `paid_at` | manual, Evento, estoque, compra, venda ou estorno | pull padrão; pending protegido; coverage histórica precisa ser declarada pelo caller | índice `(fazenda_id, client_op_id)` | não é escrito por todo fato comercial; manual pode não ter Evento; moeda não é campo explícito; ausência de linha não prova custo zero | Financeiro, Home, Relatórios | `READY` para caixa/competência/previsão observados com coverage verificada; `PARTIAL` para resultado econômico total |
| `finance_categories` | classificação | configuração | `fazenda_id`, slug único por fazenda | criação/atualização; sem vigência histórica própria | defaults determinísticos ou categoria gerencial | pull padrão; pending protegido | UUID determinístico nos defaults e unicidade `(fazenda_id, slug)` | categoria não é fato econômico; categoria ausente/inativa ou não carregada reduz classificação | Financeiro, agregação gerencial | `READY` como configuração auxiliar |
| `eventos` + `eventos_financeiro` | compra/venda financeira | factual | `fazenda_id` nas duas tabelas e FK composta | `eventos.occurred_at` | Evento financeiro | pull padrão, refresh pós-sync e pending por `evento_id` | Evento/detail por identidade de gesto | registra valor declarado e tipo, mas não `paid_at`, competência, categoria ou cobertura de despesas; Evento isolado não prova caixa bancário completo | Financeiro, Relatórios | `PARTIAL` |
| `eventos` + `eventos_comercial` v2 | compra/venda comercial | factual | `fazenda_id` e FKs compostas | `occurred_at` | operação comercial e snapshot | pull padrão/composto; `calculation_status`, issues e limitações | `client_op_id`, `domain_op_id` e `evento_id` | operação sem `finance_transaction_id` não entra no caixa; simulação e legado são excluídos; valor de venda não é lucro | Financeiro, Relatórios | `READY` para valores comerciais observados; `PARTIAL` como fonte financeira |
| `finance_transactions.reverses_transaction_id` | estorno | factual no ledger/read model | FK composta pela fazenda | `occurred_at`, `paid_at`, competência herdada | transação inversa explícita | UUID determinístico por original, FK, anti-self-reference e um estorno ativo por origem | replay converge na identidade determinística | deve ser incluído como movimento inverso, não apagar o original; estorno ausente não pode ser inferido | Financeiro e agregadores do ledger | `READY` |
| `insumo_movimentacoes.custo_*_snapshot` | custo de estoque/consumo | factual com snapshot | `fazenda_id` e vínculos factuais | `occurred_at` | lote de estoque no momento do movimento | fluxo offline/sync existente; vínculo por `source_evento_id` quando aplicável | gesto/domain op conforme o fluxo | muitos movimentos podem ter custo ausente; custo conhecido é parcial e não cobre mão de obra/depreciação etc. | relatório operacional e reconciliação sanitária | `PARTIAL` |
| `eventos_sanitario.custo_*_snapshot` | custo sanitário | factual com snapshot | Evento/detail por fazenda | data do Evento | lote/execução sanitária | cadeia sanitária especializada | gesto factual e fingerprint/replay sanitário | custo ausente é rastreado; soma conhecida não é custo sanitário total nem custo total da fazenda | Relatórios e exceções sanitárias | `PARTIAL` |
| `MetricResult` financeiro do relatório | entradas, saídas, saldo, competência e previstos | read model derivado | escopo explícito por `fazendaId` | período/timezone; caixa usa `paid_at` | ledger + Eventos financeiros deduplicados por vínculo explícito | aceita coverage explícita e diferencia `unavailable` | pura e reconstruível | status atual verifica details de Eventos, mas cobertura integral do ledger depende do caller; saldo é líquido observado, não lucro | Relatórios/exportações | `PARTIAL` |

### Gate técnico 22B

Com coverage verificada do período podem ser demonstrados:

- **receita observada:** entradas realizadas do ledger com `status=realizado`, `paid_at` no período, mais Eventos financeiros isolados apresentados separadamente como valor econômico declarado; valores comerciais v2 permanecem em bloco comercial quando não há vínculo financeiro;
- **custo observado:** saídas realizadas do ledger e snapshots de custo factuais conhecidos, sempre separados por fonte e sem preencher ausências;
- **cobertura de custos:** quantidade/valor conhecido versus movimentos/Eventos sem custo, categorias carregadas, operações sem vínculo/classificação e intervalos cobertos;
- **resultado observado:** entradas observadas menos saídas observadas no mesmo critério temporal, rotulado como saldo/resultado observado do recorte.

Não pode ser demonstrado como **lucro real completo**. Faltam garantia de exaustividade do ledger, conciliação bancária/fiscal, moeda explícita, todos os custos e despesas, rateios completos, depreciação/tributos e vínculo financeiro para toda operação comercial. Ausência de custo permanece ausência, nunca zero.

Tratamentos obrigatórios:

- estorno entra como transação inversa ligada ao original;
- categoria é configuração auxiliar e não substitui o fato;
- ledger sem categoria carregada deve aparecer como classificação indisponível, não ser descartado;
- `eventos_comercial` sem `finance_transaction_id` é dado comercial sem financeiro associado;
- período sem coverage verificada é `unavailable`/`partial`, inclusive quando a coleção está vazia;
- duplicidade ou vínculo cross-farm não admite escolha silenciosa.

## Atualização pós-baseline da dependência 22C

```ini
22C = SOURCE_GATE_UNBLOCKED
```

A `main` posterior ao baseline integrou o PR `#108` e a evidência `B4 REMOTE_CONVERGENCE_VERIFIED`: round-trip remoto multi-device e reconstrução após clean install foram comprovados. A condição técnica de entrada foi satisfeita; a F22C permanece não iniciada.

`state_lote`, `state_lotes`, vínculo corrente de animal/lote ou qualquer outro estado atual não podem reconstruir permanência histórica. Permanecem fora do escopo: dias em lote, dias em pasto, UA/ha, @/ha e desempenho por pastagem.

## Matriz de cobertura e decisão de início

| Capacidade | Fonte | Cobertura mínima | Risco dominante | Status | Pode iniciar? |
|---|---|---|---|---|---|
| Última pesagem observada + data | Evento + detail de pesagem | animal/fazenda, cutoff, duas fontes convergidas, detail completo | confundir observação com estado atual | `READY` | Sim, com essa nomenclatura |
| Idade/freshness da pesagem | `weight_data_quality` | anterior + timezone e limite técnico explícitos | threshold arbitrário | `READY` | Sim, reutilizando o contrato existente |
| Origem e método da pesagem | inexistente no contrato persistido atual | campos factuais novos e política de preenchimento | inventar proveniência | `BLOCKED` | Não |
| Intervalo factual candidato a GMD | duas ou mais pesagens | mesma fazenda/animal, ordem, conflito e convergência | confundir intervalo estrutural com autorização de cálculo | `READY` | Sim; contrato F22A.2 implementado |
| Cálculo matemático de GMD | intervalo factual validado | política contextual aplicada e cobertura atual explicitada | apresentar derivação como confiável ou acionável | `READY_WITH_CONSTRAINTS` | Sim; `reliability = UNCLASSIFIED` e `operationalUse = NOT_AUTHORIZED` |
| GMD confiável ou operacionalmente acionável | intervalo factual validado | origem, método, condições de pesagem e política contextual compatível | falsa precisão e decisão fora do contexto validado | `BLOCKED` | Não; `MEASUREMENT_COVERAGE_REQUIRED` |
| Peso comercial por operação | Evento comercial v2 | fato não simulado, snapshot/linhas completos | confundir com peso zootécnico | `READY` | Sim, em bloco comercial separado |
| Receita/saída de caixa observada | ledger | coverage do período, `paid_at`, status, estornos e tenant | vazio interpretado como zero | `READY` | Sim, como caixa observado |
| Valor comercial observado | Evento comercial v2 | fato não simulado e calculation status explícito | valor sem liquidação financeira | `READY` | Sim, separado de caixa |
| Custo conhecido registrado | ledger + snapshots factuais | coverage e lista de custos ausentes | soma parcial chamada de total | `PARTIAL` | Sim, somente como custo conhecido/parcial |
| Cobertura de custos | mesmas fontes + categorias | fontes carregadas, ausências e não classificados contados | lacunas ocultas | `PARTIAL` | Sim, após contrato de coverage explícito |
| Resultado observado do recorte | ledger/Eventos deduplicados | mesmo período e critério temporal, coverage e estornos | chamar saldo de lucro | `PARTIAL` | Sim, com caveat e nomenclatura estrita |
| Lucro real completo | não existe fonte exaustiva | conciliação e totalidade de custos/receitas/rateios | falsa precisão econômica | `BLOCKED` | Não |
| Permanência/desempenho por lote/pasto | Eventos de movimentação com E2E remoto | `B4 REMOTE_CONVERGENCE_VERIFIED` | reconstruir histórico por `state_*` | `READY` no source gate | Sim, em incremento próprio; não iniciada aqui |

## Riscos remanescentes

1. Read models existentes com “atual” no nome podem induzir uso indevido do último peso observado como peso corrente.
2. O relatório financeiro combina ledger e Evento isolado; sem coverage explícita e nomenclatura de caixa versus valor declarado, pode haver interpretação econômica excessiva.
3. O GMD de occupancy existente não é base autorizada para a F22A.2/F22A.3; o cálculo futuro deve usar exclusivamente o intervalo factual e a política contextual definida.

## Decisão e próximo passo

Decisão final: **READY WITH CAVEATS** — o gate de fontes de 22A/22B está fechado, sem implementação funcional.

Atualização de execução: F22A.1 e F22A.2 foram implementados, e F22A.2B definiu política contextual sem mínimo universal. A futura F22A.3 pode implementar apenas cálculo matemático com confiabilidade não classificada e uso operacional não autorizado. Origem/método e classificação confiável continuam dependentes de coverage própria; o contrato econômico pode avançar independentemente e o source gate de 22C segue desbloqueado.
