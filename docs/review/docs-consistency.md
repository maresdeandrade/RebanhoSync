# Relatório de Auditoria: Consistência de Documentos Normativos

> **Status:** Auditoria Factual
> **Data:** 2026-02-16
> **Escopo:** ARCHITECTURE, DB, RLS, CONTRACTS, OFFLINE, EVENTOS_AGENDA_SPEC, E2E_MVP

---

## 1. Executive Summary

### Contagem de Achados por Severidade

| Severidade  | Total | Descrição                                       |
| :---------- | :---: | :---------------------------------------------- |
| **BLOCKER** |   0   | Contradições que quebram funcionalidade crítica |
| **MAJOR**   |   2   | Desvios significativos entre docs e código      |
| **MINOR**   |   4   | Inconsistências de nomenclatura ou referência   |
| **NIT**     |   3   | Melhorias estilísticas ou clareza               |

**Total de Issues:** 9 achados
**Resultado:** ✅ Nenhum bloqueador encontrado. Documentação está substancialmente alinhada ao código.

---

## 2. Findings Table

| ID         | Severity | Doc(s) Affected | Claim                                                                                 | Evidence                                 | Por que inconsistente                                                                                                   | Minimal Patch                                                                       |
| :--------- | :------- | :-------------- | :------------------------------------------------------------------------------------ | :--------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| **DC-001** | MAJOR    | ARCHITECTURE.md | "Trigger `prevent_business_update`" (L42)                                             | `supabase/migrations/0001_init.sql`      | Trigger existe mas nome real é `prevent_evento_update`                                                                  | Corrigir nome do trigger para `prevent_evento_update`                               |
| **DC-002** | MAJOR    | DB.md           | "`animais_sociedade`" listado em § 3 (State)                                          | `src/lib/offline/db.ts:31,146`           | Tabela comentada como "FASE 2.2" no código                                                                              | Mover para seção "Fase 2 (Planejado)" ou remover se não implementado                |
| **DC-003** | MINOR    | ARCHITECTURE.md | "`source_evento_id` / `source_task_id`" (L48)                                         | `supabase/migrations/0001_init.sql`      | Coluna `source_task_id` existe em `eventos`, mas `source_evento_id` não existe como coluna (apenas `corrige_evento_id`) | Corrigir para "`corrige_evento_id` / `source_task_id`"                              |
| **DC-004** | MINOR    | OFFLINE.md      | "Stores: `event_eventos_*`" (L44)                                                     | `src/lib/offline/db.ts`                  | Notação genérica está correta, mas doc não lista explicitamente as 6 tabelas de detalhe                                 | Adicionar lista explícita: `event_eventos_sanitario`, `event_eventos_pesagem`, etc. |
| **DC-005** | MINOR    | CONTRACTS.md    | "Reason Code: `VALIDATION_MOVIMENTACAO_ORIGEM_DESTINO`" (L80)                         | `supabase/functions/sync-batch/rules.ts` | Código de validação existe conforme documentado                                                                         | ✅ OK (Verificado)                                                                  |
| **DC-006** | MINOR    | RLS.md          | "A escrita em `animais` é permitida para Cowboys" (L30) + Nota sobre restrição futura | `docs/TECH_DEBT.md:TD-003`               | Nota está desatualizada; TD-003 já documenta que DELETE deve ser restrito                                               | Alterar nota para: "DELETE de animais está planejado para restrição (ver TD-003)"   |
| **DC-007** | NIT      | ARCHITECTURE.md | "Two Rails" (§2) vs "State Rails" vs "Event Rails"                                    | Múltiplos docs                           | Terminologia misturada: "Rail 1/2" vs "State/Event"                                                                     | Padronizar: sempre usar "Rail 1 (Agenda)" e "Rail 2 (Eventos)"                      |
| **DC-008** | NIT      | E2E_MVP.md      | "Fluxo 7: Operacional" menciona "Dashboard de monitoramento de rejeições"             | `docs/ROADMAP.md`                        | Feature não implementada, apenas planejamento                                                                           | Adicionar nota: "(Planejado - M2)"                                                  |
| **DC-009** | NIT      | DB.md           | "`categorias_zootecnicas`" listado em § 2 (Admin)                                     | Schema atual não possui                  | Feature futura                                                                                                          | Marcar como "(Planejado - Fase 2)"                                                  |

---

## 3. Patch Suggestions (por arquivo)

### ARCHITECTURE.md

#### § 2.2 Rail 2: Eventos (Append-Only)

**Antes:**

```markdown
- Imutável (Trigger `prevent_business_update`).
```

**Depois:**

```markdown
- Imutável (Trigger `prevent_evento_update`).
```

#### § 2.3 Desacoplamento

**Antes:**

```markdown
Não existe FK rígida entre `agenda_itens` e `eventos`. A relação é apenas lógica (`source_evento_id` / `source_task_id`), permitindo criação offline sem dependência de IDs síncronos.
```

**Depois:**

```markdown
Não existe FK rígida entre `agenda_itens` e `eventos`. A relação é apenas lógica (`corrige_evento_id` para correções e `source_task_id` para vínculo com agenda), permitindo criação offline sem dependência de IDs síncronos.
```

