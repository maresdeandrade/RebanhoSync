import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireFarm } from "./components/auth/RequireFarm";
import { AppShell } from "./components/layout/AppShell";
import { LoadingScreen } from "./components/ui/loading-screen";

const Home = lazy(() => import("./pages/Home"));
const Animais = lazy(() => import("./pages/Animais"));
const AnimaisImportar = lazy(() => import("./pages/AnimaisImportar"));
const AnimalNovo = lazy(() => import("./pages/AnimalNovo"));
const AnimalEditar = lazy(() => import("./pages/AnimalEditar"));
const AnimalDetalhe = lazy(() => import("./pages/AnimalDetalhe"));
const AnimalReproducao = lazy(() => import("./pages/AnimalReproducao"));
const AnimalPosParto = lazy(() => import("./pages/AnimalPosParto"));
const AnimalCriaInicial = lazy(() => import("./pages/AnimalCriaInicial"));
const AnimaisTransicoes = lazy(() => import("./pages/AnimaisTransicoes"));
const Lotes = lazy(() => import("./pages/Lotes"));
const LotesImportar = lazy(() => import("./pages/LotesImportar"));
const LoteNovo = lazy(() => import("./pages/LoteNovo"));
const LoteEditar = lazy(() => import("./pages/LoteEditar"));
const LoteDetalhe = lazy(() => import("./pages/LoteDetalhe"));
const Pastos = lazy(() => import("./pages/Pastos"));
const PastosImportar = lazy(() => import("./pages/PastosImportar"));
const PastoNovo = lazy(() => import("./pages/PastoNovo"));
const PastoEditar = lazy(() => import("./pages/PastoEditar"));
const PastoDetalhe = lazy(() => import("./pages/PastoDetalhe"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Registrar = lazy(() => import("./pages/Registrar"));
const Eventos = lazy(() => import("./pages/Eventos"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Contrapartes = lazy(() => import("./pages/Contrapartes"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Reconciliacao = lazy(() => import("./pages/Reconciliacao"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const SelectFazenda = lazy(() => import("./pages/SelectFazenda"));
const CriarFazenda = lazy(() => import("./pages/CriarFazenda"));
const EditarFazenda = lazy(() => import("./pages/EditarFazenda"));
const AdminMembros = lazy(() => import("./pages/AdminMembros"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Membros = lazy(() => import("./pages/Membros"));
const Categorias = lazy(() => import("./pages/Categorias"));
const CategoriaNova = lazy(() => import("./pages/CategoriaNova"));
const ProtocolosSanitarios = lazy(() => import("./pages/ProtocolosSanitarios"));
const ReproductionDashboard = lazy(() => import("./pages/ReproductionDashboard"));
const OnboardingInicial = lazy(() => import("./pages/OnboardingInicial"));

const App = () => (
  <BrowserRouter
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        <Route path="/invites/:token" element={<AcceptInvite />} />

        <Route
          path="/select-fazenda"
          element={
            <RequireAuth>
              <SelectFazenda />
            </RequireAuth>
          }
        />

        <Route
          path="/criar-fazenda"
          element={
            <RequireAuth>
              <CriarFazenda />
            </RequireAuth>
          }
        />

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
          <Route path="/onboarding-inicial" element={<OnboardingInicial />} />
          <Route path="/animais" element={<Animais />} />
          <Route path="/animais/transicoes" element={<AnimaisTransicoes />} />
          <Route path="/animais/importar" element={<AnimaisImportar />} />
          <Route path="/animais/novo" element={<AnimalNovo />} />
          <Route path="/animais/:id/editar" element={<AnimalEditar />} />
          <Route path="/animais/:id/reproducao" element={<AnimalReproducao />} />
          <Route path="/animais/:id/pos-parto" element={<AnimalPosParto />} />
          <Route path="/animais/:id/cria-inicial" element={<AnimalCriaInicial />} />
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
          <Route path="/lotes" element={<Lotes />} />
          <Route path="/lotes/importar" element={<LotesImportar />} />
          <Route path="/lotes/novo" element={<LoteNovo />} />
          <Route path="/lotes/:id/editar" element={<LoteEditar />} />
          <Route path="/lotes/:id" element={<LoteDetalhe />} />
          <Route path="/pastos" element={<Pastos />} />
          <Route path="/pastos/importar" element={<PastosImportar />} />
          <Route path="/pastos/novo" element={<PastoNovo />} />
          <Route path="/pastos/:id/editar" element={<PastoEditar />} />
          <Route path="/pastos/:id" element={<PastoDetalhe />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/registrar" element={<Registrar />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/contrapartes" element={<Contrapartes />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/membros" element={<Membros />} />
          <Route path="/reconciliacao" element={<Reconciliacao />} />
          <Route path="/admin/membros" element={<AdminMembros />} />
          <Route path="/editar-fazenda" element={<EditarFazenda />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/categorias/novo" element={<CategoriaNova />} />
          <Route
            path="/protocolos-sanitarios"
            element={<ProtocolosSanitarios />}
          />
          <Route path="/reproducao" element={<ReproductionDashboard />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;
