import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Layout } from "@/components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Chamados from "./pages/Chamados";
import NovoChamado from "./pages/NovoChamado";
import DetalhesChamado from "./pages/DetalhesChamado";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import AcompanhamentoOperacional from "./pages/AcompanhamentoOperacional";
import HistoricoPlacas from "./pages/HistoricoPlacas";
import Transportadoras from "./pages/Transportadoras";
import Tecnologias from "./pages/Tecnologias";
import Confiabilidade from "./pages/Confiabilidade";
import Monitoramento from "./pages/Monitoramento";
import GestaoUsuarios from "./pages/GestaoUsuarios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/chamados" element={<Chamados />} />
        <Route path="/chamados/:id" element={<DetalhesChamado />} />
        <Route path="/novo-chamado" element={<NovoChamado />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/acompanhamento" element={<AcompanhamentoOperacional />} />
        <Route path="/historico-placas" element={<HistoricoPlacas />} />
        <Route path="/transportadoras" element={<Transportadoras />} />
        <Route path="/tecnologias" element={<Tecnologias />} />
        <Route path="/monitoramento" element={<Monitoramento />} />
        <Route path="/gestao-usuarios" element={<GestaoUsuarios />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
