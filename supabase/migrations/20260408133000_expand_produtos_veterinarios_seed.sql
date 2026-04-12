-- Expande o catalogo global para cobrir os produtos padrao usados
-- pelos protocolos sanitarios e pelo registro rapido.

begin;

with novos_produtos(nome, categoria) as (
  values
    ('Vacina Febre Aftosa (Bivalente/Trivalente)', 'Vacina'),
    ('Vacina Brucelose B19 (Viva)', 'Vacina'),
    ('Vacina Antirrabica', 'Vacina'),
    ('Vacina Polivalente Clostridioses', 'Vacina'),
    ('Vacina Reprodutiva (IBR/BVD/Lepto)', 'Vacina'),
    ('Vermifugo (Base Avermectina 1%)', 'Antiparasitario'),
    ('Vermifugo (Base Levamisol/Albendazol)', 'Antiparasitario'),
    ('Vermifugo (Base Moxidectina/Avermectina)', 'Antiparasitario'),
    ('Vermifugo (Endectocida)', 'Antiparasitario'),
    ('Iodo 10% (Tintura)', 'Antisseptico'),
    ('Repelente Spray', 'Repelente'),
    ('Diminazeno', 'Antiparasitario'),
    ('Oxitetraciclina L.A.', 'Antibiotico'),
    ('Antitermico/Anti-inflamatorio', 'Anti-inflamatorio'),
    ('Antibiotico Intramamario (Vaca Seca)', 'Antibiotico')
)
insert into public.produtos_veterinarios (nome, categoria)
select np.nome, np.categoria
from novos_produtos np
where not exists (
  select 1
  from public.produtos_veterinarios pv
  where lower(pv.nome) = lower(np.nome)
);

commit;
