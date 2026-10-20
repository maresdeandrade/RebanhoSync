import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "../../src/components/layout/AppShell";
import { MobileFormActions } from "../../src/components/layout/MobileFormActions";
import { Button } from "../../src/components/ui/button";
import AnimalDetalhe from "../../src/pages/AnimalDetalhe";
import AnimaisImportar from "../../src/pages/AnimaisImportar";
import OnboardingInicial from "../../src/pages/OnboardingInicial";
import { db } from "../../src/lib/offline/db";
import type { Animal, Lote } from "../../src/lib/offline/types";
import "../../src/globals.css";

Object.assign(window, { React, unexpectedActions: [] });
const longId = "BR" + "1234567890".repeat(12);
const longLot = "Lote" + "Matrizes".repeat(20);
const stamp = "2026-10-01T00:00:00.000Z";
// Somente o IndexedDB descartavel do contexto Playwright recebe esta fixture.
await db.state_animais.put({
  id: "responsive-animal",
  fazenda_id: "responsive-farm",
  identificacao: longId,
  nome: "Estrela " + "do Cerrado ".repeat(12),
  sexo: "M",
  especie: "bovino",
  status: "ativo",
  lote_id: "responsive-lot",
  data_nascimento: "2024-01-10",
  data_entrada: null,
  data_saida: null,
  pai_id: null,
  mae_id: null,
  rfid: null,
  origem: "nascimento",
  raca: "nelore",
  papel_macho: null,
  habilitado_monta: false,
  observacoes: null,
  payload: { lifecycle: { estagio_vida: "recria" } },
  client_id: "fixture",
  client_op_id: "fixture-animal",
  client_tx_id: null,
  client_recorded_at: stamp,
  server_received_at: stamp,
  created_at: stamp,
  updated_at: stamp,
  deleted_at: null,
} as Animal);
await db.state_lotes.put({
  id: "responsive-lot",
  fazenda_id: "responsive-farm",
  nome: longLot,
  status: "ativo",
  payload: {},
  created_at: stamp,
  updated_at: stamp,
  deleted_at: null,
} as Lote);

export function FormFixture() {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        (
          window as unknown as { unexpectedActions: string[] }
        ).unexpectedActions.push("submit");
      }}
    >
      <h1>Regressao UX04 e UX05</h1>
      <div className="min-h-screen py-16">
        <label htmlFor="fixture-field">Campo de destino</label>
        <input id="fixture-field" />
      </div>
      <MobileFormActions>
        <Button type="button">Cancelar</Button>
        <Button type="submit">Salvar cadastro</Button>
      </MobileFormActions>
    </form>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route
        element={
          <main className="app-content py-5">
            <Outlet />
          </main>
        }
      >
        <Route path="/responsive/animal/:id" element={<AnimalDetalhe />} />
        <Route path="/responsive/importar" element={<AnimaisImportar />} />
        <Route path="/responsive/onboarding" element={<OnboardingInicial />} />
      </Route>
      <Route element={<AppShell />}>
        <Route path="/responsive-shell" element={<FormFixture />} />
        <Route path="*" element={<h1>Destino de navegacao</h1>} />
      </Route>
    </Routes>
  </BrowserRouter>,
);
