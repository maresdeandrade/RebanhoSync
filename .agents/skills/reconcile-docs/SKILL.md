---
name: reconcile-docs
description: Reconcilia a documentação do RebanhoSync com o estado real de código, migrations e testes, atualizando somente snapshots, contratos, documentos derivados, manuais, prompts ou skills realmente afetados. Usar após mudança funcional/arquitetural, diante de drift documental ou para analisar a fase atual pelo repositório. Não usar para ajuste apenas visual, refactor sem delta, microcopy isolada, validação final do patch ou narrativa de PR.
role: lifecycle
---

# Reconcile Docs

## Missão

Eliminar drift documental com diffs mínimos, preservando a hierarquia de fontes e sem duplicar contratos estáveis.

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/CONTEXT_LOADING.md`;
4. `.agents/rules/no-broad-context.md`;
5. `.agents/rules/rtk.md`.

Depois, ler somente os arquivos necessários ao delta.

## Roteamento de contexto

| Necessidade | Fontes candidatas |
|---|---|
| Estado atual | `docs/context/PROJECT_STATUS.md`, `docs/context/KNOWN_GAPS.md` |
| Fonte de verdade | `docs/context/SOURCE_OF_TRUTH.md`, documento de domínio específico |
| Arquitetura/sync/RLS/eventos/testes | documento correspondente em `docs/technical/` |
| Fase/continuidade | `docs/review/CURRENT_PHASE_HANDOFF.md`, `docs/review/ACTIVE_PHASE_PLAN.md`, `docs/review/LAST_PHASE_RESULT.md` |
| Produto/roadmap | `docs/product/ROADMAP.md` |
| Documento derivado | arquivo derivado diretamente afetado, se existir |
| Manual/suporte | somente a página da tela ou fluxo alterado |

Não abrir todas as fontes da tabela. Selecionar apenas as que respondem à mudança.

## Precedência

Aplicar as precedências factual e procedimental definidas em `.agents/rules/CORE_RULES.md`. Esta skill não redefine nem relaxa essa ordem.

## Restrições

- Não usar `docs/archive/**` como verdade operacional.
- Não atualizar documento derivado sem delta funcional real.
- Não repetir contratos já definidos em `.agents/rules/CORE_RULES.md` ou `docs/context/SOURCE_OF_TRUTH.md`.
- Não reescrever documento estável por conveniência.
- Não documentar comportamento presumido ou teste não executado.
- Não transformar roadmap em pendência técnica nem intenção em entrega concluída.
- Não arquivar ou excluir conteúdo histórico sem necessidade e escopo explícitos.

## Procedimento

### 1. Registrar baseline e escopo

Identificar:

- capability ou trilha de infraestrutura afetada, quando esse identificador existir no plano ativo;
- módulos e arquivos alterados;
- migrations/RPC/RLS envolvidos;
- evidências de teste;
- mudanças preexistentes no worktree que não pertencem à tarefa.

### 2. Validar o estado real

Inspecionar somente código, migrations ativas, testes e documentos diretamente ligados ao delta. Se houver conflito, registrar a divergência e seguir a hierarquia de fontes.

### 3. Classificar o impacto documental

Para cada candidato, classificar como:

- `snapshot`;
- `normative`;
- `derived`;
- `manual/support`;
- `prompt/skill`;
- `no_doc_impact`.

### 4. Medir o delta

Registrar por documento:

- o que mudou;
- o que permanece válido;
- o trecho em drift;
- o que não deve ser tocado;
- ação: atualizar, dividir, arquivar ou manter.

### 5. Atualizar na camada correta

Aplicar somente os níveis necessários:

1. normativo, se o contrato mudou;
2. snapshot, se o estado atual mudou;
3. derivado/roadmap, se o progresso ou dívida mudou;
4. manual, se o comportamento visível mudou;
5. prompt/skill, se o comportamento dos agentes mudou.

Usar diff mínimo por arquivo.

### 6. Preservar histórico

Se um documento tiver sido realmente substituído e a tarefa incluir arquivamento:

- extrair antes qualquer conteúdo ainda ativo;
- mover para o padrão de archive já adotado no repositório;
- não apagar histórico silenciosamente;
- não criar novo padrão de diretório sem necessidade.

### 7. Avaliar ADR

Sugerir ADR somente se houver alteração durável em:

- contrato de sync, ordenação, deduplicação ou status;
- modelo canônico;
- invariantes RLS/RBAC/RPC;
- offline-first;
- Two Rails;
- fonte de verdade;
- regra normativa que orientará decisões futuras.

## Validação

Seguir `.agents/rules/rtk.md` e executar ao menos:

```bash
git status --short --untracked-files=all
git diff --check
```

Inspecionar o diff dos documentos alterados. Validar links, invariantes duplicados ou arquivos extensos apenas quando o delta exigir e com busca direcionada.

## Saída obrigatória

Separar `snapshot`, `normative`, `derived`, `manual/support`, `prompt/skill` e `archive`, informando:

1. resumo da reconciliação;
2. documentos atualizados e motivo;
3. documentos deliberadamente mantidos;
4. documentos movidos e conteúdo preservado;
5. fase atual, somente se solicitada;
6. validações e evidências;
7. riscos, dívidas ou divergências, até três;
8. ADR sugerido, se aplicável.

Não afirmar reconciliação sem verificar os arquivos reais.
