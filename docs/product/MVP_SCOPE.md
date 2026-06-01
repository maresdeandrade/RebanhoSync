```md
# MVP Scope — RebanhoSync

Atualizado em: 2026-05-31

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

> ⚠️ **Não deve inferir automaticamente:** peso atual confiável, aptidão para venda, aptidão para abate ou liberação sanitária final. Carência sanitária pode ser exibida quando derivada de eventos sanitários estruturados, mas isso não equivale a aptidão comercial.

### Agenda
O app deve permitir criar ou materializar tarefas futuras, listar pendências, destacar vencidos, destacar tarefas do dia, e orientar a execução.

> ⚠️ **Regra:** Agenda não é histórico. Não deve ser fonte primária para carência, histórico sanitário, execução de protocolo, liberação sanitária ou aptidão comercial.

### Eventos
O app deve permitir registrar fatos executados. Os eventos devem ser a única fonte para:
- histórico e linha do tempo;
- auditoria e KPIs históricos;
- carência sanitária (quando houver evento sanitário estruturado);
- rastreabilidade sanitária (quando houver produto/lote/dose/via/custo registrados).

### Sanitário operacional
O MVP deve suportar:
- protocolo sanitário como regra/configuração;
- agenda sanitária como tarefa futura e evento sanitário como execução;
- versionamento imutável de item de protocolo;
- snapshot da regra aplicada no evento;
- produto, lote, dose, via e responsável quando aplicável;
- vínculo com estoque e baixa idempotente quando houver consumo;
- custo sanitário por evento/produto/animal/lote quando houver snapshot;
- carência ativa/livre de carência como sinal sanitário, quando derivada de `eventos_sanitario` estruturado;
- biossegurança como ocorrência contextual;
- suspeita/doença notificável vinculada a animal, animais, lote ou evento;
- checklist regulatório como contexto, nunca como pendência geral obrigatória;
- pendência corretiva específica quando houver ocorrência real com ação pendente.

> ⚠️ **Não deve:** usar agenda como fonte de carência, usar protocolo isolado como execução, usar checklist contextual como prova universal de conformidade, afirmar liberação sanitária final sem contrato próprio, ou tratar `sanitario:livre_carencia` como aptidão para venda ou abate.

### Reprodução
O MVP deve focar em: parto, pós-parto, cria, vínculo mãe-cria, e agenda derivada da cria quando aplicável.

> ⚠️ Não assumir motor amplo de IATF, IA, cobertura ou diagnóstico de gestação sem implementação validada.

### Lotes e pastos
O MVP deve suportar: estrutura produtiva, agrupamento operacional, localização atual, movimentação, e leitura operacional de ocupação.

> ⚠️ Cálculos históricos de lotação, permanência e ganho de peso dependem de eventos suficientes.

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
- carência ativa derivada de `eventos_sanitario.carencia_*_ate`;
- livre de carência derivado de eventos sanitários estruturados, sem implicar venda/abate;
- biossegurança derivada de ocorrência real registrada;
- suspeita/doença notificável vinculada a animal, animais, lote ou evento;
- compliance sanitário contextual, separado de pendência acionável;
- pendência sanitária corretiva vinculada a ocorrência real;
- custo sanitário por evento/produto/animal/lote, quando houver snapshot;
- estoque sanitário aplicado/baixado, quando houver movimentação vinculada ao evento;
- relatórios sanitários operacionais baseados em eventos estruturados;
- sinais sanitários auxiliares, desde que declarem fonte e limitação.

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

Uma funcionalidade está dentro do MVP se:
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