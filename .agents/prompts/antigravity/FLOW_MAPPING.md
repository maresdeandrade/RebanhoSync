# Antigravity Prompt — Flow Mapping

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use para mapear uma jornada funcional ou fluxo de dados sem alterar a implementação.

## Modo

`SOMENTE_LEITURA`

## Prompt

Mapeie o fluxo abaixo do início ao resultado observável:

```txt
[NOME_DO_FLUXO]
```

### Escopo inicial

```txt
[ARQUIVOS_OU_PASTAS_SE_CONHECIDOS]
```

## Contexto e skill

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`, `CONTEXT_LOADING.md` e `no-broad-context.md`.
3. Use `repository-context-retrieval` como skill principal somente quando os pontos de entrada ou saída não estiverem claros.
4. Se o fluxo já estiver delimitado, leia apenas arquivos-alvo, dependências diretas e testes relacionados.
5. Para comandos ou Graphify, siga `.agents/rules/rtk.md` e `GRAPHIFY_USAGE.md`.

Graphify é opcional: use apenas quando houver dependência transversal complexa que a leitura dirigida não resolva.

## Restrições

- Não editar arquivos, corrigir achados, criar testes, fazer commit ou preparar PR.
- Não ler o repositório inteiro.
- Não assumir que o nome exibido na UI identifica a entidade persistida.
- Não tratar Agenda, documento, checklist, tag ou insight como fato executado.
- Não confundir estado local transitório, fato histórico e `state_*` atual.
- Não afirmar comportamento offline/remoto sem seguir o fluxo até persistência e reconciliação.

## Itens a mapear

1. entrada do usuário, sistema ou integração;
2. componente, serviço ou handler inicial;
3. normalização e validações;
4. regra/política de domínio aplicada;
5. identidade e fonte de verdade de cada dado;
6. construção de payload, plano e efeitos;
7. persistência local em Dexie/IndexedDB, quando aplicável;
8. fila, sync, persistência remota e retorno do servidor, quando aplicável;
9. retry, duplicidade, sucesso parcial, rollback e reconcile, quando aplicável;
10. atualização de `state_*` ou read models, quando aplicável;
11. mensagens, erros e exceções expostos ao usuário;
12. RLS, papel e fronteira de `fazenda_id`, quando aplicável;
13. testes existentes e lacunas de cobertura.

Classifique cada conclusão como **fato confirmado**, **inferência** ou **lacuna**.

Para uma camada que realmente não participe do fluxo, registrar `N/A — não aplicável` com evidência curta. Não tratar ausência legítima como lacuna nem inventar etapa técnica.

## Tabela obrigatória

| Etapa | Arquivo/função | Entrada → saída | Responsabilidade | Fonte de verdade | Falha/compensação | Teste |
|---|---|---|---|---|---|---|
| 1 | `path/to/file.ts` | `[entrada] → [saída]` | `[responsabilidade]` | `[fonte]` | `[tratamento]` | `[teste ou ausente]` |

## Entrega

1. **Resumo do fluxo**
2. **Escopo e pontos de entrada/saída confirmados**
3. **Tabela de mapeamento**
4. **Diagrama Mermaid**, somente se esclarecer dependências ou transições
5. **Fontes de verdade por etapa**
6. **Fatos, inferências e lacunas**
7. **Fragilidades**, incluindo race conditions e acoplamentos
8. **Edge cases e testes recomendados**
9. **Melhorias incrementais**
10. **Próximos passos**, no máximo 3

Se uma etapa não puder ser comprovada, não complete o fluxo por suposição; registre a lacuna e o próximo arquivo mínimo necessário.
