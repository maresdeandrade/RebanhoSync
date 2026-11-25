// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeFarmId: "farm-a",
  role: "owner" as string | null,
  requests: [] as Array<{
    farmId: string;
    resolve: (result: {
      data: { nome: string } | null;
      error: unknown;
    }) => void;
  }>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ activeFarmId: mocks.activeFarmId, role: mocks.role }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      select: () => ({
        eq: (_column: string, farmId: string) => ({
          is: () => ({
            single: () =>
              new Promise((resolve) => {
                mocks.requests.push({
                  farmId,
                  resolve: resolve as (result: {
                    data: { nome: string } | null;
                    error: unknown;
                  }) => void,
                });
              }),
          }),
        }),
      }),
    }),
  },
}));

import { TopBar } from "@/components/layout/TopBar";

function view() {
  return (
    <MemoryRouter>
      <TopBar />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  mocks.activeFarmId = "farm-a";
  mocks.role = "owner";
  mocks.requests.length = 0;
});

describe("TopBar farm context", () => {
  it("does not pair the previous farm name with the new farm role during a delayed or failed lookup", async () => {
    const { rerender } = render(view());
    await waitFor(() => expect(mocks.requests).toHaveLength(1));
    expect(mocks.requests[0].farmId).toBe("farm-a");
    mocks.requests[0].resolve({ data: { nome: "Fazenda A" }, error: null });
    expect(await screen.findByText("Fazenda A")).toBeVisible();
    expect(screen.getByText("Proprietario")).toBeVisible();

    mocks.activeFarmId = "farm-b";
    mocks.role = "cowboy";
    rerender(view());
    await waitFor(() => expect(mocks.requests).toHaveLength(2));

    expect(screen.queryByText("Fazenda A")).not.toBeInTheDocument();
    expect(screen.queryByText("Operacao")).not.toBeInTheDocument();

    mocks.requests[1].resolve({
      data: null,
      error: new Error("network unavailable"),
    });
    await waitFor(() =>
      expect(screen.queryByText("Fazenda A")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Operacao")).not.toBeInTheDocument();
  });
});
