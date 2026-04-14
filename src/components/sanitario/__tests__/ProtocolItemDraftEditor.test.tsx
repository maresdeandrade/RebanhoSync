/**
 * Testes — ProtocolItemDraftEditor (Renderização e Interações)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProtocolItemDraftEditor } from "@/components/sanitario/ProtocolItemDraftEditor";
import { createEmptyProtocolItemDraft } from "@/lib/sanitario/draft";
import type { ProtocolItemDraft } from "@/lib/sanitario/draft";

describe("ProtocolItemDraftEditor Component", () => {
  let mockOnUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnUpdate = vi.fn();
  });

  describe("Rendering — Basic Fields", () => {
    it("renderiza seção de identificação com campos", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        familyCode: "brucelose",
        itemCode: "dose_unica",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(screen.getByLabelText("Código da família")).toBeInTheDocument();
      expect(screen.getByLabelText("Código do item")).toBeInTheDocument();
      expect(screen.getByLabelText("Versão do regime")).toBeInTheDocument();
    });

    it("renderiza seção de localização (layer e scope)", () => {
      const draft = createEmptyProtocolItemDraft();
      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(screen.getByLabelText("Camada de domínio")).toBeInTheDocument();
      expect(screen.getByLabelText("Escopo")).toBeInTheDocument();
    });

    it("renderiza seção de agendamento (mode e anchor)", () => {
      const draft = createEmptyProtocolItemDraft();
      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(screen.getByLabelText("Modo de agendamento")).toBeInTheDocument();
      expect(screen.getByLabelText("Âncora de agendamento")).toBeInTheDocument();
    });

    it("renderiza seção de metadados (produto, dose, descrição)", () => {
      const draft = createEmptyProtocolItemDraft();
      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(screen.getByLabelText("Código do produto")).toBeInTheDocument();
      expect(screen.getByLabelText("Nome do produto")).toBeInTheDocument();
      expect(screen.getByLabelText("Número da dose")).toBeInTheDocument();
      expect(screen.getByLabelText("Descrição")).toBeInTheDocument();
    });
  });

  describe("Rendering — Dynamic Fields by Mode", () => {
    it("mostra campos de campanha quando mode é campanha", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(screen.getByLabelText("Meses da campanha")).toBeInTheDocument();
      expect(screen.getByLabelText("Rótulo da campanha")).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Idade inicial (dias)")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Intervalo (dias)")
      ).not.toBeInTheDocument();
    });

    it("mostra campos de janela_etaria quando mode é janela_etaria", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(screen.getByLabelText("Idade inicial (dias)")).toBeInTheDocument();
      expect(screen.getByLabelText("Idade final (dias)")).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Meses da campanha")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Intervalo (dias)")
      ).not.toBeInTheDocument();
    });

    it("mostra campo de intervalo quando mode é rotina_recorrente", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(screen.getByLabelText("Intervalo (dias)")).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Meses da campanha")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Idade inicial (dias)")
      ).not.toBeInTheDocument();
    });

    it("mostra campo de triggerEvent quando mode é procedimento_imediato", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "fazenda",
        mode: "procedimento_imediato",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(screen.getByLabelText("Tipo de evento")).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Meses da campanha")
      ).not.toBeInTheDocument();
    });

    it("desabilita campo de anchor para mode procedimento_imediato", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "fazenda",
        mode: "procedimento_imediato",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      const anchorSelect = screen.getByLabelText("Âncora de agendamento");
      expect(anchorSelect).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("Rendering — Error Display", () => {
    it("mostra banner de erro quando há errors", () => {
      const draft = createEmptyProtocolItemDraft();
      const errors = ["Layer é obrigatório", "Modo é obrigatório"];

      const { container } = render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={errors}
        />
      );

      const alert = container.querySelector('[data-v-role="alert"]') ||
        container.querySelector('[role="alert"]') ||
        screen.getByRole("alert", { hidden: true });

      expect(alert).toBeInTheDocument();
      expect(screen.getByText("Layer é obrigatório")).toBeInTheDocument();
      expect(screen.getByText("Modo é obrigatório")).toBeInTheDocument();
    });

    it("não mostra banner de erro quando errors está vazio", () => {
      const draft = createEmptyProtocolItemDraft();
      const { container } = render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      const alerts = container.querySelectorAll('[role="alert"]');
      expect(alerts.length).toBe(0);
    });
  });

  describe("Dedup Preview", () => {
    it("renderiza preview de dedup quando mode é definido", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        familyCode: "brucelose",
        itemCode: "dose_unica",
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [5, 6, 7],
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      const previewSection = screen.getByText("Preview de Dedup");
      expect(previewSection).toBeInTheDocument();
      
      // Deve conter a chave gerada
      const previewCode = screen.getByText(/sanitario:animal/);
      expect(previewCode).toBeInTheDocument();
    });

    it("atualiza preview quando mode muda", async () => {
      const user = userEvent.setup();
      const draft = createEmptyProtocolItemDraft({
        familyCode: "brucelose",
        layer: "sanitario",
        scopeType: "animal",
        anchor: "nascimento",
      });

      const { rerender } = render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      // Update draft com novo mode
      const updatedDraft = {
        ...draft,
        mode: "campanha" as const,
        campaignMonths: [5],
      };

      rerender(
        <ProtocolItemDraftEditor
          draft={updatedDraft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      // Preview deve estar presente
      expect(screen.getByText("Preview de Dedup")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("chama onUpdateDraft quando familyCode muda", async () => {
      const user = userEvent.setup();
      const draft = createEmptyProtocolItemDraft();

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      const input = screen.getByLabelText("Código da família");
      await user.clear(input);
      await user.type(input, "raiva");

      expect(mockOnUpdate).toHaveBeenCalledWith("familyCode", "raiva");
    });

    it("chama onUpdateDraft quando mode muda", async () => {
      const user = userEvent.setup();
      const draft = createEmptyProtocolItemDraft();

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      const modeSelect = screen.getByLabelText("Modo de agendamento");
      await user.click(modeSelect);

      const campaignaOption = screen.getByText("Campanha sazonal");
      await user.click(campaignaOption);

      expect(mockOnUpdate).toHaveBeenCalledWith("mode", "campanha");
    });

    it("chama onUpdateDraft quando campaignMonths muda", async () => {
      const user = userEvent.setup();
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      const input = screen.getByLabelText("Meses da campanha");
      await user.clear(input);
      await user.type(input, "5, 6, 7");

      expect(mockOnUpdate).toHaveBeenCalledWith("campaignMonths", [5, 6, 7]);
    });

    it("chama onUpdateDraft quando ageStartDays muda", async () => {
      const user = userEvent.setup();
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      const input = screen.getByLabelText("Idade inicial (dias)");
      await user.clear(input);
      await user.type(input, "100");

      expect(mockOnUpdate).toHaveBeenCalledWith("ageStartDays", 100);
    });

    it("chama onUpdateDraft quando intervalDays muda", async () => {
      const user = userEvent.setup();
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      const input = screen.getByLabelText("Intervalo (dias)");
      await user.clear(input);
      await user.type(input, "90");

      expect(mockOnUpdate).toHaveBeenCalledWith("intervalDays", 90);
    });

    it("chama onUpdateDraft quando triggerEvent muda", async () => {
      const user = userEvent.setup();
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "fazenda",
        mode: "procedimento_imediato",
      });

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      const input = screen.getByLabelText("Tipo de evento");
      await user.clear(input);
      await user.type(input, "notificacao_svo");

      expect(mockOnUpdate).toHaveBeenCalledWith("triggerEvent", "notificacao_svo");
    });
  });

  describe("Field Dependencies", () => {
    it("não renderiza campos dinâmicos quando mode é undefined", () => {
      const draft = createEmptyProtocolItemDraft();

      render(
        <ProtocolItemDraftEditor
          draft={draft}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(
        screen.queryByLabelText("Meses da campanha")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Idade inicial (dias)")
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Intervalo (dias)")).not.toBeInTheDocument();
    });

    it("mostra campos condicionais conforme mode muda", () => {
      const draft1 = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
      });

      const { rerender } = render(
        <ProtocolItemDraftEditor
          draft={draft1}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(screen.getByLabelText("Meses da campanha")).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Idade inicial (dias)")
      ).not.toBeInTheDocument();

      const draft2 = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
      });

      rerender(
        <ProtocolItemDraftEditor
          draft={draft2}
          onUpdateDraft={mockOnUpdate}
          errors={[]}
        />
      );

      expect(
        screen.queryByLabelText("Meses da campanha")
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Idade inicial (dias)")).toBeInTheDocument();
    });
  });
});
