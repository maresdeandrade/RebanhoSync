/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveQuery } from "dexie-react-hooks";

import {
  ReproductionForm,
  type ReproductionEventData,
} from "@/components/events/ReproductionForm";

vi.mock("dexie-react-hooks");

describe("ReproductionForm", () => {
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);

  function queueLiveQueryResults(...values: unknown[]) {
    values.forEach((value) => {
      mockedUseLiveQuery.mockReturnValueOnce(value as never);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensures at least one calf draft for parto", () => {
    const onChange = vi.fn();
    const data: ReproductionEventData = {
      tipo: "parto",
      machoId: null,
      observacoes: "",
    };

    queueLiveQueryResults([], []);

    render(
      <ReproductionForm
        fazendaId="farm-1"
        animalId="animal-1"
        data={data}
        onChange={onChange}
      />,
    );

    const nextData = onChange.mock.calls.at(-1)?.[0] as ReproductionEventData;

    expect(nextData.numeroCrias).toBe(1);
    expect(nextData.crias).toHaveLength(1);
    expect(screen.getByText("Parto e crias")).toBeInTheDocument();
  });

  it("shows diagnostico result controls", () => {
    const onChange = vi.fn();
    const data: ReproductionEventData = {
      tipo: "diagnostico",
      machoId: null,
      observacoes: "",
      resultadoDiagnostico: "positivo",
    };

    queueLiveQueryResults([], []);

    render(
      <ReproductionForm
        fazendaId="farm-1"
        animalId="animal-1"
        data={data}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("Resultado do diagnostico")).toBeInTheDocument();
    expect(screen.getByText("Data prevista do parto")).toBeInTheDocument();
  });

  it("hides diagnostico result controls for cobertura", () => {
    const onChange = vi.fn();
    const data: ReproductionEventData = {
      tipo: "cobertura",
      machoId: null,
      observacoes: "",
    };

    queueLiveQueryResults([], []);

    render(
      <ReproductionForm
        fazendaId="farm-1"
        animalId="animal-1"
        data={data}
        onChange={onChange}
      />,
    );

    expect(screen.queryByText("Resultado do diagnostico")).not.toBeInTheDocument();
    expect(screen.getByText("Servico e reprodutor")).toBeInTheDocument();
  });
});
