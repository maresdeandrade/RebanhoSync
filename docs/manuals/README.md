```md
# Manuals — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Esta pasta concentra manuais práticos de uso e suporte do RebanhoSync.

Os manuais explicam como usar o app, interpretar telas, entender estados operacionais e resolver dúvidas comuns.

---

## Estrutura

```txt
docs/manuals/
  README.md
  USER_MANUAL_INDEX.md

  screens/
    AGENDA.md
    ANIMAIS.md
    LOTES_PASTOS.md
    COMPRA_VENDA.md
    REGISTRAR.md
    SANITARIO.md

  support/
    FAQ_LOGIN.md
    FAQ_SYNC.md
    FAQ_AGENDA.md
    FAQ_SANITARIO.md
    TROUBLESHOOTING.md

```

---

## Quando usar esta pasta

Use `docs/manuals/` quando a tarefa envolver:

* manual do usuário;
* ajuda dentro do app;
* FAQ;
* suporte operacional;
* orientação por tela;
* explicação de fluxo;
* instrução para usuário final;
* onboarding;
* troubleshooting.

---

## Quando não usar

Não usar esta pasta como fonte principal para: arquitetura, RLS, sync técnico, schema, regra agropecuária detalhada, regra financeira, roadmap ou prompts de agentes.

### Guia de Pastas por Tema

| Tema | Pasta |
| --- | --- |
| Fonte de verdade / lacunas / status | `docs/context/` |
| Arquitetura / sync / RLS / testes | `docs/technical/` |
| Domínio agropecuário | `docs/domain/` |
| Produto / roadmap / escopo | `docs/product/` |
| UX / copy / telas | `docs/ux/` |
| Financeiro / KPI | `docs/finance/` |
| Histórico | `docs/archive/` |

---

## Convenção

* Pastas em minúsculo.
* Arquivos em `UPPER_SNAKE_CASE.md`.
* Manuais de tela em `screens/`.
* FAQs e suporte em `support/`.

---

## Regras críticas para manuais

Os manuais devem preservar estes conceitos:

* **Agenda:** tarefa futura ou pendência.
* **Evento:** fato executado.
* **Estado atual:** situação consolidada agora.
* **Protocolo:** regra ou configuração.
* **Sinal:** alerta auxiliar, não decisão crítica.

---

## Linguagem para usuário

### Preferir linguagem simples

* Pendente
* Atrasado
* Registrado
* Salvo neste dispositivo
* Sincronização pendente
* Fonte insuficiente

### Evitar linguagem que prometa decisão indevida

* Liberado para venda
* Apto para abate
* Livre de carência
* Peso atual confiável
* Conformidade garantida

---

## Carência sanitária

Carência sanitária pode aparecer como sinal quando vem de evento sanitário estruturado.

O manual deve explicar:

> ✅ *"Sem carência sanitária vigente nas fontes estruturadas disponíveis."*

> ⚠️ **Não significa:**
> * Liberado para venda.
> * Apto para abate.
> * Liberação sanitária final.
> 
> 

---

## Critério de qualidade

Um manual é aceitável quando:

* [ ] explica o uso prático;
* [ ] não cria regra de negócio nova;
* [ ] não contradiz regras de domínio/produto/técnico;
* [ ] orienta o usuário sem prometer certeza falsa;
* [ ] diferencia pendência, fato, estado e sinal;
* [ ] ajuda o suporte a resolver dúvidas comuns.

```

```
