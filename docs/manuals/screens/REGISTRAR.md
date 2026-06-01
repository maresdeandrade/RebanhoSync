# Manual da Tela — Registrar

Atualizado em: 2026-05-31

## Para que serve

A tela Registrar é a entrada principal para registrar operações e fatos executados na fazenda.

Use para iniciar registros como:

* manejo sanitário;
* pesagem;
* movimentação;
* parto;
* compra;
* venda;
* óbito;
* ocorrência;
* cadastro operacional.

---

## Regra principal

> ⚠️ **Regras Obrigatórias:**
> * **Registrar** = criar ou iniciar registro de fato/operação.
> * **Agenda** = tarefa futura.
> * **Evento** = fato executado.
> 
> 

---

## Quando usar

Use Registrar quando uma ação já aconteceu ou está sendo registrada formalmente.

**Exemplos:**

* vacina foi aplicada;
* animal foi pesado;
* animal mudou de lote;
* venda foi realizada;
* parto ocorreu;
* animal morreu;
* compra foi feita.

---

## Organização esperada

A tela pode agrupar fluxos por domínio:

* Animal;
* Sanitário;
* Pesagem;
* Reprodução;
* Movimentação;
* Compra/Venda;
* Ocorrência;
* Nutrição (se aplicável).

---

## Fluxos críticos

Alguns registros têm maior risco e exigem revisão:

* venda;
* óbito;
* saída;
* evento sanitário com estoque/custo;
* parto com criação de cria;
* movimentação em lote;
* correção histórica.

---

## Revisão antes de confirmar

Antes de confirmar operação crítica, confira:

* animal/lote;
* data;
* tipo de operação;
* produto/dose (se sanitário);
* origem/destino (se movimentação);
* contraparte/valor (se compra/venda);
* efeito no status;
* sync/offline.

---

## Offline

Se estiver offline, o app pode salvar localmente quando o fluxo permitir.

> 💡 **Mensagem esperada:** `Registro salvo neste dispositivo. Sincronização pendente.`
> ⚠️ **Não confundir com:** `Registro sincronizado.`

### Sync pendente

Quando o registro ainda não sincronizou, ele pode depender de envio posterior para o servidor. Evite repetir a mesma operação antes de verificar se ela já ficou pendente.

---

## O que não interpretar errado

| Situação | Não significa |
| --- | --- |
| **Registro salvo localmente** | Já sincronizou |
| **Botão concluído** | Sempre criou evento |
| **Agenda aberta por registro** | Histórico executado |
| **Produto selecionado** | Estoque baixado com sucesso |
| **Venda iniciada** | Venda confirmada |
| **Formulário com padrão preenchido** | Fato verdadeiro sem confirmação |

---

## Boas práticas

* Registrar no momento da execução.
* Conferir dados antes de confirmar.
* Não duplicar operação se estiver offline.
* Usar observação quando houver exceção.
* Revisar sync pendente ao voltar conexão.
* Evitar usar edição cadastral para corrigir evento.

---

## Erros comuns

* **“Cliquei duas vezes e duplicou”**
Evite repetir a ação se aparecer sync pendente ou carregamento.
* **“Salvou local, então já está no servidor”**
Não necessariamente. Aguarde a sincronização.
* **“Concluir agenda é igual registrar evento”**
Depende do fluxo. A tela deve deixar explícito quando o evento será criado.

---

## Quando acionar suporte

Acione o suporte se:

* operação duplicou;
* registro sumiu;
* registro ficou pendente por muito tempo;
* venda/óbito/movimentação saiu errado;
* evento sanitário não baixou estoque;
* parto criou cria duplicada;
* registro foi salvo na fazenda errada.