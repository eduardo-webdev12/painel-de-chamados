import { LayoutDashboard, List, PlusCircle, FileText, Settings, Activity, Car, Truck, Cpu, Radio, Users, Shield } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import logoVx from "@/assets/logo-vx.png";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Chamados", url: "/chamados", icon: List },
  { title: "Novo Chamado", url: "/novo-chamado", icon: PlusCircle },
  { title: "Monitoramento", url: "/monitoramento", icon: Radio },
];

const operacionalItems = [
  { title: "Acompanhamento", url: "/acompanhamento", icon: Activity },
  { title: "Histórico Placas", url: "/historico-placas", icon: Car },
  { title: "Transportadoras", url: "/transportadoras", icon: Truck },
  { title: "Tecnologias", url: "/tecnologias", icon: Cpu },
];

const sistemaItems = [
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const adminItems = isAdmin ? [{ title: "Gestão Usuários", url: "/gestao-usuarios", icon: Users }] : [];

  const renderGroup = (label: string, items: typeof mainItems) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar>
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <img src={logoVx} alt="VX Integrações" className="h-9 w-9 rounded-lg object-contain bg-white p-0.5" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground">VX Integrações</span>
          <span className="text-xs text-sidebar-foreground/60">SAC - Monitoramento</span>
        </div>
      </div>
      <SidebarContent className="pt-4">
        {renderGroup("Principal", mainItems)}
        {renderGroup("Operacional", operacionalItems)}
        {renderGroup("Sistema", [...sistemaItems, ...adminItems])}
      </SidebarContent>
    </Sidebar>
  );
}
