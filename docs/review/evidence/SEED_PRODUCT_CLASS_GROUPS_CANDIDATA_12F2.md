# Seed Candidata — ProductClassGroups Antiparasitarios — 12F2

Atualizado em: 2026-06-14
Destino futuro candidato: `sanitario_product_class_groups_v2` e `sanitario_product_class_group_members_v2`

Artefato documental/importavel candidato. ProductClassGroup nao e produto comercial e nao valida execucao sozinho.

Nota para 12F3: os arrays em `members` representam principios ativos candidatos para auditoria curatorial. A reconciliacao contra o schema real deve confirmar se `sanitario_product_class_group_members_v2` espera `class_key`, `class_id` ou granularidade por principio ativo antes de qualquer import.

```json
{
  "artifact": "sanitario_product_class_groups_seed_candidate",
  "artifact_version": "12F2.0-candidate",
  "import_policy": {
    "execute_import": false,
    "class_group_can_validate_execution": false,
    "requires_real_product_at_execution": true,
    "withdrawal_requires_executed_product": true,
    "dose_requires_weight_and_executed_product": true,
    "approved_for_catalog_count": 0
  },
  "groups": [
    {
      "id": "spcgv2_pcg_antiparasitarios_recria_estrategicos",
      "group_key": "pcg_antiparasitarios_recria_estrategicos",
      "version": "12F2.0-candidate",
      "name": "Antiparasitarios recria estrategicos",
      "curationStatus": "needs_review",
      "automationStatus": "preview_allowed",
      "approved_for_catalog": false,
      "agenda_allowed": false,
      "usage": "recria maio/julho/setembro",
      "restrictions": ["requires_real_product", "requires_weight", "withdrawal_by_executed_product", "chemical_class_rotation_required"]
    },
    {
      "id": "spcgv2_pcg_antiparasitarios_bezerros_pre_desmama",
      "group_key": "pcg_antiparasitarios_bezerros_pre_desmama",
      "version": "12F2.0-candidate",
      "name": "Antiparasitarios bezerros pre-desmama",
      "curationStatus": "needs_review",
      "automationStatus": "manual_only",
      "approved_for_catalog": false,
      "agenda_allowed": false,
      "usage": "pre-desmama situacional",
      "restrictions": ["requires_real_product", "requires_weight_or_label", "requires_mv_or_management_context", "chemical_class_rotation_required"]
    },
    {
      "id": "spcgv2_pcg_antiparasitarios_pre_confinamento",
      "group_key": "pcg_antiparasitarios_pre_confinamento",
      "version": "12F2.0-candidate",
      "name": "Antiparasitarios pre-confinamento ou pasto vedado",
      "curationStatus": "needs_review",
      "automationStatus": "manual_only",
      "approved_for_catalog": false,
      "agenda_allowed": false,
      "usage": "pre-confinamento/pasto vedado",
      "restrictions": ["requires_real_product", "requires_weight", "slaughter_withdrawal_requires_executed_product", "chemical_class_rotation_required"]
    },
    {
      "id": "spcgv2_pcg_antiparasitarios_matrizes_pre_parto",
      "group_key": "pcg_antiparasitarios_matrizes_pre_parto",
      "version": "12F2.0-candidate",
      "name": "Antiparasitarios matrizes pre-parto",
      "curationStatus": "needs_review",
      "automationStatus": "manual_only",
      "approved_for_catalog": false,
      "agenda_allowed": false,
      "usage": "matrizes pre-parto/periparto",
      "restrictions": ["requires_real_product", "milk_requires_label", "gestation_lactation_requires_label_or_mv", "chemical_class_rotation_required"]
    }
  ],
  "members": [
    {"id": "spcgmem_recria_lactonas", "group_key": "pcg_antiparasitarios_recria_estrategicos", "class_key": "lactonas_macrociclicas", "members": ["ivermectina", "doramectina", "moxidectina", "eprinomectina"], "member_status": "candidate"},
    {"id": "spcgmem_recria_benzimidazois", "group_key": "pcg_antiparasitarios_recria_estrategicos", "class_key": "benzimidazois", "members": ["albendazol", "fenbendazol", "oxfendazol"], "member_status": "candidate"},
    {"id": "spcgmem_recria_imidazotiazoleis", "group_key": "pcg_antiparasitarios_recria_estrategicos", "class_key": "imidazotiazoleis", "members": ["levamisol"], "member_status": "candidate"},
    {"id": "spcgmem_recria_associacoes", "group_key": "pcg_antiparasitarios_recria_estrategicos", "class_key": "associacoes_antiparasitarias", "members": [], "member_status": "reserved_candidate", "execution_validation": false, "requires_own_label": true},

    {"id": "spcgmem_pre_desmama_lactonas", "group_key": "pcg_antiparasitarios_bezerros_pre_desmama", "class_key": "lactonas_macrociclicas", "members": ["ivermectina", "doramectina", "moxidectina", "eprinomectina"], "member_status": "candidate"},
    {"id": "spcgmem_pre_desmama_benzimidazois", "group_key": "pcg_antiparasitarios_bezerros_pre_desmama", "class_key": "benzimidazois", "members": ["albendazol", "fenbendazol", "oxfendazol"], "member_status": "candidate"},
    {"id": "spcgmem_pre_desmama_imidazotiazoleis", "group_key": "pcg_antiparasitarios_bezerros_pre_desmama", "class_key": "imidazotiazoleis", "members": ["levamisol"], "member_status": "candidate"},
    {"id": "spcgmem_pre_desmama_associacoes", "group_key": "pcg_antiparasitarios_bezerros_pre_desmama", "class_key": "associacoes_antiparasitarias", "members": [], "member_status": "reserved_candidate", "execution_validation": false, "requires_own_label": true},

    {"id": "spcgmem_pre_confinamento_lactonas", "group_key": "pcg_antiparasitarios_pre_confinamento", "class_key": "lactonas_macrociclicas", "members": ["ivermectina", "doramectina", "moxidectina", "eprinomectina"], "member_status": "candidate"},
    {"id": "spcgmem_pre_confinamento_benzimidazois", "group_key": "pcg_antiparasitarios_pre_confinamento", "class_key": "benzimidazois", "members": ["albendazol", "fenbendazol", "oxfendazol"], "member_status": "candidate"},
    {"id": "spcgmem_pre_confinamento_imidazotiazoleis", "group_key": "pcg_antiparasitarios_pre_confinamento", "class_key": "imidazotiazoleis", "members": ["levamisol"], "member_status": "candidate"},
    {"id": "spcgmem_pre_confinamento_associacoes", "group_key": "pcg_antiparasitarios_pre_confinamento", "class_key": "associacoes_antiparasitarias", "members": [], "member_status": "reserved_candidate", "execution_validation": false, "requires_own_label": true},

    {"id": "spcgmem_matrizes_lactonas", "group_key": "pcg_antiparasitarios_matrizes_pre_parto", "class_key": "lactonas_macrociclicas", "members": ["ivermectina", "doramectina", "moxidectina", "eprinomectina"], "member_status": "candidate"},
    {"id": "spcgmem_matrizes_benzimidazois", "group_key": "pcg_antiparasitarios_matrizes_pre_parto", "class_key": "benzimidazois", "members": ["albendazol", "fenbendazol", "oxfendazol"], "member_status": "candidate"},
    {"id": "spcgmem_matrizes_imidazotiazoleis", "group_key": "pcg_antiparasitarios_matrizes_pre_parto", "class_key": "imidazotiazoleis", "members": ["levamisol"], "member_status": "candidate"},
    {"id": "spcgmem_matrizes_associacoes", "group_key": "pcg_antiparasitarios_matrizes_pre_parto", "class_key": "associacoes_antiparasitarias", "members": [], "member_status": "reserved_candidate", "execution_validation": false, "requires_own_label": true}
  ]
}
```
