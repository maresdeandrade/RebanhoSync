import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireFarm } from "./components/auth/RequireFarm";
import { AppShell } from "./components/layout/AppShell";

// Pages
import Home from "./pages/Home";
import Animais from "./pages/Animais";
import AnimalNovo from "./pages/AnimalNovo";
import AnimalEditar from "./pages/AnimalEditar";
import AnimalDetalhe from "./pages/AnimalDetalhe";
import Lotes from "./pages/Lotes";
import LoteNovo from "./pages/LoteNovo";
import LoteEditar from "./pages/LoteEditar";
import LoteDetalhe from "./pages/LoteDetalhe";
import Pastos from "./pages/Pastos";
import PastoNovo from "./pages/PastoNovo";
import PastoEditar from "./pages/PastoEditar";
import PastoDetalhe from "./pages/PastoDetalhe";
import Agenda from "./pages/Agenda";
import Registrar from "./pages/Registrar";
import Eventos from "./pages/Eventos";
import Financeiro from "./pages/Financeiro";
import Contrapartes from "./pages/Contrapartes";
import Dashboard from "./pages/Dashboard";
import Reconciliacao from "./pages/Reconciliacao";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import SelectFazenda from "./pages/SelectFazenda";
import CriarFazenda from "./pages/CriarFazenda";
import EditarFazenda from "./pages/EditarFazenda";
import AdminMembros from "./pages/AdminMembros";
import AcceptInvite from "./pages/AcceptInvite";
import Perfil from "./pages/Perfil";
import Membros from "./pages/Membros";
import Categorias from "./pages/Categorias";
import CategoriaNova from "./pages/CategoriaNova";
import ProtocolosSanitarios from "./pages/ProtocolosSanitarios";
import ReproductionDashboard from "./pages/ReproductionDashboard";

const App = () => (
  <BrowserRouter
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Public/semi-public routes */}
      <Route path="/invites/:token" element={<AcceptInvite />} />

      {/* Protegido: requer auth mas não requer fazenda */}
      <Route
        path="/select-fazenda"
        element={
          <RequireAuth>
            <SelectFazenda />
          </RequireAuth>
        }
      />

      {/* ✅ Criar Fazenda: requer auth mas NÃO requer fazenda ativa */}
      <Route
        path="/criar-fazenda"
        element={
          <RequireAuth>
            <CriarFazenda />
          </RequireAuth>
        }
      />

      {/* Rotas protegidas: requer auth + fazenda ativa */}
      <Route
        element={
          <RequireAuth>
            <RequireFarm>
              <AppShell />
            </RequireFarm>
          </RequireAuth>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/animais" element={<Animais />} />
        <Route path="/animais/novo" element={<AnimalNovo />} />
        <Route path="/animais/:id/editar" element={<AnimalEditar />} />
        <Route path="/animais/:id" element={<AnimalDetalhe />} />
        <Route path="/lotes" element={<Lotes />} />
        <Route path="/lotes/novo" element={<LoteNovo />} />
        <Route path="/lotes/:id/editar" element={<LoteEditar />} />
        <Route path="/lotes/:id" element={<LoteDetalhe />} />
        <Route path="/pastos" element={<Pastos />} />
        <Route path="/pastos/novo" element={<PastoNovo />} />
        <Route path="/pastos/:id/editar" element={<PastoEditar />} />
        <Route path="/pastos/:id" element={<PastoDetalhe />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/registrar" element={<Registrar />} />
        <Route path="/eventos" element={<Eventos />} />
        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/contrapartes" element={<Contrapartes />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/membros" element={<Membros />} />
        <Route path="/reconciliacao" element={<Reconciliacao />} />
        <Route path="/admin/membros" element={<AdminMembros />} />
        <Route path="/editar-fazenda" element={<EditarFazenda />} />
        <Route path="/categorias" element={<Categorias />} />
        <Route path="/categorias/novo" element={<CategoriaNova />} />
        <Route path="/protocolos-sanitarios" element={<ProtocolosSanitarios />} />
        <Route path="/reproducao" element={<ReproductionDashboard />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
