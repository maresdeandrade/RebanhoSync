# Antigravity Prompt — Architecture Review

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use para revisar a arquitetura de uma área ou fluxo sem alterar arquivos.

## Prompt

Realize uma revisão arquitetural somente leitura da área abaixo:

```txt
[AREA_OU_FLUXO]
```

### Escopo inicial

```txt
[ARQUIVOS_OU_PASTAS_SE_CONHECIDOS]
```

## Contexto e skill

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`, `CONTEXT_LOADING.md` e `no-broad-context.md`.
3. Se o ponto de intervenção estiver incerto, use `repository-context-retrieval` como skill principal.
4. Se o hotspot já estiver delimitado e a análise for de responsabilidades/acoplamento, use `harden-module` como skill principal.
5. Não use as duas skills por padrão; escolha conforme a dúvida dominante.
6. Para comandos e consultas Graphify, siga `.agents/rules/rtk.md`.

Expanda o contexto somente quando uma lacuna técnica relevante permanecer explícita.

## Restrições

- Não editar arquivos, implementar patch, criar testes, fazer commit ou preparar PR.
- Não ler o repositório inteiro nem todas as migrations, skills ou documentações.
- Não usar `docs/archive/**` como contrato atual.
- Não transformar hipótese arquitetural em comportamento confirmado.
- Não propor refatoração ampla quando contenção incremental resolver o risco.
- Não declarar teste, build ou validação como executado sem evidência.

## Avaliação obrigatória

Analise somente os itens aplicáveis:

- fronteiras e separação de responsabilidades;
- fonte de verdade e fluxo de atualização;
- acoplamento entre UI, regra de negócio, persistência e efeitos;
- compatibilidade com offline-first;
- idempotência, retry/replay, sucesso parcial, rollback e reconcile;
- isolamento por `fazenda_id`, RLS e autorização, se houver banco;
- compatibilidade entre clientes locais e contratos remotos;
- risco de duplicidade, concorrência e regressão;
- testabilidade, observabilidade e tratamento de falhas;
- complexidade ou abstração sem benefício comprovado.

Preserve os contratos: Agenda=intenção; Evento=fato; `state_*`=estado atual; Protocolo=regra; tags/sinais/insights=auxiliares; decisões críticas exigem fonte técnica explícita.

## Entrega

1. **Veredito**
2. **Escopo e fontes inspecionadas**
3. **Fatos confirmados**, com arquivos ou contratos de suporte
4. **Inferências e lacunas**
5. **Fragilidades**, por severidade
6. **Responsabilidades e fontes de verdade**
7. **Risco offline/sync/rollback**, quando aplicável
8. **Risco RLS/multi-tenant**, quando aplicável
9. **Hardening incremental sugerido**, em etapas pequenas
10. **Testes necessários**
11. **Riscos/pendências**, no máximo 3

Se o contexto não for suficiente para um veredito, informe exatamente a lacuna e o próximo arquivo mínimo necessário.