---

### DB.md

#### § 2.1 Entidades Administrativas

**Antes:**

```markdown
### `categorias_zootecnicas`

Regras de classificação automática (Idade/Sexo).
```

**Depois:**

```markdown
### `categorias_zootecnicas` (Planejado - Fase 2)

Regras de classificação automática (Idade/Sexo).
```

#### § 3 State (Estado Operacional)

**Antes:**

```markdown
### `animais_sociedade`

Rastreio de propriedade de terceiros.
```

**Depois:**

```markdown
### `animais_sociedade` (Planejado - Fase 2)

Rastreio de propriedade de terceiros.
```

---

### RLS.md

#### § 2. Matriz RBAC (Nota de Rodapé)

**Antes:**

```markdown
> **Nota:** A escrita em `animais` é permitida para Cowboys para agilidade, mas o `DELETE` pode ser restrito futuramente.
```

**Depois:**

```markdown
> **Nota:** A escrita em `animais` é permitida para Cowboys para agilidade. O `DELETE` está planejado para restrição a Owner/Manager (ver [TD-003](./TECH_DEBT.md)).
```

---

### OFFLINE.md

#### § 2. Event Stores (Rail 2)

**Antes:**

```markdown
Log append-only. Tabela `event_*`.

- Ex: `event_eventos`, `event_eventos_sanitario`.
```

**Depois:**

```markdown
Log append-only. Tabela `event_*`.

- `event_eventos` (Header)
- `event_eventos_sanitario`, `event_eventos_pesagem`, `event_eventos_nutricao`, `event_eventos_movimentacao`, `event_eventos_reproducao`, `event_eventos_financeiro`
```

---

### E2E_MVP.md

#### Fluxo 7: Operacional

**Antes:**

```markdown
## Fluxo 7: Operacional

- Feature flags de fazenda.
- Dashboard de monitoramento de rejeições.
```

**Depois:**

```markdown
## Fluxo 7: Operacional

- Feature flags de fazenda.
- Dashboard de monitoramento de rejeições (Planejado - M2).
```

---

## 4. Issues Verificados (No Issues Found)

Os seguintes aspectos foram auditados e confirmados consistentes entre docs e código:

### ✅ Naming Alignment (Tabelas/Colunas/Enums)

- **`agenda_itens`**: Existe em migrations e Dexie (`state_agenda_itens`)
- **`dedup_key`**: Confirmado em migrations `0001_init.sql`, `0028_sanitario_agenda_engine.sql`
- **`fazenda_id`**: Presente em todas as tabelas de negócio conforme documentado
- **Event Details**: Todas as 6 tabelas satélites (`eventos_sanitario`, `eventos_pesagem`, `eventos_nutricao`, `eventos_movimentacao`, `eventos_reproducao`, `eventos_financeiro`) existem

### ✅ Invariants Alignment (Arquitectura/Regras)

- **Anti-Teleporte**: Implementado em `sync-batch/rules.ts` (reason_code: `ANTI_TELEPORTE`)
- **Imutabilidade de Eventos**: Trigger verificado (nome real: `prevent_evento_update`)
- **Deduplicação de Agenda**: Lógica de `dedup_key` implementada com unique constraint
- **Tenant Isolation**: `fazenda_id` forçado em todas as policies RLS

### ✅ RBAC Matrix (Permissions)

- **Owner/Manager/Cowboy**: Roles documentados existem em `user_fazendas.role` (enum)
- **RPCs Administrativas**: `admin_set_member_role`, `admin_remove_member`, `create_fazenda`, `create_invite` confirmados em migrations
- **Security Definer**: RPCs privilegiadas usam `SECURITY DEFINER` conforme documentado

### ✅ Sync Contracts (API)

- **Endpoint**: `/functions/v1/sync-batch` existe
- **Status Codes**: `APPLIED`, `APPLIED_ALTERED`, `REJECTED` confirmados no código
- **Reason Codes**: Todos os codes listados em CONTRACTS.md existem em `sync-batch/rules.ts`

### ✅ E2E Coverage vs Roadmap

- **Fluxos 0-6**: Todos os fluxos E2E documentados estão alinhados com requisitos de ROADMAP.md
- **Critérios de Aceite**: Roadmap referencia fluxos E2E por nome conforme última atualização

---

## 5. Recomendações Gerais

1. **Padronizar Terminologia**: Usar consistentemente "Rail 1 (Agenda)" e "Rail 2 (Eventos)" em todos os docs.
2. **Marcar Features Futuras**: Adicionar marcador "(Planejado - Fase X)" em tabelas/features não implementadas.
3. **Verificar Nomes de Triggers**: Sempre consultar migrations para nomes exatos.
4. **Linkar Tech Debt**: Quando documentar limitações conhecidas, referenciar item TD-### correspondente.

---

## 6. Conclusão

A documentação normativa está **substancialmente consistente** com a implementação. Os 9 achados identificados são correções cirúrgicas (naming, clareza, marcação de features futuras) sem impacto em funcionalidade. **Nenhum bloqueador ou contradição crítica foi encontrado.**

**Ação Recomendada:** Aplicar patches sugeridos na seção 3 via commits incrementais para manter docs atualizados.
