import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Analytics } from "@vercel/analytics/react";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
    <Analytics />
  </AuthProvider>,
);
