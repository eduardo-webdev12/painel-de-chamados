import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addChamado, generateId } from "@/lib/storage";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function NovoChamado() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    placa: "",
    transportadora: "",
    tecnologia: "",
    descricao: "",
    observacao: "",
    tempoTravada: "",
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.placa || !form.transportadora || !form.tecnologia || !form.descricao) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    addChamado({
      id: generateId(),
      placa: form.placa.toUpperCase(),
      transportadora: form.transportadora,
      tecnologia: form.tecnologia,
      descricao: form.descricao,
      observacao: form.observacao,
      tempoTravada: form.tempoTravada,
      dataAbertura: new Date().toISOString(),
      status: "Aberto",
    });

    toast({ title: "Chamado criado", description: `Chamado para placa ${form.placa.toUpperCase()} registrado com sucesso.` });
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
                <Input
                  id="placa"
                  placeholder="ABC-1234"
                  value={form.placa}
                  onChange={(e) => update("placa", e.target.value)}
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportadora">Transportadora *</Label>
                <Input
                  id="transportadora"
                  placeholder="Nome da transportadora"
                  value={form.transportadora}
                  onChange={(e) => update("transportadora", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tecnologia">Tecnologia / Rastreador *</Label>
                <Input
                  id="tecnologia"
                  placeholder="Ex: Sascar, Autotrac, Omnilink..."
                  value={form.tecnologia}
                  onChange={(e) => update("tecnologia", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tempoTravada">Tempo travada</Label>
                <Input
                  id="tempoTravada"
                  placeholder="Ex: 2h30, 45 min..."
                  value={form.tempoTravada}
                  onChange={(e) => update("tempoTravada", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição detalhada do problema *</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o problema encontrado..."
                rows={4}
                value={form.descricao}
                onChange={(e) => update("descricao", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação (histórico/recorrência)</Label>
              <Textarea
                id="observacao"
                placeholder="Informações adicionais, histórico de recorrência..."
                rows={3}
                value={form.observacao}
                onChange={(e) => update("observacao", e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit">Registrar Chamado</Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
