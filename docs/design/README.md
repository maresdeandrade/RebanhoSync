# Design — RebanhoSync

Status: Informativo  
Escopo: Direção visual, referências de UI, prompts de geração visual e orientação UX incremental  
Produto: RebanhoSync — gestão simples e offline-first para pecuária de corte

## Objetivo

Esta pasta consolida a direção visual e UX do RebanhoSync para orientar refinamentos de interface, geração de telas de referência e futuras implementações em React/Tailwind.

Estes documentos não substituem o código atual, não alteram regra de negócio e não autorizam criação de funcionalidades fora do escopo do produto.

## Documentos

- `BRAND_DIRECTION.md` — direção de marca, logo, paleta, tipografia, iconografia e princípios visuais.
- `UI_VISUAL_REFERENCES.md` — telas de referência aprovadas como direção visual, sem pixel-perfect.
- `STITCH_PROMPTS.md` — prompts versionados para gerar novas variações visuais no Stitch.
- `references/` — imagens de referência visual.

## Direção visual implementada

Versão atual: **Azul Sync Técnico (Consolidada)**.

Princípios realizados:

- **Contraste Corretivo**: Ajustes em `light/dark mode` para legibilidade de estados críticos.
- **Mobile-first**: Bottom navigation como âncora mobile.
- **Desktop-first**: SideNav preservada em telas grandes.
- **Identidade**: Azul petróleo e cards operacionais com bordas visíveis.
- **Clareza de Sync**: Estados de pendência e rejeição com badges semânticos.

## Direção UX implementada

1. **Home como Central Operacional**: Validada como "Hoje", priorizando atrasos e sync.
2. **Agenda como Intenção**: Preservada para filtros e gestão de pendências.
3. **Eventos como Fato**: Fonte da verdade histórica append-only.
4. **Registro Contextual Seguro**:
   - Entrada via Lote, Pasto, Animal ou Agenda.
   - `pastoId` como contexto informativo (sem inferência automática de animais).
   - CTAs contextuais apenas para navegação/pré-preenchimento.
   - Revisão obrigatória antes de salvar.

Separação recomendada:

```txt
Home / Hoje = execução diária e priorização
Agenda = visão completa, filtros e gestão ampla das pendências
```

## Princípios de UX

O app deve responder rapidamente:

```txt
O que exige ação agora?
Onde está o problema?
Como registro com segurança?
Estou online, offline ou com pendências de sync?
```

A UX deve priorizar:

- uso com uma mão;
- leitura sob sol forte;
- baixa quantidade de cliques;
- contexto operacional sempre visível;
- revisão antes de salvar;
- prevenção de manejo aplicado ao alvo errado.

## Limites

Estas referências não são pixel-perfect.

Não usar estes documentos para criar:

- ERP fiscal;
- marketplace;
- venda/abate;
- carência sanitária conclusiva;
- aptidão comercial;
- IA preditiva;
- novas regras de negócio;
- alterações em Supabase, Dexie, RLS, migrations ou sync.

## Uso por agentes

Antes de tarefas visuais/UX, leia:

- `AGENTS.md`
- `docs/design/BRAND_DIRECTION.md`
- `docs/design/UI_VISUAL_REFERENCES.md`
- `docs/design/STITCH_PROMPTS.md`

Para implementação, usar prompts curtos, com escopo, fora de escopo, critérios de aceite e validação.

## Validação mínima para documentação

```bash
git status --short --untracked-files=all
```
