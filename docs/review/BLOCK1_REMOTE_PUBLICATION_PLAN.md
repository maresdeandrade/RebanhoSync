# Bloco 1 — publicação remota coordenada

Snapshot de 2026-11-21. Plano solicitado para J01–J05/J04; não executa publicação nem inicia J06. Evidência complementar: [preflight](evidence/BLOCK1_RELEASE_PREFLIGHT_20261121.json) e [validação do pacote](evidence/BLOCK1_INTEGRATION_20261121.json).

## Destinos e estado observado

| Item | Estado confirmado |
|---|---|
| Repositório / produção | `maresdeandrade/RebanhoSync`, branch `main` |
| Base / frontend publicado | `157376d90b3f3ac6ccfe806d98f1de37b2007644` |
| Vercel | `rebanho-sync`, projeto `prj_zK4H56qvCjyxWk03p5GH0kmW8EGv`, equipe `team_oTfqEJrR8Y8CHPF7usbe14Pg` |
| Deployment de referência | `dpl_EPrxswLkPWi6tcuVvryuLahnv1He`, READY, domínio `rebanho-sync.vercel.app` |
| Supabase de produção | `zqloazqzhwauamcejmuz`, região `sa-east-1`, PostgreSQL 17.11, ACTIVE_HEALTHY |
| Histórico remoto | 83 migrations; última `20261120090000`; as duas abaixo ausentes |
| RPC de preview remota | TABLE sem `fazenda_id`; contrato anterior confirmado por `pg_get_functiondef` |
| Backup / PITR | Plano Free: painel informa ausência de backups de projeto e PITR indisponível. Nenhum restore comprovado |

O inventário consultou catálogos, histórico e configurações; não copiou dados operacionais. Estes fatos precisam ser reconfirmados na janela de publicação.

## Integração Git e contenção de automações

GitHub Actions executa validação em PR/merge_group; não há workflow de deploy em push. A validação de alto risco usa Supabase local descartável. As regras ativas da main impedem exclusão e force-push; não definem checks obrigatórios ou aprovação. Ainda assim, o aceite desta tarefa exige `Required validation` e `Fill PR description` aprovados e revisão independente sem achados críticos/importantes.

Vercel tem criação de deployments Git habilitada e produção ligada à main. O Ignored Build Step observado é:

```sh
if [ "$VERCEL_ENV" == "production" ]; then exit 1; else exit 0; fi
```

Vercel interpreta 0 como ignorar e 1 como construir. Portanto push/atualização da feature branch gera evento Preview ignorado; merge na main permite build/publicação de produção. Não há ambientes customizados nem domínio vinculado à feature branch. Webhooks GitHub e Vercel consultados retornaram vazios. A enumeração geral de GitHub Apps não foi acessível; as integrações relevantes foram verificadas diretamente nos provedores.

Supabase está conectado ao GitHub, mas o painel mostra **Deploy to production desligado** e **Automatic branching desligado**. O check `Supabase Preview` genérico, skipped na main, não comprova criação automática de branches. Há somente a branch padrão. Push/PR não está autorizado a executar migrations remotas, e a automação observada não as aplica.

**Proteção proposta para o merge:** alterar exclusivamente o Ignored Build Step da Vercel para `exit 0`, após autorização específica, e confirmar por leitura que o deployment/sha de produção permaneceu o mesmo. Isso não pausa o site. Não restaurar automaticamente depois do merge: manter a proteção até autorização separada da publicação coordenada. Antes do merge, conferir novamente configurações, main, SHA do PR e checks do mesmo conteúdo. Sem proteção comprovada, não fazer merge.

## Compatibilidade e janela

1. O frontend novo exige `fazenda_id` no preview do convite. Frontend novo antes de J04 falha nesse fluxo: ordem frontend-primeiro é proibida.
2. O frontend antigo já interpreta incorretamente o retorno TABLE do preview. J04 acrescenta o campo e endurece Auth/RBAC, mas não corrige a UI antiga. Não prometer convites funcionais durante o intervalo SQL/UI.
3. Identidade de destinatário vem do Auth confirmado; metadata/perfil não comprova e-mail ou telefone. Convite por telefone exige telefone confirmado; não há fluxo novo de OTP neste pacote.
4. O trigger protege alterações efetivas das duas flags por proprietário ativo da mesma fazenda. Payload antigo de gerente que tente alterá-las será rejeitado, inclusive involuntariamente. Edição legítima das demais informações permanece permitida.
5. CAS por `updated_at` existe nos novos writers do frontend, não como proteção universal do servidor. Proprietários com abas antigas ainda podem enviar metadata desatualizada. Usar janela controlada sem escritas administrativas concorrentes; solicitar fechamento/reabertura das abas administrativas e confirmar versão nova antes de liberar essas operações. Operações offline pendentes não devem ser apagadas.
6. Não há troca de projeto Auth nem reset de contas/sessões/dados. Revalidar sessão e fazenda após atualizar a aplicação; conservar filas locais e não limpar storage para simular sucesso.

