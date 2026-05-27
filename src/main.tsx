import { createRoot } from "react-dom/client";
// DS §3.1 — Inter variable font (offline-safe, via @fontsource-variable/inter)
import "@fontsource-variable/inter";
import App from "./App.tsx";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster as AppToaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/react";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
    <AppToaster />
    <SonnerToaster />
    <Analytics />
  </AuthProvider>,
);
