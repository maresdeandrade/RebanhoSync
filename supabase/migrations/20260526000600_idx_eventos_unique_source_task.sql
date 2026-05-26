-- Layer 2: Prevent double-write race condition.
-- If the RPC `sanitario_complete_agenda_with_event` commits but the response
-- is lost (network timeout), the client may fall back to the offline path and
-- create a second event gesture with the same source_task_id. This unique
-- partial index ensures the database rejects the duplicate at sync time.
--
-- The index is partial: only active (non-deleted) events with a non-null
-- source_task_id are covered. This allows soft-deleted events and events
-- without an agenda link to remain unaffected.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.eventos
    WHERE source_task_id IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY fazenda_id, source_task_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create idx_eventos_unique_source_task: duplicate active eventos.source_task_id rows exist. Reconcile duplicated agenda-linked events before applying this migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_unique_source_task
  ON public.eventos (fazenda_id, source_task_id)
  WHERE source_task_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX public.idx_eventos_unique_source_task IS
  'Prevents duplicate active events for the same agenda item within a farm. Guards against double-write race condition when RPC commits but response is lost.';
