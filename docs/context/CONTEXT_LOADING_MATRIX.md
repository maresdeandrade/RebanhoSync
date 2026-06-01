# Context Loading Matrix — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir quais documentos devem ser carregados por tipo de tarefa.

Este arquivo é a versão documental da matriz de contexto.  
Para execução por agentes, usar também `.agents/rules/CONTEXT_LOADING.md` e `.agents/rules/no-broad-context.md`.

---

## Regra central

Carregar apenas o contexto necessário.

Não abrir por padrão:

- `docs/archive/**`;
- auditorias antigas;
- manuais completos;
- matrizes longas;
- todos os docs técnicos;
- todas as skills;
- todo o repositório.

---

## Contexto mínimo universal

Para qualquer tarefa no RebanhoSync:

```txt
AGENTS.md
.agents/rules/CORE_RULES.md
.agents/rules/CONTEXT_LOADING.md
```

Se houver risco de leitura ampla:

```txt
.agents/rules/no-broad-context.md
```

Se houver comandos/validação:

```txt
.agents/rules/rtk.md
```

---

## Matriz por tipo de tarefa

| Tipo de tarefa | Carregar | Não carregar por padrão |
|---|---|---|
| Bug local | arquivo-alvo, teste relacionado, AGENTS local | docs amplos, archive, matriz KPI |
| Patch visual pequeno | tela/componente, `docs/ux/VISUAL_TOKENS.md` se necessário | Supabase, sync, sanitário, KPI |
| Refatoração visual | `docs/ux/UX_PRINCIPLES.md`, `SCREEN_PATTERNS.md`, tela afetada | RLS/migrations, docs de domínio não envolvidos |
| Login/auth | `docs/ux/LOGIN_UX.md`, `docs/technical/SUPABASE_RLS.md`, arquivos auth | sanitário, KPI, pastos, manuals completos |
| Arquitetura | `docs/technical/ARCHITECTURE.md`, `docs/context/SOURCE_OF_TRUTH.md` | manuals, finance full matrix, archive |
| Sync/offline | `docs/technical/OFFLINE_SYNC.md`, skill `sync-offline-rollback` | docs de UX/domínio não envolvidos |
| Supabase/RLS | `docs/technical/SUPABASE_RLS.md`, skill `migrations-rls-contracts` | UI docs, manuals, archive |
| Agenda/Eventos | `docs/technical/EVENTS_AGENDA_CONTRACT.md`, `SOURCE_OF_TRUTH.md` | finance full, compliance amplo |
| Sanitário operacional | `docs/domain/SANITARIO.md`, skill `sanitario-registro-operacional` | compliance regulatório se não envolvido |
| Sanitário regulatório | `docs/domain/SANITARIO.md`, skill `sanitario-catalogo-regulatorio-compliance` | registro operacional simples se não envolvido |
| Reprodução parto/cria | `docs/domain/REPRODUCAO.md`, skill `reproducao-parto-posparto-cria` | IATF amplo sem escopo |
| Animais/cadastro | `docs/domain/ANIMAIS_TAXONOMIA.md`, skill `animal-cadastro-origem-destino` | sanitário/reprodução se não envolvidos |
| Lotes/pastos | `docs/domain/LOTES_PASTOS.md` | compliance sanitário e financeiro se não envolvidos |
| Movimentação/trânsito | `docs/domain/LOTES_PASTOS.md`, skill `movimentacao-transito-conformidade` | KPI financeiro completo sem necessidade |
| Compra/venda | `docs/domain/COMPRA_VENDA.md` | carência/venda automática sem fonte |
| Financeiro/KPI | `docs/finance/KPI_INDEX.md` | `KPI_MATRIX_FULL.md` salvo modelagem detalhada |
| Manual do usuário | página específica em `docs/manuals/screens/` | manual inteiro |
| Suporte/FAQ | página específica em `docs/manuals/support/` | docs técnicos completos |
| Documentação | `PROJECT_STATUS.md`, `SOURCE_OF_TRUTH.md`, skill `reconcile-docs` | archive como fonte operacional |
| PR | resultado do verification gate, skill `prepare-pr` | docs amplos sem caveat |
| Validação de patch | skill `rebanhosync-verification-gate`, `.agents/rules/rtk.md` | implementação nova |

---

## Matriz por pergunta

| Pergunta | Documento principal |
|---|---|
| Qual fonte responde isso? | `docs/context/SOURCE_OF_TRUTH.md` |
| Isso é lacuna ou permitido? | `docs/context/KNOWN_GAPS.md` |
| Qual é o estado atual do projeto? | `docs/context/PROJECT_STATUS.md` |
| Qual regra geral do projeto? | `docs/context/CORE_RULES.md` |
| Como validar? | `docs/technical/TESTING_GATES.md` |
| Como funciona offline/sync? | `docs/technical/OFFLINE_SYNC.md` |
| Como funciona RLS/Supabase? | `docs/technical/SUPABASE_RLS.md` |
| Como separar Agenda/Eventos/state? | `docs/technical/EVENTS_AGENDA_CONTRACT.md` |
| Qual skill usar? | `.agents/skills/README.md` |
| Qual prompt usar? | `.agents/prompts/README.md` |

---

## Quando expandir contexto

Expandir somente se:

- o ponto de intervenção não está claro;
- há risco de regressão transversal;
- código e documentação divergem;
- envolve sync/offline;
- envolve Supabase/RLS/RPC/migration;
- envolve fonte de verdade do domínio;
- envolve decisão crítica;
- a tarefa pede auditoria ampla.

Ao expandir, registrar:

```txt
Expandi contexto porque:
- dúvida:
- arquivos já verificados:
- risco:
- próximo contexto necessário:
```

---

## Quando não expandir

Não expandir se a tarefa puder ser resolvida com:

- um arquivo-alvo;
- um teste relacionado;
- uma regra global;
- um doc específico.

Exemplos:

- ajuste de copy;
- espaçamento visual;
- teste unitário isolado;
- alteração em componente conhecido;
- prompt reutilizável;
- manual de uma tela específica.

---

## Uso de archive

`docs/archive/**` pode ser usado apenas para:

- preservar histórico;
- comparar versões antigas quando pedido;
- recuperar conteúdo antes de arquivar;
- auditoria histórica explícita.

Não usar como:

- fonte operacional atual;
- contrato vigente;
- documentação de referência padrão;
- base para implementar regra.

---

## Uso de skills

Não abrir todas as skills.

Usar no máximo:

- 1 skill principal;
- 1 skill secundária se houver interseção crítica.

Referência:

```txt
.agents/skills/README.md
```

---

## Uso de prompts

Usar prompts quando a tarefa precisa de formato, não de guardrail permanente.

Referência:

```txt
.agents/prompts/README.md
```

Exemplos:

- review de diff;
- feature pequena;
- refatoração visual;
- login security review;
- mapeamento de fluxo.

---

## Critério de aceite

O carregamento de contexto está correto quando:

- não abriu docs desnecessários;
- não usou archive como fonte operacional;
- escolheu o menor conjunto de docs;
- escolheu skill apenas quando necessário;
- não carregou matriz longa sem necessidade;
- não carregou manual completo para dúvida pontual;
- conseguiu declarar fonte de verdade usada.