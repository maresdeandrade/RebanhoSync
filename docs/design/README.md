# Design — RebanhoSync

Status: Informativo  
Escopo: Direção visual, referências de UI, prompts de geração visual e orientação UX incremental  
Produto: RebanhoSync — gestão simples e offline-first para pecuária de corte  
Última atualização: 2026-05-20

## 1. Objetivo

Esta pasta consolida a direção visual e UX do RebanhoSync para orientar refinamentos de interface, geração de telas de referência e futuras implementações em React/Tailwind.

Estes documentos não substituem o código atual, não alteram regra de negócio e não autorizam criação de funcionalidades fora do escopo do produto.

## 2. Documentos

- `BRAND_DIRECTION.md` — direção de marca, logo, paleta, tipografia, iconografia, sistema de ilustrações e princípios visuais.
- `UI_VISUAL_REFERENCES.md` — inventário das telas e imagens de referência aprovadas como direção visual, sem pixel-perfect.
- `STITCH_PROMPTS.md` — prompts versionados para gerar novas variações visuais no Stitch.
- `HANDOFF_VISUAL_UX_20260508.md` — handoff da frente visual/UX consolidada em maio/2026.
- `references/` — imagens de referência visual.

## 3. Classificação obrigatória

Toda análise visual/UX deve separar:

| Status | Significado |
|---|---|
| Implementado no app | Já existe no código atual |
| Referência visual aprovada | Existe nas imagens e orienta a UI futura |
| Recomendado | Deve guiar implementação futura |
| Não autorizado por referência visual | Não deve ser inferido das imagens |

As imagens em `references/` orientam direção visual. Elas não são contrato funcional, não são pixel-perfect e não substituem o código.

## 4. Direção visual vigente

Versão atual: **Azul Sync Técnico / Campo Operacional**.

Direção consolidada:

- azul petróleo como base visual;
- branco e neutros claros nos cards;
- verde para sucesso/sincronizado;
- vermelho para atraso/crítico;
- amarelo/laranja para atenção/offline;
- ícones lineares;
- cards densos, mas legíveis;
- foco mobile-first;
- hierarquia operacional clara;
- leitura em campo;
- contraste revisado em light/dark mode.

## 5. Logo vigente nas referências

A referência visual principal do logo é composta por:

- animal adulto + bezerro;
- movimento circular/sincronização;
- wordmark `RebanhoSync`;
- uso monocromático/negativo;
- boa aplicação em fundo escuro;
- possibilidade de uso como logo horizontal e favicon/app icon.

Status: **referência visual aprovada**.

Não tratar como asset final de produção salvo se o SVG/arquivo final estiver confirmado no repositório.

Não usar versões antigas conflitantes como direção principal quando houver divergência.

## 6. Direção visual implementada

Implementado no app atual, conforme frente de UX/visual concluída:

- identidade azul `Sync Técnico` aplicada em tokens globais;
- contraste corretivo em light/dark mode;
- Bottom Navigation como âncora mobile;
- SideNav preservada em desktop/tablet;
- cards operacionais com bordas visíveis;
- estados de pendência, rejeição, sucesso, aviso e erro com badges semânticos;
- ajustes pontuais de legibilidade em Home, Agenda, Registrar e Animal.
- segunda passagem de compactação visual SLC em Lotes, Pastos, Reprodução, Relatórios, Reconciliacao, Configuracoes, seleção de fazenda, onboarding/cadastros, importações e detalhes.

Não significa que todas as referências visuais estejam implementadas pixel-perfect.

## 7. Direção UX implementada

1. **Home como Central Operacional**  
   Validada como `Hoje`, priorizando atrasos, agenda do dia, próximos manejos e sync.

2. **Agenda como intenção operacional**  
   Preservada para filtros e gestão de pendências. Não é histórico factual.

3. **Eventos como fatos históricos**  
   Fonte de verdade histórica append-only.

4. **Registro contextual seguro**  
   Entrada via Lote, Pasto, Animal ou Agenda.

   - `loteId`: pré-preenche contexto de lote quando seguro.
   - `animalId`: pré-preenche contexto de animal.
   - `sourceTaskId`: preserva contexto de item de agenda.
   - `pastoId`: contexto informativo; não infere lote nem animais automaticamente.

5. **CTAs contextuais**  
   Navegam/pré-preenchem contexto. Não salvam, não executam, não concluem agenda e não geram evento automaticamente.

6. **Seleção de fazenda contextual**  
   O card de fazenda pode mostrar município/UF, área total, tipo de produção e sistema de manejo quando esses dados já existem no cadastro. Esse contexto ajuda a diferenciar fazendas sem transformar a tela em relatório nem solicitar dados fiscais adicionais.

Separação recomendada:

```txt
Home / Hoje = execução diária e priorização
Agenda = visão completa, filtros e gestão ampla das pendências
```

## 8. Perfis visuais de animal

As referências em `references/` consolidam um sistema visual para perfis de animal.

Status: **referência visual aprovada**, não regra automática de domínio.

Perfis documentados:

- Touro Reprodutor;
- Boi Engorda;
- Vaca Seca / Solteira;
- Vaca Parida;
- Novilha;
- Bezerro.

Regras visuais registradas:

- Novilha não deve ter úbere proeminente.
- Vaca Seca / Solteira pode ter silhueta feminina adulta.
- Vaca Parida deve representar matriz com bezerro ao pé.
- Touro Reprodutor deve sugerir robustez/cupim.
- Boi Engorda deve sugerir volume/terminação.
- Bezerro deve ser menor/esguio.

Esses perfis não autorizam inferência automática de categoria sem regra de domínio validada.

## 9. Princípios de UX

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
- prevenção de manejo aplicado ao alvo errado;
- feedback claro para offline/sync/rejeição.

## 10. Limites

Estes documentos não autorizam criar:

- ERP fiscal;
- marketplace;
- venda/abate;
- carência sanitária conclusiva;
- aptidão comercial;
- IA preditiva;
- novas regras de negócio;
- inferência automática de perfil animal apenas por ícone;
- alterações em Supabase, Dexie, RLS, migrations ou sync.

## 11. Uso por agentes

Antes de tarefas visuais/UX, leia:

- `AGENTS.md`
- `docs/design/BRAND_DIRECTION.md`
- `docs/design/UI_VISUAL_REFERENCES.md`
- `docs/design/STITCH_PROMPTS.md`
- `docs/design/HANDOFF_VISUAL_UX_20260508.md`

Para implementação, usar prompts curtos com:

- tarefa única;
- escopo permitido;
- fora de escopo explícito;
- critérios de aceite;
- validação;
- confirmação de que imagens são referência, não pixel-perfect.

## 12. Validação mínima para documentação

```bash
git status --short --untracked-files=all
git diff --stat
```
