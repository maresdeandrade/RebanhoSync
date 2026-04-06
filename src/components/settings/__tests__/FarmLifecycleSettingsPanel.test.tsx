/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FarmLifecycleSettingsPanel } from "@/components/settings/FarmLifecycleSettingsPanel";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";

describe("FarmLifecycleSettingsPanel", () => {
  it("submits updated lifecycle thresholds", () => {
    const onSave = vi.fn();

    render(
      <FarmLifecycleSettingsPanel
        canManage
        config={DEFAULT_FARM_LIFECYCLE_CONFIG}
        weightUnit="kg"
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Faixa neonatal (dias)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Meta de desmame (dias)"), {
      target: { value: "240" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar regras/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        neonatal_days: 10,
        weaning_days: 240,
        default_transition_mode:
          DEFAULT_FARM_LIFECYCLE_CONFIG.default_transition_mode,
        stage_classification_basis:
          DEFAULT_FARM_LIFECYCLE_CONFIG.stage_classification_basis,
      }),
    );
  });

  it("converts arroba input back to kg before saving", () => {
    const onSave = vi.fn();

    render(
      <FarmLifecycleSettingsPanel
        canManage
        config={DEFAULT_FARM_LIFECYCLE_CONFIG}
        weightUnit="arroba"
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Meta de desmame (arroba)"), {
      target: { value: "13" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar regras/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        weaning_weight_kg: 195,
      }),
    );
  });
});
