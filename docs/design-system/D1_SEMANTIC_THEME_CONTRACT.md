# D1 — Semantic Tokens & Theme Contract

Atualizado em: 2026-08-30
Status: **Contrato semântico implementado; D2 não iniciada**

## 1. Decisão

D1 consolida a paleta existente em papéis canônicos e equivalentes nos temas claro e escuro. O contrato preserva os nomes shadcn/legados por alias para evitar breaking changes e não autoriza migração mecânica de páginas.

Precedência para novo código:

```text
papel canônico D1 → alias compatível → literal local classificado
```

Brand identifica o produto; famílias semânticas comunicam estado. Nenhuma cor de domínio foi criada.

## 2. A — Contrato semântico final

Valores são HSL sem o wrapper `hsl()`, conforme `src/globals.css`.

| Token canônico | Papel | Light | Dark | Aliases | Consumidores principais |
|---|---|---|---|---|---|
| `background` | canvas do app | `45 14% 93%` | `200 28% 12%` | `neutral-background` | body, shell |
| `surface` | conteúdo primário | `45 12% 96%` | `200 24% 16%` | `card`, `neutral-surface` | Card, Input, close controls |
| `surface-muted` | agrupamento e estado neutro | `45 10% 87%` | `200 18% 21%` | `muted`, `neutral-muted` | hover neutro, disabled |
| `surface-elevated` | conteúdo flutuante | `45 12% 97%` | `200 24% 18%` | `popover` | Dialog, Sheet, Popover |
| `border` | separador padrão | `45 10% 75%` | `200 16% 29%` | `neutral-border` | cards, divisores |
| `border-strong` | campo e superfície elevada | `45 10% 62%` | `200 16% 38%` | `input` | Input, Dialog, Sheet, Popover |
| `text-primary` | texto principal | `200 34% 14%` | `45 12% 90%` | `foreground`, `card-foreground`, `popover-foreground` | body, conteúdo |
| `text-secondary` | apoio próximo | `200 22% 27%` | `45 9% 76%` | nenhum legado direto | ícones e metadados próximos |
| `text-muted` | legenda/metadado | `200 16% 36%` | `45 8% 66%` | `muted-foreground` | descrições, placeholder |
| `primary` | ação, link e seleção forte | `200 76% 20%` | `198 72% 42%` | `brand-primary` | Button, Badge, ring relacionado |
| `primary-hover` | hover/active de ação primária | `200 76% 16%` | `198 72% 48%` | substitui opacidade local | Button, Badge |
| `primary-subtle` | seleção e destaque leve | `200 42% 88%` | `200 30% 22%` | `control-selected` | seleção, `::selection` |
| `success` | aplicado/confirmado | `142 76% 25%` | `142 52% 40%` | `semantic-success` | Alert, StatusBadge, StateBanner |
| `warning` | atenção/partial/ajuste | `35 92% 30%` | `35 72% 50%` | `semantic-warning` | Alert, StatusBadge, StateBanner |
| `danger` | erro/rejeição/destrutivo | `0 84% 40%` | `0 68% 48%` | `destructive`, `semantic-error` | Button, Badge, Alert |
| `info` | informação/syncing | `200 100% 25%` | `200 68% 44%` | `semantic-info` | Alert, StatusBadge, StateBanner |
| `ring` | focus visible | `200 76% 30%` | `198 72% 52%` | `sidebar-ring` é contexto próprio | controles interativos |
| `overlay` | backdrop modal | `200 34% 10% / 0.46` | `200 34% 5% / 0.68` | nenhum | Dialog, Sheet |

Cada família de estado mantém `foreground`, `muted` e `border`. `offline`, `pending`, `conflict`, `unknown` e `not-permitted` continuam estados operacionais explícitos; não são aliases de warning ou danger.

### 2.1 API Tailwind canônica

| Papel | Classe/namespace preferido |
|---|---|
| superfícies | `bg-background`, `bg-surface`, `bg-surface-muted`, `bg-surface-elevated` |
| bordas | `border-border`, `border-border-strong` |
| conteúdo | `text-content-primary`, `text-content-secondary`, `text-content-muted` |
| ação primária | `bg-primary`, `bg-primary-hover`, `bg-primary-subtle` |
| perigo | `danger`, `danger-foreground`, `danger-muted`, `danger-border` |
| controles | `control-disabled`, `control-disabled-foreground`, `control-selected`, `control-selected-foreground`, `control-selected-border` |

