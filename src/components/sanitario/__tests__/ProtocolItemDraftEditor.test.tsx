/** @vitest-environment jsdom */
import "@testing-library/jest-dom";

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProtocolItemDraftEditor } from "@/components/sanitario/ProtocolItemDraftEditor";
import { createEmptyProtocolItemDraft } from "@/lib/sanitario/models/draft";

describe("ProtocolItemDraftEditor Component", () => {
  it("renderiza campos base", () => {
    const draft = createEmptyProtocolItemDraft();

    render(
      <ProtocolItemDraftEditor
        draft={draft}
        onUpdateDraft={vi.fn()}
        errors={[]}
      />,
    );

    expect(screen.getByLabelText("Código da família")).toBeInTheDocument();
    expect(screen.getByLabelText("Código do item")).toBeInTheDocument();
    expect(screen.getByLabelText("Versão do regime")).toBeInTheDocument();
    expect(screen.getByLabelText("Código do produto")).toBeInTheDocument();
  });

  it("renderiza campos de campanha quando mode é campanha", () => {
    const draft = createEmptyProtocolItemDraft({
      mode: "campanha",
      anchor: "entrada_fazenda",
      layer: "sanitario",
      scopeType: "animal",
    });

    render(
      <ProtocolItemDraftEditor
        draft={draft}
        onUpdateDraft={vi.fn()}
        errors={[]}
      />,
    );

    expect(
      screen.getByPlaceholderText("ex: 5,6,7 para maio-julho"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Rótulo da campanha")).toBeInTheDocument();
    expect(screen.queryByLabelText("Idade inicial (dias)")).not.toBeInTheDocument();
  });

  it("renderiza campos de janela etária quando mode é janela_etaria", () => {
    const draft = createEmptyProtocolItemDraft({
      mode: "janela_etaria",
      anchor: "nascimento",
      layer: "sanitario",
      scopeType: "animal",
    });

    render(
      <ProtocolItemDraftEditor
        draft={draft}
        onUpdateDraft={vi.fn()}
        errors={[]}
      />,
    );

    expect(screen.getByLabelText("Idade inicial (dias)")).toBeInTheDocument();
    expect(screen.getByLabelText("Idade final (dias)")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("ex: 5,6,7 para maio-julho"),
    ).not.toBeInTheDocument();
  });

  it("renderiza campo de intervalo quando mode é rotina_recorrente", () => {
    const draft = createEmptyProtocolItemDraft({
      mode: "rotina_recorrente",
      anchor: "ultima_conclusao_mesma_familia",
      layer: "sanitario",
      scopeType: "animal",
    });

    render(
      <ProtocolItemDraftEditor
        draft={draft}
        onUpdateDraft={vi.fn()}
        errors={[]}
      />,
    );

    expect(screen.getByLabelText("Intervalo (dias)")).toBeInTheDocument();
  });

  it("renderiza campo de trigger quando mode é procedimento_imediato", () => {
    const draft = createEmptyProtocolItemDraft({
      mode: "procedimento_imediato",
      layer: "sanitario",
      scopeType: "fazenda",
    });

    render(
      <ProtocolItemDraftEditor
        draft={draft}
        onUpdateDraft={vi.fn()}
        errors={[]}
      />,
    );

    expect(screen.getByLabelText("Tipo de evento")).toBeInTheDocument();
  });

  it("renderiza banner de erro quando há inconsistências", () => {
    const draft = createEmptyProtocolItemDraft();

    render(
      <ProtocolItemDraftEditor
        draft={draft}
        onUpdateDraft={vi.fn()}
        errors={["Layer é obrigatório", "Modo é obrigatório"]}
      />,
    );

    expect(screen.getByText("Layer é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Modo é obrigatório")).toBeInTheDocument();
  });

  it("renderiza preview de dedup quando o mode está definido", () => {
    const draft = createEmptyProtocolItemDraft({
      protocolId: "proto-1",
      itemId: "item-1",
      familyCode: "brucelose",
      itemCode: "dose_unica",
      mode: "campanha",
      anchor: "entrada_fazenda",
      layer: "sanitario",
      scopeType: "animal",
      campaignMonths: [5],
    });

    render(
      <ProtocolItemDraftEditor
        draft={draft}
        onUpdateDraft={vi.fn()}
        errors={[]}
      />,
    );

    expect(screen.getByText(/Preview de Dedup/i)).toBeInTheDocument();
    expect(screen.getByText(/sanitario:animal/i)).toBeInTheDocument();
  });

  it("chama onUpdateDraft em mudanças de inputs", () => {
    const onUpdateDraft = vi.fn();
    const draft = createEmptyProtocolItemDraft({
      mode: "campanha",
      anchor: "entrada_fazenda",
      layer: "sanitario",
      scopeType: "animal",
    });

    render(
      <ProtocolItemDraftEditor
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        errors={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Código da família"), {
      target: { value: "raiva" },
    });
    fireEvent.change(screen.getByPlaceholderText("ex: 5,6,7 para maio-julho"), {
      target: { value: "5, 6, 7" },
    });
    fireEvent.change(screen.getByLabelText("Rótulo da campanha"), {
      target: { value: "Campanha Inverno" },
    });

    expect(onUpdateDraft).toHaveBeenCalledWith("familyCode", "raiva");
    expect(onUpdateDraft).toHaveBeenCalledWith("campaignMonths", [5, 6, 7]);
    expect(onUpdateDraft).toHaveBeenCalledWith(
      "campaignLabel",
      "Campanha Inverno",
    );
  });
});
