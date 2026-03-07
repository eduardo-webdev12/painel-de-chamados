import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, RotateCcw, History, Trash2, Upload, Link as LinkIcon, MessageCircle, ExternalLink } from "lucide-react";
import { gerarMensagemWhatsApp, abrirWhatsApp } from "@/lib/whatsapp";
import { montarPayloadEncerramento, montarPayloadRecorrencia, normalizarStatusChamado, type EncerrarOpcao } from "@/lib/chamadoWorkflow";
import type { ChamadoDB } from "@/hooks/useChamados";

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
  const [observacaoTecnica, setObservacaoTecnica] = useState("");
  const [linkAcompanhamento, setLinkAcompanhamento] = useState("");
  const [status, setStatus] = useState("Aberto");
  const [dataRetornoSinal, setDataRetornoSinal] = useState("");
  const [encerrarOpcao, setEncerrarOpcao] = useState<EncerrarOpcao>("destravou");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [whatsappNumero, setWhatsappNumero] = useState("");
  const [recorrenciaDialogOpen, setRecorrenciaDialogOpen] = useState(false);
  const [recorrenciaDataHora, setRecorrenciaDataHora] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("chamados").select("*").eq("id", id).maybeSingle(),
      supabase.from("chamado_historico").select("*").eq("chamado_id", id).order("created_at", { ascending: false }),
    ]).then(([chamadoRes, histRes]) => {
      if (chamadoRes.data) {
        const c = chamadoRes.data;
        setChamado(c);
        setObservacao(c.observacao || "");
        setObservacaoTecnica((c as any).observacao_tecnica || "");
        setLinkAcompanhamento((c as any).link_acompanhamento || "");
        setStatus(normalizarStatusChamado(c.status));
        // Fetch WhatsApp number for this technology
        if (c.tecnologia) {
          supabase.from("tecnologia_contatos").select("whatsapp_numero").eq("tecnologia", c.tecnologia).maybeSingle()
            .then(({ data }) => { if (data) setWhatsappNumero(data.whatsapp_numero); });
        }
      }
      setHistorico((histRes.data as HistoricoItem[]) || []);
      setLoading(false);
    });
  }, [id]);

  const addHistorico = async (acao: string, detalhes?: string) => {
    if (!id) return;
    try {
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
    } catch (e) {
      console.error("Erro ao registrar histórico:", e);
    }
  };

  const tempoAtual = useMemo(() => {
    if (!chamado || !chamado.hora_travou || chamado.status === "Resolvido" || chamado.status.startsWith("Encerrado")) return chamado?.tempo_travada || "—";
    const diff = differenceInMinutes(new Date(), parseISO(chamado.hora_travou));
    return diff < 60 ? `${diff} min` : `${(diff / 60).toFixed(1)} h`;
  }, [chamado]);

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chamado) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${chamado.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("chamado-anexos").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("chamado-anexos").getPublicUrl(path);
      const fotoUrl = urlData.publicUrl;
      await supabase.from("chamados").update({ anexo_foto_url: fotoUrl } as any).eq("id", chamado.id);
      setChamado({ ...chamado, anexo_foto_url: fotoUrl } as any);
      await addHistorico("Foto anexada", `Arquivo: ${file.name}`);
      toast({ title: "Foto anexada com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleEnviarWhatsApp = () => {
    if (!chamado) return;
    if (!whatsappNumero) {
      toast({ title: "Número não cadastrado", description: "Cadastre o número WhatsApp da tecnologia nas Configurações ou abaixo.", variant: "destructive" });
      return;
    }

    try {
      const horaStr = chamado.hora_travou ? format(parseISO(chamado.hora_travou), "HH:mm") : "horário não informado";
      const fotoAnexo = (chamado as any).anexo_foto_url as string | null;
      let msg = gerarMensagemWhatsApp(chamado.placa, horaStr, profile?.nome, chamado.tecnologia);
      if (fotoAnexo) {
        msg += `\n\n📎 Print da ocorrência:\n${fotoAnexo}`;
      }
      abrirWhatsApp(whatsappNumero, msg);
      addHistorico("Mensagem WhatsApp enviada", `Tecnologia: ${chamado.tecnologia}`);
      toast({ title: "Mensagem preparada", description: "WhatsApp aberto com a mensagem padrão e o link do print." });
    } catch (err: any) {
      toast({ title: "Erro ao abrir WhatsApp", description: err?.message || "Verifique número e dados do chamado.", variant: "destructive" });
    }
  };

  const handleSalvarNumeroWhatsApp = async () => {
    if (!chamado || !whatsappNumero.trim()) return;
    try {
      const { error } = await supabase.from("tecnologia_contatos").upsert(
        { tecnologia: chamado.tecnologia, whatsapp_numero: whatsappNumero.trim() } as any,
        { onConflict: "tecnologia" }
      );
      if (error) throw error;
      toast({ title: "Número salvo com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar número", description: err?.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  if (!chamado) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Chamado não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/chamados")}>Voltar</Button>
      </div>
    );
  }

  const statusAtualChamado = normalizarStatusChamado(chamado.status);
  const chamadoFinalizado = statusAtualChamado === "Resolvido" || statusAtualChamado.includes("Encerrado");
  const isEncerramento = status === "Resolvido" && !chamadoFinalizado;

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    if (newStatus !== "Resolvido") {
      setEncerrarOpcao("destravou");
      setDataRetornoSinal("");
    }
  };

  const handleSave = async () => {
    if (isEncerramento && encerrarOpcao === "destravou" && !dataRetornoSinal) {
      toast({ title: "Campo obrigatório", description: "Informe a data e hora que a placa destravou.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, any> = {
        observacao,
        observacao_tecnica: observacaoTecnica,
        link_acompanhamento: linkAcompanhamento,
      };
      let historicoAcao = "";
      let historicoDetalhes = "";

      if (isEncerramento) {
        const now = new Date().toISOString();
        updates.data_resolucao = now;
        updates.finalizado_por_nome = profile?.nome || null;
        updates.finalizado_por_email = profile?.email || null;
        updates.finalizado_por_cargo = profile?.cargo || null;
        updates.finalizado_em = now;

        const fechamento = montarPayloadEncerramento({
          opcao: encerrarOpcao,
          dataRetornoSinal,
          horaTravou: chamado.hora_travou,
        });

        if (!fechamento.ok) {
          toast({ title: "Campo obrigatório", description: fechamento.error, variant: "destructive" });
          setSaving(false);
          return;
        }

        Object.assign(updates, fechamento.updates);
        historicoAcao = fechamento.historicoAcao;
        historicoDetalhes = fechamento.historicoDetalhes;
      } else {
        updates.status = normalizarStatusChamado(status);
        if (status !== chamado.status) {
          historicoAcao = "Status alterado";
          historicoDetalhes = `${normalizarStatusChamado(chamado.status)} → ${normalizarStatusChamado(status)}`;
        }
      }

      if (observacao !== (chamado.observacao || "") && !historicoAcao) {
        historicoAcao = "Observação atualizada";
      }

      const { error } = await supabase.from("chamados").update(updates as any).eq("id", chamado.id);
      if (error) {
        console.error("Erro ao atualizar chamado:", error);
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }

      if (historicoAcao) {
        await addHistorico(historicoAcao, historicoDetalhes || undefined);
      }

      setChamado({ ...chamado, ...updates } as ChamadoDB);
      toast({ title: "Chamado atualizado com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleVoltouTravar = () => {
    setRecorrenciaDataHora(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setRecorrenciaDialogOpen(true);
  };

  const handleConfirmarRecorrencia = async () => {
    const payload = montarPayloadRecorrencia(recorrenciaDataHora, chamado.contagem_recorrencia);
    if (!payload.ok) {
      toast({ title: "Dados inválidos", description: payload.error, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("chamados").update(payload.updates).eq("id", chamado.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      await addHistorico(payload.historicoAcao, payload.historicoDetalhes);
      setChamado({ ...chamado, ...(payload.updates as any) } as ChamadoDB);
      setStatus("Aberto");
      setRecorrenciaDialogOpen(false);
      toast({
        title: "Recorrência registrada",
        description: `Placa voltou a travar em ${format(new Date(recorrenciaDataHora), "dd/MM/yyyy HH:mm")}.`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await addHistorico("Chamado excluído", `Excluído por ${profile?.nome || "Admin"}`);
      const { error } = await supabase.from("chamados").delete().eq("id", chamado.id);
      if (error) {
        toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Chamado excluído com sucesso" });
      navigate("/chamados");
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const fotoUrl = (chamado as any).anexo_foto_url as string | null;

  const infoRows = [
    { label: "Placa", value: chamado.placa },
    { label: "Transportadora", value: chamado.transportadora },
    { label: "Tecnologia", value: chamado.tecnologia },
    { label: "Tempo Travada", value: tempoAtual },
    { label: "Recorrente", value: chamado.recorrente ? `Sim (${chamado.contagem_recorrencia}x)` : "Não" },
    { label: "Criado por", value: chamado.created_by_name || "—" },
    { label: "Cargo (criador)", value: chamado.created_by_role || "—" },
    { label: "Data de Abertura", value: format(parseISO(chamado.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) },
    ...(chamado.hora_travou ? [{ label: "Hora que Travou", value: format(parseISO(chamado.hora_travou), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) }] : []),
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          {/* WhatsApp Button */}
          <Button variant="outline" size="sm" onClick={handleEnviarWhatsApp} className="text-green-600 border-green-300 hover:bg-green-50">
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleting ? "Excluindo..." : "Excluir"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. O chamado da placa <strong>{chamado.placa}</strong> será
                    excluído permanentemente do sistema, incluindo todo o histórico de interações.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir permanentemente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
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

      {/* Anexos */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Anexos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Photo */}
          <div className="space-y-2">
            <Label>Print da placa travada</Label>
            {fotoUrl ? (
              <div className="space-y-2">
                <img src={fotoUrl} alt="Print da placa" className="max-h-48 rounded-md border object-contain" />
                <a href={fotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Abrir em nova aba
                </a>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma foto anexada.</p>
            )}
            {!chamadoFinalizado && (
              <div>
                <Input type="file" accept="image/*" onChange={handleUploadFoto} disabled={uploading} className="max-w-xs" />
                {uploading && <p className="text-xs text-muted-foreground mt-1">Enviando...</p>}
              </div>
            )}
          </div>

          {/* Link */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><LinkIcon className="h-4 w-4" /> Link de acompanhamento</Label>
            <Input
              placeholder="https://..."
              value={linkAcompanhamento}
              onChange={(e) => setLinkAcompanhamento(e.target.value)}
              disabled={chamadoFinalizado}
            />
            {linkAcompanhamento && (
              <a href={linkAcompanhamento} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Abrir link
              </a>
            )}
          </div>

          {/* Technical note */}
          <div className="space-y-2">
            <Label>Observação técnica adicional</Label>
            <Textarea
              rows={3}
              placeholder="Informações técnicas..."
              value={observacaoTecnica}
              onChange={(e) => setObservacaoTecnica(e.target.value)}
              disabled={chamadoFinalizado}
            />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Config */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp da Tecnologia</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Número WhatsApp ({chamado.tecnologia})</Label>
            <div className="flex gap-2">
              <Input
                placeholder="5511999999999"
                value={whatsappNumero}
                onChange={(e) => setWhatsappNumero(e.target.value)}
              />
              <Button variant="outline" size="sm" onClick={handleSalvarNumeroWhatsApp}>Salvar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Formato: código do país + DDD + número (ex: 5511999999999)</p>
          </div>
          <Button onClick={handleEnviarWhatsApp} className="bg-green-600 hover:bg-green-700 text-white w-full">
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar para Tecnologia via WhatsApp
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Atualizar Chamado</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={handleStatusChange} disabled={chamadoFinalizado}>
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
              <RadioGroup
                value={encerrarOpcao}
                onValueChange={(v) => {
                  setEncerrarOpcao(v as EncerrarOpcao);
                  if (v !== "destravou") setDataRetornoSinal("");
                }}
                className="space-y-3"
              >
                <div className={`flex items-start space-x-3 rounded-md border p-3 transition-colors ${encerrarOpcao === "destravou" ? "bg-primary/10 border-primary/40" : "bg-background"}`}>
                  <RadioGroupItem value="destravou" id="destravou" className="mt-0.5" />
                  <div>
                    <Label htmlFor="destravou" className="font-medium cursor-pointer">Placa destravou</Label>
                    <p className="text-xs text-muted-foreground">Informar data e hora que o sinal voltou</p>
                  </div>
                </div>
                <div className={`flex items-start space-x-3 rounded-md border p-3 transition-colors ${encerrarOpcao === "continua_travado" ? "bg-orange-500/10 border-orange-400/40" : "bg-background"}`}>
                  <RadioGroupItem value="continua_travado" id="continua_travado" className="mt-0.5" />
                  <div>
                    <Label htmlFor="continua_travado" className="font-medium cursor-pointer">Continua travado</Label>
                    <p className="text-xs text-muted-foreground">Encerrar mesmo com a placa ainda travada</p>
                  </div>
                </div>
                <div className={`flex items-start space-x-3 rounded-md border p-3 transition-colors ${encerrarOpcao === "sem_cobertura" ? "bg-muted border-muted-foreground/30" : "bg-background"}`}>
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
                  <Input type="datetime-local" value={dataRetornoSinal} onChange={(e) => setDataRetornoSinal(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Será usado para calcular o tempo total travado.</p>
                </div>
              )}

              {encerrarOpcao !== "destravou" && (
                <p className="text-xs text-muted-foreground italic pt-1">
                  ℹ️ O chamado será encerrado sem necessidade de informar data/hora de retorno.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={4} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Adicione ou edite as observações..." />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving || deleting}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
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
