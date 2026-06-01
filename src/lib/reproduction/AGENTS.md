# Reprodução — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

```txt
src/lib/reproduction/**
```

Também pode tocar, somente se necessário:

```txt
src/pages/AnimalReproducao.tsx
src/pages/AnimalPosParto.tsx
src/pages/AnimalCriaInicial.tsx
src/pages/ReproductionDashboard.tsx
src/lib/animals/**
```

Abrir `src/lib/animals/**` apenas se a tarefa tocar elegibilidade, apresentação ou taxonomia ligada ao fluxo reprodutivo.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `.agents/rules/CORE_RULES.md`.
3. `.agents/rules/CONTEXT_LOADING.md`.
4. `docs/domain/REPRODUCAO.md`.
5. `docs/technical/EVENTS_AGENDA_CONTRACT.md`.

Ler apenas se necessário:

| Situação | Ler |
|---|---|
| Taxonomia animal | `docs/domain/ANIMAIS_TAXONOMIA.md` |
| Offline/sync | `src/lib/offline/AGENTS.md`, `docs/technical/OFFLINE_SYNC.md` |
| RLS/migration/RPC | `docs/technical/SUPABASE_RLS.md` |
| Status atual | `docs/context/PROJECT_STATUS.md` |
| UX/copy | `docs/ux/COPY_GUIDELINES.md` |

---

## Foco deste diretório

- Cobertura / IA.
- Diagnóstico.
- Parto.
- Pós-parto.
- Cria inicial.
- Linking de episódios.
- Status reprodutivo derivado.
- Integração com taxonomy facts event-driven.

---

## Modelo mental obrigatório

Fluxo principal:

```txt
cobertura/IA → diagnóstico → parto → pós-parto → cria inicial
```

Regras centrais:

- Linking deve ser determinístico e explicável.
- Fatos reprodutivos podem projetar taxonomia.
- Taxonomia não substitui eventos.
- Correção de fato event-driven ocorre por novo evento, não por override arbitrário.
- Telas pós-parto e cria inicial fazem parte do fluxo operacional principal.
- Status reprodutivo derivado não é fonte primária.
- Agenda reprodutiva é pendência futura, não histórico.

---

## Invariantes obrigatórias

- Não quebrar `episode_linking`.
- Não permitir override manual de fatos event-driven críticos:
  - `prenhez_confirmada`;
  - `data_prevista_parto`;
  - `data_ultimo_parto`.
- Não mover regra de precedência reprodutiva para UI dispersa.
- Não quebrar compatibilidade com o fluxo E2E:
  - parto;
  - pós-parto;
  - cria inicial.
- Não persistir label derivado como fonte de verdade.
- Manter coerência entre:
  - evento reprodutivo;
  - payload animal;
  - leitura derivada.
- Não usar agenda como histórico reprodutivo.
- Não tratar protocolo ou planejamento como fato executado.
- Não criar status reprodutivo manual concorrente com evento.

---

## Checagens antes de alterar

1. É regra de registro, linking, status ou apresentação?
2. O fato pertence ao evento ou ao payload derivado do animal?
3. Existe risco de drift entre histórico e status atual?
4. A mudança precisa tocar `taxonomyFactsContract` ou só selectors/status?
5. O fluxo pós-parto continua atômico e navegável?
6. Existe risco de criar fonte paralela para status reprodutivo?
7. A mudança afeta sync-batch, payload ou rejeição remota?
8. A mudança cria inferência ampla de IATF, prenhez ou aptidão sem fonte?
9. A UI está exibindo fato, sinal ou pendência?

---

## Evitar

- Lógica de negócio forte diretamente nas páginas.
- Múltiplas fontes de verdade para status reprodutivo.
- Campos manuais para algo que já é derivado do histórico.
- Misturar correção operacional com edição destrutiva.
- Inferir IATF pendente ampla sem fonte técnica explícita.
- Persistir tag/sinal como regra crítica.
- Usar taxonomia atual como substituta do histórico.
- Usar agenda como evidência de execução.

---

## Entrega esperada

- Diff mínimo.
- Impacto no fluxo em até 5 bullets.
- Até 3 riscos.
- Testes focados.
- Fonte primária declarada quando envolver fato reprodutivo.
- Limitação explícita se houver dado derivado ou parcial.

---

## Validação

```bash
pnpm test
pnpm run lint
pnpm run build
```

Quando houver mudança de jornada:

```bash
pnpm test -- -t "reprodução"
```

ou teste específico do fluxo afetado, se existir.

---

## Quando escalar

- Se tocar ownership de `taxonomy_facts`, contrato de payload ou status code de rejeição: revisar `sync-batch`.
- Se tocar schema ou FK de reprodução: revisar migration/DB.
- Se alterar invariante do episódio: avaliar ADR.
- Se tocar sync/rollback/offline: consultar `src/lib/offline/AGENTS.md`.