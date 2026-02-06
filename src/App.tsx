import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireFarm } from "./components/auth/RequireFarm";
import { AppShell } from "./components/layout/AppShell";

// Pages
import Home from "./pages/Home";
import Animais from "./pages/Animais";
import AnimalNovo from "./pages/AnimalNovo";
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
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import SelectFazenda from "./pages/SelectFazenda";
import AdminMembros from "./pages/AdminMembros";
import AcceptInvite from "./pages/AcceptInvite";
import Perfil from "./pages/Perfil";

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      
      {/* Public/semi-public routes */}
      <Route path="/invites/:token" element={<AcceptInvite />} />
      
      {/* Protegido: requer auth mas não requer fazenda */}
      <Route path="/select-fazenda" element={
        <RequireAuth>
          <SelectFazenda />
        </RequireAuth>
      } />
      
      {/* Rotas protegidas: requer auth + fazenda ativa */}
      <Route element={
        <RequireAuth>
          <RequireFarm>
            <AppShell />
          </RequireFarm>
        </RequireAuth>
      }>
        <Route path="/home" element={<Home />} />
        <Route path="/animais" element={<Animais />} />
        <Route path="/animais/novo" element={<AnimalNovo />} />
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
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/reconciliacao" element={<Reconciliacao />} />
        <Route path="/admin/membros" element={<AdminMembros />} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;