# SANITARIO LOCAL AGENT

Escopo:
- `src/lib/sanitario/**`
- `src/components/sanitario/**` quando a tarefa tocar materialização ou overlay
- `src/pages/Registrar/**`, `src/pages/Agenda/**`, `src/pages/ProtocolosSanitarios/**` só se necessário
- não abrir outros domínios sem motivo explícito

Leia primeiro:
1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`

Leia só se necessário:
- `docs/OFFLINE.md`
- `docs/DB.md`
- `docs/CONTRACTS.md`

Foco deste diretório:
- biblioteca canônica de protocolos
- `calendario_base`
- catálogo oficial regulatório
- overlay operacional / compliance
- produtos veterinários
- materialização operacional em protocolo, agenda e evento
- read models sanitários compartilhados

Modelo mental obrigatório:
- existem 3 camadas distintas:
  1. base regulatória oficial
  2. overlay operacional do pack
  3. protocolos operacionais da fazenda
- essas camadas não devem competir entre si como se fossem a mesma coisa
- `calendario_base` é semântica declarativa; não reduzir tudo a `intervalo_dias`
- catálogo global pode ser cacheado localmente, mas não vira fonte tenant-scoped
- pendência futura vive na agenda; evento passado continua append-only

Invariantes obrigatórias:
- não quebrar semântica de `calendario_base` (`mode`, `anchor`, `label`, campanha/janela/recorrência)
- não voltar protocolo padrão para dentro da UI hardcoded
- não duplicar regra entre `Registrar`, agenda, relatórios e overlays
- preservar `produtos_veterinarios` como referência estruturada
- não quebrar o read model regulatório compartilhado
- não misturar documento/checklist regulatório com evento sanitário bruto sem motivo claro
- não reintroduzir aftosa como calendário base default

Checagens mentais antes de alterar:
1. A mudança é de conteúdo regulatório, de materialização operacional ou de UI?
2. A regra deveria viver em `baseProtocols`, `officialCatalog`, `compliance`, `attention` ou no read model?
3. A agenda resultante continua explicável?
4. A mudança afeta filtros/labels/read-only surfaces?
5. Há impacto em offline cache do catálogo?

Evitar:
- duplicar lógica entre `Registrar/**`, `Agenda/**` e `Relatorios.tsx`
- salvar campo derivado que deveria ser projeção
- criar texto livre quando já existe referência estruturada
- puxar `IMPLEMENTATION_STATUS` / `ROADMAP` sem necessidade de estado

Entrega esperada:
- diff mínimo
- regra alterada em uma frase
- até 3 riscos
- testes focados por superfície afetada

Validação mínima:
- `pnpm test`
- `pnpm run lint`
- `pnpm run build`

Quando escalar:
- se mudar seleção do pack oficial, contrato regulatório ou modelo de materialização -> revisar migration / DB
- se mudar invariante de agenda automática -> revisar `supabase/migrations/**`
- se mudar contrato normativo do domínio -> avaliar ADR
