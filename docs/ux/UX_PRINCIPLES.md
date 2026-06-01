# UX Principles — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir os princípios de experiência do usuário do RebanhoSync.

Este documento orienta decisões de fluxo, navegação, formulários, mensagens, estados visuais e hierarquia de informação.

---

## Princípio central

O RebanhoSync deve ser simples para uso em campo, sem ocultar riscos operacionais.

A interface deve ajudar o usuário a agir com segurança, mesmo em ambiente offline, com pressão de tempo e dados incompletos.

---

## Perfil de uso

O app deve considerar:

- uso no curral;
- uso com celular;
- internet instável;
- baixa tolerância a formulários longos;
- necessidade de registrar rápido;
- necessidade de revisar antes de concluir operação crítica;
- alternância entre proprietário, gerente, vaqueiro/cowboy e técnico.

---

## Regras de UX

### 1. Campo primeiro

Fluxos principais devem ser rápidos, legíveis e tolerantes a interrupção.

Priorizar:

- botões claros;
- poucos campos obrigatórios;
- preenchimento progressivo;
- confirmação em ações críticas;
- salvamento local quando aplicável.

---

### 2. Offline explícito

O usuário deve entender se está:

- online;
- offline;
- sincronizando;
- com erro de sincronização;
- com alteração local pendente;
- com conflito.

Não ocultar estado de sync em operação crítica.

---

### 3. Intenção não é fato

A UX deve deixar claro:

```txt
Agenda = intenção/tarefa futura
Evento = fato executado
```

Não usar linguagem que faça agenda parecer histórico.

Evitar:

```txt
Manejo realizado
```

quando a fonte for apenas agenda.

Preferir:

```txt
Manejo pendente
Manejo previsto
Manejo registrado
```

conforme a fonte.

---

### 4. Sinal não é autorização

Tags, sinais e insights são auxiliares.

A UX não deve transformar sinal em decisão crítica.

Exemplo crítico:

```txt
Sem carência sanitária vigente nas fontes estruturadas disponíveis
```

não equivale a:

```txt
Liberado para venda
Apto para abate
```

---

### 5. Bloquear melhor do que inventar

Quando a fonte for insuficiente, a interface deve mostrar bloqueio ou limitação.

Não preencher lacunas com inferência silenciosa.

Exemplos:

- peso atual confiável;
- pronto para venda;
- apto para abate;
- liberação sanitária final;
- margem final;
- conformidade regulatória universal.

---

### 6. Mostrar fonte quando a decisão for sensível

Cards, sinais e relatórios operacionais devem indicar fonte quando houver risco de interpretação errada.

Exemplos:

- “Fonte: eventos sanitários”
- “Fonte: agenda aberta”
- “Fonte: state_animais”
- “Fonte ausente”
- “Leitura parcial”

---

### 7. Reduzir fricção, não reduzir rastreabilidade

Formulários devem ser simples, mas operações críticas precisam preservar:

- data;
- animal/lote;
- responsável, se aplicável;
- produto/dose/lote de estoque, se aplicável;
- origem/destino, se aplicável;
- valor/custo, se aplicável;
- observação quando necessário.

---

### 8. Interface não é autorização

A UI pode ocultar, orientar ou alertar, mas autorização real deve ser protegida por domínio, banco, RLS e validações.

Não depender apenas de:

- botão desabilitado;
- rota escondida;
- menu oculto;
- badge visual.

---

## Linguagem

A linguagem deve ser:

- direta;
- operacional;
- curta;
- sem jargão técnico desnecessário;
- sem prometer certeza quando a fonte é parcial.

Preferir:

```txt
Fonte carregada, sem itens.
Fonte obrigatória ausente.
Dados incompletos para calcular.
Sinal sanitário, não autorização comercial.
```

Evitar:

```txt
Tudo certo
Liberado
Garantido
Seguro para venda
Apto para abate
```

---

## Hierarquia de informação

Em telas operacionais, priorizar:

1. O que exige ação agora.
2. O que está atrasado.
3. O que está parcialmente registrado.
4. O que é apenas informação.
5. Detalhe técnico sob demanda.

---

## Estados obrigatórios

Componentes que exibem dados derivados devem considerar:

- carregando;
- vazio;
- parcial;
- bloqueado;
- erro;
- offline;
- sincronização pendente.

Detalhes:

- `docs/ux/EMPTY_PARTIAL_BLOCKED_STATES.md`

---

## Critério de aceite

Uma tela respeita os princípios de UX quando:

- deixa claro o que o usuário deve fazer;
- separa pendência de fato executado;
- mostra limitação quando a fonte é parcial;
- não transforma sinal em autorização;
- funciona bem em celular;
- não depende de conexão para fluxo offline esperado;
- preserva rastreabilidade em ação crítica;
- não esconde risco operacional.