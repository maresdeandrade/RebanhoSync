# Navigation Model — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir o modelo de navegação do RebanhoSync.

Este documento orienta organização de rotas, menus, navegação mobile/desktop e agrupamento das funcionalidades principais.

---

## Princípios

- Navegação deve refletir rotina de campo.
- Home deve responder “o que precisa de atenção agora?”.
- Registrar deve concentrar ações operacionais.
- Rebanho deve concentrar consulta e gestão animal.
- Estrutura deve concentrar lote, pasto e fazenda.
- Mais deve agrupar itens secundários.
- Não criar módulo novo sem necessidade.

---

## Modelo principal

```txt
Home / Hoje
Agenda
Registrar
Rebanho
Estrutura
Mais
```

---

## Home / Hoje

Papel:

- central operacional;
- pendências do dia;
- atrasos;
- sinais auxiliares;
- sync/status;
- visão rápida.

Não deve virar:

- BI completo;
- ERP;
- lista de todos os dados;
- painel de decisão crítica automática.

---

## Agenda

Papel:

- tarefas futuras;
- pendências;
- vencimentos;
- atrasos;
- execução orientada.

Agenda não é histórico.

Ações possíveis:

- abrir registro;
- reagendar, se suportado;
- concluir com evento, se fluxo existir;
- visualizar detalhes.

---

## Registrar

Papel:

- entrada principal para fatos executados e operações.

Agrupar por domínio:

- Animal;
- Sanitário;
- Pesagem;
- Reprodução;
- Movimentação;
- Compra/Venda;
- Nutrição, se aplicável;
- Ocorrência/checklist, se aplicável.

### Regra

Registrar deve criar ou iniciar fluxo de evento/operação, não apenas navegar para painel read-only.

---

## Rebanho

Papel:

- lista de animais;
- filtros;
- detalhes do animal;
- status atual;
- histórico;
- agenda vinculada;
- sinais auxiliares.

Não deve ser fonte de decisão crítica sem fonte técnica.

---

## Estrutura

Papel:

- fazenda;
- lotes;
- pastos;
- estrutura produtiva;
- ocupação atual;
- movimentação estrutural.

Não misturar com compra/venda patrimonial, salvo vínculo operacional claro.

---

## Mais

Papel:

- configurações;
- suporte;
- sync técnico;
- perfil;
- permissões, se aplicável;
- documentação/ajuda;
- itens menos frequentes.

Evitar colocar fluxos operacionais principais apenas em “Mais”.

---

## Compra / Venda / Sociedade

Local preferencial:

```txt
Registrar → Compra / Venda / Sociedade
```

Motivo:

- são operações patrimoniais/econômicas;
- alteram status/estado;
- pertencem ao fluxo operacional;
- não são configuração.

---

## Sanitário

Entradas possíveis:

```txt
Home → pendência sanitária
Agenda → item sanitário
Registrar → Sanitário
Animal → Histórico/Registrar sanitário
```

A tela sanitária deve diferenciar:

- protocolo;
- agenda;
- evento;
- estoque;
- carência como sinal;
- compliance/checklist.

---

## Reprodução

Entradas possíveis:

```txt
Registrar → Reprodução
Animal → Reprodução/Parto
Agenda → cuidado da cria/pós-parto
```

Foco MVP:

- parto;
- cria;
- pós-parto.

Não destacar IATF ampla como fluxo principal sem contrato validado.

---

## Login e seleção de fazenda

Fluxo antes da navegação principal:

```txt
Login
→ Seleção de fazenda, se múltiplas
→ Home
```

Usuário sem fazenda não deve acessar navegação operacional.

---

## Mobile

Mobile deve usar navegação inferior para itens principais:

```txt
Hoje
Agenda
Registrar
Rebanho
Mais
```

Estrutura pode ficar em:

```txt
Mais → Estrutura
```

ou aparecer como item principal se for uso frequente em fase específica.

---

## Desktop/tablet

Desktop pode usar SideNav com:

- Home/Hoje;
- Agenda;
- Registrar;
- Rebanho;
- Estrutura;
- Sanitário, se houver área dedicada;
- Relatórios, se houver;
- Configurações/Mais.

---

## Regras de navegação

Não criar top-level novo sem justificar:

- frequência alta;
- valor operacional direto;
- clareza para usuário;
- domínio consolidado;
- não duplicação com Registrar/Home.

---

## Estados globais

A navegação deve considerar:

- offline;
- sync pendente;
- sessão expirada;
- fazenda ativa;
- usuário sem permissão;
- loading inicial.

---

## Critério de aceite

A navegação é aceitável quando:

- prioriza rotina diária;
- reduz cliques para registros frequentes;
- separa consulta de registro;
- não esconde operação principal em menu secundário;
- mantém fazenda ativa clara;
- não permite navegação operacional sem fazenda;
- funciona em mobile e desktop;
- não duplica módulos sem necessidade.