## Pré-requisitos e backup recuperável

**NO-GO para publicação neste snapshot.** Faltam autorização explícita de migrations/deploy, backup recuperável com restore demonstrado, janela e contas/ambiente de smoke autorizados. A proteção Vercel do merge também aguarda decisão. CI e merge serão registrados separadamente; sua aprovação não resolve esses pré-requisitos.

Antes de autorizar execução, registrar responsável, janela, SHA integrado exato, hashes SHA-256 das duas migrations, deployment anterior, versões de CLI e destino de recuperação isolado. Reconsultar migrations/catálogos; abortar se houver mudança concorrente ou divergência de contrato não reconciliada. Conexões e credenciais devem vir de cofre/ambiente seguro, nunca de URL ou argumento registrado em logs.

O backup precisa preservar dados e dependências relevantes, incluindo `auth`, `public`, memberships, convites, perfis, metadata, grants, funções e triggers. Um dump padrão da CLI, que pode excluir schemas gerenciados, não basta para comprovar preservação do Auth. Com autorização própria para cópia dos dados, um operador pode usar cliente PostgreSQL compatível, conexão direta/session apropriada e `PGPASSFILE` protegido (ou mecanismo equivalente):

```powershell
# PGHOST, PGPORT, PGDATABASE, PGUSER e PGPASSFILE fornecidos fora do log.
# RELEASE_BACKUP é caminho absoluto seguro, fora do Git, definido pelo operador.
pg_dump --format=custom --file $env:RELEASE_BACKUP
if ($LASTEXITCODE -ne 0) { throw 'Backup falhou; interromper publicação' }
pg_restore --list $env:RELEASE_BACKUP
Get-FileHash -Algorithm SHA256 -LiteralPath $env:RELEASE_BACKUP
```

O operador deve verificar avisos, cobertura de schemas/dados/ACLs e privilégios reais; roles globais e objetos gerenciados requerem inventário e procedimento compatível com Supabase. Restaurar o arquivo em destino isolado explicitamente autorizado com versão compatível e testar contagens/identidades/relações/RPCs/permissões antes de aceitar o backup. `pg_restore --list` sozinho não comprova recuperação. Não usar produção como ensaio, nem presumir que um restore completo sobre projeto Supabase gerenciado seja suportado. Anotar retenção/acesso e tempo de recuperação observado. Objetos Storage não estão incluídos no dump SQL; inventariá-los se necessários à recuperação do projeto, embora este pacote não os altere. Se o procedimento não recuperar Auth/ACLs, permanecer NO-GO e definir alternativa suportada antes de prosseguir.

## Sequência executável após autorização específica

Todos os comandos desta seção são **planejados, não executados**. Executar na revisão integrada aprovada, com a proteção Git mantida e janela ativa.

1. Registrar snapshot prévio e backup/restore aprovado. Conferir por leitura a referência do projeto vinculado: deve ser exatamente `zqloazqzhwauamcejmuz`. Não relinkar silenciosamente. Confirmar que somente as duas versões abaixo estão pendentes:

   ```powershell
   supabase migration list --linked
   supabase db push --linked --dry-run
   ```

   Qualquer migration adicional, histórico divergente ou alvo diferente interrompe a execução. Não usar `--include-all`, `migration repair`, reset ou db push não revisado.

2. Aplicar o pacote revisto com `supabase db push --linked`, somente com autorização explícita para **as duas migrations neste projeto**. A CLI aplica em ordem crescente, em transações por migration:
   - `20261120231349_j04_members_invites_authorization.sql`;
   - `20261121023104_block1_farm_security_flags_guard.sql`.

   Guardar resultado sem segredos; não presumir atomicidade do pacote inteiro. Reconsultar histórico imediatamente, inclusive em erro.

3. Verificar por SQL somente leitura: assinatura/resultado e definição das sete RPCs J04 contra as migrations aprovadas; ACLs, `SECURITY DEFINER`/search_path esperados; trigger e função de guarda das flags; policies/grants de `fazendas` e `user_profiles` preservados. Confirmar `fazenda_id` no TABLE de `get_invite_preview`. Usar `pg_get_functiondef`, `pg_get_function_result`, `pg_trigger`, `pg_policies` e `information_schema.role_table_grants`. Não chamar RPC de escrita apenas para inspecionar.

