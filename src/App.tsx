import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { AppShell } from "./components/layout/AppShell";

// Pages
import Home from "./pages/Home";
import Animais from "./pages/Animais";
import AnimalDetalhe from "./pages/AnimalDetalhe";
import Registrar from "./pages/Registrar";
import Dashboard from "./pages/Dashboard";
import Reconciliacao from "./pages/Reconciliacao";
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
          <Route path="/login" element={<Placeholder />} />
          
          <Route element={<AuthGate><AppShell /></AuthGate>}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/animais" element={<Animais />} />
            <Route path="/animais/:id" element={<AnimalDetalhe />} />
            <Route path="/registrar" element={<Registrar />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reconciliacao" element={<Reconciliacao />} />
            
            {/* Placeholders para o resto */}
            <Route path="/lotes" element={<Placeholder />} />
            <Route path="/pastos" element={<Placeholder />} />
            <Route path="/agenda" element={<Placeholder />} />
            <Route path="/eventos" element={<Placeholder />} />
            <Route path="/financeiro" element={<Placeholder />} />
            <Route path="/perfil" element={<Placeholder />} />
            <Route path="/admin/membros" element={<Placeholder />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;