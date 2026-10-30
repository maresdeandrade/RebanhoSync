// Dedicated local harness. No Auth replacements, synthetic HTTP replies or local seeds.
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "../../src/hooks/useAuth";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { RequireFarm } from "../../src/components/auth/RequireFarm";
import ProtocolosSanitarios from "../../src/pages/ProtocolosSanitarios";
import "../../src/globals.css";

const endpoint = new URL(import.meta.env.VITE_SUPABASE_URL);
if (endpoint.hostname !== "127.0.0.1" || endpoint.port !== "55421") {
  throw new Error("C05 requires the owned loopback backend");
}

export function Probe() {
  const { user, activeFarmId, role, loading, setActiveFarm, refreshSettings, loadRoleForFarm } = useAuth();
  React.useEffect(() => {
    Object.assign(window, { c05Auth: { setActiveFarm, refreshSettings, loadRoleForFarm } });
  }, [setActiveFarm, refreshSettings, loadRoleForFarm]);
  return <aside aria-label="Contexto C05">
    <output aria-label="Identidade C05">{user?.id ?? "none"}</output>
    <output aria-label="Fazenda C05">{activeFarmId ?? "none"}</output>
    <output aria-label="Papel C05">{role ?? "none"}</output>
    <output aria-label="Loading C05">{String(loading)}</output>
  </aside>;
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider><BrowserRouter><Probe/><Routes>
    <Route path="/login" element={<p>Sessão ausente C05</p>}/>
    <Route path="/select-fazenda" element={<p>Seleção pendente C05</p>}/>
    <Route path="*" element={<RequireAuth><RequireFarm><ProtocolosSanitarios/></RequireFarm></RequireAuth>}/>
  </Routes><Toaster/></BrowserRouter></AuthProvider>,
);
