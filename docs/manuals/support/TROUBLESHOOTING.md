# Troubleshooting — RebanhoSync

Atualizado em: 2026-11-21
**Baseline documental original:** `32d7779`

## Objetivo

Orientar a resolução de problemas comuns no RebanhoSync.

Use este documento para triagem inicial antes de acionar o suporte técnico.

---

## 1. Não consigo logar

Autenticar e ter acesso a uma fazenda são etapas diferentes. A pessoa pode criar conta/entrar sem vínculo e encontrar uma seleção vazia. A tela atual não oferece recuperação de senha; consulte a [FAQ de acesso](./FAQ_LOGIN.md#esqueci-minha-senha), sem recriar conta ou limpar dados locais por tentativa.

### Verifique
* Internet.
* E-mail.
* Senha.
* Serviço indisponível.
* Sessão expirada.
* Usuário vinculado à fazenda.

### Mensagens comuns

| Mensagem | Significado provável |
| :--- | :--- |
| **E-mail ou senha inválidos** | Credencial não aceita |
| **Não foi possível conectar** | Problema de rede/serviço |
| **Nenhuma fazenda vinculada** | Usuário sem acesso operacional |
| **Sessão expirada** | Precisa entrar novamente |

### Acionar suporte se:
* a credencial está correta;
* a internet está funcionando;
* a fazenda deveria aparecer;
* o erro persiste.

---

## 2. Minha fazenda não aparece

### Verifique
* Usuário correto.
* Conta correta.
* Convite/vínculo com fazenda.
* Permissão.
* Conexão.
* Troca de fazenda.

**Ação:** Solicitar ao administrador/proprietário que confira o acesso.

---

## 3. App está offline

### Verifique
* Internet do aparelho.
* Sinal no local.
* Wi-Fi / dados móveis.
* VPN / firewall.
* Modo avião.

> 💡 **Se já havia sessão:** O app pode mostrar dados locais.
> ⚠️ **Se for login novo:** Pode exigir conexão.

---

## 4. Registro ficou com sincronização pendente

### Verifique
* Conexão.
* Status de sync.
* Se há erro.
* Se a fazenda ativa está correta.
* Se a sessão expirou.

**Ação segura:** Não repetir operação crítica sem conferir se ela já está pendente.

**Acionar suporte se envolver:**
* venda;
* óbito;
* evento sanitário;
* baixa de estoque;
* movimentação;
* parto/cria.

---

## 5. Registro duplicou

### Possíveis causas
* duplo clique;
* retry;
* falha de rede;
* reenvio manual;
* problema de idempotência;
* sync parcial.

**Ação:** Não excluir manualmente sem entender o tipo de registro. Acionar suporte se for evento crítico.

---

## 6. Animal não aparece no lote/pasto

### Verifique
* Filtro.
* Fazenda ativa.
* Status do animal.
* Lote/pasto atual.
* Movimentação pendente.
* Sync pendente.
* Histórico de movimentação.

> 💡 **Observação:** O estado atual não é o histórico completo.

---

## 7. Agenda parece errada

### Verifique
* Data do dispositivo.
* Filtros.
* Itens concluídos.
* Itens reagendados.
* Protocolo que gerou agenda.
* Sync pendente.
* Fazenda ativa.

**Acionar suporte se:**
* o item duplicou;
* o item sumiu;
* a data está incorreta;
* a agenda sanitária não bate com o protocolo.

---

## 8. Evento sanitário não baixou estoque

### Verifique
* Produto foi selecionado.
* Lote de estoque foi selecionado.
* Quantidade/dose foi informada.
* Evento está sincronizado.
* Houve erro parcial.
* Estoque tinha saldo.

**Acionar suporte se:**
* a baixa duplicou;
* o evento existe sem baixa;
* a baixa existe sem evento;
* o custo ficou incorreto.

---

## 9. Carência sanitária parece incorreta

### Verifique
* Evento sanitário existe.
* Produto aplicado está correto.
* Data do evento está correta.
* Regra/snapshot de carência existe.
* Animal/lote correto.
* Sync completo.

> ⚠️ **Atenção:** Carência sanitária é um sinal. Não significa que a venda/abate está liberado.

---

## 10. Venda ou saída ficou incorreta

### Verifique
* Animal/lote correto.
* Data.
* Contraparte.
* Status atual.
* Sync pendente.
* Duplicidade.

**Ação:** Acionar suporte. Venda, saída e óbito são operações críticas e devem ser corrigidas com rastreabilidade.

---

## 11. Custo aparece como vazio

**Significado:** Custo vazio é custo não informado. Não é custo zero.

### Verifique
* Valor informado.
* Custo unitário.
* Custo total.
* Lote de estoque.
* Snapshot.
* Produto.

---

## 12. Dados aparecem na fazenda errada

**Ação imediata:** Parar novos registros.

### Verifique
* fazenda ativa;
* usuário logado;
* troca recente de fazenda;
* sync pendente;
* filtros.

> ⚠️ **Ação:** Acionar suporte. Dados cross-fazenda são risco crítico.

---

## 13. App mostra erro de permissão

### Possíveis causas
* usuário sem papel adequado;
* vínculo removido;
* fazenda errada;
* sessão expirada;
* RLS bloqueou a operação.

**Ação:** Solicitar acesso ao administrador ou acionar suporte.

---

## Bloco 1 — erro ao salvar, convite e configuração

Esta seção descreve o pacote validado localmente, ainda pendente de integração e publicação. Confira o [estado do projeto](../../context/PROJECT_STATUS.md#estado-atual).

| Sintoma | Ação suportada |
|---|---|
| Perfil não carregou | Use **Tentar carregar perfil** antes de salvar. Perfil vazio pela primeira vez pode ser ausência legítima; erro de carga não deve ser ignorado. |
| Erro ao salvar perfil | Confira conexão e mensagem; preserve o rascunho na tela. Anote antes de sair. Após sucesso, reabra para conferir o valor. |
| Horário de silêncio recusado | Habilitado exige início/fim válidos e diferentes. Intervalo 22:00–06:00 é válido; igual não significa 24 horas. |
| Fazenda alterada ou acesso mudou | Anote sua intenção, recarregue e confira os valores atuais antes de refazer a alteração; não repita o envio antigo indefinidamente. |
| Opção de segurança indisponível | Confira fazenda e papel: gerente não altera as opções exclusivas de proprietário; papel de outra fazenda não se transfere. |
| Convite inválido/expirado/utilizado | Confira a conta e validade; solicite novo link quando necessário. Após remoção, precisa de convite emitido depois do desligamento. |
| Telefone do Perfil não permite aceitar | Telefone de contato não comprova número confirmado; solicite convite para seu email confirmado. |
| Não recebi mensagem após gerar link | Gerar convite não envia mensagem automática. O responsável deve compartilhar o link com o destinatário. |
| Configuração salva, efeito não apareceu | Confira fazenda, escopo pessoal/da fazenda e condições do fluxo. Preferência de aviso não prova entrega; regra de estágio não comprova manejo executado. |
| Em dia junto de ausência de confirmação | O indicador geral não substitui confirmação específica da operação. Confira as pendências e a mensagem da tela antes de repetir registros. |

Não use reset, limpeza de IndexedDB ou recriação da conta como solução genérica. Se persistir, encaminhe as informações abaixo ao suporte, sem senha, tokens ou exposição de dados pessoais desnecessários.

## 14. O que informar ao suporte

**Enviar:**
* usuário/e-mail;
* fazenda ativa;
* data/hora aproximada;
* tela;
* ação realizada;
* mensagem exibida;
* se estava offline;
* se havia sync pendente;
* animal/lote envolvido;
* print, se possível.

**Não enviar:**
* senha;
* token;
* dados sensíveis desnecessários.

---

## Checklist rápido

Antes de acionar suporte, verificar:

- [ ] Internet.
- [ ] Usuário correto.
- [ ] Fazenda correta.
- [ ] Filtros da tela.
- [ ] Sync pendente.
- [ ] Sessão expirada.
- [ ] Item duplicado ou apenas filtrado.
- [ ] Operação foi salva localmente ou sincronizada.
- [ ] Há mensagem de erro visível.

---

## Critério de escalonamento

Escalar imediatamente se envolver:

* dados em fazenda errada;
* venda;
* óbito;
* abate;
* baixa de estoque duplicada;
* evento sanitário crítico;
* carência sanitária incorreta;
* duplicidade de animal;
* perda aparente de histórico;
* conflito não resolvido.
