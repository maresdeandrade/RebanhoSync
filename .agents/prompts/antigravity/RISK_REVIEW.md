# Antigravity Prompt — Risk Review

Atualizado em: 2026-08-07
Versão: 1.2.0

Use para revisar riscos de uma mudança proposta antes da implementação. Não use para revisar ou aprovar um diff já existente.

## Modo

`SOMENTE_LEITURA`

Não editar arquivos, executar correções, criar testes, fazer commit ou preparar PR.

## Entradas obrigatórias

### Mudança proposta

```txt
[DESCREVER_MUDANCA_E_RESULTADO_ESPERADO]
```

### Escopo conhecido

```txt
[ARQUIVOS_AREAS_OU_CONTRATOS]
```

### Evidências disponíveis

```txt
[CODIGO_DOCUMENTO_TESTE_OU_LACUNA_CONHECIDA]
```

## Dependências autoritativas

1. Aplicar `AGENTS.md` e `.agents/rules/CORE_RULES.md`.
2. Usar `.agents/rules/CONTEXT_LOADING.md` para contexto e skill.
3. Aplicar `.agents/rules/no-broad-context.md`.
4. Seguir `.agents/rules/rtk.md` se houver comandos somente leitura.
5. Usar `repository-context-retrieval` como skill principal apenas se o ponto de intervenção estiver incerto; caso contrário, registrar `N/A` e inspecionar somente o escopo delimitado.

## Escopo proibido

- Não ampliar autorização nem converter recomendação em patch.
- Não aprovar proposta apenas por descrição; exigir evidência proporcional no repositório.
- Não tratar hipótese, checklist, agenda, tag ou insight como fato.
- Não carregar todos os documentos, migrations ou skills.
- Não afirmar validação, comportamento ou mitigação sem evidência.

## Avaliação

Avaliar somente categorias aplicáveis:

- produto e clareza operacional;
- domínio e fontes de verdade;
- offline-first, idempotência, retry, rollback e reconcile;
- RLS, `fazenda_id`, autorização e exposição de credenciais;
- compatibilidade local/remota e migrations;
- testes, observabilidade e tratamento de falha;
- escopo, reversibilidade e risco de regressão.

Classificar cada conclusão como `FATO_CONFIRMADO`, `INFERÊNCIA` ou `RECOMENDAÇÃO` e cada risco como `BAIXO`, `MÉDIO`, `ALTO` ou `BLOQUEANTE`.

## Condições de parada

Se não for possível localizar o contrato, o ponto de intervenção ou a evidência mínima, não emitir aprovação. Registrar a lacuna e o próximo arquivo mínimo necessário.

## Saída obrigatória

| Risco | Severidade | Classificação da evidência | Evidência/gatilho | Mitigação mínima | Bloqueia? |
|---|---|---|---|---|---|

Finalizar com:

1. **Veredito:** `APROVADO`, `APROVADO_COM_RESSALVAS`, `REJEITADO` ou `EVIDÊNCIA_INSUFICIENTE`;
2. **Escopo e fontes inspecionadas**;
3. **Riscos bloqueantes**;
4. **Ajustes mínimos antes da implementação**;
5. **Testes necessários**;
6. **Riscos/pendências**, no máximo 3.
