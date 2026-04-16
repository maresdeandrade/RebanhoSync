# REPRODUCAO LOCAL AGENT

Escopo:
- `src/lib/reproduction/**`
- `src/pages/AnimalReproducao.tsx`
- `src/pages/AnimalPosParto.tsx`
- `src/pages/AnimalCriaInicial.tsx`
- `src/pages/ReproductionDashboard.tsx`
- `src/lib/animals/**` apenas se a tarefa tocar elegibilidade, apresentação ou taxonomia ligada ao fluxo

Leia primeiro:
1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`

Leia só se necessário:
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`
- `docs/DB.md`

Foco deste diretório:
- cobertura / IA
- diagnóstico
- parto
- pós-parto
- cria inicial
- linking de episódios
- status reprodutivo derivado
- integração com taxonomy facts event-driven

Modelo mental obrigatório:
- fluxo principal: cobertura/IA -> diagnóstico -> parto -> pós-parto -> cria inicial
- linking deve ser determinístico e explicável
- fatos reprodutivos podem projetar taxonomia, mas taxonomia não substitui os eventos
- correção de fato event-driven ocorre por novo evento, não por override arbitrário
- telas pós-parto e cria inicial fazem parte do fluxo operacional principal, não são apêndices

Invariantes obrigatórias:
- não quebrar `episode_linking`
- não permitir override manual de fatos event-driven críticos:
  - `prenhez_confirmada`
  - `data_prevista_parto`
  - `data_ultimo_parto`
- não mover regra de precedência reprodutiva para UI dispersa
- não quebrar compatibilidade com o fluxo E2E parto -> pós-parto -> cria inicial
- não persistir label derivado como fonte de verdade
- manter coerência entre evento reprodutivo, payload animal e leitura derivada

Checagens mentais antes de alterar:
1. É regra de registro, linking, status ou apresentação?
2. O fato pertence ao evento ou ao payload derivado do animal?
3. Existe risco de drift entre histórico e status atual?
4. A mudança precisa tocar `taxonomyFactsContract` ou só selectors/status?
5. O fluxo pós-parto continua atômico e navegável?

Evitar:
- lógica de negócio forte diretamente nas páginas
- múltiplas fontes de verdade para status reprodutivo
- introduzir campos manuais para algo que já é derivado do histórico
- misturar correção operacional com edição destrutiva

Entrega esperada:
- diff mínimo
- impacto no fluxo em até 5 bullets
- até 3 riscos
- testes focados

Validação mínima:
- `pnpm test`
- `pnpm run lint`
- `pnpm run build`
- rodar testes E2E/guiados do fluxo afetado quando houver mudança de jornada

Quando escalar:
- se tocar ownership de `taxonomy_facts`, contrato de payload ou status code de rejeição -> revisar `sync-batch`
- se tocar schema ou FK de reprodução -> revisar migration / DB
- se alterar invariante do episódio -> avaliar ADR