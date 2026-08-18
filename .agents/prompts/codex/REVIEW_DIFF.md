# Codex Prompt — Review de Diff

Atualizado em: 2026-08-07
Versão: 1.3.0

Use para revisar alterações já existentes e classificar a entrega. Este prompt é wrapper do `rebanhosync-verification-gate` e não duplica seu procedimento.

## Modo

`SOMENTE_LEITURA`

## Entrada obrigatória

### Escopo pretendido

```txt
[DESCREVER_PEDIDO_LIMITES_E_BASE_SE_A_ENTREGA_ESTIVER_COMMITADA]
```

## Dependências autoritativas

1. Aplicar `AGENTS.md`, `.agents/rules/CORE_RULES.md` e `.agents/rules/CONTEXT_LOADING.md`.
2. Usar `rebanhosync-verification-gate` como skill lifecycle principal desta fase.
3. Seguir `.agents/rules/rtk.md` para comandos e validações.
4. Usar `.agents/rules/RESPONSE_FORMATS.md` somente como formato geral; o contrato específico do gate prevalece.

## Escopo proibido

- Não editar arquivos, corrigir achados, criar testes, fazer commit ou preparar PR.
- Não presumir base Git nem considerar untracked revisado apenas pelo nome.
- Não classificar como READY quando o gate exigir NOT READY ou quando houver evidência desconhecida.

## Condições de parada

Se o escopo pretendido, a base necessária ou algum arquivo relevante não puder ser inspecionado, retornar NOT READY conforme o gate.

## Saída obrigatória

Retornar exatamente o contrato de saída de `rebanhosync-verification-gate`, acrescentando apenas uma seção inicial **Escopo pretendido**. Se não houver achados, declarar isso sem omitir lacunas ou riscos residuais.
