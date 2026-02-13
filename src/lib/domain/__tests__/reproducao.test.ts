import { describe, it, expect } from "vitest";
import { calcularStatusReprodutivo, EventoWithReproDetails } from "../reproducao";
import { Animal, AgendaItem, SexoEnum, ReproTipoEnum } from "@/lib/offline/types";
import { subDays } from "date-fns";

// Helper to create basic animal
const createAnimal = (sexo: SexoEnum = "F"): Animal => ({
    id: "animal-1",
    fazenda_id: "fazenda-1",
    identificacao: "123",
    sexo,
    status: "ativo",
    lote_id: null,
    data_nascimento: "2020-01-01",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: new Date().toISOString(),
    server_received_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
});

// Helper to create event
const createEvent = (
    tipo: ReproTipoEnum,
    daysAgo: number,
    payload: Record<string, unknown> = {}
): EventoWithReproDetails => {
    const occurredAt = subDays(new Date(), daysAgo).toISOString();
    return {
        id: `evt-${Math.random()}`,
        fazenda_id: "fazenda-1",
        dominio: "reproducao",
        occurred_at: occurredAt,
        animal_id: "animal-1",
        lote_id: null,
        source_task_id: null,
        source_tx_id: null,
        source_client_op_id: null,
        corrige_evento_id: null,
        observacoes: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: null,
        client_recorded_at: occurredAt,
        server_received_at: occurredAt,
        created_at: occurredAt,
        updated_at: occurredAt,
        deleted_at: null,
        details_reproducao: {
            evento_id: `evt-${Math.random()}`, // Should match parent id in real DB
            fazenda_id: "fazenda-1",
            tipo,
            macho_id: null,
            payload,
            client_id: "client-1",
            client_op_id: "op-1",
            client_tx_id: null,
            client_recorded_at: occurredAt,
            server_received_at: occurredAt,
            created_at: occurredAt,
            updated_at: occurredAt,
            deleted_at: null,
        }
    };
};

// Helper for agenda item
const createAgendaItem = (tipo: string, daysAgo: number): AgendaItem => ({
    id: `agenda-${Math.random()}`,
    fazenda_id: "fazenda-1",
    dominio: "reproducao", // or manejo
    tipo,
    status: "agendado",
    data_prevista: subDays(new Date(), daysAgo).toISOString(),
    animal_id: "animal-1",
    lote_id: null,
    dedup_key: null,
    source_kind: "manual",
    source_ref: null,
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: null,
    protocol_item_version_id: null,
    interval_days_applied: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: new Date().toISOString(),
    server_received_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
});

describe("calcularStatusReprodutivo", () => {
    it("should return VAZIA for males", () => {
        const animal = createAnimal("M");
        const status = calcularStatusReprodutivo(animal, []);
        expect(status).toBe("VAZIA");
    });

    it("should return VAZIA for females with no events", () => {
        const animal = createAnimal("F");
        const status = calcularStatusReprodutivo(animal, []);
        expect(status).toBe("VAZIA");
    });

    it("should return PARIDA if parto <= 45 days ago", () => {
        const animal = createAnimal("F");
        const events = [createEvent("parto", 30)];
        const status = calcularStatusReprodutivo(animal, events);
        expect(status).toBe("PARIDA");
    });

    it("should return LACTANTE if parto > 45 and <= 210 days ago", () => {
        const animal = createAnimal("F");
        const events = [createEvent("parto", 100)];
        const status = calcularStatusReprodutivo(animal, events);
        expect(status).toBe("LACTANTE");
    });

    it("should return DESMAME_PENDENTE if agenda has pending weaning", () => {
        const animal = createAnimal("F");
        const events = [createEvent("parto", 100)]; // Still lactating
        const agenda = [createAgendaItem("desmame", -5)]; // Future or past pending
        const status = calcularStatusReprodutivo(animal, events, agenda);
        expect(status).toBe("DESMAME_PENDENTE");
    });

    it("should return PRENHA if last diagnosis is positive", () => {
        const animal = createAnimal("F");
        // Parto antigo (saiu de lactante) -> Cobertura -> Diagnóstico Positivo
        const events = [
            createEvent("parto", 400),
            createEvent("cobertura", 60),
            createEvent("diagnostico", 30, { result: "positivo", resultado: "positivo" })
        ];
        const status = calcularStatusReprodutivo(animal, events);
        expect(status).toBe("PRENHA");
    });

    it("should return SERVIDA if last event is service > diagnosis", () => {
        const animal = createAnimal("F");
        // Diagnóstico negativo antigo -> Nova cobertura
        const events = [
            createEvent("diagnostico", 60, { resultado: "negativo" }),
            createEvent("cobertura", 10)
        ];
        const status = calcularStatusReprodutivo(animal, events);
        expect(status).toBe("SERVIDA");
    });

    it("should return REPETIDORA if >= 2 consecutive negative diagnoses after parto", () => {
        const animal = createAnimal("F");
        const events = [
            createEvent("parto", 400),
            createEvent("cobertura", 100),
            createEvent("diagnostico", 90, { resultado: "negativo" }),
            createEvent("cobertura", 60),
            createEvent("diagnostico", 30, { resultado: "negativo" })
        ];
        const status = calcularStatusReprodutivo(animal, events);
        expect(status).toBe("REPETIDORA");
    });

    it("should return VAZIA if only 1 negative diagnosis after parto (and no pending service)", () => {
        const animal = createAnimal("F");
        const events = [
            createEvent("parto", 400),
            createEvent("cobertura", 60),
            createEvent("diagnostico", 30, { resultado: "negativo" })
        ];
        const status = calcularStatusReprodutivo(animal, events);
        expect(status).toBe("VAZIA");
    });
});
