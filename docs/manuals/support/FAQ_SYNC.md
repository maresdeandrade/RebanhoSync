# FAQ — Offline e Sincronização

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Responder dúvidas comuns sobre funcionamento offline, sincronização, pendências, conflitos e dados locais.

---

## O RebanhoSync funciona offline?

Sim, fluxos offline-first devem funcionar localmente quando aplicável.

Algumas ações podem exigir conexão, especialmente login novo, permissões ou operações que dependem do servidor.

---

## O que significa “salvo neste dispositivo”?

Significa que o dado foi salvo localmente. Ainda pode não ter sido enviado ao servidor.

---

## O que significa “sincronização pendente”?

Significa que existe alteração local aguardando envio ou confirmação remota. Evite repetir a mesma operação sem verificar se ela já está pendente.

---

## O que significa “sincronizado”?

Significa que a alteração foi confirmada no servidor.

---

## Posso fechar o app com sync pendente?

Pode haver risco operacional. O app deve preservar a fila local, mas é melhor sincronizar quando houver internet antes de encerrar após operações críticas.

---

## Fiz um registro offline. Ele sumiu?

**Possíveis causas:**
* ainda está em fila local;
* filtro da tela oculta o item;
* troca de fazenda;
* falha de sync;
* conflito;
* erro de renderização.

**Verifique:**
* status de sincronização;
* fazenda ativa;
* filtros;
* tela de histórico;
* mensagens de erro.

---

## O que é conflito?

Conflito acontece quando dado local e remoto divergem.

**Exemplo:**
* mesmo item alterado em dispositivos diferentes;
* operação já foi processada no servidor;
* retry gerou divergência;
* permissões mudaram.

> ⚠️ **Atenção:** Conflito crítico não deve ser resolvido silenciosamente.

---

## Uma operação duplicou. Por quê?

**Possíveis causas:**
* duplo clique;
* retry sem idempotência adequada;
* reenviar registro manualmente;
* falha de rede durante confirmação;
* sync parcial.

> ⚠️ **Acione suporte se envolver:** venda, óbito, evento sanitário, baixa de estoque, movimentação, ou parto/cria.

---

## O que significa rollback?

Rollback é desfazer ou compensar uma operação quando parte do fluxo falha.

**Exemplo:**
* evento foi criado, mas baixa de estoque falhou;
* sync remoto falhou;
* operação precisa ser reconciliada.

---

## Dados locais são iguais aos dados do servidor?

Nem sempre no momento. Durante offline ou sync pendente, o dispositivo pode ter alterações ainda não enviadas.

---

## Troquei de fazenda e os dados mudaram

Correto. Cada fazenda tem contexto próprio.

> ⚠️ **Regra:** Dados não devem ser misturados entre fazendas.

---

## Quando acionar suporte?

Acione suporte se:
* sync fica pendente por muito tempo;
* aparece conflito;
* registro crítico duplicou;
* registro crítico sumiu;
* dados aparecem na fazenda errada;
* baixa de estoque duplicou;
* venda/óbito/movimentação ficou inconsistente;
* app alterna entre online/offline sem motivo claro.