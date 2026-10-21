```md
# MVP Scope — RebanhoSync

Atualizado em: 2026-10-20

**Baseline documental original:** `32d7779`

## Objetivo

Definir o escopo do MVP/beta interno do RebanhoSync.

Este documento separa o que deve ser suportado agora, o que pode existir parcialmente, o que depende de validação e o que não deve ser implementado no MVP.

---

## Status do MVP

O RebanhoSync está em beta interno com MVP operacional.

### Foco atual
- estabilizar fluxos centrais;
- preservar offline-first;
- consolidar documentação ativa;
- reduzir risco operacional;
- melhorar UX dos fluxos principais;
- validar sync, rollback, RLS e multi-tenant;
- evitar expansão prematura.

Este documento declara escopo de produto. A existência de código, teste versionado, migration ou gate não altera por si só a inclusão no MVP, nem comprova validação executada, integração remota ou rollout. Consulte [`CAPABILITY_MAP.md`](./CAPABILITY_MAP.md) para a síntese de escopo e [`REQUIREMENTS_TRACEABILITY.md`](./REQUIREMENTS_TRACEABILITY.md) para evidência técnica por requisito.

---

## Escopo principal do MVP

O MVP deve cobrir:
- cadastro e controle de animais;
- lotes e pastos;
- agenda operacional;
- eventos históricos;
- sanitário operacional;
- reprodução focada em parto/cria/pós-parto;
- movimentação;
- compra/venda básica;
- visão operacional da fazenda;
- insights read-only auxiliares;
- sync offline-first;
- segurança multi-tenant.

---

## Capacidades obrigatórias

### Rebanho
O app deve permitir cadastrar animal, identificar animal, acompanhar status atual, vincular animal a lote/pasto quando aplicável, consultar histórico por eventos, e distinguir ativo, vendido, morto ou inativo quando modelado.

> ⚠️ **Não deve inferir automaticamente:** peso atual confiável, aptidão para venda, aptidão para abate ou liberação sanitária final. A carência pode ser indicada como sinal sanitário apenas com Evento executado, produto aplicado, snapshot/campos estruturados e fonte técnica aplicável, declarando cobertura; ausência de registro não comprova ausência de carência.

### Agenda
O app deve permitir criar ou materializar tarefas futuras, listar pendências, destacar vencidos, destacar tarefas do dia, e orientar a execução.

> ⚠️ **Regra:** Agenda não é histórico. Não deve ser fonte primária para carência, histórico sanitário, execução de protocolo, liberação sanitária ou aptidão comercial.

### Eventos
O app deve permitir registrar fatos executados. Eventos e detalhes factuais são fontes primárias para histórico, linha do tempo e auditoria. KPIs históricos devem agregar a fonte canônica apropriada a cada indicador: Eventos/detalhes para fatos executados, lançamentos financeiros canônicos quando pertinentes e snapshots factuais com proveniência quando aplicáveis. Cada resultado deve declarar período, proveniência e cobertura; Agenda e `state_*` não substituem fonte factual.

### Sanitário operacional
O MVP deve suportar:
- protocolo sanitário como regra/configuração;
- Agenda Sanitária v2 local persistida como tarefa futura, distinta do Evento factual de execução;
- versionamento imutável de item de protocolo;
- snapshot da regra aplicada no evento;
- produto, lote, dose, via e responsável quando aplicável;
- vínculo com estoque e baixa idempotente quando houver consumo;
- custo sanitário por evento/produto/animal/lote quando houver snapshot;
- carência ativa como sinal sanitário quando derivada de Evento sanitário executado, produto efetivamente aplicado, snapshot técnico, campos estruturados e fonte técnica aplicável;
- biossegurança como ocorrência contextual;
- suspeita/doença notificável vinculada a animal, animais, lote ou evento;
- checklist regulatório como contexto, nunca como pendência geral obrigatória;
- pendência corretiva específica quando houver ocorrência real com ação pendente.

O código contém schema, migrations, stores locais e caminho de Sync Sanitário v2 com gate. Isso não comprova que migrations estejam aplicadas em staging/produção, que o gate remoto esteja ativo ou que haja rollout autorizado. A ativação técnica e o rollout permanecem separados do escopo do MVP.

> ⚠️ **Não deve:** usar agenda como fonte de carência, usar protocolo isolado como execução, usar checklist contextual como prova universal de conformidade, afirmar liberação sanitária final sem contrato próprio, ou tratar `sanitario:livre_carencia` como aptidão para venda ou abate.

### Reprodução

O MVP deve focar em: parto, pós-parto, cria, vínculo mãe-cria e agenda derivada da cria quando aplicável.

O código versionado também contém registro factual de cobertura/IA e diagnóstico ligado a episódio, com projeção reprodutiva. Essa implementação não decide sua inclusão no MVP. Não assumir motor amplo de IATF, automação integral de IA/cobertura/diagnóstico, estação de monta ou indicadores avançados; consulte [`OUT_OF_SCOPE.md`](./OUT_OF_SCOPE.md).

### Lotes e pastos
O MVP deve suportar: estrutura produtiva, agrupamento operacional, localização atual e movimentação interna entre lote/pasto. A leitura de ocupação atual é operacional; métricas históricas de ocupação, permanência e ganho de peso dependem de eventos suficientes e permanecem parciais.

O contrato consultado não decide a inclusão de trânsito externo/GTA no MVP. Não inferir autorização, emissão documental ou conformidade regulatória a partir da movimentação interna.

### Compra/venda
O MVP deve suportar: entrada/compra quando modelada, venda/saída quando modelada, contraparte, valor/custo quando aplicável, snapshot econômico nos pontos já implementados, e alteração coerente do estado atual.

> ⚠️ **Não deve automatizar:** “pronto para venda”, “apto para abate”, “liberado comercialmente” ou “liberado sanitariamente para venda”.

### Central Operacional / Home
O MVP deve priorizar:
- pendências de hoje e atrasos;
- sinais operacionais auxiliares;
- status de sincronização;
- leitura rápida de rebanho;
- cards read-only com fonte declarada;
- sinais sanitários baseados em eventos;
- sinais de biossegurança baseados em ocorrências reais.

---

## Capacidades permitidas no MVP com fonte explícita

Podem existir como respostas operacionais quando houver fonte primária suficiente:
- carência ativa comprovada por aplicação/evento estruturado e fonte técnica aplicável;
- ausência de carência vigente identificada somente nas fontes avaliadas, com cobertura suficiente; ausência de registro, snapshot ou fonte aplicável não prova conformidade;
- biossegurança derivada de ocorrência real registrada;
- suspeita/doença notificável vinculada a animal, animais, lote ou evento;
- compliance sanitário contextual, separado de pendência acionável;
- pendência sanitária corretiva vinculada a ocorrência real;
- custo sanitário por evento/produto/animal/lote, quando houver snapshot;
- estoque sanitário aplicado/baixado, quando houver movimentação vinculada ao evento;
- relatórios sanitários operacionais baseados em eventos estruturados;
- sinais sanitários auxiliares, desde que declarem fonte e limitação.

A interpretação de carência deve distinguir explicitamente:

| Situação | Mensagem conceitual |
|---|---|
| Carência ativa comprovada | Carência sanitária ativa até a data indicada |
| Carência expirada, com cobertura suficiente por produto/modalidade e sem fonte conflitante | Sem carência vigente identificada nas fontes avaliadas |
| Cobertura parcial ou campos aplicáveis ausentes | Avaliação parcial; verificar fontes ausentes |
| Fonte insuficiente ou conflito técnico não resolvido | Carência sanitária indeterminada |
| Dados não avaliáveis, incluindo ausência de Evento, snapshot ou fonte aplicável | Dados insuficientes para avaliar carência |

São diretrizes documentais, não alteração de copy ou comportamento da UI. `carencia_*_ate` isoladamente não comprova conformidade universal; ausência de regra configurada ou de registro não equivale a `explicit_absence`, que exige fonte forte de ausência. Carência derivada não libera venda, abate, leite ou trânsito.

---

## Capacidades permitidas como parciais

Podem existir como parciais, desde que declarem limitação:
- custos consolidados gerais e KPIs financeiros gerais;
- lotação histórica e ganho de peso por período;
- indicadores reprodutivos e margem por lote;
- compliance regulatório amplo e estoque sanitário avançado;
- relatórios operacionais fora do sanitário;
- tempo até resolução de ocorrência, enquanto não houver data estruturada de encerramento;
- caso notificável por lote, enquanto `sanitario_casos` não suportar lote como escopo nativo.

---

## Propostas de capacidades complementares ao núcleo do MVP

`Complementar` designa capacidade preservada no produto, mas não obrigatória para aprovar o núcleo mínimo do MVP. Esta classificação está proposta, não aprovada: não foi localizada decisão explícita de produto que a confirme. Até essa decisão, os itens abaixo não são critérios obrigatórios de aceite nem compromissos de roadmap; sua maturidade técnica, validação e disponibilidade operacional continuam sendo dimensões independentes.

- Importação V2 de animais, lotes e pastos;
- Simulação Produtiva/Comercial efêmera;
- registro factual de cobertura/IA/diagnóstico ligado a episódio, além do foco do MVP em parto/cria.

Consulte [`CAPABILITY_MAP.md`](./CAPABILITY_MAP.md) e [`REQUIREMENTS_TRACEABILITY.md`](./REQUIREMENTS_TRACEABILITY.md).

---

## Capacidades bloqueadas no MVP como decisão automática

Não implementar como autorização automática sem fonte técnica explícita, contrato próprio e aceite de produto:
- pronto para venda e apto para abate;
- peso atual confiável e liberação sanitária final;
- compliance regulatório universal e IATF ampla;
- recomendação veterinária autônoma e predição comercial;
- aptidão comercial baseada apenas em carência;
- venda/abate baseado apenas em `sanitario:livre_carencia`.

---

## Escopo técnico obrigatório

Qualquer fluxo central deve preservar:
- offline-first e multi-tenant (isolamento por `fazenda_id` via RLS);
- sync idempotente e rollback quando aplicável;
- sucesso parcial tratado explicitamente;
- separação UI/domínio;
- testes proporcionais.

---

## Escopo documental obrigatório

Toda mudança relevante deve respeitar:
- `docs/context/SOURCE_OF_TRUTH.md`
- `docs/context/KNOWN_GAPS.md`
- `docs/domain/AGRO_BASE.md`
- `docs/technical/TESTING_GATES.md`

---

## Critério de aceite do MVP

Uma funcionalidade formalmente aprovada no escopo do MVP está dentro do MVP se:
- resolve problema operacional real;
- preserva fonte de verdade;
- funciona offline quando aplicável;
- não exige automação crítica não validada;
- pode ser testada;
- é compreensível para o usuário de campo;
- não transforma o app em ERP fiscal/contábil completo;
- reduz risco ou fricção no manejo.

---

## Critério para rejeitar escopo

Rejeitar ou adiar quando:
- exige modelagem técnica ainda inexistente;
- cria decisão crítica sem fonte;
- aumenta muito a complexidade;
- duplica fonte de verdade;
- depende de compliance amplo;
- exige integrações fiscais;
- ameaça offline-first;
- cria risco de RLS/multi-tenant;
- adiciona fluxo avançado antes de estabilizar o básico.

```