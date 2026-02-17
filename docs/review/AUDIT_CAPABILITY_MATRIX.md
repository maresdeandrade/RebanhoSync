# Matriz de Capacidade e Auditoria (Derivado)

- Status: Derivado
- Baseline: 0bb8829
- Última Atualização: 2024-03-24
- Derivado por: Antigravity Regen vNext Consolidado — Rev D

## Legenda
- ✅ **Permitido:** RLS permite e UI expõe.
- ❌ **Bloqueado:** RLS bloqueia (e UI deve esconder).
- ⚠️ **Risco:** RLS permite mas UI esconde (segurança por obscuridade), ou RLS bloqueia mas UI tenta (erro).
- 🔄 **Sistema:** Executado pelo servidor/sistema (não aplicável a role direto).

## Matriz de Permissões (Roles x Capabilities)

| Capability / Recurso | Owner | Manager | Cowboy | Evidência RLS/UI |
| :--- | :---: | :---: | :---: | :--- |
| **sanitario.registro** | ✅ | ✅ | ✅ | `eventos_sanitario` INSERT policy (todos membros) |
| **sanitario.historico** | ✅ | ✅ | ✅ | `eventos_sanitario` SELECT policy (todos membros) |
| **pesagem.registro** | ✅ | ✅ | ✅ | `eventos_pesagem` INSERT policy (todos membros) |
| **pesagem.historico** | ✅ | ✅ | ✅ | `eventos_pesagem` SELECT policy (todos membros) |
| **nutricao.registro** | ✅ | ✅ | ✅ | `eventos_nutricao` INSERT policy (todos membros) |
| **nutricao.historico** | ✅ | ✅ | ✅ | `eventos_nutricao` SELECT policy (todos membros) |
| **movimentacao.registro** | ✅ | ✅ | ✅ | `eventos_movimentacao` INSERT policy (todos membros) |
| **movimentacao.historico** | ✅ | ✅ | ✅ | `eventos_movimentacao` SELECT policy (todos membros) |
| **reproducao.registro** | ✅ | ✅ | ✅ | `eventos_reproducao` INSERT policy (todos membros) |
| **reproducao.historico** | ✅ | ✅ | ✅ | `eventos_reproducao` SELECT policy (todos membros) |
| **financeiro.registro** | ✅ | ✅ | ✅ | `eventos_financeiro` INSERT policy (todos membros) |
| **financeiro.historico** | ✅ | ✅ | ✅ | `eventos_financeiro` SELECT policy (todos membros) |
| **agenda.concluir** | ✅ | ✅ | ✅ | `agenda_itens` UPDATE policy (todos membros) |
| **agenda.gerar** | 🔄 | 🔄 | 🔄 | Trigger/Function (System) |
| **lotes.manage** | ✅ | ✅ | ❌ | `lotes` INSERT/UPDATE restrito a owner/manager |
| **pastos.manage** | ✅ | ✅ | ❌ | `pastos` INSERT/UPDATE restrito a owner/manager |
| **protocolos.manage** | ✅ | ✅ | ❌ | `protocolos_*` INSERT/UPDATE restrito a owner/manager |
| **contrapartes.manage** | ✅ | ✅ | ❌ | `contrapartes` INSERT/UPDATE restrito a owner/manager |
| **members.manage** | ✅ | ❌ | ❌ | RPC `admin_*` restrito a owner |
| **fazenda.edit** | ✅ | ❌ | ❌ | `fazendas` UPDATE restrito a owner |

## Notas de Auditoria
1. **Cowboy Financeiro**: Atualmente Cowboys podem registrar eventos financeiros (compra/venda) e ver histórico financeiro. Se isso não for desejado, é necessário ajustar RLS de `eventos_financeiro`.
2. **Delete/Update Eventos**: Bloqueado para TODOS os roles via trigger `prevent_business_update` (Append-Only).
