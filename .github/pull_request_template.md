## Resumo

<!-- Descreva o delta real do PR em 2-5 linhas. Evite repetir o título. -->

- 
- 

## Tipo de mudança

- [ ] Correção
- [ ] Refatoração
- [ ] Feature
- [ ] Documentação
- [ ] Infra / CI
- [ ] Segurança / RLS / RPC
- [ ] Sync / Offline-first
- [ ] Outro

## Capability / Infra

- `capability_id` ou `infra_id`: `N/A`
- Issue vinculada: `N/A`
- Track:
  - [ ] Catalog
  - [ ] Infra / Out-of-catalog
  - [ ] Não aplicável

## Escopo alterado

- [ ] UI / UX
- [ ] Domínio / regra de negócio
- [ ] Dexie / offline local
- [ ] Supabase / SQL / migrations
- [ ] RLS / RPC / Edge Functions
- [ ] Sync / queue / rollback/reconcile
- [ ] Testes
- [ ] Documentação
- [ ] CI / GitHub Actions

## Contratos e impacto

<!-- Marque somente contratos realmente afetados pelo diff. -->

- [ ] Agenda
- [ ] Eventos / histórico factual
- [ ] `state_*` / read models
- [ ] Protocolos / configuração
- [ ] RLS / multi-tenant / `fazenda_id`
- [ ] Sync / retry / replay / reconciliação
- [ ] Auth / sessão / ownership
- [ ] Fonte de verdade
- [ ] Nenhum dos contratos acima

Fonte de verdade ou contrato principal afetado:

```txt
N/A
```

## Evidência / Governança

<!-- PM = evidência verificável por path/trecho. P = prova reproduzível por comando/resultado observado. -->

### Evidência PM

```txt
N/A
```

### Evidência P

```txt
N/A
```

### Validações não executadas

<!-- Liste somente validações relevantes que não foram executadas e o motivo. -->

```txt
N/A
```

## Riscos / Caveats

<!-- Não omita ressalvas reais. Use N/A somente quando não houver risco residual relevante conhecido. -->

- N/A

## Checklist final

- [ ] O diff real foi revisado contra o escopo declarado.
- [ ] Testes/validações listados acima foram realmente observados.
- [ ] Não há afirmação de PASS/READY/CLOSED sem evidência correspondente.
- [ ] Mudanças de banco/RLS/sync, se houver, preservam compatibilidade e isolamento aplicáveis.
- [ ] Nenhuma operação remota, destrutiva, merge ou deploy está implícita neste PR.
