import { createRoot } from "react-dom/client";
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
