import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Moon, Sun, User } from "lucide-react";

export default function Configuracoes() {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize sua experiência na plataforma</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between border-b pb-2">
            <span className="text-sm text-muted-foreground">Nome</span>
            <span className="text-sm font-medium">{profile?.nome || "—"}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{profile?.email || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Cargo</span>
            <span className="text-sm font-medium">{profile?.cargo || "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tema da Interface</CardTitle>
          <CardDescription>Escolha entre tema claro ou escuro</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => theme !== "light" && toggleTheme()}
              className="flex items-center gap-2"
            >
              <Sun className="h-4 w-4" />
              Tema Claro
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => theme !== "dark" && toggleTheme()}
              className="flex items-center gap-2"
            >
              <Moon className="h-4 w-4" />
              Tema Escuro
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
