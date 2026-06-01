# Review Checklist — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir checklist padrão para revisão documental, técnica, arquitetural e operacional do RebanhoSync.

Use este documento para validar se uma alteração preserva os contratos centrais do projeto, reduz risco operacional e mantém rastreabilidade a partir do baseline `3664395`.

---

## Escopo da revisão

Este checklist se aplica a:

- reorganização documental;
- revisão de prompts/agentes/skills;
- alteração de fluxo;
- alteração de domínio;
- alteração de UI;
- alteração de sync/offline;
- alteração de Supabase/RLS;
- alteração financeira;
- alteração sanitária;
- preparação de PR;
- validação pós-patch.

---

## Resultado esperado

Toda revisão deve terminar com um dos estados:

| Estado | Uso |
|---|---|
| `APROVADO` | Sem bloqueios relevantes. |
| `APROVADO_COM_RESSALVAS` | Pode seguir, mas há pendências não bloqueantes. |
| `BLOQUEADO` | Não deve seguir sem correção. |
| `INCONCLUSIVO` | Faltou fonte, diff, contexto ou validação. |

---

## 1. Checklist documental

### Cabeçalho

Verificar se todo documento ativo novo ou reconciliado contém:

```md
Atualizado em: 2026-05-31  
**Baseline Commit:** `3664395`
```

Obrigatório para:

- `docs/context/`
- `docs/technical/`
- `docs/domain/`
- `docs/product/`
- `docs/ux/`
- `docs/finance/`
- `docs/manuals/`
- `docs/review/`
- `.agents/rules/`
- `.agents/skills/`
- `.agents/prompts/`
- `AGENTS.md`

---

### Local correto

Validar se o conteúdo está na pasta certa:

| Conteúdo | Local correto |
|---|---|
| Fonte de verdade, status, lacunas | `docs/context/` |
| Arquitetura, sync, RLS, testes | `docs/technical/` |
| Regras agropecuárias | `docs/domain/` |
| Produto, MVP, roadmap, escopo | `docs/product/` |
| UX, telas, copy, login | `docs/ux/` |
| Custos, KPIs, snapshots | `docs/finance/` |
| Manual e suporte | `docs/manuals/` |
| Revisões ativas | `docs/review/` |
| Histórico fechado | `docs/archive/` |
| Regras de agentes | `.agents/rules/` |
| Skills de agentes | `.agents/skills/` |
| Prompts reutilizáveis | `.agents/prompts/` |

---

### Duplicidade

Verificar se o documento não duplica integralmente outro.

Permitido:

- resumo;
- índice;
- referência cruzada;
- regra curta de segurança.

Não permitido:

- copiar matriz inteira em vários locais;
- duplicar manual completo;
- repetir prompts longos em múltiplos arquivos;
- manter duas fontes de verdade para o mesmo contrato.

---

### Fonte ativa vs histórico

Validar:

```txt
Se orienta decisão atual → docs ativos.
Se está superado/fechado → docs/archive/.
Se é achado pendente → docs/review/.
```

Não usar `docs/archive/**` como fonte operacional, salvo pedido explícito.

---

## 2. Checklist de contratos centrais

Toda alteração deve preservar:

```txt
Agenda = intenção/tarefa futura.
Evento = fato histórico executado.
state_* = estado atual/read model.
Protocolo = regra/configuração.
Tags, sinais e insights = auxiliares, não fonte primária.
```

Bloquear alteração que:

- usa agenda como histórico;
- usa protocolo como execução;
- usa tag/sinal como regra crítica;
- usa `state_*` como histórico completo;
- cria fonte paralela de verdade;
- mistura UI com regra crítica de negócio.

---

## 3. Checklist sanitário

Verificar se a alteração preserva:

```txt
Carência sanitária pode ser sinal limitado.
Carência sanitária exige evento sanitário estruturado.
Carência sanitária não é liberação final.
Carência sanitária não autoriza venda.
Carência sanitária não autoriza abate.
```

### Permitido

- `sanitario:carencia_ativa`;
- `sanitario:sem_carencia_vigente`;
- copy cautelosa;
- fonte e limitação explícitas.

### Bloqueado

