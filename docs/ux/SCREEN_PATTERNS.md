# Screen Patterns — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir padrões de estrutura para telas, cards, painéis, listas, detalhes e hierarquia visual do RebanhoSync.

Este documento evita telas densas, ambíguas ou que misturem ação crítica com informação auxiliar.

---

## Princípio

Cada tela deve responder rapidamente:

1. Onde estou?
2. O que preciso fazer?
3. O que está pendente?
4. O que é histórico?
5. Qual informação é parcial/bloqueada?
6. Qual ação é segura agora?

---

## Estrutura padrão de tela

Ordem recomendada:

```txt
Cabeçalho
→ Resumo operacional
→ Ação principal
→ Conteúdo principal
→ Estados/alertas
→ Detalhes técnicos sob demanda
```

---

## Cabeçalho

Deve conter:

- título;
- contexto principal;
- fazenda ativa quando relevante;
- ação primária quando aplicável.

Evitar múltiplos CTAs concorrentes no topo.

---

## Resumo operacional

Usar cards curtos para:

- pendências;
- atrasos;
- status atual;
- sinais auxiliares;
- sync;
- limitações.

Cards devem indicar fonte quando o dado for derivado.

---

## Ação principal

Cada tela deve ter uma ação principal clara.

Exemplos:

- Registrar manejo;
- Adicionar animal;
- Criar lote;
- Registrar movimentação;
- Registrar venda;
- Abrir agenda.

Ações secundárias devem ficar em menu, dropdown ou área inferior.

---

## Listas

Listas devem priorizar:

- identificação;
- status;
- pendência;
- data;
- fonte/limitação quando relevante.

Evitar colunas excessivas em mobile.

---

## Cards

Cards devem ter:

- título curto;
- valor ou status;
- descrição curta;
- fonte/limitação quando necessário;
- ação apenas se for segura.

Não usar card read-only como botão se isso não estiver visualmente claro.

---

## Painel read-only

Painel read-only pode:

- resumir;
- alertar;
- priorizar;
- mostrar sinais;
- mostrar bloqueios.

Não pode:

- concluir agenda;
- gerar evento;
- autorizar venda/abate;
- decidir carência sem fonte;
- esconder fonte.

---

## Detalhes técnicos

Detalhes técnicos devem ficar sob demanda.

Exemplos:

- UUID;
- payload;
- dedup key;
- origem de sync;
- timestamp técnico;
- regra aplicada;
- fonte do insight.

Usar:

```txt
Ver detalhes técnicos
```

---

## Home / Central Operacional

Deve priorizar:

1. Pendências atrasadas.
2. Agenda de hoje.
3. Ações seguras.
4. Sinais sanitários auxiliares.
5. Sync/status.
6. Resumo de rebanho.

Não transformar Home em cockpit analítico pesado no MVP.

---

## Agenda

Agenda deve deixar claro:

- pendente;
- hoje;
- atrasado;
- previsto;
- concluído apenas como estado da tarefa, não fato histórico.

Ações devem diferenciar:

```txt
Abrir registro
Concluir direto
```

Quando “concluir direto” criar evento, isso deve ser explícito e validado.

---

## Registrar

Tela Registrar deve agrupar ações por domínio:

- Animal;
- Sanitário;
- Reprodução;
- Movimentação;
- Compra/Venda;
- Pesagem;
- Nutrição, se aplicável.

Priorizar ações mais usadas.

---

## Animal

Tela do animal deve separar:

- identidade;
- status atual;
- lote/pasto atual;
- agenda aberta;
- eventos históricos;
- sinais auxiliares;
- detalhes técnicos.

Não misturar último peso com peso atual confiável.

---

## Sanitário

Tela sanitária deve separar:

- agenda sanitária;
- eventos sanitários;
- protocolos;
- produtos/estoque;
- sinais de carência;
- compliance/checklists.

Copy obrigatória quando exibir ausência de carência:

```txt
Não equivale a liberação para venda ou abate.
```

---

## Compra/Venda

Tela de compra/venda deve separar:

- operação planejada;
- operação executada;
- contraparte;
- valores;
- status patrimonial;
- limitações econômicas.

Não mostrar “pronto para venda” sem contrato próprio.

---

## Estados visuais

Toda tela com dados derivados deve suportar:

- carregando;
- vazio;
- parcial;
- bloqueado;
- erro;
- offline;
- sync pendente.

Referência:

- `docs/ux/EMPTY_PARTIAL_BLOCKED_STATES.md`

---

## Mobile

Em mobile:

- CTA principal deve ser visível;
- evitar tabela larga;
- usar cards/listas;
- reduzir densidade;
- usar bottom navigation;
- detalhes técnicos colapsados;
- confirmação clara para ações críticas.

---

## Critério de aceite

Uma tela é aceitável quando:

- tem hierarquia clara;
- prioriza ação operacional;
- diferencia fato, intenção, estado e regra;
- mostra fonte/limitação em dado derivado;
- não apresenta sinal como autorização;
- funciona em mobile;
- evita densidade desnecessária;
- não esconde risco operacional.