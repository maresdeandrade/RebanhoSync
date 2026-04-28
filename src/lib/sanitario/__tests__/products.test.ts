import { describe, expect, it } from "vitest";

import {
  buildVeterinaryProductMetadata,
  buildVeterinaryProductMetadataPatch,
  pickVeterinaryProductMetadata,
  readVeterinaryProductSelection,
  resolveVeterinaryProductByName,
  searchVeterinaryProducts,
} from "@/lib/sanitario/catalog/products";
import type { ProdutoVeterinarioCatalogEntry } from "@/lib/offline/types";

const CATALOG: ProdutoVeterinarioCatalogEntry[] = [
  {
    id: "prod-1",
    nome: "Vacina Febre Aftosa (Bivalente/Trivalente)",
    categoria: "Vacina",
    created_at: "2026-04-08T00:00:00.000Z",
    updated_at: "2026-04-08T00:00:00.000Z",
  },
  {
    id: "prod-2",
    nome: "Vermifugo (Base Avermectina 1%)",
    categoria: "Antiparasitario",
    created_at: "2026-04-08T00:00:00.000Z",
    updated_at: "2026-04-08T00:00:00.000Z",
  },
  {
    id: "prod-3",
    nome: "Oxitetraciclina L.A.",
    categoria: "Antibiotico",
    created_at: "2026-04-08T00:00:00.000Z",
    updated_at: "2026-04-08T00:00:00.000Z",
  },
];

describe("sanitary products helpers", () => {
  it("searches catalog using sanitary type hints", () => {
    const matches = searchVeterinaryProducts(CATALOG, {
      query: "",
      sanitaryType: "vermifugacao",
      limit: 3,
    });

    expect(matches[0]?.id).toBe("prod-2");
  });

  it("resolves product by name with fuzzy matching", () => {
    const resolved = resolveVeterinaryProductByName(
      "Vacina Aftosa",
      CATALOG,
      {
        sanitaryType: "vacinacao",
      },
    );

    expect(resolved.product?.id).toBe("prod-1");
    expect(resolved.matchMode).toBeTruthy();
  });

  it("builds and reads structured metadata", () => {
    const metadata = buildVeterinaryProductMetadata({
      selectedProduct: {
        id: "prod-3",
        nome: "Oxitetraciclina L.A.",
        categoria: "Antibiotico",
        origem: "catalogo",
        matchMode: "exact",
      },
      typedName: "Oxitetraciclina",
    });

    expect(metadata).toMatchObject({
      produto_veterinario_id: "prod-3",
      produto_nome_catalogo: "Oxitetraciclina L.A.",
      produto_categoria: "Antibiotico",
      produto_origem: "catalogo",
      produto_match_mode: "exact",
      produto_rotulo_informado: "Oxitetraciclina",
    });

    expect(readVeterinaryProductSelection(metadata)).toEqual({
      id: "prod-3",
      nome: "Oxitetraciclina L.A.",
      categoria: "Antibiotico",
      origem: "catalogo",
      matchMode: "exact",
    });
    expect(pickVeterinaryProductMetadata(metadata)).toEqual(metadata);
  });

  it("builds a patch that clears stale catalog metadata", () => {
    expect(
      buildVeterinaryProductMetadataPatch({
        typedName: "Formula manipulada",
      }),
    ).toEqual({
      produto_veterinario_id: null,
      produto_nome_catalogo: null,
      produto_categoria: null,
      produto_origem: "texto_livre",
      produto_match_mode: null,
      produto_rotulo_informado: null,
    });
  });
});
