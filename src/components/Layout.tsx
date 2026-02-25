import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="flex h-14 items-center justify-between border-b bg-card px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
                Plataforma SAC – Controle de Placas Travadas
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={toggleTheme} title="Alternar tema">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              {profile && (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium leading-none">{profile.nome}</p>
                    <p className="text-xs text-muted-foreground">{profile.cargo}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
