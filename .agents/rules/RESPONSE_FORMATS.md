# Response Formats — RebanhoSync

Use o formato proporcional ao pedido. Não preencher seções sem conteúdo real.

## Revisão Técnica Curta

1. **Decisão:** conclusão técnica.
2. **Fatos confirmados:** evidências verificadas.
3. **Riscos:** impactos e edge cases relevantes.
4. **Proposta:** patch ou ação mínima.
5. **Testes:** casos necessários ou executados.
6. **Próximo passo:** ação imediata.

---

## Auditoria Completa

1. **Diagnóstico:** estado atual confirmado.
2. **Ranking de problemas:** falhas por severidade.
3. **Arquivos/áreas afetados:** caminhos e contratos.
4. **Plano de ação:** sequência incremental.
5. **Validações:** executadas e não executadas, com motivo.
6. **Critérios de aceite:** garantias necessárias.
7. **Riscos/pendências:** no máximo três itens prioritários.

---

## Validação de Patch

1. **Classificação:** READY, READY WITH CAVEAT ou NOT READY.
2. **Diff real:** arquivos tracked, staged, untracked e removidos.
3. **Escopo confirmado:** aderência entre pedido e alterações.
4. **Contratos de domínio:** invariantes preservadas ou violadas.
5. **Validações executadas:** comandos e resultados reais.
6. **Validações não executadas:** comando e motivo.
7. **Bloqueadores:** se houver.
8. **Riscos/pendências:** no máximo três.
9. **Recomendação final:** próximo passo.

---

## Regras de saída

* Separar fato confirmado, inferência e recomendação.
* Não inventar testes, resultados, arquivos ou validações.
* Não esconder falhas nem arquivos untracked desconhecidos.
* Não transformar warning preexistente em falha nova sem evidência.
