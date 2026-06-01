# Stitch Prompts — RebanhoSync

Status: Ferramenta auxiliar  
Tipo: Prompts para geração de telas de referência  
Fonte visual: `BRAND_DIRECTION.md` + `UI_VISUAL_REFERENCES.md`  
Última atualização: 2026-05-08

## 1. Regra de uso

Os prompts deste arquivo servem para gerar variações visuais no Stitch.

As saídas geradas devem ser revisadas antes de virar referência oficial.

Não usar outputs do Stitch como:

- especificação funcional automática;
- implementação pixel-perfect;
- autorização para alterar regra de negócio;
- autorização para criar funcionalidades fora do escopo;
- fonte para inferir categoria animal, carência, aptidão comercial ou regra sanitária.

Classificar sempre o resultado como:

| Status | Uso |
|---|---|
| Referência visual aprovada | Pode orientar UI futura |
| Recomendado | Pode virar backlog visual |
| Não autorizado por referência visual | Não deve ser inferido |

## 2. Direção visual fixa para prompts

Usar a direção **Azul Sync Técnico / Campo Operacional**:

- azul petróleo profundo `#002B45`;
- azul ação `#0057C2`;
- azul informação `#2563EB`;
- azul claro `#3B82F6`;
- verde sucesso `#16A34A`;
- aviso/offline `#F59E0B` ou laranja próximo;
- erro/crítico `#DC2626`;
- fundo claro `#F7F9FA`;
- cards `#FFFFFF`;
- bordas `#E2E8F0`;
- texto principal `#0F172A`;
- texto secundário `#64748B`.

## 3. Logo fixo para novas gerações

Usar o logo de referência atual:

- animal adulto + bezerro;
- movimento circular/sincronização;
- wordmark `RebanhoSync`;
- aplicação monocromática/negativa quando em fundo escuro;
- possibilidade de favicon/app icon simplificado.

Evitar:

- escudo/hexágono como direção principal se conflitar com a referência atual;
- foto real de animal;
- boi hiper-realista;
- folha genérica;
- nuvem/Wi-Fi como elemento principal.

## 4. Prompt principal — Telas mobile Azul Sync Técnico

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

Use a identidade visual azul “Sync Técnico / Campo Operacional”:

- azul petróleo profundo `#002B45`;
- azul ação `#0057C2`;
- azul informação `#2563EB`;
- azul claro `#3B82F6`;
- verde sucesso `#16A34A`;
- aviso/offline `#F59E0B`;
- erro/crítico `#DC2626`;
- fundo `#F7F9FA`;
- cards `#FFFFFF`;
- bordas `#E2E8F0`;
- texto principal `#0F172A`;
- texto secundário `#64748B`.

Use logo com animal adulto + bezerro, movimento circular de sincronização e wordmark RebanhoSync. Em fundo escuro, usar versão monocromática/negativa branca.

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

## 5. Prompt curto

```markdown
Crie telas mobile high-fidelity para o app RebanhoSync.

RebanhoSync é um app offline-first para gestão simples de pecuária de corte, focado em pequeno/médio produtor. Não é ERP completo.

Use identidade azul “Sync Técnico / Campo Operacional”:

- azul petróleo `#002B45`;
- azul ação `#0057C2`;
- azul info `#2563EB`;
- azul claro `#3B82F6`;
- sucesso `#16A34A`;
- aviso/offline `#F59E0B`;
- erro `#DC2626`;
- fundo `#F7F9FA`;
- cards `#FFFFFF`;
- borda `#E2E8F0`;
- texto `#0F172A`.

Logo: animal adulto + bezerro, movimento circular de sincronização e wordmark RebanhoSync. Usar versão branca em fundo azul escuro.

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

## 6. Prompt — Perfis visuais de animal

