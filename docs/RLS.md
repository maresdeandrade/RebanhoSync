# Modelo de Segurança e RLS

> **Status:** Normativo
> **Fonte de Verdade:** SQL Policies (PostgreSQL)
> **Última Atualização:** 2026-02-15

Este documento define as regras de Row Level Security (RLS) e Controle de Acesso (RBAC).

---

## 1. Princípio de Isolamento

- **Tenancy:** Toda tabela de negócio possui `fazenda_id`.
- **Integridade:** Foreign Keys sempre compostas `(id, fazenda_id)` quando possível.
- **Visibilidade:** Policies forçam `fazenda_id` na cláusula `WHERE` via helper `has_membership(fazenda_id)`.

---

## 2. Matriz RBAC

| Recurso       | Ação           | Owner | Manager | Cowboy |
| :------------ | :------------- | :---: | :-----: | :----: |
| **Fazenda**   | Update/Delete  |  ✅   |   ❌    |   ❌   |
| **Membros**   | Gerenciar      |  ✅   |   ⚠️    |   ❌   |
| **Estrutura** | Pastos, Lotes  |  ✅   |   ✅    |   ❌   |
| **Cadastros** | Contrapartes   |  ✅   |   ✅    |   ❌   |
| **Animais**   | CRUD           |  ✅   |   ✅    |   ✅   |
| **Operação**  | Eventos/Agenda |  ✅   |   ✅    |   ✅   |

> **Nota:** A escrita em `animais` é permitida para Cowboys para agilidade, mas o `DELETE` pode ser restrito futuramente.

---

## 3. Policies por Categoria

### Tabelas de Sistema

- `user_profiles`, `user_settings`: Acesso **Self Only** (`user_id = auth.uid()`).
- `user_fazendas`: **Members View** (vê a si mesmo e colegas da mesma fazenda).

### Tabelas de Negócio

- **Leitura:** Permitida para qualquer membro ativo da fazenda.
- **Escrita:** Depende do Role (ver Matriz RBAC). Geralmente Owner/Manager para estrutura, todos para operação diária.

---

## 4. RPCs Administrativas (Security Definer)

Funções que bypassam RLS para operações privilegiadas (mas validam permissões via código):

- `admin_set_member_role`: Apenas Owner (ou Manager promovendo Cowboy).
- `admin_remove_member`: Apenas Owner.
- `create_fazenda`: Aberto (cria novo tenant e torna caller Owner).
- `create_invite`: Owner ou Manager.

---

## 5. Mitigações de Segurança

- **Anti-Teleporte:** Validado no Sync Batch (Server-Side).
- **Imutabilidade:** Trigger `prevent_business_update` em tabelas de eventos.
- **SQL Injection:** Uso estrito de PL/pgSQL com parâmetros tipados.

---

## Veja Também

- [**ARCHITECTURE.md**](./ARCHITECTURE.md)
- [**DB.md**](./DB.md)
- [**CONTRACTS.md**](./CONTRACTS.md)
