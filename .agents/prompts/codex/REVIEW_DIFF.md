# Codex Prompt — Review de Diff

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use para revisar alterações já existentes. Este prompt é somente leitura: não autoriza corrigir o patch.

## Prompt

Revise o estado atual do worktree do RebanhoSync e classifique a entrega.

### Escopo pretendido

```txt
[DESCREVER_PEDIDO_E_LIMITES]
```

## Contexto e skill

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`, `no-broad-context.md` e `RESPONSE_FORMATS.md`.
3. Use `rebanhosync-verification-gate` como skill principal.
4. Para comandos e validações, siga `.agents/rules/rtk.md`.

## Restrições

- Não editar arquivos, corrigir achados, criar testes, fazer commit ou preparar PR.
- Não assumir que `git diff` inclui staged ou untracked.
- Não classificar como READY se uma validação necessária não foi executada ou se há arquivo relevante não inspecionado.
- Não tratar warning preexistente como regressão nova sem evidência.

## Revisão obrigatória

Inspecione:

- estado completo: tracked, staged, untracked, removidos e renomeados;
- conteúdo dos diffs unstaged e staged;
- conteúdo dos arquivos untracked relevantes;
- aderência entre escopo pretendido e diff real;
- contratos de domínio aplicáveis;
- regressão em offline-first, sync, idempotência, rollback, RLS e `fazenda_id`, quando tocados;
- mudanças indevidas em migrations, RLS, RPC, seed ou testes;
- regra de negócio na UI ou fonte de verdade paralela;
- testes alterados apenas para aceitar comportamento incorreto;
- validações executadas e lacunas.

## Classificação

- **READY:** escopo aderente, sem bloqueadores e validação suficiente confirmada.
- **READY WITH CAVEAT:** entrega utilizável, com risco residual explícito e não bloqueante.
- **NOT READY:** falha funcional, contrato violado, escopo indevido, evidência insuficiente ou validação bloqueante ausente.

## Entrega

1. **Classificação**
2. **Achados**, por severidade e com arquivo/trecho
3. **Diff real**, incluindo staged e untracked
4. **Escopo confirmado**
5. **Contratos avaliados**
6. **Validações executadas**
7. **Validações não executadas e motivo**
8. **Bloqueadores**
9. **Riscos/pendências**, no máximo 3
10. **Recomendação final**

Se não houver achados, declarar isso explicitamente e ainda registrar riscos residuais e lacunas de validação.
