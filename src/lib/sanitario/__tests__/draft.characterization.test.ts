import { describe, expect, it } from "vitest";
import {
  createEmptyProtocolItemDraft,
  validateProtocolItemDraft,
  createEmptyProtocolDraft,
  validateProtocolDraft,
} from "@/lib/sanitario/customization/customization";

describe("Caracterizacao - Risco F: Defaults Perigosos de Agenda", () => {
  it("CONFIRMADO: createEmptyProtocolItemDraft define geraAgenda = true e intervaloDias = '1' por padrao", () => {
    const draft = createEmptyProtocolItemDraft();
    expect(draft.geraAgenda).toBe(true);
    expect(draft.intervaloDias).toBe("1");
  });

  it("CONFIRMADO: validateProtocolItemDraft permite salvar rascunho com geraAgenda = true e sem calendario estruturado ou ancora", () => {
    const draft = createEmptyProtocolItemDraft({
      produto: "Vacina A",
      geraAgenda: true,
      intervaloDias: "1",
      calendarMode: "", // Sem modo de calendario-base estruturado
      calendarAnchor: "", // Sem ancora estruturada
    });

    const error = validateProtocolItemDraft(draft);
    expect(error).toBeNull(); // Sucesso, permite salvar!
  });
});

describe("Caracterizacao - Risco G: Edicao de Protocolo Oficial", () => {
  it("CONFIRMADO: validateProtocolDraft e fluxos de edicao do FarmProtocolManager tratam protocolos oficiais de forma identica aos customizados", () => {
    // Roteiro de edicao de protocolo oficial:
    // O FarmProtocolManager nao valida ou restringe se o protocolo editado eh de origem oficial ou customizada,
    // e permite que qualquer protocolo passe pela validacao de draft e chame buildProtocolUpdateRecord.
    const officialDraft = createEmptyProtocolDraft({
      nome: "Brucelose - MAPA Oficial",
      descricao: "Protocolo oficial do MAPA",
      ativo: true,
    });

    const error = validateProtocolDraft(officialDraft);
    expect(error).toBeNull(); // Sucesso, permite salvar alteracoes locais de cabeçalho mesmo para protocolos oficiais!
  });
});
