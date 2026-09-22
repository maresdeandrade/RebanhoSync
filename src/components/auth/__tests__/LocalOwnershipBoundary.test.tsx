/** @vitest-environment jsdom */
import "@testing-library/jest-dom";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocalOwnershipBoundary } from "../LocalOwnershipBoundary";
import { UNKNOWN_LOCAL_RESET_CONFIRMATION } from "@/lib/offline/unknownOwnershipRecovery";

const mocks = vi.hoisted(() => ({
  localOwnership: null as null | {
    status: "OWNED" | "MISMATCH" | "UNKNOWN";
    ownerUserId: string | null;
    currentUserId: string | null;
  },
  resetUnknownLocalDatabase: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ localOwnership: mocks.localOwnership }),
}));

vi.mock("@/lib/offline/unknownOwnershipRecovery", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/offline/unknownOwnershipRecovery")
  >();
  return {
    ...original,
    resetUnknownLocalDatabase: mocks.resetUnknownLocalDatabase,
  };
});

beforeEach(() => {
  mocks.localOwnership = null;
  mocks.resetUnknownLocalDatabase.mockReset();
  mocks.resetUnknownLocalDatabase.mockResolvedValue("DATABASE_DELETED");
});

describe("LocalOwnershipBoundary", () => {
  it("renders protected content when UNKNOWN recovery is not applicable", () => {
    mocks.localOwnership = {
      status: "MISMATCH",
      ownerUserId: "user-a",
      currentUserId: "user-b",
    };

    render(
      <LocalOwnershipBoundary>
        <p>Conteúdo protegido</p>
      </LocalOwnershipBoundary>,
    );

    expect(screen.getByText("Conteúdo protegido")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Limpar dados locais e continuar" }),
    ).not.toBeInTheDocument();
  });

  it("blocks content, preserves data on cancel, and resets only after confirmation", async () => {
    const user = userEvent.setup();
    mocks.localOwnership = {
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId: "user-current",
    };

    render(
      <LocalOwnershipBoundary>
        <p>Conteúdo legado secreto</p>
      </LocalOwnershipBoundary>,
    );

    expect(screen.queryByText("Conteúdo legado secreto")).not.toBeInTheDocument();
    expect(
      screen.getByText("Dados locais não podem ser verificados"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Dados ainda não sincronizados serão descartados/),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Limpar dados locais e continuar" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.resetUnknownLocalDatabase).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Limpar dados locais e continuar" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Limpar definitivamente" }),
    );

    expect(mocks.resetUnknownLocalDatabase).toHaveBeenCalledWith({
      confirmation: UNKNOWN_LOCAL_RESET_CONFIRMATION,
    });
  });
});
