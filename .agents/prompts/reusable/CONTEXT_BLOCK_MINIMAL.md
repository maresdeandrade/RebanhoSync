# Context Block Minimal — RebanhoSync

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use somente quando a IA não puder consultar as rules e os documentos ativos diretamente. Este bloco é fallback de contexto, não fonte de verdade.

## Projeto

RebanhoSync é um app agropecuário offline-first para gestão pecuária de corte.

Stack principal: React/TypeScript, Dexie/IndexedDB, Supabase/Postgres/Auth/RLS e sincronização local-remota.

## Contratos mínimos

- Agenda = intenção futura; não histórico.
- Evento = fato executado.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração; não execução.
- Tags, sinais e insights = auxiliares; nunca fonte primária ou regra crítica.
- Decisões operacionais críticas exigem fonte técnica explícita.
- Preservar offline-first, idempotência, rollback, RLS, multi-tenant e isolamento por `fazenda_id`.
- Não misturar UI com regra de negócio nem criar fonte de verdade paralela.

## Tarefa

```txt
[OBJETIVO_ESPECIFICO]
```

### Escopo permitido

```txt
[ESCOPO_PERMITIDO]
```

### Escopo proibido

```txt
[ESCOPO_PROIBIDO]
```

### Critérios de aceite

```txt
[CRITERIOS_ESPECIFICOS]
```

## Regras de trabalho

- Separar fato confirmado, inferência e recomendação.
- Preferir patch pequeno, reversível e testável.
- Não inventar arquivos, contratos, comandos ou validações.
- Carregar somente o contexto necessário.
- Se o repositório estiver acessível, substituir este bloco pela leitura de `AGENTS.md`, das rules e das fontes ativas pertinentes.
- Em conflito, prevalecem código + migrations ativas, `PROJECT_STATUS.md`, documentos normativos ativos, documentos derivados e, por último, histórico.
