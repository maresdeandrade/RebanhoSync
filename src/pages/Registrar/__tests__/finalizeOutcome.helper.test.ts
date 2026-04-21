import { describe, expect, it } from "vitest";
import {
  buildRegistrarFinalizeSuccessMessage,
  buildRegistrarPostFinalizeNavigationPath,
} from "@/pages/Registrar/helpers/finalizeOutcome";

describe("buildRegistrarFinalizeSuccessMessage", () => {
  it("gera mensagem de compra com quantidade de novos animais", () => {
    const message = buildRegistrarFinalizeSuccessMessage({
      compraGerandoAnimais: true,
      createdAnimalCount: 3,
      txId: "abcdef123456",
    });

    expect(message).toContain("3 novo(s) animal(is)");
    expect(message).not.toContain("TX");
  });

  it("gera mensagem padrao para manejo nao-compra", () => {
    const message = buildRegistrarFinalizeSuccessMessage({
      compraGerandoAnimais: false,
      createdAnimalCount: 0,
      txId: "abcdef123456",
    });

    expect(message).toContain("Execução registrada com sucesso");
  });

  it("gera mensagem de continuidade para fluxo originado da agenda", () => {
    const message = buildRegistrarFinalizeSuccessMessage({
      compraGerandoAnimais: false,
      createdAnimalCount: 0,
      txId: "abcdef123456",
      sourceTaskId: "agenda-1",
    });

    expect(message).toContain("vinculado à agenda");
  });
});

describe("buildRegistrarPostFinalizeNavigationPath", () => {
  it("retorna home quando nao existe redirect de pos-parto", () => {
    expect(buildRegistrarPostFinalizeNavigationPath(null)).toBe("/home");
  });

  it("retorna agenda quando finalize veio de sourceTaskId", () => {
    expect(buildRegistrarPostFinalizeNavigationPath(null, "agenda-1")).toBe(
      "/agenda",
    );
  });

  it("monta rota de pos-parto com evento e crias", () => {
    const path = buildRegistrarPostFinalizeNavigationPath({
      motherId: "mother-1",
      eventId: "event-1",
      calfIds: ["calf-1", "calf-2"],
    });

    expect(path).toContain("/animais/mother-1/pos-parto?");
    expect(path).toContain("eventoId=event-1");
    expect(path).toContain("cria=calf-1");
    expect(path).toContain("cria=calf-2");
  });
});
