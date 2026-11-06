---
name: reconcile-docs
description: Usar quando houver drift documental comprovado ou atualização documental explicitamente autorizada no RebanhoSync, inclusive por mudança normativa ou de governança sem alteração de runtime. Não usar para consulta somente leitura sobre fase atual, status ou roadmap, validação final de patch ou narrativa de PR.
role: lifecycle
---

# Reconcile Docs

## Missão

Eliminar drift documental com diffs mínimos, preservando a hierarquia de fontes e sem duplicar contratos estáveis.

## Leitura inicial

1. Reutilize o bootstrap único de `AGENTS.md` e as rules já carregadas nesta sessão.
2. Não releia instruções ou reinicie o bootstrap por causa desta skill. Em uma sessão sem bootstrap aplicado, siga `AGENTS.md` uma vez antes de continuar.

Depois, ler somente os arquivos necessários ao delta.

## Roteamento de contexto

| Necessidade | Fontes candidatas |
|---|---|
| Estado atual | `docs/context/PROJECT_STATUS.md`, `docs/context/KNOWN_GAPS.md` |
| Fonte de verdade | `docs/context/SOURCE_OF_TRUTH.md`, documento de domínio específico |
| Arquitetura/sync/RLS/eventos/testes | documento correspondente em `docs/technical/` |
| Fase/continuidade | Selecionar entre `docs/review/CURRENT_PHASE_HANDOFF.md`, `docs/review/ACTIVE_PHASE_PLAN.md`, `docs/review/LAST_PHASE_RESULT.md` somente quando a tarefa depender de continuidade ou estado de fase |
| Produto/roadmap | `docs/product/ROADMAP.md` |
| Documento derivado | arquivo derivado diretamente afetado, se existir |
| Manual/suporte | somente a página da tela ou fluxo alterado |

Não abrir todas as fontes da tabela. Selecionar apenas as que respondem à mudança.

## Precedência

Aplicar as precedências factual e procedimental definidas em `.agents/rules/CORE_RULES.md`. Esta skill não redefine nem relaxa essa ordem.

## Restrições

- Não usar `docs/archive/**` como verdade operacional.
- Atualizar documento derivado somente com delta factual ou normativo comprovado na fonte aplicável; mudanças de governança não exigem alteração de runtime.
- Não repetir contratos já definidos em `.agents/rules/CORE_RULES.md` ou `docs/context/SOURCE_OF_TRUTH.md`.
- Não reescrever documento estável por conveniência.
- Não documentar comportamento presumido ou teste não executado.
- Não transformar roadmap em pendência técnica nem intenção em entrega concluída.
- Não arquivar ou excluir conteúdo histórico sem necessidade e escopo explícitos.

## Procedimento

### 1. Delimitar baseline e escopo

Identificar:

- capability ou trilha de infraestrutura afetada, se já estiver identificada em contexto/plano pertinente; não abrir plano somente para obter identificador;
- módulos e arquivos alterados;
- migrations/RPC/RLS envolvidos;
- evidências de teste;
- mudanças preexistentes no worktree que não pertencem à tarefa.

Consultar handoff/plano de fase somente se a tarefa exigir continuidade, fechamento ou confirmação do estado da fase.

### 2. Validar o estado real

Inspecionar somente as fontes diretamente ligadas ao delta e necessárias para confirmar o fato normativo. Se houver conflito, seguir a hierarquia de fontes; registrar a divergência somente quando afetar a decisão ou entrega.

### 3. Classificar o impacto documental

Classificar os documentos efetivamente pertinentes como:

- `snapshot`;
- `normative`;
- `derived`;
- `manual/support`;
- `prompt/skill`;
- `no_doc_impact`.

### 4. Medir o delta

Determinar por documento:

- o que mudou;
- o que permanece válido;
- o trecho em drift;
- o que não deve ser tocado;
- ação: atualizar ou manter. Dividir, arquivar ou mover somente quando necessário e autorizado.

Não criar relatórios, handoffs, ADRs ou arquivos auxiliares para documentar a reconciliação.

### 5. Atualizar na camada correta

Aplicar somente os níveis necessários:

1. normativo, se o contrato mudou;
2. snapshot, se o estado atual mudou;
3. derivado/roadmap, se o progresso ou dívida mudou;
4. manual, se o comportamento visível mudou;
5. prompt/skill, se o comportamento dos agentes mudou.

Usar diff mínimo por arquivo. Alterar somente documentos canônicos autorizados que tenham mudança factual/normativa durável; não atualizar `LAST_PHASE_RESULT.md` ou outro registro de continuidade por rotina.

### 6. Preservar histórico

Se um documento tiver sido realmente substituído e a tarefa incluir arquivamento:

- extrair antes qualquer conteúdo ainda ativo;
- mover para o padrão de archive já adotado no repositório;
- não apagar histórico silenciosamente;
- não criar novo padrão de diretório sem necessidade.

### 7. Avaliar necessidade de ADR

Não criar ADR por rotina. Considerar sua necessidade somente se houver alteração durável em:

- contrato de sync, ordenação, deduplicação ou status;
- modelo canônico;
- invariantes RLS/RBAC/RPC;
- offline-first;
- Two Rails;
- fonte de verdade;
- regra normativa que orientará decisões futuras.

Qualquer criação continua sujeita a autorização explícita e escopo para o documento.

## Validação

Seguir `.agents/rules/rtk.md` e executar ao menos:

```bash
git status --short --untracked-files=all
git diff --check
```

Inspecionar o diff dos documentos alterados. Validar links, invariantes duplicados ou arquivos extensos apenas quando o delta exigir e com busca direcionada.
Para alterações em `.agents/`, executar `pnpm run gates:docs` quando disponível; esse gate já inclui a auditoria de agentes.

## Saída obrigatória

Entregar de forma concisa, distinguindo fato confirmado, inferência e recomendação quando relevante:

1. resumo e documentos efetivamente atualizados, se houver;
2. documentos deliberadamente mantidos somente quando isso esclarecer o escopo;
3. arquivos movidos somente se houver movimentação autorizada;
4. fase atual somente se solicitada;
5. validações e evidências;
6. riscos, dívidas ou divergências relevantes, até três;
7. ADR somente se necessário e autorizado.

Não afirmar reconciliação sem verificar os arquivos reais. Se não houver mudança documental durável, não crie artefato e relate a decisão sem alteração de arquivo.
