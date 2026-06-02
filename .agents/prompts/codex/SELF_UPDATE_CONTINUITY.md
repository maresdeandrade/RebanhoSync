# Self Update Continuity — RebanhoSync

Ao finalizar qualquer fase, atualize a continuidade do projeto.

## Arquivos obrigatórios

Atualizar:

- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/review/CURRENT_PHASE_HANDOFF.md`

Atualizar também, se houve avanço validado:

- `docs/context/PROJECT_STATUS.md`

## Regras

- Não reescrever histórico como se algo não tivesse falhado.
- Não marcar como concluído sem teste/validação correspondente.
- Se algo não foi validado, registrar como pendência.
- Se houve falha parcial, registrar como parcial.
- Se não houve alteração de schema/RLS/RPC/sync, declarar explicitamente.
- Se houve alteração de schema/RLS/RPC/sync, registrar validação Supabase.
- Não criar nova próxima fase fora do escopo aprovado.
- Não avançar para venda, abate, DRE, ROI ou custo por arroba sem autorização.

## Formato obrigatório

### LAST_PHASE_RESULT.md

Registrar:

1. Nome da fase.
2. Fonte de continuidade usada.
3. Arquivos alterados.
4. Testes criados/ajustados.
5. Comandos executados.
6. Resultado de cada comando.
7. Pendências remanescentes.
8. Riscos.
9. Próximo passo recomendado.

### OPEN_REVIEW_ITEMS.md

Atualizar:

- remover pendências resolvidas;
- manter pendências não validadas;
- criar novas pendências apenas se forem reais;
- classificar por prioridade: alta, média, baixa.

### CURRENT_PHASE_HANDOFF.md

Gerar handoff curto para a próxima etapa contendo:

1. Estado consolidado.
2. O que não deve ser refeito.
3. Pendências abertas.
4. Escopo permitido.
5. Escopo proibido.
6. Áreas candidatas.
7. Validação obrigatória.
8. Critérios de aceite.

### PROJECT_STATUS.md

Atualizar somente fatos validados:

- funcionalidades concluídas;
- decisões consolidadas;
- limitações atuais;
- gates verdes;
- pendências relevantes.