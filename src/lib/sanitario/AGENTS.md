# Sanitário — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

```txt
src/lib/sanitario/**
```

Também pode tocar, somente se necessário:

```txt
src/components/sanitario/**
src/pages/Registrar/**
src/pages/Agenda/**
src/pages/ProtocolosSanitarios/**
```

Não abrir outros domínios sem motivo explícito.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `.agents/rules/CORE_RULES.md`.
3. `.agents/rules/CONTEXT_LOADING.md`.
4. `docs/domain/SANITARIO.md`.
5. `docs/technical/EVENTS_AGENDA_CONTRACT.md`.

Ler apenas se necessário:

| Situação | Ler |
|---|---|
| Offline/cache/sync | `src/lib/offline/AGENTS.md`, `docs/technical/OFFLINE_SYNC.md` |
| RLS/migration/RPC | `docs/technical/SUPABASE_RLS.md` |
| Status do projeto | `docs/context/PROJECT_STATUS.md` |
| UX/copy sanitária | `docs/ux/COPY_GUIDELINES.md` |
| Manual do usuário | `docs/manuals/screens/SANITARIO.md`, se a tarefa for suporte/manual |

---

## Foco deste diretório

- Biblioteca canônica de protocolos.
- `calendario_base`.
- Catálogo oficial regulatório.
- Overlay operacional/compliance.
- Produtos veterinários.
- Materialização operacional em protocolo, agenda e evento.
- Read models sanitários compartilhados.
- Sinais sanitários limitados por fonte.

---

## Modelo mental obrigatório

Existem 3 camadas distintas:

1. base regulatória oficial;
2. overlay operacional do pack;
3. protocolos operacionais da fazenda.

Essas camadas não devem competir como se fossem a mesma coisa.

Regras centrais:

- `calendario_base` é semântica declarativa; não reduzir tudo a `intervalo_dias`.
- catálogo global pode ser cacheado localmente, mas não vira fonte tenant-scoped.
- pendência futura vive na agenda.
- evento passado continua append-only.
- protocolo é regra/configuração, não execução.
- carência sanitária exige fonte estruturada e não autoriza venda/abate.

---

## Invariantes obrigatórias

- Não quebrar semântica de `calendario_base`:
  - `mode`;
  - `anchor`;
  - `label`;
  - campanha;
  - janela;
  - recorrência.
- Não voltar protocolo padrão para dentro da UI hardcoded.
- Não duplicar regra entre `Registrar`, Agenda, Relatórios e overlays.
- Preservar `produtos_veterinarios` como referência estruturada.
- Não quebrar read model regulatório compartilhado.
- Não misturar documento/checklist regulatório com evento sanitário bruto sem motivo claro.
- Não reintroduzir aftosa como calendário base default.
- Não tratar agenda/protocolo/checklist como evento sanitário.
- Não transformar carência sanitária em:
  - liberação sanitária final;
  - aptidão comercial;
  - pronto para venda;
  - apto para abate.

---

## Checagens antes de alterar

1. A mudança é de conteúdo regulatório, materialização operacional ou UI?
2. A regra deveria viver em `baseProtocols`, `officialCatalog`, `compliance`, `attention` ou read model?
3. A agenda resultante continua explicável?
4. A mudança afeta filtros, labels ou superfícies read-only?
5. Há impacto em offline cache do catálogo?
6. Há fonte estruturada suficiente para qualquer sinal de carência?
7. Existe risco de duplicar lógica entre página, agenda e evento?
8. Existe risco de usar protocolo como execução?
9. Existe risco de usar ausência de pendência como prova sanitária?

---

## Evitar

- Duplicar lógica entre `Registrar/**`, `Agenda/**` e relatórios.
- Salvar campo derivado que deveria ser projeção.
- Criar texto livre quando já existe referência estruturada.
- Usar ausência de pendência como prova sanitária.
- Usar protocolo isolado como execução.
- Usar checklist como conformidade universal.
- Criar regra sanitária crítica dentro da UI.
- Inferir aptidão comercial por carência.

---

## Entrega esperada

- Diff mínimo.
- Regra alterada em uma frase.
- Até 3 riscos.
- Testes focados por superfície afetada.
- Fonte primária declarada quando envolver carência, agenda ou evento.
- Limitação explícita se a fonte for parcial.

---

## Validação

```bash
pnpm test
pnpm run lint
pnpm run build
```

Se tocar migration, RLS ou materialização remota:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## Quando escalar

- Se mudar seleção do pack oficial, contrato regulatório ou modelo de materialização: revisar migration/DB.
- Se mudar invariante de agenda automática: revisar `supabase/migrations/**`.
- Se mudar contrato normativo do domínio: avaliar ADR.
- Se tocar sync, rollback ou cache offline: consultar `src/lib/offline/AGENTS.md`.