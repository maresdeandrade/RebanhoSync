import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialogFiles = [
  new URL("../AdicionarAnimaisLote.tsx", import.meta.url),
  new URL("../MoverAnimalLote.tsx", import.meta.url),
  new URL("../MudarPastoLote.tsx", import.meta.url),
  new URL("../TrocarTouroLote.tsx", import.meta.url),
  new URL("../../../pages/PastoDetalhe.tsx", import.meta.url),
  new URL("../../../pages/Financeiro.tsx", import.meta.url),
];

describe("contrato de acessibilidade dos dialogs auditados", () => {
  it.each(dialogFiles)("mantém título e descrição para cada dialog em %s", (file) => {
    const source = readFileSync(file, "utf8");
    const dialogCount = source.match(/<DialogContent\b/g)?.length ?? 0;
    const titleCount = source.match(/<DialogTitle\b/g)?.length ?? 0;
    const descriptionCount = source.match(/<DialogDescription\b/g)?.length ?? 0;

    expect(dialogCount).toBeGreaterThan(0);
    expect(titleCount).toBe(dialogCount);
    expect(descriptionCount).toBe(dialogCount);
  });
});