4. Somente após ambos os SQLs e contratos aprovados, publicar frontend do **SHA integrado exato** com backend de produção confirmado e segredo público adequado. Obter aprovação do método de deployment e da mudança do Ignored Build Step. Se restaurar o comando anterior, um push antigo não dispara necessariamente build retroativo: criar deployment explícito do SHA aprovado pelo mecanismo escolhido e registrar ID/URL/alias. Não executar deploy de diretório com scratch ou selecionar “último commit” sem SHA. Não promover preview sintético apontando para backend de teste.

5. Conferir deployment READY, SHA, backend, domínio e ausência de erros críticos. Executar smoke abaixo em staging equivalente ou contas/dados sintéticos especificamente autorizados no destino. Sem essa autorização, limitar inspeção a leituras e não declarar smoke funcional concluído.

6. Observar estabilidade durante a janela acordada, registrar erros/resultados reais e liberar escritas administrativas somente após clientes atualizados. Revalidar histórico remoto e garantir ausência de migration/deploy extra. Registrar conclusão e política aprovada para automação futura; não habilitar Git automaticamente por conveniência.

## Falha parcial e recuperação

| Situação | Conduta |
|---|---|
| Backup/restore ou dry-run falha | Não aplicar SQL/deploy; corrigir pré-requisito e reavaliar |
| J04 aplicada e guarda falha | Manter frontend atual e janela; identificar histórico efetivo e causa. Preservar proteção J04 e corrigir forward-only com patch/revisão/autorização próprios |
| SQLs aplicados, deploy falha | Conservar dados e SQLs; manter restrição dos fluxos afetados e repetir deploy do artefato aprovado após diagnóstico. UI antiga mantém limitações conhecidas |
| Frontend novo publicado com SQL ausente | Conter fluxos administrativos/convites; corrigir ordem mediante autorização. Não simular sucesso nem fazer reset |
| Falha Auth/RBAC/isolamento | Interromper operações afetadas, preservar logs sem segredos e evidências. Diagnosticar contrato/versão; não relaxar RLS ou identidade para restaurar acesso |
| Regressão de frontend após SQL | Roll-forward preferencial. Rollback ao deployment anterior exige autorização e aceite das limitações da UI antiga e ausência de CAS; não reverte SQL nem é recuperação completa |
| Corrupção/perda de dados demonstrada | Interromper escritas e acionar procedimento de restore ensaiado, com autorização específica e reconciliação dos dados posteriores ao backup; nunca restaurar cegamente sobre produção |

`vercel rollback dpl_EPrxswLkPWi6tcuVvryuLahnv1He` é somente candidato de recuperação do frontend, condicionado à disponibilidade, compatibilidade e autorização no momento; não executar como compensação automática. Não há migration down autorizada, backup de provedor ou PITR comprovado neste ambiente.

## Smoke e aceite pós-publicação

Registrar ambiente, versão, executor, resultado observado e evidência por caso. Não registrar tokens/dados pessoais.

| Caso | Resultado esperado / controle negativo |
|---|---|
| Login e sessão | Sessão válida após reload; expirada exige autenticação; sem perda de pendências locais |
| Equipe e contexto | Listagem por fazenda ativa; troca de fazenda não permite edição cruzada |
| Convite e destinatário | Usuário Auth confirmado correto aceita; outra identidade não aceita; replay não altera papel; reentrada após revogação segue contrato |
| Papéis | Proprietário administra; gerente não administra proprietário; viewer/operator não ganham privilégios |
| Último proprietário | Remoção/rebaixamento do último proprietário rejeitado; concorrência preserva um proprietário |
| Flags | Proprietário da fazenda altera; gerente e proprietário de outra fazenda não alteram valores protegidos |
| Edição legítima | Gerente salva campos permitidos; resposta confirma linha; gravação stale é rejeitada sem perder rascunho |
| Perfil | Ausência permite self-upsert; falha de persistência preserva rascunho; outro perfil não é editável |
| Configurações | Silêncio válido, inclusive noturno, persiste; horários iguais/inválidos rejeitados; sem alegar entrega com app fechado |
| Multi-fazenda e frontend | Fazenda/role corretos após reload; nenhum erro crítico em rede/console/observabilidade no fluxo testado |

Testes que gravam, revogam ou criam usuários/convites necessitam contas e dados de teste autorizados. Não testar remoção do último proprietário real. Fixture local com rollback não substitui observação remota, e smoke remoto não certifica todos os módulos ou hardware.

## Critério de decisão

GO só após: alvo/SHA/hashes confirmados, CI e revisão aprovados, contenção de automação comprovada, backup recuperável ensaiado, compatibilidade/janela aceitas, permissões/contas de smoke definidas e autorização específica para SQLs/deploy. Qualquer lacuna mantém **NO-GO**. Integração na main, publicação SQL e publicação frontend são estados distintos; J06 permanece fora deste trabalho.
