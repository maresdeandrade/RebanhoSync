# AI Context Optimization Report — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Registrar diagnóstico e plano de otimização de contexto, tokens, prompts, regras e skills usadas por agentes no projeto RebanhoSync.

Este relatório é uma revisão ativa.  
Quando suas recomendações forem incorporadas em contratos estáveis, mover o histórico para `docs/archive/`.

---

## Diagnóstico executivo

O principal custo de tokens do RebanhoSync vem de repetição de contexto fixo em múltiplos locais.

Os pontos mais onerosos são:

1. prompts longos usados repetidamente;
2. regras duplicadas em prompts, skills e docs;
3. documentação extensa carregada sem necessidade;
4. manuais e matrizes completas usados para tarefas simples;
5. falta de separação clara entre contexto fixo, opcional e sob demanda;
6. skills com sobreposição parcial;
7. auditorias antigas disponíveis como se fossem fonte ativa.

---

## Decisão

Centralizar regras globais em poucos arquivos e reduzir prompts para ponteiros objetivos.

A estrutura recomendada é:

```txt
AGENTS.md
.agents/rules/
.agents/skills/
.agents/prompts/
docs/context/
docs/technical/
docs/domain/
docs/product/
docs/ux/
docs/finance/
docs/manuals/
docs/review/
docs/archive/
```

---

## Achados

## 1. Prompts muito longos

### Fato confirmado

O projeto utiliza prompts para Codex, Antigravity, Jules e outras ferramentas, frequentemente com repetição de contexto do RebanhoSync.

### Risco

- alto consumo de tokens;
- maior chance de contradição;
- dificuldade de manutenção;
- prompts antigos continuarem com regra superada.

### Recomendação

Prompts devem conter apenas:

- objetivo;
- escopo;
- arquivos-alvo;
- restrições;
- validações;
- critérios de aceite;
- referência a `AGENTS.md` e `.agents/rules/`.

Não devem repetir todo o contexto do projeto.

---

## 2. Regras duplicadas entre prompts, skills e docs

### Fato confirmado

Regras como Agenda/Eventos/state/Protocolo, offline-first, RLS, carência e sinais aparecem em múltiplos tipos de arquivo.

### Risco

- drift semântico;
- agente seguir uma regra antiga;
- correção precisar ser aplicada em muitos arquivos;
- inconsistência entre produto, domínio e UX.

### Recomendação

Manter regras globais em:

```txt
AGENTS.md
.agents/rules/CORE_RULES.md
docs/context/SOURCE_OF_TRUTH.md
```

Outros arquivos devem referenciar ou resumir, não duplicar extensivamente.

---

## 3. Documentos extensos demais carregados sem necessidade

### Fato confirmado

Alguns documentos tendem a crescer, especialmente:

- `KPI_MATRIX_FULL.md`;
- manuais;
- relatórios de revisão;
- auditorias;
- documentação técnica ampla;
- matrizes de domínio.

### Risco

- tarefa simples virar leitura ampla;
- agente perder foco;
- aumento de custo;
- respostas menos precisas.

### Recomendação

Definir leitura curta por padrão:

| Tema | Ler primeiro |
|---|---|
| Fonte de verdade | `docs/context/SOURCE_OF_TRUTH.md` |
| Status | `docs/context/PROJECT_STATUS.md` |
| Arquitetura | `docs/technical/ARCHITECTURE.md` |
| Sync | `docs/technical/OFFLINE_SYNC.md` |
| RLS | `docs/technical/SUPABASE_RLS.md` |
| Sanitário | `docs/domain/SANITARIO.md` |
| UX | `docs/ux/UX_PRINCIPLES.md` |
| Login | `docs/ux/LOGIN_UX.md` |
| Financeiro curto | `docs/finance/KPI_INDEX.md` |
| Limites financeiros | `docs/finance/FINANCIAL_LIMITS.md` |
| Manual por tela | `docs/manuals/screens/<TELA>.md` |

Abrir matriz completa apenas quando a tarefa exigir.

---

## 4. Fluxos do app carregados sem necessidade

### Fato confirmado

Tarefas de documentação, prompt ou copy podem carregar fluxo completo de app mesmo quando a alteração é localizada.

### Risco

- contexto irrelevante;
- perda de precisão;
- alteração ampla desnecessária;
- refatoração sem motivo.

### Recomendação

Usar `.agents/rules/CONTEXT_LOADING.md`.

Regra prática:

```txt
Tarefa local → arquivos-alvo + teste relacionado + AGENTS local.
Tarefa transversal → expandir por justificativa.
Tarefa de domínio → doc específico do domínio.
Tarefa UX → docs/ux + tela afetada.
Tarefa sync/RLS → docs/technical + arquivos afetados.
```

---

## 5. Manuais completos usados quando bastaria resumo

### Fato confirmado

Manuais tendem a ser longos e orientados ao usuário final.

### Risco

- alto custo de contexto;
- agente usar manual como fonte técnica;
- regra de domínio ser inferida a partir de texto de suporte.

### Recomendação

Estruturar manuais por tela e suporte:

```txt
docs/manuals/screens/
docs/manuals/support/
```

Manuais não devem substituir:

- `docs/context/`
- `docs/domain/`
- `docs/technical/`
- `docs/finance/`

