import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { getChamadoById, updateChamado } from "@/lib/storage";
import { toast } from "@/hooks/use-toast";
import { Chamado, StatusChamado } from "@/types/chamado";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";

export default function DetalhesChamado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [observacao, setObservacao] = useState("");
  const [status, setStatus] = useState<StatusChamado>("Aberto");

  useEffect(() => {
    if (!id) return;
    const found = getChamadoById(id);
    if (found) {
      setChamado(found);
      setObservacao(found.observacao);
      setStatus(found.status);
    }
  }, [id]);

  if (!chamado) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Chamado não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/chamados")}>
          Voltar
        </Button>
      </div>
    );
  }

  const handleSave = () => {
    const updates: Partial<Chamado> = { observacao, status };
    if (status === "Resolvido" && chamado.status !== "Resolvido") {
      updates.dataResolucao = new Date().toISOString();
    }
    updateChamado(chamado.id, updates);
    setChamado({ ...chamado, ...updates });
    toast({ title: "Chamado atualizado", description: "As alterações foram salvas." });
  };

  const infoRows = [
    { label: "Placa", value: chamado.placa },
    { label: "Transportadora", value: chamado.transportadora },
    { label: "Tecnologia", value: chamado.tecnologia },
    { label: "Tempo Travada", value: chamado.tempoTravada || "—" },
    { label: "Data de Abertura", value: format(parseISO(chamado.dataAbertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) },
    ...(chamado.dataResolucao
      ? [{ label: "Data de Resolução", value: format(parseISO(chamado.dataResolucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chamado – {chamado.placa}</h1>
          <div className="mt-1">
            <StatusBadge status={chamado.status} />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
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
        <CardHeader>
          <CardTitle>Descrição</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{chamado.descricao}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atualizar Chamado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusChamado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Em Tratativa">Em Tratativa</SelectItem>
                <SelectItem value="Resolvido">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={4}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Adicione ou edite as observações..."
            />
          </div>

          <Button onClick={handleSave}>Salvar Alterações</Button>
        </CardContent>
      </Card>
    </div>
  );
}
