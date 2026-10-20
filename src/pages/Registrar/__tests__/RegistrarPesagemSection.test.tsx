/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrarPesagemSection } from "../components/RegistrarPesagemSection";

const animais = [
  { id: "animal-1", identificacao: "BOI-001" },
  { id: "animal-2", identificacao: "BOI-002" },
];
const baseProps = {
  selectedAnimalIds: animais.map((animal) => animal.id),
  animaisNoLote: animais,
  invalidAnimalIds: [] as string[],
  weightInputStep: 0.1,
  weightUnitLabel: "kg",
  pesagemData: { "animal-1": "350.5", "animal-2": "400" },
  onPesoChange: vi.fn(),
};
afterEach(cleanup);
describe("acessibilidade da pesagem individual", () => {
  it("associa nome, animal e unidade ao input por label nativo", () => {
    render(<RegistrarPesagemSection {...baseProps} />);
    for (const animal of animais) {
      const input = screen.getByRole<HTMLInputElement>("spinbutton", {
        name: "Peso do animal " + animal.identificacao + " (kg)",
      });
      expect(input).toHaveAccessibleName(
        "Peso do animal " + animal.identificacao + " (kg)",
      );
      expect(input).toHaveAttribute("id");
      expect(input).toHaveAttribute("step", "0.1");
      const label = input.labels?.[0];
      expect(label).toHaveAttribute("for", input.id);
      expect(label).toHaveTextContent(animal.identificacao);
    }
  });
  it("mantem IDs exclusivos entre animais e instancias e estaveis ao reordenar", () => {
    const view = render(
      <>
        <RegistrarPesagemSection {...baseProps} />
        <RegistrarPesagemSection {...baseProps} />
      </>,
    );
    const firstIds = screen.getAllByRole("spinbutton").map((input) => input.id);
    expect(new Set(firstIds).size).toBe(4);
    view.rerender(
      <>
        <RegistrarPesagemSection
          {...baseProps}
          selectedAnimalIds={["animal-2", "animal-1"]}
        />
        <RegistrarPesagemSection {...baseProps} />
      </>,
    );
    const reordered = screen
      .getAllByRole("spinbutton")
      .map((input) => input.id);
    expect(reordered).toEqual([
      firstIds[1],
      firstIds[0],
      firstIds[2],
      firstIds[3],
    ]);
  });
  it("associa o erro somente ao animal invalido e limpa a associacao quando valido", () => {
    const view = render(
      <RegistrarPesagemSection
        {...baseProps}
        invalidAnimalIds={["animal-1"]}
      />,
    );
    const invalid = screen.getByRole("spinbutton", { name: /BOI-001/ });
    const valid = screen.getByRole("spinbutton", { name: /BOI-002/ });
    expect(invalid).toHaveAttribute("aria-invalid", "true");
    expect(invalid).toHaveAccessibleDescription(
      "Peso deve ser maior que zero.",
    );
    expect(
      document.getElementById(invalid.getAttribute("aria-describedby")!),
    ).toHaveTextContent("Peso deve ser maior que zero.");
    expect(valid).toHaveAttribute("aria-invalid", "false");
    expect(valid).not.toHaveAttribute("aria-describedby");
    const previousId = invalid.id;
    view.rerender(
      <RegistrarPesagemSection {...baseProps} invalidAnimalIds={[]} />,
    );
    expect(screen.getByRole("spinbutton", { name: /BOI-001/ })).toHaveAttribute(
      "id",
      previousId,
    );
    expect(invalid).toHaveAttribute("aria-invalid", "false");
    expect(invalid).not.toHaveAttribute("aria-describedby");
    expect(
      screen.queryByText("Peso deve ser maior que zero."),
    ).not.toBeInTheDocument();
  });
  it("nao compartilha IDs de erro entre campos invalidos", () => {
    render(
      <RegistrarPesagemSection
        {...baseProps}
        invalidAnimalIds={["animal-1", "animal-2"]}
      />,
    );
    const inputs = screen.getAllByRole("spinbutton");
    const errorIds = inputs.map((input) =>
      input.getAttribute("aria-describedby"),
    );
    expect(new Set(errorIds).size).toBe(2);
    inputs.forEach((input) =>
      expect(input).toHaveAccessibleDescription(
        "Peso deve ser maior que zero.",
      ),
    );
  });
  it("acompanha a unidade e conserva nome pelo ID quando o animal ainda nao carregou", () => {
    render(
      <RegistrarPesagemSection
        {...baseProps}
        animaisNoLote={undefined}
        weightUnitLabel="@"
      />,
    );
    expect(
      screen.getByRole("spinbutton", { name: "Peso do animal animal-1 (@)" }),
    ).toBeInTheDocument();
  });
  it("preserva valores e callback bruto sem conversao ou persistencia", () => {
    const onPesoChange = vi.fn();
    render(
      <RegistrarPesagemSection {...baseProps} onPesoChange={onPesoChange} />,
    );
    const input = screen.getByRole("spinbutton", { name: /BOI-001/ });
    expect(input).toHaveValue(350.5);
    fireEvent.change(input, { target: { value: "351.75" } });
    expect(onPesoChange).toHaveBeenCalledExactlyOnceWith("animal-1", "351.75");
  });
  it("permite foco por Tab, digitacao e atualizacao controlada", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [pesagemData, setData] = useState<Record<string, string>>({});
      return (
        <RegistrarPesagemSection
          {...baseProps}
          pesagemData={pesagemData}
          onPesoChange={(id, value) =>
            setData((previous) => ({ ...previous, [id]: value }))
          }
        />
      );
    }
    render(<Controlled />);
    const first = screen.getByRole("spinbutton", { name: /BOI-001/ });
    const second = screen.getByRole("spinbutton", { name: /BOI-002/ });
    await user.tab();
    expect(first).toHaveFocus();
    await user.keyboard("350.5");
    expect(first).toHaveValue(350.5);
    await user.tab();
    expect(second).toHaveFocus();
    await user.keyboard("400");
    expect(second).toHaveValue(400);
    await user.tab({ shift: true });
    expect(first).toHaveFocus();
  });
});