```markdown
Crie telas mobile high-fidelity de Perfil do Animal para o RebanhoSync.

Usar a identidade azul “Sync Técnico / Campo Operacional”.

Gerar variações visuais para:

- Touro Reprodutor;
- Boi Engorda;
- Vaca Seca;
- Vaca Parida;
- Novilha;
- Bezerro.

Estrutura da tela:

- header azul petróleo;
- cartão principal branco;
- ilustração do perfil animal, sem foto real;
- código do animal em destaque;
- símbolo de sexo visível;
- raça, idade, brinco e status;
- badge da categoria;
- abas Resumo, Histórico e Manejos;
- cards de Peso, GMD, Lote e métrica contextual;
- seção Próximos eventos;
- CTA “Ver histórico completo”.

Regras visuais:

- Novilha sem úbere proeminente.
- Vaca Parida com bezerro ao pé.
- Touro Reprodutor robusto, com cupim evidente.
- Boi Engorda com volume/terminação.
- Bezerro menor e esguio.
- Vaca Seca como fêmea adulta sem bezerro ao pé.

Não transformar perfil visual em regra automática de negócio.
Não criar cálculo de GMD, desmame, cobertura, status reprodutivo ou terminação se a fonte não estiver disponível.
```

## 7. Prompt — Home / Hoje Central Operacional

```markdown
Crie uma tela mobile high-fidelity para a Home do RebanhoSync, chamada “Hoje”.

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

## 8. Prompt — Agenda completa

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

## 9. Prompt — Manejo contextual

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

## 10. Prompt — Rebanho

```markdown
Crie uma tela mobile high-fidelity para “Rebanho” do RebanhoSync.

Objetivo: busca rápida e acesso a animais/lotes.

Mostrar:

- busca por brinco, nome, lote;
- cards de métricas: total, ativos, atenção, em tratamento;
- abas ou filtros: Animais, Lotes;
- lista de animais sem foto real;
- ilustração por perfil visual quando disponível;
- símbolo de sexo;
- badge de categoria;
- idade, peso, GMD e status visual por animal;
- acesso ao perfil do animal.

Bottom navigation com Rebanho ativo.

Não inferir categoria automaticamente apenas pelo ícone.
```

## 11. Prompt — Estrutura

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

## 12. Prompt — Lote

```markdown
Crie uma tela mobile high-fidelity para Detalhe do Lote no RebanhoSync.

Mostrar:

- header azul petróleo;
- identificação do lote;
- total de animais;
- status geral;
- cards de peso médio, manejos pendentes e calendário sanitário;
- atividades recentes;
- agenda do lote;
- CTAs: Ver animais, Registrar manejo, Relatório.

O CTA Registrar manejo apenas navega e pré-preenche contexto. Não salva, não executa e não gera evento automaticamente.
```

## 13. Prompt — Offline / Sync

```markdown
Crie uma tela mobile high-fidelity para Offline / Sincronização do RebanhoSync.

Mostrar:

- header azul petróleo;
- status da conexão;
- última sincronização;
- pendentes para sincronizar;
- rejeições;
- armazenamento local;
- atividade de sincronização;
- botões “Ver dados locais” e “Sincronizar agora”.

Usar laranja para offline/atenção, verde para sucesso, vermelho para rejeição/falha.

Não criar regra nova de sincronização.
```

## 14. Prompt — Relatórios / Insights

```markdown
Crie uma tela mobile high-fidelity para Relatórios / Insights do RebanhoSync.

Mostrar:

- header azul petróleo com logo e status sincronizado;
- filtros de período e lote;
- resumo do período;
- manejos do mês;
- animais por lote;
- pendências da agenda;
- eventos recentes;
- card de modo offline.

Usar gráficos simples, como barras e donut.

Não criar BI complexo, predição, aptidão comercial, carência sanitária conclusiva ou regra crítica.
```

## 15. Restrições fixas

Todo prompt deve preservar:

- Agenda como intenção operacional;
- Eventos como fatos históricos;
- protocolos como regra/configuração, não execução;
- `pastoId` como contexto informativo;
- CTAs contextuais como navegação/pré-preenchimento, não ação automática;
- revisão obrigatória antes de salvar;
- offline-first;
- mobile-first.

Não criar:

- ERP fiscal;
- marketplace;
- venda/abate;
- carência sanitária conclusiva;
- aptidão comercial;
- IA preditiva;
- seleção global/bandeja sem prompt próprio de risco;
- regra automática baseada em imagem, ícone ou categoria visual.
