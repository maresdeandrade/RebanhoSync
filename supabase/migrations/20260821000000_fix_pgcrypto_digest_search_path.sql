-- Fix pgcrypto resolution when the extension is installed in the extensions schema.

create or replace function public.get_deterministic_finance_category_id(
  fazenda_id uuid,
  slug text
)
returns uuid
language plpgsql
immutable
set search_path = public, extensions, pg_temp
as $$
declare
  hash bytea;
  hex text;
  chars text[];
begin
  hash := digest(fazenda_id::text || ':' || slug, 'sha256'::text);
  hex := encode(hash, 'hex');

  chars := string_to_array(hex, NULL);
  chars[13] := '5';
  chars[17] := to_hex((('x' || chars[17])::bit(4)::integer & 3) | 8);

  return (
    array_to_string(chars[1:8], '') || '-' ||
    array_to_string(chars[9:12], '') || '-' ||
    array_to_string(chars[13:16], '') || '-' ||
    array_to_string(chars[17:20], '') || '-' ||
    array_to_string(chars[21:32], '')
  )::uuid;
end;
$$;