# Guia de Seed (MVP)

Para testar o sistema, execute os seguintes passos no SQL Editor do Supabase:

## 1. Criar Fazenda e Membership
```sql
-- Criar fazenda
INSERT INTO public.fazendas (nome, municipio) VALUES ('Fazenda Modelo', 'Uberaba');

-- Pegar o ID da fazenda criada e o seu user_id (auth.uid())
-- Atribuir como Owner
SELECT admin_set_member_role('FAZENDA_UUID', 'SEU_USER_UUID', 'owner', true);
```

## 2. Criar Estrutura Base
```sql
-- Pastos
INSERT INTO public.pastos (fazenda_id, nome, area_ha) VALUES ('FAZENDA_UUID', 'Pasto Norte', 50);

-- Lotes
INSERT INTO public.lotes (fazenda_id, nome, pasto_id) VALUES ('FAZENDA_UUID', 'Lote Engorda 01', 'PASTO_UUID');
```

## 3. Criar Animais (Exemplo de 5)
```sql
INSERT INTO public.animais (fazenda_id, identificacao, sexo, status, lote_id) VALUES 
('FAZENDA_UUID', 'BR-001', 'M', 'ativo', 'LOTE_UUID'),
('FAZENDA_UUID', 'BR-002', 'F', 'ativo', 'LOTE_UUID'),
('FAZENDA_UUID', 'BR-003', 'M', 'ativo', 'LOTE_UUID'),
('FAZENDA_UUID', 'BR-004', 'F', 'ativo', 'LOTE_UUID'),
('FAZENDA_UUID', 'BR-005', 'M', 'ativo', 'LOTE_UUID');