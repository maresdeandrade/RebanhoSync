-- The canonical invoker needs only lot inspection and append-only movements.
-- Existing sanitary admission triggers still require authenticated farm context;
-- no authenticated/anon privileges or RLS policy is broadened.
begin;
grant select on public.insumo_lotes to service_role;
grant select,insert on public.insumo_movimentacoes to service_role;
commit;
