---
name: prepare-pr
description: Prepara título, corpo, escopo, impacto de domínio, validações e riscos de um PR do RebanhoSync usando uma verificação classificada como READY. Usar quando o patch estiver concluído e verificado e o usuário pedir narrativa de PR ou handoff final. Não usar com READY WITH CAVEAT, NOT READY, escopo incerto, implementação em andamento ou antes do rebanhosync-verification-gate.
role: lifecycle
---

# Prepare PR

## Missão

Converter o resultado do `rebanhosync-verification-gate` em uma narrativa curta, auditável e sem ampliar o escopo técnico.

## Entradas obrigatórias

Exigir do gate:

- classificação READY;
- resumo do diff e arquivos alterados;
- contratos afetados;
- comandos realmente executados e resultados;
- ressalvas e riscos.

Se essas informações não estiverem disponíveis, o resultado for READY WITH CAVEAT/NOT READY ou o patch tiver mudado depois do gate, interromper a preparação e executar novamente o `rebanhosync-verification-gate` após resolver a ressalva ou bloqueador.

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/RESPONSE_FORMATS.md`;
4. resultado atual do gate.

Ler contexto adicional apenas se uma ressalva do gate exigir precisão de domínio. Não reabrir documentação ampla.

## Restrições

- Não inventar teste, resultado, arquivo ou comportamento.
- Não omitir ressalva do gate.
- Não dizer “todos os testes passaram” sem evidência correspondente.
- Não alterar código ou documentação nesta etapa.
- Não expandir o escopo nem introduzir decisão arquitetural nova.
- Não declarar impacto ausente sem confirmação do diff.

## Título

Usar título curto, acionável e com um único escopo principal.

Formato preferido:

```txt
<tipo>: <ação objetiva>
```

Tipos usuais: `fix`, `feat`, `refactor`, `docs`, `test`, `chore` ou `ui`.

## Corpo do PR

Usar:

### Summary

- o que mudou;
- por que mudou.

### Files changed

- principais arquivos ou áreas;
- arquivos gerados, movidos ou arquivados, se houver.

### Domain impact

Declarar como afetado ou não afetado, conforme o gate:

- Agenda;
- Eventos;
- `state_*`;
- Protocolos;
- tags/sinais/insights;
- Supabase/RLS/migrations;
- sync/offline.

### Validation

Listar cada comando, resultado e ressalva exatamente como verificados.

### Scope confirmed

Declarar somente exclusões confirmadas, como ausência de mudança em produto, UI, domínio, migrations/RLS/RPC ou sync/offline.

### Risks / caveats

Listar até três riscos reais não bloqueantes já aceitos pelo gate READY.

## Saída obrigatória

Retornar:

1. título do PR;
2. corpo em Markdown pronto para copiar;
3. notas de revisão, somente se úteis;
4. checklist pós-merge, somente se houver ação imediata real.

Ser conciso e não superestimar o impacto.
