import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { AppShell } from "./components/layout/AppShell";

// Pages
import Home from "./pages/Home";
import Animais from "./pages/Animais";
import AnimalDetalhe from "./pages/AnimalDetalhe";
import Lotes from "./pages/Lotes";
import Pastos from "./pages/Pastos";
import Agenda from "./pages/Agenda";
import Registrar from "./pages/Registrar";
import Dashboard from "./pages/Dashboard";
import Reconciliacao from "./pages/Reconciliacao";
import Placeholder from "./pages/Placeholder";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Placeholder />} />
      <Route path="/select-fazenda" element={<Placeholder />} />
      
      <Route element={<AuthGate><AppShell /></AuthGate>}>
        <Route path="/home" element={<Home />} />
        
        <Route path="/animais" element={<Animais />} />
        <Route path="/animais/:id" element={<AnimalDetalhe />} />
        
        <Route path="/lotes" element={<Lotes />} />
        <Route path="/lotes/:id" element={<Placeholder />} />
        
        <Route path="/pastos" element={<Pastos />} />
        <Route path="/pastos/:id" element={<Placeholder />} />
        
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/registrar" element={<Registrar />} />
        
        <Route path="/eventos" element={<Placeholder />} />
        <Route path="/financeiro" element={<Placeholder />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/perfil" element={<Placeholder />} />
        <Route path="/reconciliacao" element={<Reconciliacao />} />
        <Route path="/admin/membros" element={<Placeholder />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;