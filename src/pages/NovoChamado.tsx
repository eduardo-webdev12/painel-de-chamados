import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useChamados } from "@/hooks/useChamados";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function AutocompleteInput({
  id,
  placeholder,
  value,
  onChange,
  suggestions,
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return suggestions.slice(0, 8);
    return suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
  }, [value, suggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setFocused(false)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[180px] overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NovoChamado() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { chamados } = useChamados();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    placa: "",
    transportadora: "",
    tecnologia: "",
    descricao: "",
    observacao: "",
    horaTravou: "",
    recorrente: false,
  });

  // Build suggestion lists from existing data
  const transportadoraSuggestions = useMemo(() => [...new Set(chamados.map((c) => c.transportadora))].sort(), [chamados]);
  const tecnologiaSuggestions = useMemo(() => [...new Set(chamados.map((c) => c.tecnologia))].sort(), [chamados]);

  const update = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.placa || !form.transportadora || !form.tecnologia || !form.descricao) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const now = new Date();
    const horaTravou = form.horaTravou ? new Date(form.horaTravou).toISOString() : now.toISOString();
    const diffMs = now.getTime() - new Date(horaTravou).getTime();
    const diffMin = Math.round(diffMs / 60000);
    const tempoTravada = diffMin < 60 ? `${diffMin} min` : `${(diffMin / 60).toFixed(1)} h`;

    const { data: inserted, error } = await supabase.from("chamados").insert({
      placa: form.placa.toUpperCase(),
      transportadora: form.transportadora,
      tecnologia: form.tecnologia,
      descricao: form.descricao,
      observacao: form.observacao,
      hora_travou: horaTravou,
      tempo_travada: tempoTravada,
      recorrente: form.recorrente,
      contagem_recorrencia: form.recorrente ? 1 : 0,
      criado_por: user?.id || null,
      created_by_name: profile?.nome || null,
      created_by_email: profile?.email || null,
      created_by_role: profile?.cargo || null,
    }).select("id").single();

    if (error) {
      setLoading(false);
      toast({ title: "Erro ao criar chamado", description: error.message, variant: "destructive" });
      return;
    }

    // Add historico entry
    if (inserted?.id) {
      await supabase.from("chamado_historico").insert({
        chamado_id: inserted.id,
        acao: "Chamado criado",
        detalhes: `Placa: ${form.placa.toUpperCase()} — ${form.transportadora}`,
        usuario_nome: profile?.nome || null,
        usuario_email: profile?.email || null,
        usuario_cargo: profile?.cargo || null,
        usuario_id: user?.id || null,
      });
    }

    setLoading(false);
    toast({ title: "Chamado criado", description: `Chamado para placa ${form.placa.toUpperCase()} registrado.` });
    navigate("/chamados");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo Chamado</h1>
        <p className="text-sm text-muted-foreground">Registrar nova ocorrência de placa travada</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Chamado</CardTitle>
          <CardDescription>
            Data/hora: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · Status: Aberto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="placa">Placa do veículo *</Label>
                <Input id="placa" placeholder="ABC-1234" value={form.placa} onChange={(e) => update("placa", e.target.value)} className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportadora">Transportadora *</Label>
                <AutocompleteInput
                  id="transportadora"
                  placeholder="Nome da transportadora"
                  value={form.transportadora}
                  onChange={(v) => update("transportadora", v)}
                  suggestions={transportadoraSuggestions}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tecnologia">Tecnologia / Rastreador *</Label>
                <AutocompleteInput
                  id="tecnologia"
                  placeholder="Ex: Sascar, Autotrac..."
                  value={form.tecnologia}
                  onChange={(v) => update("tecnologia", v)}
                  suggestions={tecnologiaSuggestions}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horaTravou">Hora que a placa travou</Label>
                <Input id="horaTravou" type="datetime-local" value={form.horaTravou} onChange={(e) => update("horaTravou", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição detalhada do problema *</Label>
              <Textarea id="descricao" placeholder="Descreva o problema encontrado..." rows={4} value={form.descricao} onChange={(e) => update("descricao", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação (histórico/recorrência)</Label>
              <Textarea id="observacao" placeholder="Informações adicionais..." rows={3} value={form.observacao} onChange={(e) => update("observacao", e.target.value)} />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="recorrente" checked={form.recorrente} onCheckedChange={(v) => update("recorrente", !!v)} />
              <Label htmlFor="recorrente" className="cursor-pointer">Marcar como recorrente</Label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>{loading ? "Registrando..." : "Registrar Chamado"}</Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
