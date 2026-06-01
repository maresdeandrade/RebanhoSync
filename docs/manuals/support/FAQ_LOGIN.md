```md
# FAQ — Login e Acesso

Atualizado em: 2026-05-31

## Objetivo

Responder dúvidas comuns sobre login, senha, sessão, fazenda ativa e permissões.

---

## Não consigo entrar. O que verificar?

Verifique:
1. Se o e-mail está correto.
2. Se a senha está correta.
3. Se há internet.
4. Se o serviço está disponível.
5. Se a conta tem vínculo com alguma fazenda.

---

## O app diz “E-mail ou senha inválidos”. O que significa?

Significa que a credencial informada não foi aceita.

> 💡 **Nota:** Por segurança, o app não deve informar se o problema foi no e-mail ou na senha.

---

## O app diz que não conseguiu conectar. É senha errada?

Não necessariamente. Pode ser:
- internet indisponível;
- Supabase/Auth indisponível;
- bloqueio de rede;
- sessão expirada;
- erro temporário.

---

## Consigo usar o app offline sem login?

Depende.

Para novo login, normalmente precisa de conexão. Se já havia sessão salva no dispositivo, o app pode permitir acesso aos dados locais conforme o fluxo implementado.

---

## Minha sessão expirou. Perdi meus dados?

Não deveria.

A sessão expirada exige novo login para continuar sincronizando. Alterações locais pendentes não devem ser apagadas automaticamente.

---

## Entrei, mas minha fazenda não aparece

**Possíveis causas:**
- usuário não foi vinculado à fazenda;
- vínculo foi removido;
- permissão ainda não foi configurada;
- erro de carregamento;
- internet indisponível;
- cache antigo.

**Ação:**
- conferir conexão;
- tentar recarregar;
- solicitar acesso ao administrador/proprietário;
- acionar suporte se persistir.

---

## Tenho mais de uma fazenda. Como funciona?

O app deve pedir a seleção da fazenda ativa. A fazenda ativa define o contexto operacional.

> ⚠️ **Regra:** Dados de uma fazenda não devem aparecer misturados com outra.

---

## Posso trocar de fazenda?

Sim, se o usuário tiver acesso a mais de uma fazenda. Ao trocar, o app deve recarregar o contexto e os dados da fazenda selecionada.

---

## O app diz “sem permissão”. O que fazer?

Solicite acesso ao administrador da fazenda. A interface (UI) pode orientar, mas a permissão real depende de Auth/RLS/vínculo com a fazenda.

---

## Esqueci minha senha

Use a opção “Esqueci minha senha”.

> 💡 **A mensagem correta é neutra:** `"Se o e-mail estiver cadastrado, enviaremos instruções de recuperação."`

---

## O que não deve aparecer para o usuário?

O app **não** deve exibir:
- token;
- JWT;
- refresh token;
- `service_role`;
- detalhes internos de RLS;
- stack trace;
- payload sensível.

---

## Quando acionar suporte?

Acione o suporte se:
- o login falhar mesmo com internet;
- a fazenda não aparecer;
- aparecer a fazenda errada;
- a sessão expirar repetidamente;
- a troca de fazenda misturar dados;
- o usuário tiver permissão, mas o app bloquear o acesso;
- a recuperação de senha não chegar após tentativas adequadas.

```