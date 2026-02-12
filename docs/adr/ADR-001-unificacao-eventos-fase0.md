# ADR-001: Unificacao de Eventos - Decisoes de Fase 0

Data: 2026-02-11
Status: Aprovado (baseline tecnico)

## Contexto

Havia divergencias entre:

1. Documentacao de analise de eventos.
2. Tipagens offline (`src/lib/offline/types.ts`).
3. Schema real no banco (`supabase/migrations/0001_init.sql`).

Essas divergencias elevam risco de:

1. Erros de contrato no sync.
2. Rejeicoes inconsistentes entre dominios.
3. Evolucao de schema sem previsibilidade.

## Decisao

Adotar abordagem `schema-first` para a unificacao de eventos.

### Decisoes concretas da Fase 0

1. Fonte de verdade dos campos: migrations SQL.
2. Matriz canonica criada em `docs/MATRIZ_CANONICA_EVENTOS_SCHEMA.md`.
3. Tipos offline alinhados ao schema real:
   1. `Evento` agora inclui `source_tx_id` e `source_client_op_id`.
   2. `Evento` inclui `occurred_on` (opcional no cliente, gerado no banco).
   3. `EventoFinanceiro` inclui `server_received_at`.
   4. Campos sem respaldo no schema foram removidos de interfaces (`AgendaItem.observacoes`, `Contraparte.observacoes`).
4. Nomenclatura de papel padronizada para `owner|manager|cowboy` (sem `admin` no tenant role).
5. Recorte de implantacao:
   1. MVP: unificacao do caminho de criacao/leitura e hardening minimo.
   2. Pos-MVP: envelope v2 (`schema_version`, `correlation_id`, etc.) e outbox.

## Consequencias

Positivas:

1. Reduz drift entre cliente e banco.
2. Diminui ambiguidade na implementacao da Fase 1 e 2.
3. Facilita validacao automatica schema vs tipos.

Trade-offs:

1. Parte dos campos desejados nos docs (ex.: sanitario expandido) permanece em `payload` no MVP.
2. Algumas melhorias estruturais ficam explicitamente para Pos-MVP.

## Proximos passos vinculados

1. Executar Fase 1 com factory unica e validadores por dominio.
2. Executar Fase 2 com constraints/FKs e padronizacao de `reason_code`.
3. Criar check de CI para comparar schema e interfaces offline.

