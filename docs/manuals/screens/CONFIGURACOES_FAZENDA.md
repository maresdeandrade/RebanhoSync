# Configurações da fazenda

Atualizado em: 2026-11-21

**Disponibilidade:** descreve o Bloco 1 validado localmente, ainda pendente de integração e publicação. Consulte o [estado do projeto](../../context/PROJECT_STATUS.md#estado-atual).

## Para que serve e onde encontrar

Abra **Configuracoes** no menu ou no menu do nome da fazenda no cabeçalho. A tela **Regras e parametros operacionais** reúne unidade de peso e regras de estágio. Os parâmetros são da fazenda selecionada; não são preferências pessoais.

Para identificação, localização, modo da aplicação e opções de segurança, use **Editar cadastro da fazenda** ou **Editar fazenda**. Confira sempre o nome da propriedade antes de salvar.

## Quem pode usar

Proprietário (Owner) e gerente (Manager) podem editar as configurações permitidas. Operador (Cowboy) consulta, sem essa escrita administrativa. As opções **Validacao forte** e **Movimentacao consistente**, na edição da fazenda, exigem proprietário ativo daquela propriedade mesmo que outra tela ou aba esteja aberta.

## Como alterar a unidade de peso

1. Em **Unidade de peso da fazenda**, confira **Atual**.
2. Selecione **Quilograma (kg)** ou **Arroba**.
3. Use **Salvar unidade** e aguarde **Unidade de peso atualizada.**
4. Reabra a tela para conferir o valor salvo, se necessário.

A unidade orienta a apresentação e os controles que a utilizam; escolher Arroba não cria pesagem nem substitui uma medição registrada.

## Como consultar categorias e regras de estágio

A seção **Categorias zootecnicas** apresenta categorias por sexo. A seção **Regras de estagio de vida** permite revisar marcos de idade/peso e a **Base principal**, por **Idade** ou **Peso**. Os valores iniciais são padrões do aplicativo; não são recomendação universal para todas as raças, produções e sistemas.

Para alterar, confira a unidade, os marcos iniciais e os marcos de machos/fêmeas. Use **Salvar regras** para gravar. **Reverter** volta o formulário à configuração carregada; não é restauração geral de dados do rebanho. Não preencha um valor apenas para eliminar um aviso sem avaliar sua pertinência operacional.

## Como interpretar os modos de transição

| Opção | Efeito e limite |
|---|---|
| Manual | A avaliação pode sugerir estágio; o modo não autoriza autoaplicação da transição. |
| Híbrido | Pode admitir autoaplicação de transições somente por idade quando **Autoaplicar marcos por idade no modo hibrido** está habilitado e há evidência suficiente. |
| Automático | Pode admitir autoaplicação quando existe evidência suficiente e uma transição elegível; não é garantia de mudança imediata de todos os animais. |

Um animal pode ter modo próprio que prevalece sobre o padrão da fazenda. Salvar regras não comprova manejo executado, cria Evento histórico nem conclui tarefa da Agenda. A aplicação a animais e os efeitos operacionais pertencem aos fluxos desses módulos, que não foram reexecutados pelo Bloco 1.

## Opções avançadas e perfil produtivo

**Modo essencial** altera a experiência da aplicação na fazenda. Modo Completo do aplicativo não significa sistema produtivo de ciclo completo. Corte, Leite e Mista são outro atributo; não determinam automaticamente cria, recria ou engorda.

As opções de segurança são controles avançados de validação dos registros. Não as altere como tentativa genérica de resolver um erro de manejo ou permissão; confira a mensagem e procure o responsável. Ser proprietário de outra fazenda não dá autoridade sobre esta.

## Como confirmar e resolver falhas

Confira a mensagem específica de sucesso e o valor apresentado após reabrir a tela. Essa gravação precisa de confirmação remota; indicador geral **Em dia** não é comprovante desse salvamento.

Se outra gravação ocorreu desde a abertura, o aplicativo rejeita a versão antiga e orienta recarga. Anote sua intenção, recarregue, confira os valores atuais e refaça somente o necessário. A proteção preserva mudanças concorrentes das flags e demais chaves; não repita um envio antigo como se tivesse sido aceito.

Em erro de permissão, confira a fazenda e seu papel. Em falha de rede, mantenha o formulário aberto enquanto verifica a conexão; não há promessa de envio posterior automático para esses salvamentos. Consulte a [solução de problemas](../support/TROUBLESHOOTING.md).

## Limitações

Rascunhos podem ser perdidos ao navegar, recarregar ou trocar de fazenda. Uma configuração salva não garante classificação adequada para todo animal nem conformidade sanitária/comercial. O Bloco 1 validou configurações e persistência, sem executar as jornadas operacionais futuras.
