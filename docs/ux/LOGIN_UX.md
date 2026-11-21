# Login UX — RebanhoSync

Atualizado em: 2026-11-21
**Baseline documental original:** `32d7779`

## Implementação J01–J05 e limites atuais

Cadastro, login, seleção/criação de fazenda e continuidade de convite foram observados nas jornadas locais. O cadastro exige Nome, E-mail, Telefone, Senha e Confirmar Senha; telefone de cadastro é contato editável, sem comprovação de número confirmado. Confirmação de email depende do ambiente; criar conta não cria fazenda nem aceita convite.

J04 interpreta a prévia tabular do convite, distingue estados inválidos/expirados/utilizados, oferece retry e mantém ação explícita de aceitar após login/cadastro. O servidor exige destinatário confirmado; Perfil não altera identidade. Na tela atual **não existe ação de recuperação de senha**. O fluxo de recovery descrito abaixo é referência de UX candidata, não funcionalidade entregue.

A fazenda ativa aparece no cabeçalho e pode ser trocada; a confirmação geral de descarte de rascunho ainda não está implementada. As diretrizes normativas abaixo não provam disponibilidade universal. [Manual atual](../manuals/screens/PRIMEIRO_ACESSO.md), [equipe](../manuals/screens/EQUIPE_CONVITES.md) e [estado local/remoto](../context/PROJECT_STATUS.md#estado-atual).

## Objetivo

Definir o comportamento de UX para login, sessão, logout, recuperação de acesso, usuário sem fazenda, múltiplas fazendas e erros de autenticação/conexão.

Este documento trata de experiência e mensagens.  
Autorização real, RLS e isolamento multi-tenant ficam em `docs/technical/SUPABASE_RLS.md`.

---

## Princípios

- Login deve ser simples.
- Erros devem ser claros.
- Problema de rede não deve parecer senha errada.
- Usuário sem fazenda deve receber orientação.
- Múltiplas fazendas devem ser explicitamente selecionadas.
- Sessão expirada deve preservar dados locais quando possível.
- UI não é fronteira de autorização.

---

## Fluxo principal

```txt
Abrir app
→ Verificar sessão local
→ Se sessão válida: carregar fazenda ativa
→ Se sem sessão: exibir login
→ Após login: carregar vínculos de fazenda
→ Se uma fazenda: entrar
→ Se múltiplas: selecionar fazenda
→ Se nenhuma: mostrar estado "sem fazenda"
```

---

## Tela de login

Campos mínimos:

- e-mail;
- senha.

Ações:

- Entrar;
- recuperação de senha como evolução candidata; a tela atual não oferece essa ação;
- Criar conta, se habilitado;
- Ver estado de conexão, se relevante.

---

## Mensagens de login

### Credencial inválida

```txt
E-mail ou senha inválidos.
```

Não dizer qual campo está errado.

### Rede indisponível

```txt
Não foi possível conectar agora. Verifique sua internet.
```

### Supabase/Auth indisponível

```txt
Serviço de autenticação indisponível no momento.
```

### Campo obrigatório

```txt
Informe o e-mail.
Informe a senha.
```

### Formato inválido

```txt
Informe um e-mail válido.
```

---

## Sessão existente

Ao abrir app com sessão local válida:

```txt
Carregando sua fazenda.
```

Se os dados locais estiverem disponíveis e a conexão falhar:

```txt
Você está offline. Exibindo dados salvos neste dispositivo.
```

---

## Sessão expirada

Quando a sessão expirar:

```txt
Sua sessão expirou. Entre novamente para continuar sincronizando.
```

Se houver dados locais pendentes:

```txt
Há alterações locais pendentes. Elas não serão apagadas ao entrar novamente.
```

### Regra

Não apagar dados locais automaticamente por sessão expirada.

---

## Logout

Antes de sair, se houver sync pendente:

```txt
Há alterações pendentes de sincronização neste dispositivo.
```

Ações:

- Continuar no app;
- Sair mesmo assim.

Copy cautelosa:

```txt
Sair não deve apagar dados locais, mas alterações pendentes só serão sincronizadas após novo acesso.
```

---

## Usuário sem fazenda

Quando o usuário autenticado não tem vínculo com fazenda:

```txt
Nenhuma fazenda vinculada a este usuário.
```

Subcopy:

```txt
Solicite acesso ao proprietário ou administrador da fazenda.
```

Não mostrar app operacional sem fazenda ativa.

---

## Múltiplas fazendas

Quando houver mais de uma fazenda:

```txt
Selecione a fazenda para continuar.
```

A fazenda ativa deve ficar visível na UI após entrada.

Troca de fazenda deve:

- confirmar alteração;
- limpar contexto visual da fazenda anterior;
- recarregar dados locais/remotos da fazenda selecionada;
- respeitar isolamento por `fazenda_id`.

---

## Sem permissão

Quando o usuário não tem permissão para uma ação:

```txt
Você não tem permissão para realizar esta ação.
```

Não detalhar internamente policy/RLS.

Quando útil:

```txt
Solicite acesso ao administrador da fazenda.
```

---

## Offline no login

Login novo geralmente exige conexão.

Copy:

```txt
É necessário estar online para entrar.
```

Se sessão local já existe:

```txt
Você está offline. Entrando com sessão salva neste dispositivo.
```

### Regra

Não prometer login offline se não houver sessão local válida.

---

## Recuperação de senha

Referência candidata, não implementada na tela atual. Fluxo a considerar somente em tarefa própria:

```txt
Informar e-mail
→ Enviar instruções
→ Mostrar confirmação neutra
```

Copy:

```txt
Se o e-mail estiver cadastrado, enviaremos instruções de recuperação.
```

Não revelar se o e-mail existe.

---

## Primeiro acesso

Se habilitado:

```txt
Crie sua conta para acessar a fazenda.
```

Mas acesso à fazenda deve depender de vínculo/permissão.

Não assumir que criar conta cria fazenda automaticamente, salvo fluxo específico.

---

## Erros que não devem ser confundidos

| Situação | Mensagem |
|---|---|
| Senha errada | E-mail ou senha inválidos. |
| Sem internet | Não foi possível conectar agora. |
| Sem fazenda | Nenhuma fazenda vinculada a este usuário. |
| Sem permissão | Você não tem permissão para realizar esta ação. |
| Sessão expirada | Sua sessão expirou. Entre novamente. |
| RLS bloqueou operação | Você não tem permissão ou a fazenda ativa não permite esta operação. |

---

## Segurança de UX

Não exibir:

- token;
- JWT;
- refresh token;
- detalhes internos de policy;
- `service_role`;
- payload sensível;
- stack trace.

Detalhes técnicos podem ir para logs internos, não para o usuário final.

---

## Relação com RLS

A UX pode orientar, mas não autoriza.

Autorização real deve ser protegida em:

- Supabase Auth;
- RLS;
- memberships;
- roles;
- policies;
- RPCs;
- validações de `fazenda_id`.

Referência:

- `docs/technical/SUPABASE_RLS.md`

---

## Edge cases

Verificar:

- usuário com sessão local e sem internet;
- usuário sem fazenda;
- usuário removido de uma fazenda;
- usuário com fazenda ativa deletada/inativa;
- troca de fazenda com dados pendentes;
- sessão expirada durante registro;
- erro de sync após login;
- credencial inválida;
- Supabase indisponível;
- redirect loop;
- cache antigo de fazenda ativa.

---

## Critério de aceite

O fluxo de login é aceitável quando:

- diferencia erro de credencial e erro de rede;
- não revela dados sensíveis;
- não permite app sem fazenda ativa;
- mostra claramente sessão expirada;
- preserva dados locais quando possível;
- não usa UI como autorização real;
- respeita RLS e `fazenda_id`;
- orienta usuário sem fazenda/permissão.