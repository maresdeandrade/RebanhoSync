```md
# FAQ — Sanitário

Atualizado em: 2026-07-12
**Baseline Commit:** `32d7779`

## Objetivo

Responder dúvidas comuns sobre protocolo sanitário, agenda sanitária, evento sanitário, produtos, estoque, carência e sinais sanitários.

---

## Qual a diferença entre protocolo, agenda e evento?

### Protocolo
Regra ou configuração.
> 💡 **Exemplo:** Vacinar bezerros em determinada idade.

### Agenda
Tarefa futura ou pendência.
> 💡 **Exemplo:** Vacina prevista para hoje.

### Evento
Fato executado.
> 💡 **Exemplo:** Vacina aplicada em 31/05/2026.

---

## Protocolo prova que o animal foi vacinado?

**Não.** Protocolo é regra. A execução precisa de um evento sanitário.

---

## Agenda sanitária prova aplicação?

**Não.** A agenda sanitária indica tarefa prevista ou pendente. A aplicação exige um evento sanitário registrado.

---

## O que é a Central Sanitária?

É a área `/protocolos-sanitarios` usada para janelas sanitárias, elegibilidade, pré-checagem, agenda sanitária local, catálogo, histórico e pendências documentais.

Detalhe de animal e detalhe de lote mostram apenas resumo contextual. Para planejamento completo, use a Central Sanitária.

---

## O que é contexto operacional?

É informação explícita usada para avaliar uma janela quando o protocolo depende de condição externa.

Exemplos:

* área de risco para raiva;
* cadência anual/semestral;
* contexto reprodutivo;
* manejo pré-desmama, recria, pré-confinamento ou pasto vedado.

> ⚠️ Contexto operacional ajuda a avaliar a janela, mas não substitui fonte técnica nem execução.

---

## O que é histórico sanitário anterior?

É histórico registrado antes da entrada do animal no app/fazenda.

Pode ser documentado, declarado ou importado legado. Histórico externo documentado pode apoiar a pré-checagem. Declaração sem documento pode gerar aviso ou pendência documental.

> ⚠️ Histórico anterior não registra execução local da fazenda, não baixa estoque e não calcula carência ativa automaticamente.

---

## O que é evento sanitário?

É o registro de manejo sanitário executado ou ocorrência sanitária. Pode incluir:
* produto;
* dose;
* via;
* lote de estoque;
* responsável;
* custo;
* carência;
* observação.

---

## O que é carência sanitária?

É um período associado a produto/regra sanitária após a aplicação. No app, pode aparecer como sinal quando houver evento sanitário estruturado.

---

## O que significa “Carência sanitária ativa até [data]”?

Significa que, nas fontes estruturadas disponíveis, existe carência sanitária vigente até aquela data.

> ⚠️ **Não significa automaticamente:**
> * bloqueio comercial universal;
> * liberação futura automática;
> * aptidão para venda;
> * aptidão para abate.

---

## O que significa “Sem carência sanitária vigente nas fontes estruturadas disponíveis”?

Significa que, com base nos eventos sanitários estruturados disponíveis, não foi identificada carência vigente.

> ⚠️ **Não significa:**
> * liberado para venda;
> * apto para abate;
> * liberação sanitária final;
> * conformidade universal.

---

## Por que não usar “Livre de carência”?

Porque pode parecer liberação final e gerar falsas garantias.

✅ **Copy preferida na UI:**
`Sem carência sanitária vigente nas fontes estruturadas disponíveis.`

---

## Checklist de biossegurança prova conformidade?

**Não.** O checklist é apoio operacional/contextual. Pode gerar alerta ou pendência corretiva específica, mas não prova conformidade universal.

---

## Produto cadastrado significa produto aplicado?

**Não.** O produto aplicado precisa estar em um evento sanitário registrado.

---

## Evento sanitário sempre baixa estoque?

Depende do fluxo e dos dados informados. Se houver baixa, ela deve ser idempotente e vinculada ao evento.

---

## Filtro por animal ou lote na Central executa alguma ação?

**Não.** Filtro só muda a visualização. Ele não cria agenda, evento, estoque, carência ativa ou `queue_ops`.

---

## Custo sanitário ausente é zero?

**Não.** Custo ausente significa custo não informado.

---

## Evento sanitário pode liberar venda?

**Não sozinho.** Venda/abate exigem validação própria. A carência sanitária é apenas uma dimensão da decisão.

---

## Quando acionar suporte?

Acione o suporte se:
* evento sanitário duplicou;
* produto não aparece no histórico;
* baixa de estoque falhou;
* baixa de estoque duplicou;
* carência parece incorreta;
* protocolo gerou agenda errada;
* filtro por animal/lote mostra itens de outro escopo;
* histórico anterior documentado não aparece separado;
* agenda sanitária não bate com o evento;
* ocorrência sanitária não aparece;
* sinais sanitários aparecem como liberação comercial.

```
