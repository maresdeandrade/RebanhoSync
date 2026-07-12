# Core Rules — RebanhoSync

Atualizado em: 2026-07-12
**Baseline Commit:** `32d7779`

## Objetivo

Concentrar as regras centrais do RebanhoSync em formato curto e estável.

Este arquivo é a versão documental das regras essenciais do projeto.  
Para regras específicas de agentes, usar também `.agents/rules/CORE_RULES.md`.

---

## Produto

RebanhoSync é um app agropecuário offline-first para gestão pecuária de corte.

Prioridades:

- operação prática no campo;
- baixa fricção;
- funcionamento offline;
- sincronização confiável;
- segurança multi-tenant;
- rastreabilidade operacional;
- evolução incremental.

---

## Regras absolutas

- Preservar offline-first.
- Preservar RLS, multi-tenant e isolamento por `fazenda_id`.
- Não criar fonte paralela de verdade.
- Não colocar regra de negócio crítica em componente React.
- Não usar UI como única fronteira de autorização.
- Não expor `service_role` no client.
- Não alterar migrations, seed, RLS, policies ou RPCs sem tarefa explícita.
- Preferir patch pequeno, reversível e testável.
- Não refatorar por conveniência.
- Declarar limitações quando fonte for parcial.

---

## Contratos do domínio

### Agenda

Agenda é intenção/tarefa futura.

Pode representar:

- pendência;
- vencimento;
- planejamento;
- tarefa operacional aberta;
- item gerado por protocolo.

Não é histórico factual.

---

### Evento

Evento é fato histórico executado.

Deve representar:

- ação realizada;
- ocorrência registrada;
- histórico auditável;
- base para KPIs históricos;
- linha do tempo operacional.

---

### `state_*`

`state_*` é estado atual/read model.

Serve para:

- situação corrente;
- status atual;
- lote/pasto atual;
- visão operacional consolidada.

Não substitui histórico.

---

### Protocolo

Protocolo é regra/configuração/template.

Serve para:

- orientar manejo;
- gerar agenda;
- materializar tarefas;
- padronizar rotina.

Não comprova execução.

---

### Contexto operacional

Contexto operacional é entrada explícita do usuário para apoiar pré-checagem, preview e snapshot de planejamento.

Pode apoiar:

- avaliação de janela sanitária;
- explicação de dados insuficientes;
- planejamento manual.

Não pode:

- substituir fonte técnica;
- criar evento;
- movimentar estoque;
- calcular carência ativa;
- liberar venda/abate/leite;
- provar execução.

---

### Histórico externo

Histórico sanitário externo documentado pode apoiar pré-checagem quando houver vínculo suficiente com protocolo/item.

Declaração sem documento e legado ambíguo são avisos/pendências documentais, não comprovação crítica.

Histórico externo não é execução local e não deve baixar estoque, criar agenda automática ou calcular carência ativa automaticamente.

---

### Tags, sinais e insights

São auxiliares de UX/consulta.

Podem:

- filtrar;
- priorizar;
- alertar;
- compor painel read-only.

Não podem:

- ser fonte primária;
- substituir evento;
- substituir agenda;
- substituir `state_*`;
- decidir carência/venda/abate.

---

## Decisões críticas

Exigem fonte técnica explícita:

- carência ativa;
- livre de carência;
- peso atual confiável;
- pronto para venda;
- apto para abate;
- protocolo executado;
- liberação sanitária;
- aptidão operacional crítica.

Se a fonte não existir, a resposta deve ser bloqueada ou declarada como parcial.

---

## Offline-first

Toda mudança que toque persistência deve preservar:

- operação local quando aplicável;
- gesture idempotente;
- fila de sync;
- retry seguro;
- rollback determinístico;
- reconcile;
- tratamento de sucesso parcial;
- metadata de sincronização.

---

## Supabase/RLS

Toda mudança que toque backend deve preservar:

- RLS;
- `fazenda_id`;
- membership;
- papéis/permissões;
- FK composta quando aplicável;
- RPC com validação explícita;
- `search_path` controlado quando aplicável;
- ausência de bypass cross-tenant.

---

## UI

UI deve:

- exibir;
- orientar;
- validar entrada simples;
- comunicar estados;
- reduzir fricção.

UI não deve:

- ser única barreira de autorização;
- conter regra crítica não testável;
- criar fonte de verdade;
- mascarar limitação técnica;
- transformar sinal visual em decisão operacional.

---

## Documentação

Docs devem:

- refletir estado real;
- evitar duplicidade;
- declarar fonte;
- separar ativo de histórico;
- usar `docs/archive/**` apenas como histórico;
- não contradizer código/migrations ativas.

---

## Validação

Validar proporcionalmente ao risco:

- patch local: teste específico;
- domínio crítico: teste do domínio + lint/build;
- sync/offline: testes amplos;
- Supabase/RLS: baseline funcional;
- documentação: checagem de duplicidade e referências.

Detalhes:

- `docs/technical/TESTING_GATES.md`
- `.agents/rules/rtk.md`

---

## Critério de aceite

Uma alteração é aceitável quando:

- respeita fonte de verdade;
- não viola offline-first;
- não enfraquece RLS;
- não cria duplicidade de verdade;
- não infere decisão crítica sem fonte;
- é testável;
- tem escopo controlado;
- declara riscos remanescentes.
