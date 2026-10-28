# Codex Prompt — Feature Pequena

Atualizado em: 2026-10-28
Versão: 1.3.0

Use para implementar uma funcionalidade nova, pequena e delimitada. Para corrigir comportamento existente em um ponto conhecido, prefira `PATCH_LOCAL.md`.

## Modo

`IMPLEMENTATION` somente dentro do escopo preenchido neste prompt e da tarefa atual.

## Prompt

Implemente no RebanhoSync:

```txt
[DESCREVER_FEATURE_E_RESULTADO_OBSERVAVEL]
```

### Escopo permitido

```txt
[LISTAR_ARQUIVOS_AREAS_OU_COMPORTAMENTOS_PERMITIDOS]
```

### Escopo proibido

```txt
[LISTAR_LIMITES_ESPECIFICOS]
```

### Arquivos-alvo prováveis

```txt
[LISTAR_ARQUIVOS_OU_PASTAS]
```

### Critérios de aceite específicos

```txt
[LISTAR_CENARIOS_OBSERVAVEIS]
```

## Contexto e skill

Aplique o bootstrap único e a rota B de `.agents/rules/CONTEXT_LOADING.md`; risco de contrato crítico exige rota C. Descoberta dirigida somente se o ponto de intervenção permanecer incerto. Seleção e limite de skills seguem o roteador, sem repetir contexto vigente. Para comandos e evidências, siga `.agents/rules/rtk.md`.

## Antes do patch

Confirme de forma breve:

- fonte de verdade e fluxo afetado;
- arquivos mínimos a ler e alterar;
- impacto em domínio, offline-first, sync e RLS — apenas quando aplicável;
- necessidade de migration/RPC/RLS/schema;
- plano incremental e testes proporcionais.

Use plano curto na conversa, sem documento de fase por padrão. Se a descoberta não delimitar o ponto de intervenção, parar sem implementar e relatar a lacuna mínima. Caso contrário, continuar a implementação autorizada até a entrega na mesma sessão.

## Regras

- Não ampliar escopo nem refatorar por conveniência.
- Não criar fonte paralela de verdade.
- Não mover regra crítica para componente React.
- Preservar idempotência, retry, sucesso parcial, rollback e isolamento por `fazenda_id` quando afetados.
- Não alterar migration, RLS, RPC, seed ou schema sem autorização explícita no escopo.
- Atualizar documentação somente se surgir contrato, limitação ou comportamento persistente novo.
- Não afirmar validação sem saída confirmatória.

## Validação

Executar as validações proporcionais de `.agents/rules/rtk.md` e demonstrar o resultado funcional observável dos critérios de aceite. Concluir com `rebanhosync-verification-gate`, reutilizando testes e revisão vigentes; build, E2E, Supabase e suíte ampliada somente conforme risco real. Não repetir verificações sem mudança que possa afetar seu resultado.

## Entrega

1. **Decisão e resultado**
2. **Arquivos criados/alterados**
3. **Decisões técnicas**
4. **Testes e validações executadas**
5. **Validações não executadas e motivo**
6. **Riscos/pendências**, no máximo 3