---

## 6. Skills acionadas sem necessidade

### Fato confirmado

Skills podem ser carregadas por proximidade temática, mesmo sem necessidade real.

### Risco

- contexto adicional desnecessário;
- duplicidade de regra;
- orientação antiga influenciar patch atual.

### Recomendação

Regra:

```txt
Usar no máximo 1 skill principal e 1 skill secundária real.
```

Não usar skill para:

- copy simples;
- ajuste visual isolado;
- documento curto;
- patch com arquivo-alvo óbvio.

---

## 7. Templates de resposta extensos

### Fato confirmado

O projeto usa formatos estruturados detalhados.

### Risco

- respostas longas para tarefas simples;
- ruído;
- perda de objetividade.

### Recomendação

Manter formatos em:

```txt
.agents/rules/RESPONSE_FORMATS.md
```

Usar formato proporcional:

- revisão curta;
- auditoria completa;
- validação de patch;
- prompt para agente;
- resumo executivo.

---

## 8. Tabelas grandes em tarefas simples

### Fato confirmado

Matrizes e tabelas são úteis, mas podem ser excessivas para respostas rápidas.

### Risco

- token alto;
- baixa legibilidade;
- manutenção difícil.

### Recomendação

Usar:

- tabela curta para decisão;
- matriz completa só em documentos específicos;
- listas objetivas em prompts.

---

## 9. Repetição de contexto do RebanhoSync

### Fato confirmado

O contexto do projeto aparece em docs, prompts, skills e instruções.

### Risco

- divergência;
- regras antigas persistirem;
- agentes receberem contexto demais.

### Recomendação

Criar camada de contexto:

| Tipo | Local |
|---|---|
| Contexto fixo mínimo | `.project-context` |
| Regras globais | `AGENTS.md` + `.agents/rules/CORE_RULES.md` |
| Carregamento sob demanda | `.agents/rules/CONTEXT_LOADING.md` |
| Fonte de verdade | `docs/context/SOURCE_OF_TRUTH.md` |
| Skills específicas | `.agents/skills/` |
| Prompts enxutos | `.agents/prompts/` |

---

## 10. Falta de separação entre contexto fixo, opcional e sob demanda

### Fato confirmado

Sem política clara, agente tende a abrir mais arquivos do que necessário.

### Risco

- aumento de custo;
- leitura de docs errados;
- decisões com base em fonte menos relevante.

### Recomendação

Adotar três níveis:

### Contexto fixo

Sempre disponível:

```txt
AGENTS.md
.agents/rules/CORE_RULES.md
.agents/rules/CONTEXT_LOADING.md
```

### Contexto opcional

Depende do tipo de tarefa:

```txt
docs/domain/SANITARIO.md
docs/ux/LOGIN_UX.md
docs/finance/KPI_INDEX.md
docs/technical/OFFLINE_SYNC.md
```

### Contexto sob demanda

Abrir apenas com justificativa:

```txt
docs/archive/**
docs/finance/KPI_MATRIX_FULL.md
manuais completos
relatórios de review
auditorias antigas
migrations legadas
```

---

## Plano de ação recomendado

## Fase 1 — Regras globais

- Consolidar `AGENTS.md`.
- Criar `.agents/rules/CORE_RULES.md`.
- Criar `.agents/rules/CONTEXT_LOADING.md`.
- Criar `.agents/rules/no-broad-context.md`.
- Criar `.agents/rules/RESPONSE_FORMATS.md`.
- Criar `.agents/rules/rtk.md`.

## Fase 2 — Skills

- Criar índice `.agents/skills/README.md`.
- Manter skills específicas.
- Arquivar skills duplicadas.
- Atualizar sanitário para carência como sinal limitado.

## Fase 3 — Prompts

- Criar `.agents/prompts/`.
- Separar prompts por ferramenta.
- Reduzir prompts a escopo, arquivos, restrições, validações e aceite.

## Fase 4 — Docs

- Reorganizar `docs/context/`.
- Reorganizar `docs/technical/`.
- Reorganizar `docs/domain/`.
- Reorganizar `docs/product/`.
- Reorganizar `docs/ux/`.
- Reorganizar `docs/finance/`.
- Reorganizar `docs/manuals/`.
- Criar `docs/review/`.
- Criar `docs/archive/`.

## Fase 5 — Validação

Executar:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
```

Buscar contradições:

```bash
rg "livre de carência|apto para abate|pronto para venda|liberação sanitária" docs .agents
```

---

## Critérios de aceite

A otimização é aceitável quando:

- prompts ficam menores;
- regras globais ficam centralizadas;
- docs grandes deixam de ser leitura padrão;
- archive não é fonte ativa;
- manuais ficam separados por tela;
- matriz KPI completa só é usada sob demanda;
- agentes usam matriz de carregamento;
- carência sanitária está consistente;
- todo documento ativo tem baseline `3664395`.

---

## Pendências relacionadas

Registrar em:

```txt
docs/review/OPEN_REVIEW_ITEMS.md
```

Itens principais:

- baseline em todos os arquivos;
- contradições de carência;
- archive;
- links internos;
- revisão de skills;
- revisão de prompts;
- matriz de carregamento.