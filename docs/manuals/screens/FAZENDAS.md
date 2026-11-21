# Fazendas e contexto das operações

Atualizado em: 2026-11-21

**Disponibilidade:** orientação para o Bloco 1 validado localmente, ainda pendente de integração e publicação. Consulte o [estado do projeto](../../context/PROJECT_STATUS.md#estado-atual).

## Para que serve e onde encontrar

A fazenda ativa define a propriedade consultada ou afetada nas telas operacionais. Seu nome aparece no cabeçalho. Selecione esse nome para abrir **Fazenda atual**, com **Trocar fazenda**, **Configuracoes** e **Editar fazenda**. **Meu Perfil** também oferece **Trocar de fazenda**.

No celular, o cabeçalho pode abreviar nomes longos. Antes de registrar ou alterar dados, confira a propriedade selecionada e a tela aberta. Perfil e preferências pessoais têm outro escopo, explicado no [capítulo correspondente](./PERFIL_PREFERENCIAS.md).

## Quem pode usar

Você pode selecionar as propriedades às quais possui acesso. Seu papel pode mudar entre fazendas: ser gerente em uma não torna você gerente ou proprietário das demais.

| Papel mostrado em algumas telas | Significado neste fluxo |
|---|---|
| Owner / Proprietário | Edita cadastro e configurações da própria fazenda e administra suas opções protegidas. |
| Manager / Gerente | Edita os dados e configurações permitidos, sem alterar as flags exclusivas de proprietário. |
| Cowboy / Operador | Consulta o contexto e usa ações autorizadas de sua rotina; não edita o cadastro/configurações administrativas nem cria lançamentos financeiros gerenciais. |

A disponibilidade de uma ação na tela não substitui a conferência de permissão pelo serviço.

## Como alternar entre fazendas

1. Confira se há preenchimento ainda não salvo. A troca pode descartar o rascunho.
2. Abra o nome da fazenda no cabeçalho e selecione **Trocar fazenda**.
3. Em **Escolha a fazenda**, confira nome, localização e papel apresentados no cartão.
4. Selecione o cartão da propriedade desejada e aguarde a abertura do contexto.
5. Confira novamente o nome no cabeçalho antes de continuar.

Se uma propriedade esperada não aparecer, confira a conta usada, conexão e vínculo com a equipe. Uma troca visual correta não certifica que todas as operações anteriores já foram sincronizadas.

## Como criar outra propriedade

Na seleção de fazendas, use **Criar nova fazenda** se sua conta tiver essa permissão. Siga o [primeiro acesso](./PRIMEIRO_ACESSO.md#como-criar-a-primeira-fazenda). A autorização para criar é da conta e não decorre automaticamente do papel na propriedade atualmente aberta.

## Como editar os dados

1. Selecione a fazenda e abra **Editar fazenda** pelo cabeçalho ou por Configurações.
2. Confira e altere os dados cadastrais permitidos ao seu papel.
3. Confira o **Modo essencial** e as opções avançadas somente se precisar alterar o comportamento da aplicação nessa fazenda. **Validacao forte** e **Movimentacao consistente** são exclusivas de proprietário.
4. Selecione **Salvar fazenda**. Na gravação bem-sucedida, o fluxo retorna à Home.
5. Reabra a edição para conferir o valor persistido, se necessário.

O cadastro oferece campos opcionais; não preencha valores fictícios para completar a tela. Para unidade de peso e regras de estágio, use o [guia de configurações](./CONFIGURACOES_FAZENDA.md).

## Se ocorrer erro ou alteração concorrente

Se aparecer **Recarregue os dados antes de salvar novamente**, outra gravação ou uma mudança de acesso pode ter ocorrido. Anote o que pretendia alterar, recarregue, confira os valores atuais e refaça apenas a alteração necessária. Não repita indefinidamente o mesmo envio antigo.

Se a operação for negada, confira o papel nessa propriedade e solicite auxílio ao proprietário. Não suponha que o papel de outra fazenda se aplica aqui.

## Limitações e confirmação

Abas diferentes podem manter contextos visuais próprios até recarga. Confira o cabeçalho em cada aba. Rascunhos não têm recuperação geral garantida. O indicador de sincronização não substitui a confirmação específica de um salvamento remoto.

[Referência visual da edição](../images/block1/edit-desktop.png): versão local atual com propriedade sintética. As jornadas validaram contextos e permissões delimitados, sem certificar todos os módulos ou dispositivos físicos.
