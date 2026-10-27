# Ensaios C02 P11/F6

Estas regras complementam o `AGENTS.md` da raiz somente para os ensaios C02.

- Após autorização para criar um ambiente Docker local descartável, a entrada
  padrão e exclusiva para P11/F6 cobertos é o launcher gerenciado, a partir da raiz:

  ```sh
  node scripts/codex/run-sanitario-c02-disposable.mjs --run-local p11
  node scripts/codex/run-sanitario-c02-disposable.mjs --run-local f6 integration
  ```

- Não criar esses fixtures por comandos Docker avulsos. O launcher usa uma
  execução/label/CID exclusivos, `--rm` e cleanup em sucesso, erro e cancelamento
  tratável. Não baixa imagens: a versão local necessária deve estar disponível.
- O harness `sanitario-c02-p11.local.mjs` continua aceitando um container externo
  autorizado. Recebê-lo por argumento não transfere sua propriedade: o harness
  fecha a conexão, mas nunca para ou remove esse recurso.
- Para novos harnesses C02 descartáveis, testar criação, execução e descarte
  completos, incluindo falha, timeout, cancelamento, concorrência e preservação
  de recursos externos. Não ampliar os modos cobertos sem revisar seu contrato.
- Preservar o diretório de diagnóstico indicado pelo launcher (`run.json`, CID
  e logs sanitizados). Após SIGKILL/crash/daemon indisponível, revalidar ID,
  ownership e dependências antes de qualquer recuperação manual autorizada.
- Não criar limpeza automática por prefixo, wildcard ou idade. O ledger não
  autoriza remover recursos de outra execução, processo, teste ou agente.
- `creation_indeterminate` não comprova ausência do container. Sem CID confirmado,
  preservar UUID/nome do ledger e verificar a label `com.rebanhosync.c02.run`
  antes de uma recuperação manual autorizada; nunca remover apenas pelo nome.
- O callback `run()` do helper deve cooperar com cancelamento. A CLI transmite
  o AbortSignal ao subprocesso; o helper não interrompe por conta própria um
  callback que fica pendurado ou que aborta o sinal e retorna sucesso.
- Estes comandos e instruções não autorizam limpar recursos preexistentes,
  descartar dados, alterar Supabase remoto ou publicar mudanças no repositório.
