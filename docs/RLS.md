# Row Level Security (RLS) & Roles

O sistema utiliza RLS do Supabase para garantir que usuários acessem apenas dados de fazendas onde possuem membership ativo.

## Roles (Papéis)
1.  **Cowboy:** Operador de campo. Pode ler tudo da fazenda, inserir eventos e atualizar o status de itens da agenda (concluir tarefas). Não pode alterar o cadastro base (animais, lotes, pastos).
2.  **Manager:** Gestor da fazenda. Possui todas as permissões do Cowboy, além de poder criar/editar animais, lotes, pastos e protocolos.
3.  **Owner:** Dono da conta. Possui todas as permissões do Manager e é o único que pode gerenciar membros (adicionar/remover usuários) via RPC.

## Funcionamento das Policies
- **Leitura:** Baseada na função `has_membership(fazenda_id)`. Se o `auth.uid()` não estiver na tabela `user_fazendas` para aquela fazenda, o acesso é negado.
- **Escrita (State):** Restrita a `role in ('owner', 'manager')`.
- **Escrita (Eventos):** Permitida para todos os membros ativos.
- **Membership:** Bloqueada para `INSERT/UPDATE` direto via API. Alterações devem ser feitas via RPC `admin_set_member_role` (Security Definer), que valida se o chamador é o `owner`.