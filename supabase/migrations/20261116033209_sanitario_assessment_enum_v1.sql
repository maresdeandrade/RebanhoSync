-- Add a factual type distinct from pharmacological administration.
alter type public.sanitario_tipo_enum add value if not exists 'avaliacao';
