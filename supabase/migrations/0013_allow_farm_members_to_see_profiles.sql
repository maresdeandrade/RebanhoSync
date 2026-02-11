-- 0013_allow_farm_members_to_see_profiles.sql
-- =========================================================
-- Adiciona política para permitir ver perfis de colegas
-- =========================================================

-- 🎯 PROBLEMA: user_profiles_self só permite ver o próprio perfil
-- Isso impede que AdminMembros exiba outros membros da mesma fazenda

-- ✅ SOLUÇÃO: Adicionar política separada para ver perfis de farm-mates

create policy user_profiles_farmmates
  on public.user_profiles
  for select
  using (
    exists (
      select 1
      from public.user_fazendas uf1
      join public.user_fazendas uf2 on uf2.fazenda_id = uf1.fazenda_id
      where uf1.user_id = auth.uid()
        and uf2.user_id = public.user_profiles.user_id
        and uf1.deleted_at is null
        and uf2.deleted_at is null
    )
  );

-- Nota: Esta política permite SELECT only (não UPDATE/DELETE)
-- Ainda mantém user_profiles_self para operações ALL (incluindo UPDATE)
