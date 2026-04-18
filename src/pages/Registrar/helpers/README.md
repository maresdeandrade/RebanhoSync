# Registrar Helpers

Coloque aqui funcoes puras extraidas de `index.tsx` (normalizacao, policy/guard, montagem de payload, formatacao local).
Nao adicionar IO remoto/local neste nivel; para isso use `../effects/`.

Helpers atuais:
- `animalSelection.ts`: normalizacao/select do recorte de animais por busca e contagem de selecionados visiveis.
- `selectContext.ts`: resolve selecao por ids e recorte sensivel para transito externo.
- `movimentacao.ts`: regras puras para destino de movimentacao (anti-teleporte).
- `actionStepIssues.ts`: validacoes leves, mensagens de bloqueio/elegibilidade e composicao final de issues para liberar avance do wizard.
- `protocolEvaluation.ts`: avaliacao/ordenacao de itens de protocolo sanitario e selecao da avaliacao ativa.
- `financialContext.ts`: normalizacao do contexto financeiro (natureza/totais/quantidade/peso) e parse numerico local.
- `financialPlan.ts`: selecao dos animais financeiros e montagem do recorte `purchaseAnimals` para transacao.
- `financialFinalize.ts`: monta o plano final de transacao financeira (guardrail de natureza + build de gesture/ops).
- `finalizeOutcome.ts`: concentra mensagem de sucesso e rota final (home/pos-parto) apos commit.
- `finalizeGuards.ts`: guardrails finais de submit (natureza financeira, erro de reproducao, ops vazias e mensagens de catch).
- `sanitaryFinalize.ts`: composicao do contexto sanitario de finalizacao (produto, metadata de protocolo/regime e payload de checklist de transito).
