# Stitch Prompts — RebanhoSync

Status: Ferramenta auxiliar  
Tipo: Prompts para geração de telas de referência  
Fonte visual: `BRAND_DIRECTION.md` + `UI_VISUAL_REFERENCES.md`

## 1. Regra de uso

Os prompts deste arquivo servem para gerar variações visuais no Stitch.

As saídas geradas devem ser revisadas antes de virar referência oficial.

Não usar outputs do Stitch como:

- especificação funcional automática;
- implementação pixel-perfect;
- autorização para alterar regra de negócio;
- autorização para criar funcionalidades fora do escopo.

## 2. Prompt principal — Telas mobile Azul Sync Técnico

```markdown
Você é um Product Designer Sênior especializado em aplicativos mobile-first, offline-first e sistemas de gestão operacional para campo.

Crie telas de alta fidelidade para o app RebanhoSync, respeitando a estrutura funcional atual do produto.

O RebanhoSync é um app offline-first para gestão simples de pecuária de corte, voltado para pequeno e médio produtor rural.

O app ajuda o usuário a:

- acompanhar a rotina da fazenda;
- registrar manejos;
- acompanhar agenda sanitária/reprodutiva;
- consultar animais, lotes e pastos;
- visualizar pendências;
- operar mesmo sem internet;
- sincronizar dados quando houver conexão.

Não trate o produto como ERP agro completo.
Não crie módulos fiscais, estoque avançado, IA generativa, marketplace ou funcionalidades não solicitadas.

Use a identidade visual azul “Sync Técnico”:

- azul petróleo profundo `#002B45`;
- azul ação `#0057C2`;
- azul informação `#2563EB`;
- azul claro `#3B82F6`;
- verde sucesso `#16A34A`;
- aviso `#F59E0B`;
- erro/crítico `#DC2626`;
- fundo `#F7F9FA`;
- cards `#FFFFFF`;
- bordas `#E2E8F0`;
- texto principal `#0F172A`;
- texto secundário `#64748B`.

Use logo em escudo/hexágono técnico azul com cabeça de boi branca e elementos discretos de sincronização/circuito.

Não usar foto real do animal como avatar.

Estilo:

- mobile-first;
- header azul petróleo;
- cards brancos;
- cantos arredondados;
- sombras discretas;
- ícones lineares estilo Lucide;
- bottom navigation;
- visual operacional, limpo, técnico e legível.

Navegação principal:

- Hoje;
- Rebanho;
- Manejo;
- Estrutura;
- Mais.

Gerar telas:

1. Home/Hoje como Central Operacional;
2. Agenda completa de pendências;
3. Registrar manejo;
4. Registro sanitário;
5. Perfil do animal sem foto;
6. Lista de animais sem fotos reais;
7. Lote;
8. Pasto/Estrutura;
9. Offline/Sincronização;
10. Relatórios/Insights.

Priorize fidelidade funcional, clareza operacional e consistência com o app atual.
Não criar funcionalidades fora do escopo.
```

## 3. Prompt curto

```markdown
Crie telas mobile high-fidelity para o app RebanhoSync.

RebanhoSync é um app offline-first para gestão simples de pecuária de corte, focado em pequeno/médio produtor. Não é ERP completo.

Use identidade azul “Sync Técnico”:

- azul petróleo `#002B45`;
- azul ação `#0057C2`;
- azul info `#2563EB`;
- azul claro `#3B82F6`;
- sucesso `#16A34A`;
- aviso `#F59E0B`;
- erro `#DC2626`;
- fundo `#F7F9FA`;
- cards `#FFFFFF`;
- borda `#E2E8F0`;
- texto `#0F172A`.

Logo: escudo/hexágono técnico azul com cabeça de boi branca e elementos discretos de sync/circuito.

Não usar fotos de animais como avatar.

Estilo:

- mobile-first;
- header azul petróleo;
- cards brancos;
- cantos arredondados;
- sombras discretas;
- ícones lineares estilo Lucide;
- bottom navigation;
- visual técnico, limpo e operacional.

Navegação: Hoje, Rebanho, Manejo, Estrutura, Mais.

Gerar telas:

1. Home/Hoje;
2. Agenda;
3. Registrar manejo;
4. Registro sanitário;
5. Perfil do animal sem foto;
6. Lista de animais sem fotos reais;
7. Lote;
8. Pasto/Estrutura;
9. Offline/Sync;
10. Relatórios/Insights.

