import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { AppShell } from "./components/layout/AppShell";

// Pages
import Home from "./pages/Home";
import Placeholder from "./pages/Placeholder";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Placeholder />} />
          
          {/* Rotas Protegidas */}
          <Route element={<AuthGate><AppShell /></AuthGate>}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/select-fazenda" element={<Placeholder />} />
            <Route path="/animais" element={<Placeholder />} />
            <Route path="/animais/:id" element={<Placeholder />} />
            <Route path="/lotes" element={<Placeholder />} />
            <Route path="/lotes/:id" element={<Placeholder />} />
            <Route path="/pastos" element={<Placeholder />} />
            <Route path="/pastos/:id" element={<Placeholder />} />
            <Route path="/agenda" element={<Placeholder />} />
            <Route path="/registrar" element={<Placeholder />} />
            <Route path="/eventos" element={<Placeholder />} />
            <Route path="/financeiro" element={<Placeholder />} />
            <Route path="/dashboard" element={<Placeholder />} />
            <Route path="/perfil" element={<Placeholder />} />
            <Route path="/reconciliacao" element={<Placeholder />} />
            <Route path="/admin/membros" element={<Placeholder />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;