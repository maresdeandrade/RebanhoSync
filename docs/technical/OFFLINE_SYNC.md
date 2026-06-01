```markdown
# Offline Sync — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir o contrato técnico para comportamento offline-first, sync, rollback e reconciliação local-remota.

---

## Princípios

* **Local-first:** A operação deve funcionar localmente primeiro quando aplicável.
* **Idempotência:** Toda sincronização deve ser estritamente idempotente.
* **Integridade:** Lógicas de retry nunca podem duplicar eventos, itens de agenda ou baixas de insumos.
* **Tratamento de Falhas:** Falhas parciais devem ser tratadas de forma explícita e reconciliável.
* **Determinismo:** O rollback deve ser determinístico quando houver operação otimista.
* **Isolamento:** O estado local não pode, sob circunstância alguma, violar o isolamento multi-tenant por `fazenda_id`.

---

## Conceitos

### 1. Gesture
Representa uma ação operacional isolada do usuário.  
*Diretriz:*
```txt
1 ação operacional ──> 1 gesture idempotente

```

### 2. Queue (Fila Local)

Fila local de operações pendentes de envio. Deve preservar obrigatoriamente:

* Ordem cronológica e de dependência necessária;
* Payload de dados original;
* Metadados de controle;
* Status atual do processamento;
* Contador de tentativas de retry;
* Registro detalhado de erros;
* Vínculo com snapshots de rollback quando aplicável.

### 3. Before Snapshot

Cópia do estado anterior à execução local. É de uso **obrigatório** sempre que uma operação otimista alterar o estado local antes da confirmação do servidor remoto.

### 4. Reconcile

Processo que compara o resultado do processamento remoto com o estado local e ajusta divergências.

> ⚠️ **Restrição:** Nunca apague ou mascare erros silenciosamente durante a reconciliação.

---

## Contratos Operacionais

### Idempotência

Uma operação repetida em decorrência de retry deve resultar obrigatoriamente em:

1. Mesmo efeito final no estado do sistema; ou
2. Rejeição segura por duplicidade já conhecida.

*Garantia: Nunca deve gerar duplicidade operacional ou registros concorrentes.*

### Rollback

Mecanismo de reversão que atua quando a operação falha na ponta remota. Deve:

* Restaurar integralmente o estado anterior do banco local;
* Preservar a trilha e o log do erro original;
* Expor explicitamente falhas parciais;
* Impedir o travamento ou quebra da fila local;
* Evitar a geração de novos fatos históricos falsos ou artificiais.

### Sucesso Parcial

Cenários de sucesso parcial devem ser tratados como estados explícitos do fluxo. Jamais assuma que a transação inteira foi concluída se apenas uma fração do lote foi aceita pelo servidor.

### Pull Seletivo

A busca e atualização de dados remotos deve respeitar estritamente:

* O escopo do `fazenda_id` ativo;
* As permissões e papéis do usuário autenticado;
* Timestamps de controle e versionamento de registros;
* Tabelas explicitamente autorizadas;
* A integridade dos read models locais.

---

## Fronteiras de Fonte de Verdade

| Pergunta Operacional | Fonte Correta de Verdade |
| --- | --- |
| O que foi executado? | Tabelas de `eventos` + tabelas de detalhes (`detail tables`). |
| O que está planejado/pendente? | Itens de `agenda` abertos. |
| Qual é o estado atual do ecossistema? | Tabelas e views de read model `state_*`. |
| Qual regra gera novas tarefas? | Modelos de `protocolo` / configurações estáticas. |
| Qual sinal visual exibir na interface? | Camadas de `tags/sinais/insights` (apenas como auxiliares de UX). |

---

## Riscos Operacionais e Técnicos

* Duplicação indesejada de eventos históricos durante retries automáticos;
* Conclusão de itens de agenda sem o registro do evento real correspondente;
* Rollbacks parciais defeituosos que deixam o estado local corrompido ou incoerente;
* Travamento da fila local (`queue`) sem feedback visual ou tratamento para o usuário;
* Duplicação em baixa de insumos ou lançamentos de estoque;
* Sincronização aceitar ou processar payloads com dados cruzados entre fazendas (*cross-tenant*);
* Divergência persistente e falta de reconciliação entre o read model local e o banco remoto.

---

## Diretrizes de Validação Mínima

### Para patches puramente locais:

```bash
rtk pnpm test -- caminho/do/teste.test.ts

```

### Para alterações amplas na arquitetura de sync/offline:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

### Se a alteração envolver sync-batch, RLS ou contratos do Supabase:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

```

```