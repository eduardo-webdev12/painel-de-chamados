import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Plus, WifiOff, Wifi, Clock, AlertTriangle, BarChart3 } from "lucide-react";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Integracao {
  id: string;
  tecnologia: string;
  data_hora_queda: string;
  data_hora_retorno: string | null;
  status: string;
  observacao: string | null;
  registrado_por_nome: string | null;
  created_at: string;
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getCriticidade(mins: number) {
  if (mins < 30) return { color: "text-green-600", bg: "bg-green-100", label: "Baixa" };
  if (mins < 120) return { color: "text-yellow-600", bg: "bg-yellow-100", label: "Média" };
  return { color: "text-red-600", bg: "bg-red-100", label: "Alta" };
}

export default function TecnologiasIntegracao() {
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tecnologia, setTecnologia] = useState("");
  const [dataQueda, setDataQueda] = useState("");
  const [horaQueda, setHoraQueda] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  // Tick every minute for live duration
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchRegistros = async () => {
    const { data } = await supabase
      .from("tecnologia_integracoes")
      .select("*")
      .order("data_hora_queda", { ascending: false });
    setRegistros((data as Integracao[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRegistros();
    const channel = supabase
      .channel("integracoes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tecnologia_integracoes" }, () => fetchRegistros())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCreate = async () => {
    if (!tecnologia.trim() || !dataQueda || !horaQueda) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const dt = new Date(`${dataQueda}T${horaQueda}`);
    const { error } = await supabase.from("tecnologia_integracoes").insert({
      tecnologia: tecnologia.trim().toUpperCase(),
      data_hora_queda: dt.toISOString(),
      status: "Fora do ar",
      observacao: observacao || null,
      registrado_por: user?.id,
      registrado_por_nome: profile?.nome || null,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Queda registrada com sucesso" });
      setDialogOpen(false);
      setTecnologia(""); setDataQueda(""); setHoraQueda(""); setObservacao("");
    }
  };

  const handleNormalizar = async (id: string) => {
    await supabase.from("tecnologia_integracoes").update({
      status: "Normal",
      data_hora_retorno: new Date().toISOString(),
    } as any).eq("id", id);
    toast({ title: "Integração normalizada" });
  };

  const foraDoAr = registros.filter(r => r.status === "Fora do ar");
  const normais = registros.filter(r => r.status === "Normal");

  // Dashboard data
  const rankingData = useMemo(() => {
    const map = new Map<string, { total: number; tempo: number }>();
    registros.forEach(r => {
      const cur = map.get(r.tecnologia) || { total: 0, tempo: 0 };
      cur.total++;
      const end = r.data_hora_retorno ? new Date(r.data_hora_retorno) : now;
      cur.tempo += differenceInMinutes(end, new Date(r.data_hora_queda));
      map.set(r.tecnologia, cur);
    });
    return [...map.entries()]
      .map(([tec, v]) => ({ tecnologia: tec, quedas: v.total, tempoTotal: v.tempo }))
      .sort((a, b) => b.tempoTotal - a.tempoTotal)
      .slice(0, 10);
  }, [registros, now]);

  const slaTarget = 99.5; // 99.5% uptime

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tecnologias sem Integração</h1>
          <p className="text-sm text-muted-foreground">Controle de indisponibilidade das integrações</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Registrar Queda</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Queda de Integração</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tecnologia *</Label>
                <Input value={tecnologia} onChange={e => setTecnologia(e.target.value)} placeholder="Ex: OMNILINK, SASCAR..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data da queda *</Label><Input type="date" value={dataQueda} onChange={e => setDataQueda(e.target.value)} /></div>
                <div><Label>Hora da queda *</Label><Input type="time" value={horaQueda} onChange={e => setHoraQueda(e.target.value)} /></div>
              </div>
              <div><Label>Observação</Label><Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Detalhes sobre a queda..." /></div>
              <Button onClick={handleCreate} disabled={saving} className="w-full">{saving ? "Registrando..." : "Registrar Queda"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><WifiOff className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-xs text-muted-foreground">Fora do Ar</p><p className="text-2xl font-bold">{foraDoAr.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100"><Wifi className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Normalizadas</p><p className="text-2xl font-bold">{normais.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100"><Clock className="h-5 w-5 text-yellow-600" /></div>
            <div><p className="text-xs text-muted-foreground">Total de Quedas</p><p className="text-2xl font-bold">{registros.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><BarChart3 className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Tecnologias Afetadas</p><p className="text-2xl font-bold">{new Set(registros.map(r => r.tecnologia)).size}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Ativas - Fora do ar */}
      {foraDoAr.length > 0 && (
        <Card className="border-red-200">
          <CardHeader><CardTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Integrações Fora do Ar</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {foraDoAr.map(r => {
              const mins = differenceInMinutes(now, new Date(r.data_hora_queda));
              const crit = getCriticidade(mins);
              const progressVal = Math.min((mins / 480) * 100, 100); // 8h = 100%
              return (
                <div key={r.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <WifiOff className="h-5 w-5 text-red-500" />
                      <span className="font-semibold">{r.tecnologia}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${crit.bg} ${crit.color} font-medium`}>{crit.label}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleNormalizar(r.id)} className="text-green-600 border-green-300 hover:bg-green-50">
                      <Wifi className="h-4 w-4 mr-1" />Normalizar
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Início: {format(new Date(r.data_hora_queda), "dd/MM/yyyy HH:mm")}</span>
                    <span className={`font-semibold ${crit.color}`}>⏱ {formatDuration(mins)}</span>
                  </div>
                  <Progress value={progressVal} className="h-2" />
                  {r.observacao && <p className="text-xs text-muted-foreground">{r.observacao}</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Ranking Chart */}
      {rankingData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Ranking — Tempo Total Fora do Ar</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rankingData} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tickFormatter={v => formatDuration(v)} />
                <YAxis type="category" dataKey="tecnologia" width={80} />
                <Tooltip formatter={(v: number) => formatDuration(v)} />
                <Bar dataKey="tempoTotal" radius={[0, 4, 4, 0]}>
                  {rankingData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "hsl(0, 70%, 50%)" : i < 3 ? "hsl(30, 70%, 50%)" : "hsl(210, 60%, 50%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader><CardTitle>Histórico de Quedas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tecnologia</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Retorno</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map(r => {
                const end = r.data_hora_retorno ? new Date(r.data_hora_retorno) : now;
                const mins = differenceInMinutes(end, new Date(r.data_hora_queda));
                const crit = getCriticidade(mins);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.tecnologia}</TableCell>
                    <TableCell>{format(new Date(r.data_hora_queda), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{r.data_hora_retorno ? format(new Date(r.data_hora_retorno), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                    <TableCell className={crit.color}>{formatDuration(mins)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${r.status === "Fora do ar" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.registrado_por_nome || "—"}</TableCell>
                  </TableRow>
                );
              })}
              {registros.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
