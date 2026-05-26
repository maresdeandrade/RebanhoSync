-- Phase 4A: Index JSONB for sanitary_completion (F5)
-- Optimizes lookups on sanitary_completion_key during recompute.

create index concurrently if not exists idx_eventos_sanitario_completion_key
  on public.eventos_sanitario ((payload #>> '{sanitary_completion,sanitary_completion_key}'))
  where payload #>> '{sanitary_completion,sanitary_completion_key}' is not null
    and deleted_at is null;
