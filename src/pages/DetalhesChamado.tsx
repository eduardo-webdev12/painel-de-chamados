import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, RotateCcw, History } from "lucide-react";
import type { ChamadoDB } from "@/hooks/useChamados";

type EncerrarOpcao = "destravou" | "continua_travado" | "sem_cobertura";

interface HistoricoItem {
  id: string;
  acao: string;
  detalhes: string | null;
  usuario_nome: string | null;
  usuario_cargo: string | null;
  created_at: string;
}

export default function DetalhesChamado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [chamado, setChamado] = useState<ChamadoDB | null>(null);
  const [observacao, setObservacao] = useState("");
  const [status, setStatus] = useState("Aberto");
  const [dataRetornoSinal, setDataRetornoSinal] = useState("");
  const [encerrarOpcao, setEncerrarOpcao] = useState<EncerrarOpcao>("destravou");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  useEffect(() => {
    if (!id) return;
    // Fetch chamado and historico in parallel
    Promise.all([
      supabase.from("chamados").select("*").eq("id", id).maybeSingle(),
      supabase.from("chamado_historico").select("*").eq("chamado_id", id).order("created_at", { ascending: false }),
    ]).then(([chamadoRes, histRes]) => {
      if (chamadoRes.data) {
        setChamado(chamadoRes.data);
        setObservacao(chamadoRes.data.observacao || "");
        setStatus(chamadoRes.data.status);
      }
      setHistorico((histRes.data as HistoricoItem[]) || []);
      setLoading(false);
    });
  }, [id]);

  const addHistorico = async (acao: string, detalhes?: string) => {
    if (!id) return;
    const entry = {
      chamado_id: id,
      acao,
      detalhes: detalhes || null,
      usuario_nome: profile?.nome || null,
      usuario_email: profile?.email || null,
      usuario_cargo: profile?.cargo || null,
      usuario_id: user?.id || null,
    };
    const { data } = await supabase.from("chamado_historico").insert(entry).select().single();
    if (data) setHistorico((prev) => [data as HistoricoItem, ...prev]);
  };

  const tempoAtual = useMemo(() => {
    if (!chamado || !chamado.hora_travou || chamado.status.startsWith("Resolvido") || chamado.status.startsWith("Encerrado")) return chamado?.tempo_travada || "—";
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

  const isEncerramento = status === "Resolvido" && !chamado.status.startsWith("Resolvido") && !chamado.status.startsWith("Encerrado");

  const handleSave = async () => {
    if (isEncerramento && encerrarOpcao === "destravou" && !dataRetornoSinal) {
      toast({ title: "Campo obrigatório", description: "Informe a data e hora que destravou.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const updates: Record<string, unknown> = { observacao };
    let historicoAcao = "";
    let historicoDetalhes = "";

    if (isEncerramento) {
      updates.data_resolucao = new Date().toISOString();
      updates.finalizado_por_nome = profile?.nome || null;
      updates.finalizado_por_email = profile?.email || null;
      updates.finalizado_por_cargo = profile?.cargo || null;
      updates.finalizado_em = new Date().toISOString();

      if (encerrarOpcao === "destravou") {
        updates.status = "Resolvido";
        const retornoDate = new Date(dataRetornoSinal);
        updates.data_hora_retorno_sinal = retornoDate.toISOString();
        if (chamado.hora_travou) {
          const diff = differenceInMinutes(retornoDate, parseISO(chamado.hora_travou));
          updates.tempo_travada = diff < 60 ? `${diff} min` : `${(diff / 60).toFixed(1)} h`;
        }
        historicoAcao = "Chamado encerrado — Resolvido";
        historicoDetalhes = `Retorno do sinal: ${format(retornoDate, "dd/MM/yyyy HH:mm")}`;
      } else if (encerrarOpcao === "continua_travado") {
        updates.status = "Encerrado — Continua travado";
        historicoAcao = "Chamado encerrado — Continua travado";
      } else if (encerrarOpcao === "sem_cobertura") {
        updates.status = "Encerrado — Sem cobertura";
        historicoAcao = "Chamado encerrado — Sem cobertura";
      }
    } else {
      updates.status = status;
      if (status !== chamado.status) {
        historicoAcao = "Status alterado";
        historicoDetalhes = `${chamado.status} → ${status}`;
      }
    }

    // Check if observacao changed
    if (observacao !== (chamado.observacao || "") && !historicoAcao) {
      historicoAcao = "Observação atualizada";
    }

    const { error } = await supabase.from("chamados").update(updates).eq("id", chamado.id);
    if (error) {
      setSaving(false);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    if (historicoAcao) {
      await addHistorico(historicoAcao, historicoDetalhes || undefined);
    }

    setChamado({ ...chamado, ...updates } as ChamadoDB);
    setSaving(false);
    toast({ title: "Chamado atualizado" });
  };

  const handleVoltouTravar = async () => {
    setSaving(true);
    const updates = {
      status: "Aberto",
      data_resolucao: null,
      recorrente: true,
      contagem_recorrencia: chamado.contagem_recorrencia + 1,
      hora_travou: new Date().toISOString(),
      finalizado_por_nome: null,
      finalizado_por_email: null,
      finalizado_por_cargo: null,
      finalizado_em: null,
      data_hora_retorno_sinal: null,
    };
    const { error } = await supabase.from("chamados").update(updates).eq("id", chamado.id);
    if (error) {
      setSaving(false);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    await addHistorico("Placa voltou a travar", `Recorrência: ${chamado.contagem_recorrencia + 1}x`);

    setChamado({ ...chamado, ...updates } as ChamadoDB);
    setSaving(false);
    toast({ title: "Placa marcada como travada novamente", description: `Recorrência: ${chamado.contagem_recorrencia + 1}x` });
  };

  const infoRows = [
    { label: "Placa", value: chamado.placa },
    { label: "Transportadora", value: chamado.transportadora },
    { label: "Tecnologia", value: chamado.tecnologia },
    { label: "Tempo Travada", value: tempoAtual },
    { label: "Recorrente", value: chamado.recorrente ? `Sim (${chamado.contagem_recorrencia}x)` : "Não" },
    { label: "Criado por", value: chamado.created_by_name || "—" },
    { label: "Cargo (criador)", value: chamado.created_by_role || "—" },
    { label: "Data de Abertura", value: format(parseISO(chamado.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) },
    ...(chamado.finalizado_por_nome ? [
      { label: "Finalizado por", value: chamado.finalizado_por_nome },
      { label: "Cargo (finalizador)", value: chamado.finalizado_por_cargo || "—" },
    ] : []),
    ...(chamado.finalizado_em ? [
      { label: "Finalizado em", value: format(parseISO(chamado.finalizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) },
    ] : []),
    ...(chamado.data_hora_retorno_sinal ? [
      { label: "Retorno do sinal", value: format(parseISO(chamado.data_hora_retorno_sinal), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) },
    ] : []),
    ...(chamado.data_resolucao ? [{ label: "Data de Resolução", value: format(parseISO(chamado.data_resolucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) }] : []),
  ];

  const chamadoFinalizado = chamado.status === "Resolvido" || chamado.status.startsWith("Encerrado");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chamado – {chamado.placa}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={chamado.status} />
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
            <Select value={status} onValueChange={setStatus} disabled={chamadoFinalizado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Em Tratativa">Em Tratativa</SelectItem>
                <SelectItem value="Resolvido">Encerrar Chamado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isEncerramento && (
            <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <Label className="font-semibold text-base">Opções de Encerramento</Label>
              <RadioGroup value={encerrarOpcao} onValueChange={(v) => setEncerrarOpcao(v as EncerrarOpcao)} className="space-y-3">
                <div className="flex items-start space-x-3 rounded-md border p-3 bg-background">
                  <RadioGroupItem value="destravou" id="destravou" className="mt-0.5" />
                  <div>
                    <Label htmlFor="destravou" className="font-medium cursor-pointer">Placa destravou</Label>
                    <p className="text-xs text-muted-foreground">Informar data e hora que o sinal voltou</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-md border p-3 bg-background">
                  <RadioGroupItem value="continua_travado" id="continua_travado" className="mt-0.5" />
                  <div>
                    <Label htmlFor="continua_travado" className="font-medium cursor-pointer">Continua travado</Label>
                    <p className="text-xs text-muted-foreground">Encerrar mesmo com a placa ainda travada</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-md border p-3 bg-background">
                  <RadioGroupItem value="sem_cobertura" id="sem_cobertura" className="mt-0.5" />
                  <div>
                    <Label htmlFor="sem_cobertura" className="font-medium cursor-pointer">Placa sem cobertura</Label>
                    <p className="text-xs text-muted-foreground">Região ou placa sem cobertura de sinal</p>
                  </div>
                </div>
              </RadioGroup>

              {encerrarOpcao === "destravou" && (
                <div className="space-y-2 pt-2">
                  <Label className="font-semibold">Data e hora que destravou *</Label>
                  <Input
                    type="datetime-local"
                    value={dataRetornoSinal}
                    onChange={(e) => setDataRetornoSinal(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Será usado para calcular o tempo total travado.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={4} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Adicione ou edite as observações..." />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Alterações"}</Button>
            {chamadoFinalizado && (
              <Button variant="outline" onClick={handleVoltouTravar} disabled={saving}>
                <RotateCcw className="mr-2 h-4 w-4" />Placa Voltou a Travar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Interações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Interações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro de interação ainda.</p>
          ) : (
            <div className="space-y-3">
              {historico.map((h) => (
                <div key={h.id} className="flex gap-3 border-b pb-3 last:border-0">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{h.acao}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(parseISO(h.created_at), "dd/MM/yy HH:mm")}
                      </span>
                    </div>
                    {h.detalhes && <p className="text-xs text-muted-foreground mt-0.5">{h.detalhes}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      por {h.usuario_nome || "Sistema"}{h.usuario_cargo ? ` (${h.usuario_cargo})` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
