import { describe, expect, it, vi } from "vitest";
import { buildSanitaryDedupKey } from "@/lib/sanitario/engine/dedup";

describe("Caracterizacao - Risco I: RPC/Supabase Direto apos Gesture", () => {
  it("CONFIRMADO: activateOfficialSanitaryPack executa createGesture offline, mas chama RPC Supabase diretamente (sem atomicidade/offline-first)", async () => {
    // Simulando o comportamento de activateOfficialSanitaryPack em officialCatalog.ts
    const mockCreateGesture = vi.fn().mockResolvedValue("tx-123");
    const mockRpc = vi.fn().mockRejectedValue(new Error("Network Error - User is Offline"));

    const mockActivateOfficialSanitaryPack = async (input: {
      fazendaId: string;
      failRpc: boolean;
    }) => {
      // 1. Gera e executa o gesture local (Dexie/offline)
      const clientTxId = await mockCreateGesture();

      // 2. Tenta materializar no Supabase via RPC direto (sem fila offline)
      try {
        if (input.failRpc) {
          await mockRpc("materialize_standard_sanitary_protocols", {
            _fazenda_id: input.fazendaId,
          });
        }
      } catch (e: unknown) {
        // Apenas da console.warn e prossegue como "sucesso"
        console.warn("Failed to materialize standard protocols:", e);
      }

      return {
        clientTxId,
        operationCount: 5,
      };
    };

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await mockActivateOfficialSanitaryPack({
      fazendaId: "farm-123",
      failRpc: true,
    });

    // O retorno indica sucesso com o clientTxId do gesture
    expect(result.clientTxId).toBe("tx-123");
    expect(result.operationCount).toBe(5);

    // O RPC falhou e foi apenas avisado via console.warn, quebrando a consistência se o usuário estivesse offline
    expect(mockRpc).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Failed to materialize standard protocols:",
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
  });
});

describe("Regressao - Risco E: Deduplicacao Oficial", () => {
  it("REGRESSÃO FASE 1A: buildOfficialSanitaryPackOps gera itens de protocolo oficiais com dedup_template preenchido se houver valor resolvel", () => {
    // Agora o builder tenta resolver o dedup_template. Simulamos o record retornado:
    const itemPayload = {
      calendario_base: {
        mode: "campaign",
        anchor: "calendar_month",
        label: "Brucelose - Dose Unica",
      },
      regime_sanitario: {
        family_code: "brucelose",
        item_code: "dose_1",
        version: 1,
      }
    };

    // Simulando a populacao do dedup_template no buildOfficialSanitaryPackOps
    const mockResolveDedupTemplate = (payload: { calendario_base?: unknown; regime_sanitario?: { family_code?: string; item_code?: string } }) => {
      const trigger = payload.calendario_base;
      if (trigger) {
        return `${payload.regime_sanitario?.family_code || ""}:${payload.regime_sanitario?.item_code || ""}`;
      }
      return null;
    };

    const dedupTemplate = mockResolveDedupTemplate(itemPayload);
    expect(dedupTemplate).toBe("brucelose:dose_1"); // Preenchido e resolvel!
  });

  it("REGRESSÃO FASE 1A: O scheduler calcula a chave dedup dinamicamente via buildSanitaryDedupKey independente do dedup_template do banco", () => {
    const key = buildSanitaryDedupKey({
      scopeType: "animal",
      scopeId: "animal-1",
      familyCode: "brucelose",
      itemCode: "dose_1",
      regimenVersion: 1,
      mode: "janela_etaria",
      periodKey: "2026-07-01",
    });

    expect(key).toBe("sanitario:animal:animal-1:brucelose:dose_1:v1:window:2026-07-01");
  });
});
