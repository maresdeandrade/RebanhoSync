```markdown
# ADR-0004: Dedup Sanitário Canônico Estruturado

> **Status:** Accepted  
> **Data:** 2026-04-27  
> **Atualizado:** 2026-06-01  
> **Contexto:** Saneamento sanitário P0.3  
> **Autores:** Codex + revisão técnica

## Contexto

O dedup sanitário tinha duas formas ativas: TypeScript gerava chave estruturada e SQL renderizava templates livres. Essa divergência podia gerar duplicidade, ausência de agenda ou colisão semântica entre protocolo oficial, standard e custom.

Com a evolução do domínio sanitário, ficou explícito que dedup canônico se aplica à **agenda sanitária operacional**, não a checklist regulatório contextual, ocorrência de biossegurança, suspeita notificável ou correção histórica.

## Decisão

O contrato canônico de dedup sanitário é estruturado:

```txt
sanitario:{scopeType}:{scopeId}:{familyCode}:{itemCode}:v{regimenVersion}:{periodMode}:{periodKey}

```

TypeScript gera esse contrato por `buildSanitaryDedupKey`. SQL deve gerar a mesma chave por função canônica equivalente, mantendo `render_dedup_key` apenas como wrapper compatibilizado quando existir no caminho ativo.

### Escopo do dedup canônico

Aplica-se a:

* agenda sanitária operacional;
* protocolos sanitários com `gera_agenda=true`;
* materialização de milestones sanitários;
* recompute de pendências futuras;
* anti-zumbi de agenda sanitária operacional.

Não se aplica a:

* evento sanitário já executado;
* ocorrência de biossegurança;
* suspeita/doença notificável;
* checklist regulatório contextual;
* overlay de compliance sem runtime acionável;
* pendência corretiva gerada por ocorrência real;
* correção/complemento/estorno histórico;
* sinais/insights.

### Alternativas consideradas

* Manter templates livres no SQL: descartado por risco de drift semântico.
* Criar contrato novo fora de TS/SQL: descartado por custo maior e falta de necessidade para o ciclo atual.
* Usar dedup de agenda para checklist/compliance: descartado porque checklist contextual não é tarefa operacional.
* Usar dedup de protocolo para ocorrência: descartado porque ocorrência é fato contextual, não regra recorrente.

### Consequências

* `scopeType`, `scopeId`, `familyCode`, `itemCode`, `regimenVersion`, `periodMode` e `periodKey` são campos obrigatórios do contrato.
* Dedup não deve depender apenas de nome textual, ano isolado, dose solta ou template livre.
* Golden tests devem falhar se TS e SQL divergirem.
* Checklist regulatório disponível não deve criar dedup de agenda.
* Doença notificável sem suspeita real não deve criar dedup.
* Pendência corretiva deve ser vinculada ao evento/ocorrência por `source_evento_id`, não deduplicada como protocolo sanitário recorrente.

### Evidências e referências

* `src/lib/sanitario/engine/dedup.ts`
* `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`
* `src/lib/sanitario/__tests__/dedup.test.ts`
* `src/lib/sanitario/__tests__/golden/sanitario_engine_parity.golden.test.ts`
* `docs/domain/SANITARIO.md`

### Plano de rollout

* Manter o contrato canônico nos testes de dedup e golden.
* Qualquer novo protocolo deve escolher `familyCode`, `itemCode`, `regimenVersion`, `periodMode` e `periodKey Body` explicitamente.
* Qualquer novo fluxo de checklist/compliance deve declarar se é contextual ou acionável.
* Ocorrências e correções devem usar vínculo factual, não dedup de protocolo.

---

```

```