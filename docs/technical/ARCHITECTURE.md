```markdown
# Architecture — RebanhoSync

## Visão Geral

RebanhoSync é um aplicativo agropecuário offline-first voltado para a gestão de pecuária de corte.

### Stack Principal:
* React / TypeScript;
* Dexie / IndexedDB;
* Supabase / Postgres / Auth / RLS;
* Sincronização local-remota baseada em gestures e transações;
* Testes automatizados com Vitest e React Testing Library.

---

## Princípios de Design

* **Offline-first:** Funcionamento local contínuo independente de conectividade.
* **Isolamento de Dados:** Multi-tenant estrito baseado em `fazenda_id`.
* **Segurança na Fonte:** RLS (Row Level Security) atuando como barreira real de proteção de dados — a UI nunca é tratada como fronteira de autorização.
* **Semântica do Domínio:**
  * **Evento:** Fato histórico consumado.
  * **Agenda:** Intenção ou tarefa futura.
  * **`state_*`:** Read model representando o estado atual do ecossistema.
  * **Protocolo:** Regra ou configuração estática de processos.
  * **Tags / Sinais / Insights:** Camadas auxiliares de UX e filtros rápidos, nunca regras críticas ou fontes primárias de verdade.

---

## Camadas do Sistema

### 1. UI (User Interface)
* **Responsabilidades:** Captura de dados de entrada do usuário, renderização visual de componentes, microcopy, controle de estados visuais (loading, erro, vazio) e gerenciamento de rotas/navegação.
* > ⚠️ **Restrição:** É terminantemente proibido injetar regras críticas de domínio em componentes React.

### 2. Domínio Local
* **Responsabilidades:** Validação de payloads de entrada, montagem e normalização de estruturas de dados, execução de regras de negócio puras e aplicação de políticas de seleção.
* *Diretriz:* Priorizar funções puras, isoladas e facilmente testáveis.

### 3. Offline / Local Storage
* **Responsabilidades:** Persistência local no IndexedDB via Dexie, gerenciamento da fila local de sincronização, empacotamento de gestures, criação de snapshots pré-operação, rollback automático e orquestração de retries.

### 4. Remoto / Supabase Backend
* **Responsabilidades:** Armazenamento canônico centralizado, enforcement de segurança via RLS policies, validação profunda de isolamento multi-tenant por fazenda, funções de banco de dados (RPCs), triggers e scripts de recompute.

### 5. Read Models
* **Responsabilidades:** Viabilizar leituras operacionais rápidas através de tabelas `state_*`, resumos consolidados na interface, painéis de leitura restrita (read-only) e queries otimizadas.
* > ⚠️ **Restrição:** Read models otimizam a leitura atual e nunca substituem o registro de eventos históricos.

---

## Pipeline Preferencial de Fluxo

Em cenários complexos ou hotspots arquiteturais, estruture o fluxo sob o seguinte encadeamento lógico:

```txt
Normalize ──> Select/Policy ──> Payload ──> Plan ──> Effects ──> Reconcile

```

*Nota: Não force esta pipeline em lógicas simples ou rotinas triviais.*

---

## Áreas Críticas do Projeto

```txt
src/lib/
  ├── offline/
  ├── sanitario/
  ├── reproduction/
  ├── animals/
  └── events/
src/pages/
  ├── Registrar/
  ├── Agenda/
  └── ProtocolosSanitarios/
supabase/
  ├── functions/sync-batch/
  └── migrations/

```

---

## Riscos Arquiteturais Recorrentes

* Injeção de regras de negócio críticas dentro de componentes de renderização React;
* Tratar registros de **Agenda** (intenções) como dados históricos do rebanho;
* Utilizar tabelas de **Read Model** (`state_*`) como fontes de fatos consolidados;
* Tratar parâmetros de **Protocolo** (configurações) como execuções consumadas;
* Elevar **Tags, Sinais e Insights** ao papel de regras críticas ou fontes primárias;
* Introduzir duplicidade na arquitetura criando fontes paralelas de verdade;
* Lógicas de sincronização complexas desprovidas de mecanismos automáticos de **Rollback**;
* Fluxos de **Retry** mal estruturados que violam a propriedade de idempotência;
* Políticas de segurança enfraquecidas ou permissivas no Supabase (RLS fraco);
* Relacionamentos cruzados que violam o isolamento multi-tenant devido a Chaves Estrangeiras (FKs) sem a presença do `fazenda_id`.

---

## Critério de Aceite Arquitetural

Uma alteração é classificada como arquiteturalmente segura somente quando:

1. Preserva a integridade e operação continuada do modelo **offline-first**;
2. Mantém intactas as barreiras de isolamento por **multi-tenant e RLS**;
3. Evita estritamente a criação de fontes de dados concorrentes ou paralelas;
4. Respeita a separação conceitual entre **Agenda, Eventos e `state_***`;
5. Apresenta cobertura de validações locais proporcional aos riscos do módulo;
6. O patch é implementado de forma incremental, idempotente e totalmente reversível;
7. Mantém o escopo da tarefa estritamente contido, evitando refatorações amplas e desnecessárias.

```

```