- `comercial:pronto_venda`;
- `comercial:apto_abate`;
- `sanitario:liberacao_final`;
- venda/abate baseado apenas em carência;
- agenda/protocolo/checklist como fonte de carência;
- ausência de pendência como prova sanitária.

---

## 4. Checklist financeiro

Validar:

```txt
Custo ausente ≠ custo zero.
Margem parcial ≠ lucro final.
Receita de venda ≠ resultado líquido.
Snapshot econômico ≠ preço atual.
Último peso ≠ peso atual confiável.
Carência sanitária ≠ aptidão comercial.
```

Bloquear alteração que:

- usa custo ausente como `0`;
- exibe lucro final sem fonte completa;
- recalcula histórico com preço atual;
- calcula custo por arroba sem peso confiável;
- usa margem parcial como resultado líquido;
- automatiza venda/abate por indicador parcial.

---

## 5. Checklist offline-first e sync

Verificar se a alteração preserva:

- Dexie/local-first quando aplicável;
- fila/sync idempotente;
- retry seguro;
- rollback coerente;
- sucesso parcial tratado;
- conflito visível;
- registros locais não apagados por sessão expirada;
- diferença entre salvo localmente e sincronizado.

Bloquear alteração que:

- depende de conexão para fluxo offline esperado;
- duplica evento por retry;
- duplica baixa de estoque;
- resolve conflito crítico silenciosamente;
- apaga dado local sem confirmação;
- usa UI como única proteção contra duplicidade.

---

## 6. Checklist Supabase/RLS

Aplicável quando tocar backend, migration, RPC, sync remoto ou autenticação.

Verificar:

- isolamento por `fazenda_id`;
- RLS ativa;
- policies coerentes por papel;
- ausência de `service_role` no client;
- FKs compostas/cross-tenant quando aplicável;
- RPCs com validação de tenant;
- migrations idempotentes e rastreáveis;
- baseline Supabase validado quando necessário.

Comando esperado quando aplicável:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## 7. Checklist UX

Validar:

- copy não promete certeza falsa;
- estados vazio/parcial/bloqueado claros;
- agenda não aparece como histórico;
- evento aparece como fato executado;
- sinal não aparece como autorização;
- login diferencia rede, credencial, sessão e fazenda;
- mobile legível;
- ações críticas têm revisão.

Bloquear copy como:

```txt
Liberado para venda
Apto para abate
Livre de carência
Peso atual confiável
Lucro final
Conformidade garantida
```

sem fonte/contrato próprio.

---

## 8. Checklist de agentes/prompts

Validar:

- prompts curtos;
- sem repetição de contexto amplo;
- uso de `AGENTS.md`;
- uso de `.agents/rules/CONTEXT_LOADING.md`;
- uso de no máximo 1 skill principal e 1 secundária real;
- não carregar manual/matriz completa sem necessidade;
- não ler `docs/archive/**` por padrão;
- não rodar busca global antes de delimitar escopo.

---

## 9. Checklist de comandos

Antes de fechar revisão, quando houver mudança no repositório:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
```

Para validação proporcional:

```bash
pnpm run lint
pnpm test
pnpm run build
```

Para Supabase/RLS/sync-batch:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## 10. Checklist de conclusão

Antes de marcar revisão como concluída:

- [ ] Cabeçalho com baseline presente.
- [ ] Pasta correta.
- [ ] Sem duplicidade relevante.
- [ ] Fonte de verdade preservada.
- [ ] Contratos Agenda/Eventos/state/Protocolo preservados.
- [ ] Sanitário não virou autorização comercial.
- [ ] Financeiro não afirma lucro/custo falso.
- [ ] Offline-first preservado.
- [ ] RLS/multi-tenant preservado quando aplicável.
- [ ] UX não promete decisão crítica sem fonte.
- [ ] Validação proporcional indicada ou executada.
- [ ] Pendências registradas em `OPEN_REVIEW_ITEMS.md`.
- [ ] Revisão ativa registrada em `ACTIVE_REVIEW_INDEX.md`.

---

## Template de resultado

```md
## Resultado

Status: APROVADO | APROVADO_COM_RESSALVAS | BLOQUEADO | INCONCLUSIVO

### Fatos confirmados

-

### Riscos

-

### Correções necessárias

-

### Validações

-

### Pendências

-
```