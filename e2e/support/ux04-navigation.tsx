import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AppShell } from "../../src/components/layout/AppShell";
import "../../src/globals.css";

// The browser test isolates services; navigation, Sheet and CSS are production code.
Object.assign(window, { React });

export function Destination() {
  const location = useLocation();
  const navigate = useNavigate();
  React.useEffect(() => {
    const onNavigate = (event: Event) =>
      navigate((event as CustomEvent<string>).detail);
    window.addEventListener("ux04:navigate", onNavigate);
    return () => window.removeEventListener("ux04:navigate", onNavigate);
  }, [navigate]);
  return (
    <>
      <h1>
        {location.pathname}
        {location.search}
        {location.hash}
      </h1>
      <input aria-label="Campo de destino" />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route element={<AppShell />}>
        <Route path="*" element={<Destination />} />
      </Route>
    </Routes>
  </BrowserRouter>,
);
