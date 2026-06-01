```md
# User Manual Index — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Índice do manual do usuário do RebanhoSync.

Use este arquivo como ponto de entrada para localizar o manual correto por tela ou por dúvida de suporte.

---

## Comece por aqui

Se você quer entender o uso geral do app:

1. Leia a tela que está usando em `screens/`.
2. Consulte a FAQ correspondente em `support/`.
3. Se o problema for técnico, consulte `support/TROUBLESHOOTING.md`.

---

## Manuais por tela

| Tela/fluxo | Arquivo |
|---|---|
| Agenda | `docs/manuals/screens/AGENDA.md` |
| Animais/Rebanho | `docs/manuals/screens/ANIMAIS.md` |
| Lotes e Pastos | `docs/manuals/screens/LOTES_PASTOS.md` |
| Compra/Venda/Sociedade | `docs/manuals/screens/COMPRA_VENDA.md` |
| Registrar | `docs/manuals/screens/REGISTRAR.md` |
| Sanitário | `docs/manuals/screens/SANITARIO.md` |

---

## Suporte e dúvidas frequentes

| Tema | Arquivo |
|---|---|
| Login, senha, sessão, fazenda | `docs/manuals/support/FAQ_LOGIN.md` |
| Offline, sincronização e conflitos | `docs/manuals/support/FAQ_SYNC.md` |
| Agenda, pendências e atrasos | `docs/manuals/support/FAQ_AGENDA.md` |
| Sanitário, protocolo, evento e carência | `docs/manuals/support/FAQ_SANITARIO.md` |
| Problemas comuns | `docs/manuals/support/TROUBLESHOOTING.md` |

---

## Conceitos essenciais

### Agenda

Agenda é tarefa futura ou pendência.

Exemplos:

- vacina prevista;
- manejo atrasado;
- tarefa de hoje;
- cuidado pós-parto pendente.

Agenda não é histórico.

---

### Evento

Evento é fato executado.

Exemplos:

- vacina aplicada;
- animal movimentado;
- venda registrada;
- parto registrado;
- pesagem registrada.

Histórico vem de eventos.

---

### Estado atual

Estado atual mostra a situação consolidada agora.

Exemplos:

- animal ativo;
- lote atual;
- pasto atual;
- status vendido;
- status morto.

Estado atual não substitui histórico.

---

### Protocolo

Protocolo é regra/configuração.

Exemplo:

- calendário sanitário configurado;
- regra de vacinação;
- manejo previsto por categoria.

Protocolo não prova execução.

---

### Sinal

Sinal é alerta ou leitura auxiliar.

Exemplo:

- pendência atrasada;
- animal sem lote;
- estágio desconhecido;
- carência sanitária ativa;
- sem carência sanitária vigente nas fontes estruturadas disponíveis.

Sinal não é autorização final.

---

## Regras de interpretação segura

Não interpretar automaticamente:

| Informação exibida | Não significa |
|---|---|
| Agenda vencida | Manejo executado |
| Protocolo configurado | Protocolo aplicado |
| Evento sanitário registrado | Liberação comercial |
| Sem carência sanitária vigente | Apto para venda/abate |
| Último peso | Peso atual confiável |
| Custo parcial | Lucro final |
| Animal em lote | Histórico completo de permanência |

---

## Ordem prática de uso diário

1. Abrir Home/Central Operacional.
2. Ver pendências de hoje e atrasadas.
3. Abrir Agenda quando precisar organizar tarefas.
4. Usar Registrar para fatos executados.
5. Consultar Animais para histórico individual.
6. Consultar Sanitário para protocolos, eventos e sinais sanitários.
7. Verificar sincronização antes de fechar o app em área com internet.

---

## Quando acionar suporte

Acione suporte quando:

- não conseguir entrar;
- sua fazenda não aparecer;
- dados importantes sumirem;
- sync ficar pendente por muito tempo;
- aparecer duplicidade;
- evento crítico parecer incorreto;
- venda/saída/óbito foi registrado errado;
- há conflito de dados;
- baixa de estoque parece duplicada ou ausente.

```