Classes legadas como `bg-card`, `bg-popover`, `text-foreground`, `border-input` e `bg-destructive` permanecem funcionais durante a migração incremental.

## 3. Estados de interação

| Estado | Contrato |
|---|---|
| default | superfície e texto do papel do componente |
| hover | ação primária usa `primary-hover`; ação neutra usa `surface-muted` |
| focus | ring de 2 px em `ring`, com offset perceptível nos dois temas |
| disabled | `control-disabled` + `control-disabled-foreground`; sem sombra ou interação |
| selected | `control-selected` + `control-selected-foreground` + `control-selected-border` |
| destructive | família `danger`; `destructive` é apenas alias compatível |

Disabled e selected são estados de controle, não estados operacionais. `surface-muted` não significa indisponibilidade fora de um controle explicitamente disabled.

## 4. B — Mapa de migração

| Token atual | Token alvo | Ação | Motivo |
|---|---|---|---|
| `background` | `background` | KEEP | papel já inequívoco |
| `card` | `surface` | ALIAS | compatibilidade shadcn; novo código usa surface |
| `popover` | `surface-elevated` | ALIAS | compatibilidade Radix/shadcn |
| `muted` | `surface-muted` | ALIAS | separa superfície de texto muted |
| `foreground` | `text-primary` | ALIAS | preserva consumidores existentes |
| `muted-foreground` | `text-muted` | ALIAS | preserva consumidores existentes |
| ausência de secundário | `text-secondary` | MIGRATE | cobre apoio sem rebaixar tudo a muted |
| `input` | `border-strong` | ALIAS | nomeia a hierarquia de borda |
| `primary/90`, `primary/85` | `primary-hover` | MIGRATE | hover consistente light/dark |
| seleção por opacidade local | `primary-subtle` | MIGRATE | seleção previsível |
| `destructive` | `danger` | ALIAS | danger é papel canônico; API antiga continua válida |
| `semantic-error` | `danger` | ALIAS | uma fonte cromática para erro/destrutivo |
| `secondary` | `secondary` | KEEP | permanece papel de controle secundário |
| `accent` | `accent` | KEEP | branding/ação operacional; não substitui warning |
| `neutral-*` | papéis base | DEPRECATE | aliases preservados; não usar em consumidor novo |
| cores literais de página | classificação D0 | KEEP | migração pertence a D4, não à D1 |

`DEPRECATE` significa “não adotar em novo código”, não remoção nesta fase.

## 5. Consumidores globais migrados

- `Button`: hover primário, danger e disabled canônicos;
- `Card`/`CardField`/`CardStatus`: surface, conteúdo e danger canônicos;
- `Input`: surface, border-strong, texto e disabled;
- `Badge`: hover primário, danger e surface outline;
- `Alert`: superfícies e bordas das famílias semânticas;
- `Dialog`, `Sheet` e `Popover`: surface-elevated, border-strong e texto principal;
- helpers globais `.app-surface*`, body e seleção de texto.

APIs, variantes, dimensões, animações, focus trap e estrutura DOM foram preservados.

## 6. Compatibilidade e limites

- nenhum token antigo foi removido;
- nenhum literal de página foi migrado;
- nenhum componente local de domínio foi alterado;
- Agenda, Evento, `state_*`, protocolo, insights e recomendações não mudaram;
- offline-first, sync, Supabase, RLS, migrations e F22 não foram tocados;
- cor de domínio só poderá existir com significado transversal documentado.

## 7. C — Pendências

### D2 — Shell/Layout

- decidir o papel de Home × Dashboard;
- consolidar container, gutters, header/sidebar/mobile nav;
- aplicar selected ao shell sem mudar rotas antes da decisão D2.

### D3 — Primitives estruturais

- consolidar densidade de Card, tipografia e FormSection;
- revisar aliases/variantes duplicadas de Alert, Badge e status;
- padronizar Empty/Loading/Error/Partial/Blocked;
- avaliar remoção futura de aliases deprecated após telemetria de uso.

### D4 — Páginas

- classificar e migrar incrementalmente as 563 cores candidatas;
- começar pelos hotspots definidos na D0;
- não executar search-and-replace global.

### D5 — Responsividade e acessibilidade

- fechar matriz autenticada 390/768/1024/1440 light/dark;
- medir WCAG de texto, bordas, foco e estados;
- validar high contrast, reduced motion, teclado e screen reader.

## 8. Critério de continuidade

D2 só pode iniciar em tarefa própria. D1 termina quando contrato, aliases, consumers globais, testes, build, documentação e smoke visual estiverem validados, sem redesign de página.