Não criar ERP fiscal, marketplace, venda/abate, carência conclusiva, aptidão comercial ou IA preditiva.
```

## 4. Prompt — Home / Hoje Central Operacional

```markdown
Crie uma tela mobile high-fidelity para a Home do RebanhoSync, agora chamada “Hoje”.

Objetivo: funcionar como Central Operacional do dia.

Mostrar:

- header azul petróleo com logo, fazenda e status de sync;
- status online/offline;
- pendências atrasadas;
- agenda de hoje como seção principal;
- próximos manejos;
- rejeições ou pendências de sincronização;
- atalhos para Registrar manejo e Ver agenda;
- resumo curto do rebanho.

Bottom navigation: Hoje ativo, Rebanho, Manejo, Estrutura, Mais.

Não criar gráficos complexos. Não tratar agenda como histórico. Não criar evento automático.
```

## 5. Prompt — Agenda completa

```markdown
Crie uma tela mobile high-fidelity para Agenda do RebanhoSync.

Objetivo: visão completa e filtrável das pendências.

Elementos:

- header “Agenda”;
- filtros em chips: Todas, Atrasadas, Hoje, Próximas;
- busca/filtro;
- seções por status;
- cards com tipo de manejo, lote, quantidade de animais, prazo e status;
- ações: abrir item, registrar execução, encerrar pendência quando aplicável.

Bottom navigation com Hoje/Rebanho/Manejo/Estrutura/Mais.

Não tratar agenda como histórico factual. Não concluir automaticamente.
```

## 6. Prompt — Manejo contextual

```markdown
Crie telas mobile high-fidelity demonstrando o fluxo de Manejo Contextual do RebanhoSync.

Mostrar pelo menos três entradas:

1. Lote → botão “Manejar este lote”.
2. Pasto → botão “Manejar neste pasto”.
3. Animal → botão “Registrar manejo deste animal”.

Regra visual: o contexto pré-preenche o alvo, mas a tela de revisão permanece obrigatória.

Mostrar no Registrar:

- alvo pré-selecionado visível;
- possibilidade de alterar alvo;
- etapa de revisão;
- botão “Salvar registro”;
- aviso “Salvo neste aparelho e sincroniza quando houver conexão”.

Não salvar automaticamente. Não criar regra de negócio nova.
```

## 7. Prompt — Rebanho

```markdown
Crie uma tela mobile high-fidelity para “Rebanho” do RebanhoSync.

Objetivo: busca rápida e acesso a animais/lotes.

Mostrar:

- busca por brinco, nome, lote;
- cards de métricas: total, ativos, atenção, em tratamento;
- abas ou filtros: Animais, Lotes;
- lista de animais sem foto real;
- avatar simbólico com ícone simples;
- status visual por animal;
- acesso ao perfil do animal.

Bottom navigation com Rebanho ativo.
```

## 8. Prompt — Estrutura

```markdown
Crie uma tela mobile high-fidelity para “Estrutura” do RebanhoSync.

Objetivo: acesso a pastos, lotes e estrutura operacional da fazenda.

Mostrar:

- lista de pastos/piquetes;
- capacidade ou ocupação, se aplicável;
- lotes vinculados;
- pendências relacionadas;
- botão “Manejar neste pasto”;
- acesso a detalhe do lote/pasto.

Bottom navigation com Estrutura ativo.

Não criar mapa avançado se não houver suporte funcional.
```

## 9. Restrições fixas

Sempre manter:

- identidade azul “Sync Técnico”;
- estrutura mobile-first;
- bottom navigation;
- ausência de foto real de animal como avatar padrão;
- clareza sobre offline/sync;
- fidelidade funcional ao app atual.

Nunca criar:

- ERP fiscal;
- marketplace;
- venda/abate;
- carência sanitária conclusiva;
- aptidão comercial;
- IA preditiva;
- regra de negócio nova;
- tela sem relação com fluxo existente.

## 10. Como promover output do Stitch para referência

Antes de salvar imagem em `docs/design/references/`, revisar:

```txt
Respeita identidade azul?
Respeita navegação Hoje/Rebanho/Manejo/Estrutura/Mais?
Não usa foto real de animal?
Não cria função fora do escopo?
Não sugere regra crítica inexistente?
Serve como referência, não pixel-perfect?
```
