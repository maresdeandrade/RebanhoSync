-- TD-011: Produtos Sanitários TEXT Livre (Autocomplete Básico)
-- Cria catálogo de produtos para UX aprimorada no frontend

BEGIN;

CREATE TABLE IF NOT EXISTS public.produtos_veterinarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    categoria TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed básico de produtos mais comuns para auxiliar na UI de Autocomplete
INSERT INTO public.produtos_veterinarios (nome, categoria)
VALUES
    ('Ivermectina', 'Antiparasitário'),
    ('Doramectina', 'Antiparasitário'),
    ('Abamectina', 'Antiparasitário'),
    ('Vacina Aftosa', 'Vacina'),
    ('Vacina Brucelose', 'Vacina'),
    ('Vacina Raiva', 'Vacina'),
    ('Penicilina', 'Antibiótico'),
    ('Oxitetraciclina', 'Antibiótico'),
    ('Diclofenaco', 'Anti-inflamatório'),
    ('Complexo B', 'Vitamina')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.produtos_veterinarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produtos veterinários são públicos para leitura"
ON public.produtos_veterinarios
FOR SELECT
TO authenticated
USING (true);

COMMIT;
