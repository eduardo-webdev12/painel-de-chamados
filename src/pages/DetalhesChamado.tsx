import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, RotateCcw } from "lucide-react";
import type { ChamadoDB } from "@/hooks/useChamados";
import type { StatusChamado } from "@/types/chamado";

export default function DetalhesChamado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chamado, setChamado] = useState<ChamadoDB | null>(null);
  const [observacao, setObservacao] = useState("");
  const [status, setStatus] = useState<StatusChamado>("Aberto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("chamados").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (data) {
        setChamado(data);
        setObservacao(data.observacao || "");
        setStatus(data.status as StatusChamado);
      }
      setLoading(false);
    });
  }, [id]);

  // Live timer
  const tempoAtual = useMemo(() => {
    if (!chamado || !chamado.hora_travou || chamado.status === "Resolvido") return chamado?.tempo_travada || "—";
    const diff = differenceInMinutes(new Date(), parseISO(chamado.hora_travou));
    return diff < 60 ? `${diff} min` : `${(diff / 60).toFixed(1)} h`;
  }, [chamado]);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  if (!chamado) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Chamado não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/chamados")}>Voltar</Button>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    const updates: any = { observacao, status };
    if (status === "Resolvido" && chamado.status !== "Resolvido") {
      updates.data_resolucao = new Date().toISOString();
      // Calc final tempo_travada
      if (chamado.hora_travou) {
        const diff = differenceInMinutes(new Date(), parseISO(chamado.hora_travou));
        updates.tempo_travada = diff < 60 ? `${diff} min` : `${(diff / 60).toFixed(1)} h`;
      }
    }
    const { error } = await supabase.from("chamados").update(updates).eq("id", chamado.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setChamado({ ...chamado, ...updates });
    toast({ title: "Chamado atualizado" });
  };

  const handleVoltouTravar = async () => {
    setSaving(true);
    const { error } = await supabase.from("chamados").update({
      status: "Aberto",
      data_resolucao: null,
      recorrente: true,
      contagem_recorrencia: chamado.contagem_recorrencia + 1,
      hora_travou: new Date().toISOString(),
    }).eq("id", chamado.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setChamado({
      ...chamado,
      status: "Aberto",
      data_resolucao: null,
      recorrente: true,
      contagem_recorrencia: chamado.contagem_recorrencia + 1,
      hora_travou: new Date().toISOString(),
    });
    toast({ title: "Placa marcada como travada novamente", description: `Recorrência: ${chamado.contagem_recorrencia + 1}x` });
  };

  const infoRows = [
    { label: "Placa", value: chamado.placa },
    { label: "Transportadora", value: chamado.transportadora },
    { label: "Tecnologia", value: chamado.tecnologia },
    { label: "Tempo Travada", value: tempoAtual },
    { label: "Recorrente", value: chamado.recorrente ? `Sim (${chamado.contagem_recorrencia}x)` : "Não" },
    { label: "Criado por", value: chamado.created_by_name || "—" },
    { label: "Cargo", value: chamado.created_by_role || "—" },
    { label: "Data de Abertura", value: format(parseISO(chamado.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) },
    ...(chamado.data_resolucao ? [{ label: "Data de Resolução", value: format(parseISO(chamado.data_resolucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) }] : []),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chamado – {chamado.placa}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={chamado.status as StatusChamado} />
            {chamado.recorrente && <span className="text-xs text-destructive font-medium">Recorrente ({chamado.contagem_recorrencia}x)</span>}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {infoRows.map((row) => (
            <div key={row.label} className="flex justify-between border-b pb-2 last:border-0">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-sm font-medium">{row.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{chamado.descricao}</p></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Atualizar Chamado</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusChamado)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Em Tratativa">Em Tratativa</SelectItem>
                <SelectItem value="Resolvido">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={4} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Adicione ou edite as observações..." />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Alterações"}</Button>
            <Button variant="outline" onClick={handleVoltouTravar} disabled={saving}>
              <RotateCcw className="mr-2 h-4 w-4" />Placa Voltou a Travar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
