# R04B.3 — tentativa de finalização dos previews autenticados

> **Atualização pós-consolidação:** [sete previews reais obtidos e avaliados em 21/10/2026](SANITARIO_V2_R04B3_PREVIEWS_POSTCONSOLIDATION_20261021.md); estado atual `AWAITING_CURATORIAL_APPROVAL`. O registro abaixo preserva a tentativa anterior e seu resultado histórico de 0/7.

**Classificação: `BLOCKED_AUTHENTICATED_PREVIEWS`. Critério de aceite: 0/7 previews obtidos.**

[Registro estruturado, autorização, argumentos exatos e limitações](evidence/SANITARIO_V2_R04B3_AUTHENTICATED_PREVIEWS_20261021.json).

Em 21/10/2026, o usuário autorizou expressamente acessar a sessão real e executar somente os sete previews de leitura. O acesso ao Chrome foi concedido nesta tentativa. A aba do RebanhoSync abriu em `/home`, no contexto “Homologação Sanitário V2”; foi possível abrir o perfil e o painel `/admin`, que exibiu SuperAdmin e métricas carregadas. Isso não substitui a verificação de autorização pela RPC curatorial, que não foi executada.

A interface publicada em `https://rebanho-sync.vercel.app/admin` oferece somente Métricas, Usuários, Fazendas e Convites, inclusive após um recarregamento. A aba “Curadoria sanitária” está presente em `src/pages/Admin/index.tsx` na worktree `r04b2-certificacao`, mas não apareceu na interface publicada observada. O controle disponível do navegador não oferece transporte RPC autenticado arbitrário; não houve extração de sessão, credenciais ou claims. Foi solicitada uma URL alternativa já disponível com a interface curatorial.

O plano `SANITARIO_V2_R04B2_PUBLICATION_PLAN_20261021.json` foi lido integralmente. Seus cinco escopos individuais e dois grupos foram transcritos e comparados estruturalmente na evidência, sem divergência. Todos exigem versão 1 do protocolo; as versões físicas esperadas são:

| Escopo | Versões dos itens |
| --- | --- |
| CLO — primovacinação dose 1 | 3 |
| CLO — primovacinação dose 2 | 4 |
| CLO — reforço anual | 3 |
| LEP — primovacinação dose 1 | 3 |
| LEP — reforço anual/semestral | 3 |
| Grupo CLO | 3, 4, 3 |
| Grupo LEP | 3, 3 |

Essas versões vêm do plano e **não são retornos do servidor nesta tentativa**. Nenhum conteúdo, blocker, versão ou `reviewed_content_digest` de preview foi obtido. Campos nulos na evidência significam ausência de retorno, não ausência de blockers.

O digest do delta no plano é `55a71d9f4adb6b4fcbbfe9cd5d26ee8c15fd4fc99f1106b50d02dc830ca877e4`. O SHA-256 da migration local coincide com o plano: `c490630d646a9d99a8fc424c07cc73f73485b6e6bd5ae2d5b6a5582f06e29e59`. A publicação anterior foi tratada como baseline informado, apoiado pela evidência preexistente; não foi repetida nem revalidada remotamente nesta tentativa.

Nenhuma chamada de preview ou decisão, SQL administrativo, migration, importação, escrita operacional, ativação de gate ou deploy foi executada. Alterações locais anteriores foram preservadas. Somente estes dois novos registros documentais foram criados. A sessão permanece no painel administrativo.

Validação documental: JSON relido com sucesso; sete argumentos comparados ao plano e idênticos; zero resultados autenticados registrados. Testes de runtime não se aplicam a este registro e não foram repetidos. Gates e dados operacionais não foram reconsultados remotamente.

**Pendência:** disponibilizar um canal suportado de preview na sessão autorizada. Depois, executar os sete escopos exatos, guardar os retornos completos do servidor e conferir blockers, versões e digests antes de considerar `AWAITING_CURATORIAL_APPROVAL`. Decisões curatoriais permanecem fora do escopo.
