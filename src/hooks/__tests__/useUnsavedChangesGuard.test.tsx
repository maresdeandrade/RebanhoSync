// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  createMemoryRouter,
  Link,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

function LocationDisplay() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function DeferredSaveForm() {
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const blocker = useUnsavedChangesGuard({
    isDirty: draft.length > 0,
    isSaving,
  });

  const save = () => {
    setIsSaving(true);
    void new Promise<void>((_resolve, reject) => {
      window.setTimeout(() => reject(new Error("persist failed")), 20);
    })
      .catch(() => setSaveError(true))
      .finally(() => setIsSaving(false));
  };

  return (
    <main>
      <LocationDisplay />
      <label>
        Rascunho
        <input
          aria-label="Rascunho"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <button type="button" onClick={save} disabled={isSaving}>
        {isSaving ? "Salvando" : "Salvar"}
      </button>
      <Link to="/destino">Sair</Link>
      {saveError && <p role="alert">Falha ao salvar</p>}
      {blocker.state === "blocked" && <p role="dialog">Navegação bloqueada</p>}
    </main>
  );
}

describe("useUnsavedChangesGuard", () => {
  it("preserva o rascunho e bloqueia navegação até a persistência pendente ser confirmada", async () => {
    const router = createMemoryRouter(
      [
        { path: "/formulario", element: <DeferredSaveForm /> },
        {
          path: "/destino",
          element: (
            <>
              <LocationDisplay />
              <p>Página de destino</p>
            </>
          ),
        },
      ],
      { initialEntries: ["/formulario"] },
    );
    render(<RouterProvider router={router} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Rascunho" }), {
      target: { value: "alteração ainda não confirmada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    fireEvent.click(screen.getByRole("link", { name: "Sair" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/formulario");
    expect(screen.getByRole("textbox", { name: "Rascunho" })).toHaveValue(
      "alteração ainda não confirmada",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao salvar",
    );
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/formulario"),
    );
    expect(screen.getByRole("textbox", { name: "Rascunho" })).toHaveValue(
      "alteração ainda não confirmada",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Navegação bloqueada");
  });
});
