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

## Direção visual vigente

Versão atual: **Azul Sync Técnico**.

Princípios:

- mobile-first;
- offline-first;
- clareza operacional;
- identidade azul;
- cards brancos em fundo claro;
- header azul petróleo;
- ícones lineares estilo Lucide;
- bottom navigation mobile;
- perfil/lista de animais sem foto real como avatar padrão;
- estados claros para sync, offline, pendente e rejeitado.

## Direção UX vigente

A evolução de UX deve ser incremental, orientada ao uso em campo e sem alterar regras de negócio.

Prioridades:

1. **Bottom Navigation mobile** preservando SideNav desktop.
2. **Home como Hoje / Central Operacional**.
3. **Registro contexto-primeiro** por lote, pasto, animal ou item de agenda.
4. **Bandeja de seleção** apenas como evolução futura.

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
