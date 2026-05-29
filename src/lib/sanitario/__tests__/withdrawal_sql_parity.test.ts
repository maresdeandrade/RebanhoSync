import { describe, expect, it } from "vitest";
import { getNominalDate, addDaysNominal } from "../compliance/withdrawalReadModel";

// Teste de paridade logica e formula matematica entre o motor TS e a View SQL do Supabase.
// A view SQL public.vw_animais_carencia_ativa faz:
// 1. (occurred_at at time zone 'America/Sao_Paulo')::date -> inicio_carencia
// 2. inicio_carencia + dias_carencia -> fim_carencia
describe("Withdrawal Period TS x SQL Parity", () => {
  
  // Paridade de Timezone e Data Nominal de Inicio
  describe("Timezone nominal shift matching (occurred_at at time zone 'America/Sao_Paulo')::date", () => {
    
    it("madrugada UTC (01:30Z) deve retroceder 1 dia para fuso de Sao Paulo (-3h)", () => {
      const occurred_at = "2026-05-20T01:30:00Z";
      // SQL calcula: 2026-05-20T01:30:00Z -> 2026-05-19T22:30:00 (fuso SP) -> 2026-05-19
      const tsCalculated = getNominalDate(occurred_at);
      expect(tsCalculated).toBe("2026-05-19");
    });

    it("tarde UTC (18:00Z) deve manter o mesmo dia nominal para fuso de Sao Paulo (-3h)", () => {
      const occurred_at = "2026-05-20T18:00:00Z";
      // SQL calcula: 2026-05-20T18:00:00Z -> 2026-05-20T15:00:00 (fuso SP) -> 2026-05-20
      const tsCalculated = getNominalDate(occurred_at);
      expect(tsCalculated).toBe("2026-05-20");
    });

    it("madrugada local SP com offset (-03:00) deve manter o dia local nominal correto", () => {
      const occurred_at = "2026-05-20T00:30:00-03:00";
      // SQL calcula: 2026-05-20T00:30:00-03:00 -> 2026-05-20T00:30:00 (fuso SP) -> 2026-05-20
      const tsCalculated = getNominalDate(occurred_at);
      expect(tsCalculated).toBe("2026-05-20");
    });

    it("final de noite local SP com offset (-03:00) deve manter o dia local nominal correto", () => {
      const occurred_at = "2026-05-20T23:45:00-03:00";
      const tsCalculated = getNominalDate(occurred_at);
      expect(tsCalculated).toBe("2026-05-20");
    });
  });

  // Paridade de Soma de Intervalos de Dias (fim_carencia)
  describe("Interval date addition matching (inicio_carencia + dias_carencia)", () => {
    
    it("soma dias nominalmente com virada de mes", () => {
      const inicio = "2026-05-25";
      const dias = 10;
      // SQL calcula: '2026-05-25'::date + 10 = '2026-06-04'
      const tsFim = addDaysNominal(inicio, dias);
      expect(tsFim).toBe("2026-06-04");
    });

    it("soma dias nominalmente com virada de ano e ano bissexto", () => {
      // 2024 foi ano bissexto (fevereiro tem 29 dias)
      const inicio = "2024-02-28";
      const dias = 2;
      // SQL calcula: '2024-02-28'::date + 2 = '2024-03-01'
      const tsFim = addDaysNominal(inicio, dias);
      expect(tsFim).toBe("2024-03-01");
    });

    it("soma dias nominalmente em ano nao-bissexto", () => {
      // 2026 nao bissexto (fevereiro tem 28 dias)
      const inicio = "2026-02-28";
      const dias = 2;
      // SQL calcula: '2026-02-28'::date + 2 = '2026-03-02'
      const tsFim = addDaysNominal(inicio, dias);
      expect(tsFim).toBe("2026-03-02");
    });
  });
});
