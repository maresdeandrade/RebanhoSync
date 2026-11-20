import { describe, expect, it } from "vitest";
import { resolveApprovedProductClassKeysV2 } from "../sanitaryProductClassLinkV2";
import type {
  SanitarioProdutoClassLinkLocalV2,
  SanitarioProductClassLocalV2,
} from "@/lib/offline/types";

const classes = [
  {
    id: "c",
    class_key: "vacina_raiva",
    scope: "global",
    fazenda_id: null,
    curation_status: "approved_for_catalog",
    deleted_at: null,
  },
] as SanitarioProductClassLocalV2[];
const link = {
  id: "l",
  product_id: "p",
  class_id: "c",
  status_curatorial: "ativo",
  source_refs: [{ id: "source", field: "product_class" }],
  deleted_at: null,
} as unknown as SanitarioProdutoClassLinkLocalV2;
describe("relação produto–classe técnica", () => {
  it("exige associação ativa, evidência e classe aprovada; cache parcial falha fechado", () => {
    expect([
      ...resolveApprovedProductClassKeysV2("p", [link], classes, "farm"),
    ]).toEqual(["vacina_raiva"]);
    for (const invalid of [
      { ...link, source_refs: [] },
      { ...link, status_curatorial: "precisa_validar" as const },
      { ...link, deleted_at: "2026-11-19" },
    ]) {
      expect(
        resolveApprovedProductClassKeysV2("p", [invalid], classes, "farm").size,
      ).toBe(0);
    }
    expect(
      resolveApprovedProductClassKeysV2("p", [], classes, "farm").size,
    ).toBe(0);
    expect(
      resolveApprovedProductClassKeysV2("p", [link], [], "farm").size,
    ).toBe(0);
    expect(
      resolveApprovedProductClassKeysV2(
        "p",
        [link],
        [{ ...classes[0], curation_status: "blocked" }],
        "farm",
      ).size,
    ).toBe(0);
  });
  it("não transforma a relação global em associação de classe tenant", () => {
    expect(resolveApprovedProductClassKeysV2("p", [link], [{ ...classes[0], scope: "tenant", fazenda_id: "farm" }], "farm").size).toBe(0);
  });

  it("suporta multivalência sem converter categoria comercial em classe", () => {
    const second = { ...classes[0], id: "c2", class_key: "vacina_lepto" };
    expect([
      ...resolveApprovedProductClassKeysV2(
        "p",
        [link, { ...link, id: "l2", class_id: "c2" }],
        [...classes, second],
        "farm",
      ),
    ]).toEqual(["vacina_raiva", "vacina_lepto"]);
  });
});
