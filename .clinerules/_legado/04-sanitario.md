---
paths:
  - "src/lib/sanitario/**"
  - "src/components/sanitario/**"
  - "src/pages/Registrar.tsx"
  - "src/pages/Agenda.tsx"
  - "src/pages/ProtocolosSanitarios.tsx"
  - "src/pages/Eventos.tsx"
  - "src/pages/Relatorios.tsx"
  - "src/pages/Home.tsx"
  - "src/pages/Dashboard.tsx"
  - "src/pages/Animais.tsx"
  - "src/pages/AnimalDetalhe.tsx"
  - "src/pages/LoteDetalhe.tsx"
---

# RebanhoSync — Sanitário Rules

Leia:
1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DB.md` se houver impacto estrutural

Separações obrigatórias:
1. base regulatória oficial
2. overlay operacional / compliance
3. protocolos operacionais da fazenda
4. evento sanitário operacional
5. agenda sanitária futura

Regras:
- não colapsar essas camadas como se fossem a mesma coisa
- `calendario_base` é semântica declarativa; não reduzir tudo a `intervalo_dias`
- `produtos_veterinarios` permanece referência estruturada do fluxo sanitário
- próxima ação pertence à agenda, não ao evento sanitário
- não reintroduzir protocolo base hardcoded na UI
- não reintroduzir aftosa como base vacinal default
- bloqueios regulatórios devem nascer do read model/guards compartilhados, não de lógica duplicada por tela

Quando a tarefa for:
- registro manual / agenda / produto -> manter foco operacional
- catálogo oficial / compliance / overlay / feed-ban -> manter foco regulatório
- trânsito/GTA/PNCEBT -> revisar interseção com `transit.ts` e conformidade

Checklist:
1. A mudança é operacional ou regulatória?
2. O dado pertence ao evento, à agenda ou ao overlay?
3. A regra está duplicada em mais de uma superfície?
4. Há impacto em `regulatoryReadModel`?
5. Há impacto em materialização/recompute da agenda?