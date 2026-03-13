import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Moon, Sun, User, MessageCircle, Cpu, Truck, Save } from "lucide-react";

interface ContatoItem {
  nome: string;
  numero: string;
}

export default function Configuracoes() {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useAuth();

  const [tecContatos, setTecContatos] = useState<ContatoItem[]>([]);
  const [transpContatos, setTranspContatos] = useState<ContatoItem[]>([]);
  const [loadingContatos, setLoadingContatos] = useState(true);

  const fetchContatos = useCallback(async () => {
    setLoadingContatos(true);
    const [tecRes, transpRes] = await Promise.all([
      supabase.from("tecnologia_contatos").select("tecnologia, whatsapp_numero").order("tecnologia"),
      supabase.from("transportadora_contatos" as any).select("transportadora, whatsapp_numero").order("transportadora" as any),
    ]);
    setTecContatos((tecRes.data || []).map((d: any) => ({ nome: d.tecnologia, numero: d.whatsapp_numero })));
    setTranspContatos((transpRes.data || []).map((d: any) => ({ nome: d.transportadora, numero: d.whatsapp_numero })));
    setLoadingContatos(false);
  }, []);

  useEffect(() => { fetchContatos(); }, [fetchContatos]);

  const updateTecNumero = (index: number, numero: string) => {
    setTecContatos(prev => prev.map((c, i) => i === index ? { ...c, numero } : c));
  };

  const updateTranspNumero = (index: number, numero: string) => {
    setTranspContatos(prev => prev.map((c, i) => i === index ? { ...c, numero } : c));
  };

  const salvarTecContatos = async () => {
    try {
      for (const c of tecContatos) {
        if (!c.numero.trim()) continue;
        await supabase.from("tecnologia_contatos").upsert(
          { tecnologia: c.nome, whatsapp_numero: c.numero.trim() } as any,
          { onConflict: "tecnologia" }
        );
      }
      toast({ title: "Números de tecnologias salvos" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    }
  };

  const salvarTranspContatos = async () => {
    try {
      for (const c of transpContatos) {
        if (!c.numero.trim()) continue;
        await supabase.from("transportadora_contatos" as any).upsert(
          { transportadora: c.nome, whatsapp_numero: c.numero.trim() } as any,
          { onConflict: "transportadora" }
        );
      }
      toast({ title: "Números de transportadoras salvos" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    }
  };

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

      {/* WhatsApp Automático */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp Automático
          </CardTitle>
          <CardDescription>
            Configure os números de WhatsApp para envio automático de mensagens para tecnologias e transportadoras.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingContatos ? (
            <p className="text-sm text-muted-foreground">Carregando contatos...</p>
          ) : (
            <>
              {/* Tecnologias */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Cpu className="h-4 w-4 text-green-600" />
                  Números das Tecnologias
                </Label>
                {tecContatos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma tecnologia cadastrada. Os números são registrados ao enviar WhatsApp nos detalhes do chamado.</p>
                ) : (
                  <div className="space-y-2">
                    {tecContatos.map((c, i) => (
                      <div key={c.nome} className="flex items-center gap-2">
                        <span className="text-sm font-medium w-32 truncate">{c.nome}</span>
                        <Input
                          placeholder="5511999999999"
                          value={c.numero}
                          onChange={(e) => updateTecNumero(i, e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {tecContatos.length > 0 && (
                  <Button variant="outline" size="sm" onClick={salvarTecContatos} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Salvar Tecnologias
                  </Button>
                )}
              </div>

              {/* Transportadoras */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4 text-blue-600" />
                  Números das Transportadoras
                </Label>
                {transpContatos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma transportadora cadastrada. Os números são registrados ao enviar WhatsApp nos detalhes do chamado.</p>
                ) : (
                  <div className="space-y-2">
                    {transpContatos.map((c, i) => (
                      <div key={c.nome} className="flex items-center gap-2">
                        <span className="text-sm font-medium w-32 truncate">{c.nome}</span>
                        <Input
                          placeholder="5511999999999"
                          value={c.numero}
                          onChange={(e) => updateTranspNumero(i, e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {transpContatos.length > 0 && (
                  <Button variant="outline" size="sm" onClick={salvarTranspContatos} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Salvar Transportadoras
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
