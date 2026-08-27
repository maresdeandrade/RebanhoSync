-- Migration: Hardening da função get_user_emails
-- C1: Concede EXECUTE apenas a authenticated, revoga de PUBLIC e anon.
-- Reforça o corpo da função para exigir tenant boundary ativo (mesma fazenda de auth.uid()) ou SuperAdmin,
-- eliminando risco de enumeração/vazamento de e-mails entre fazendas ou usuários arbitrários.

CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  select u.id, u.email
  from auth.users u
  where u.id = any(user_ids)
    and auth.uid() is not null
    and (
      u.id = auth.uid()
      or public.is_app_admin()
      or exists (
        select 1
        from public.user_fazendas uf_caller
        join public.user_fazendas uf_target
          on uf_target.fazenda_id = uf_caller.fazenda_id
         and uf_target.deleted_at is null
        where uf_caller.user_id = auth.uid()
          and uf_caller.deleted_at is null
          and uf_target.user_id = u.id
      )
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_emails(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO authenticated;
