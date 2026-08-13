-- Restrict the legacy commercial purchase RPC to authenticated callers only.
-- The function body and every factual/persistence contract remain unchanged.

do $$
declare
  v_expected_signature regprocedure := to_regprocedure(
    'public.apply_individual_animal_purchase(uuid,uuid,uuid,jsonb,jsonb,jsonb)'
  );
  v_overload_count integer;
begin
  select count(*)
  into v_overload_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'apply_individual_animal_purchase';

  if v_expected_signature is null or v_overload_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'COMMERCIAL_PURCHASE_RPC_SIGNATURE_DRIFT';
  end if;
end;
$$;

revoke execute on function public.apply_individual_animal_purchase(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public;

revoke execute on function public.apply_individual_animal_purchase(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) from anon;

grant execute on function public.apply_individual_animal_purchase(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) to authenticated;
