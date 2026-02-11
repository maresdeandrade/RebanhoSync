-- 0015_get_user_emails_rpc.sql
-- =========================================================
-- RPC para obter emails dos usuários
-- =========================================================

create or replace function public.get_user_emails(user_ids uuid[])
returns table (
  user_id uuid,
  email text
)
language sql security definer as $$
  select au.id as user_id, au.email
  from auth.users au
  where au.id = any(user_ids);
$$;
