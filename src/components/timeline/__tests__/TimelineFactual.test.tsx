/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  TimelineFactual,
  type TimelineFactualItem,
} from "@/components/timeline/TimelineFactual";

const mockItems: TimelineFactualItem[] = [
  {
    id: "event-1",
    dominio: "pesagem",
    occurred_at: "2026-03-15T10:00:00.000Z",
    animalIdentificacao: "BR-100",
    descricao: "Pesagem de rotina: 420 kg",
    detalhe: "GMD 0.85 kg/dia",
  },
  {
    id: "event-2",
    dominio: "sanitario",
    occurred_at: "2026-03-10T14:30:00.000Z",
    animalIdentificacao: "BR-100",
    descricao: "Vacina clostridiose aplicada",
  },
];

describe("TimelineFactual accessibility and structure", () => {
  it("renders semantic ordered list with aria-label and time elements", () => {
    render(<TimelineFactual items={mockItems} title="Linha do Tempo de Teste" />);

    expect(screen.getByRole("list", { name: /Linha do tempo factual/i })).toBeInTheDocument();
    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(2);

    const timeElements = document.querySelectorAll("time");
    expect(timeElements).toHaveLength(2);
    expect(timeElements[0]).toHaveAttribute("dateTime", "2026-03-15T10:00:00.000Z");

    expect(screen.getByText("Pesagem de rotina: 420 kg")).toBeInTheDocument();
    expect(screen.getByText("Vacina clostridiose aplicada")).toBeInTheDocument();
  });

  it("renders accessible empty state when there are no items", () => {
    render(<TimelineFactual items={[]} />);

    expect(
      screen.getByText("Nenhum evento registrado nesta linha do tempo."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
