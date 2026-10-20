import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { db } from "../../src/lib/offline/db";
import type {
  Animal,
  Evento,
  EventoPesagem,
} from "../../src/lib/offline/types";
import AnimalSimulacao from "../../src/pages/AnimalSimulacao";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { RequireFarm } from "../../src/components/auth/RequireFarm";
import { setFixtureAuth, useAuth } from "./ux17-auth";
import "../../src/globals.css";

declare global {
  interface Window {
    ux17: {
      pauseAnimalRead: () => void;
      resumeAnimalRead: () => void;
      useSameFarm: () => Promise<void>;
      snapshot: () => Promise<unknown[][]>;
      setAuth: typeof setFixtureAuth;
    };
  }
}

const animals = [
  {
    id: "animal-a",
    fazenda_id: "farm-a",
    identificacao: "ANIMAL-A",
    deleted_at: null,
  },
  {
    id: "animal-b",
    fazenda_id: "farm-b",
    identificacao: "ANIMAL-B",
    deleted_at: null,
  },
] as Animal[];
await db.open();
if (!(await db.state_animais.count())) {
  await db.state_animais.bulkPut(animals);
  for (const [animal, weights] of [
    [animals[0], [400, 410]],
    [animals[1], [700, 720]],
  ] as const) {
    for (const [index, peso_kg] of weights.entries()) {
      const id = `${animal.id}-${index}`;
      await db.event_eventos.put({
        id,
        fazenda_id: animal.fazenda_id,
        animal_id: animal.id,
        dominio: "pesagem",
        occurred_at: `2026-01-${index ? "11" : "01"}T12:00:00.000Z`,
        deleted_at: null,
      } as Evento);
      await db.event_eventos_pesagem.put({
        evento_id: id,
        fazenda_id: animal.fazenda_id,
        peso_kg,
        deleted_at: null,
      } as EventoPesagem);
    }
  }
}

// Read real IndexedDB first, then let the test release the pending response.
const readAnimal = db.state_animais.get.bind(db.state_animais);
let pause = false;
let release: (() => void) | undefined;
db.state_animais.get = ((id: string) => {
  if (!pause) return readAnimal(id);
  pause = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return readAnimal(id).then(async (animal) => {
    await gate;
    return animal;
  });
}) as typeof db.state_animais.get;

window.ux17 = {
  setAuth: setFixtureAuth,
  pauseAnimalRead: () => {
    pause = true;
  },
  resumeAnimalRead: () => {
    release?.();
  },
  snapshot: () => Promise.all(db.tables.map((table) => table.toArray())),
  useSameFarm: async () => {
    await db.state_animais.update("animal-b", { fazenda_id: "farm-a" });
    await db.event_eventos
      .where("animal_id")
      .equals("animal-b")
      .modify({ fazenda_id: "farm-a" });
    await db.event_eventos_pesagem
      .where("fazenda_id")
      .equals("farm-b")
      .modify({ fazenda_id: "farm-a" });
  },
};

export function Fixture() {
  const auth = useAuth();
  return (
    <BrowserRouter>
      <nav aria-label="Contexto de teste">
        <button onClick={() => setFixtureAuth({ activeFarmId: "farm-a" })}>
          Fazenda A
        </button>
        <button onClick={() => setFixtureAuth({ activeFarmId: "farm-b" })}>
          Fazenda B
        </button>
        <Link to="/animais/animal-a/simulacao">Animal A</Link>
        <Link to="/animais/animal-b/simulacao">Animal B</Link>
        <p>Fazenda ativa: {auth.activeFarmId}</p>
      </nav>
      <main>
        <Routes>
          <Route
            path="/animais/:id/simulacao"
            element={
              <RequireAuth>
                <RequireFarm>
                  <AnimalSimulacao />
                </RequireFarm>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<p>LOGIN</p>} />
          <Route path="/select-fazenda" element={<p>ESCOLHER FAZENDA</p>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
