import { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { normalizarTecnologia } from "@/lib/tecnologiaNormalizacao";
import { differenceInMinutes, subDays, format, getDay, getHours, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Activity, AlertTriangle, TrendingUp, Clock, Plus, Trash2, Edit, Save, X } from "lucide-react";
import { motion } from "framer-motion";

interface Integracao {
  id: string;
  tecnologia: string;
  data_hora_queda: string;
  data_hora_retorno: string | null;
  status: string;
  observacao: string | null;
  registrado_por: string | null;
  registrado_por_nome: string | null;
  created_at: string;
}

type Classificacao = "estavel" | "atencao" | "critica";

const CLASSIF_CONFIG: Record<Classificacao, { label: string; color: string; bg: string; emoji: string }> = {
  estavel: { label: "Estável", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-400/30", emoji: "🟢" },
  atencao: { label: "Atenção", color: "text-yellow-600", bg: "bg-yellow-500/10 border-yellow-400/30", emoji: "🟡" },
  critica: { label: "Crítica", color: "text-red-600", bg: "bg-destructive/10 border-destructive/30", emoji: "🔴" },
};

const PERIODOS = [
  { label: "7 dias", value: "7" },
  { label: "30 dias", value: "30" },
  { label: "90 dias", value: "90" },
  { label: "Total", value: "all" },
];

export default function RecorrenciasTecnologias() {
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30");
  const [filtroTec, setFiltroTec] = useState("all");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formTec, setFormTec] = useState("");
  const [formData, setFormData] = useState("");
  const [formHora, setFormHora] = useState("");
  const [formObs, setFormObs] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTec, setEditTec] = useState("");
  const [editData, setEditData] = useState("");
  const [editHora, setEditHora] = useState("");
  const [editObs, setEditObs] = useState("");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Integracao | null>(null);

  const fetchRegistros = useCallback(async () => {
    const { data, error } = await supabase
      .from("tecnologia_integracoes")
      .select("*")
      .order("data_hora_queda", { ascending: false });
    if (!error && data) setRegistros(data as Integracao[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("recorrencias-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tecnologia_integracoes" }, () => fetchRegistros())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRegistros]);

  const handleSubmit = async () => {
    if (!formTec.trim() || !formData || !formHora) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const dataHoraQueda = `${formData}T${formHora}:00`;
    const { error } = await supabase.from("tecnologia_integracoes").insert({
      tecnologia: normalizarTecnologia(formTec),
      data_hora_queda: dataHoraQueda,
      status: "Fora do ar",
      observacao: formObs || null,
      registrado_por: user?.id,
      registrado_por_nome: profile?.nome || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Queda de integração registrada com sucesso" });
      setFormTec(""); setFormData(""); setFormHora(""); setFormObs("");
      setShowForm(false);
    }
  };

  const handleEditSave = async () => {
    if (!editId || !editTec.trim() || !editData || !editHora) return;
    const dataHoraQueda = `${editData}T${editHora}:00`;
    const { error } = await supabase.from("tecnologia_integracoes").update({
      tecnologia: normalizarTecnologia(editTec),
      data_hora_queda: dataHoraQueda,
      observacao: editObs || null,
    }).eq("id", editId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Registro atualizado" });
      setEditId(null);
    }
  };

  const startEdit = (r: Integracao) => {
    setEditId(r.id);
    setEditTec(r.tecnologia);
    const d = new Date(r.data_hora_queda);
    setEditData(format(d, "yyyy-MM-dd"));
    setEditHora(format(d, "HH:mm"));
    setEditObs(r.observacao || "");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("tecnologia_integracoes").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Registro excluído" });
      setDeleteTarget(null);
    }
  };

  // Filtered data
  const filtrados = useMemo(() => {
    let data = registros;
    if (periodo !== "all") {
      const corte = subDays(new Date(), parseInt(periodo));
      data = data.filter(r => new Date(r.data_hora_queda) >= corte);
    }
    if (filtroTec !== "all") {
      data = data.filter(r => normalizarTecnologia(r.tecnologia) === filtroTec);
    }
    return data;
  }, [registros, periodo, filtroTec]);

  const tecnologias = useMemo(() =>
    [...new Set(registros.map(r => normalizarTecnologia(r.tecnologia)))].sort()
  , [registros]);

  // Stats per technology
  const stats = useMemo(() => {
    const map = new Map<string, Integracao[]>();
    filtrados.forEach(r => {
      const tec = normalizarTecnologia(r.tecnologia);
      if (!map.has(tec)) map.set(tec, []);
      map.get(tec)!.push(r);
    });

    return Array.from(map.entries()).map(([nome, ocs]) => {
      // Sort by date asc for interval calculation
      const sorted = [...ocs].sort((a, b) => new Date(a.data_hora_queda).getTime() - new Date(b.data_hora_queda).getTime());
      let intervaloMedioDias: number | null = null;
      if (sorted.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const diff = differenceInMinutes(new Date(sorted[i].data_hora_queda), new Date(sorted[i - 1].data_hora_queda));
          intervals.push(diff / 1440);
        }
        intervaloMedioDias = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      const totalOcorrencias = ocs.length;
      const classificacao: Classificacao =
        totalOcorrencias >= 10 || (intervaloMedioDias !== null && intervaloMedioDias < 3) ? "critica" :
        totalOcorrencias >= 5 || (intervaloMedioDias !== null && intervaloMedioDias < 7) ? "atencao" : "estavel";

      return { nome, totalOcorrencias, intervaloMedioDias, classificacao };
    }).sort((a, b) => b.totalOcorrencias - a.totalOcorrencias);
  }, [filtrados]);

  // Trend data (monthly)
  const trendData = useMemo(() => {
    const months = new Map<string, Map<string, number>>();
    filtrados.forEach(r => {
      const tec = normalizarTecnologia(r.tecnologia);
      const mes = format(new Date(r.data_hora_queda), "MMM/yy", { locale: ptBR });
      if (!months.has(mes)) months.set(mes, new Map());
      months.get(mes)!.set(tec, (months.get(mes)!.get(tec) || 0) + 1);
    });
    const allTechs = [...new Set(filtrados.map(r => normalizarTecnologia(r.tecnologia)))];
    return Array.from(months.entries()).map(([mes, m]) => {
      const item: Record<string, string | number> = { mes };
      allTechs.forEach(t => { item[t] = m.get(t) || 0; });
      return item;
    });
  }, [filtrados]);

  const trendTechs = useMemo(() => {
    if (filtroTec !== "all") return [filtroTec];
    return stats.slice(0, 5).map(s => s.nome);
  }, [stats, filtroTec]);

  // Ranking bar data
  const rankingData = stats.map(s => ({ nome: s.nome, ocorrencias: s.totalOcorrencias }));

  // Heatmap
  const heatmapData = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    filtrados.forEach(r => {
      const d = new Date(r.data_hora_queda);
      grid[getDay(d)][getHours(d)]++;
    });
    const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const result: { dia: string; hora: number; valor: number }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (grid[d][h] > 0) result.push({ dia: dias[d], hora: h, valor: grid[d][h] });
      }
    }
    return result;
  }, [filtrados]);

  const maxHeat = Math.max(1, ...heatmapData.map(h => h.valor));

  // KPIs
  const totalOcorrencias = stats.reduce((s, t) => s + t.totalOcorrencias, 0);
  const criticas = stats.filter(s => s.classificacao === "critica").length;
  const techMaisInstavel = stats[0]?.nome || "—";

  const COLORS = ["hsl(215, 80%, 50%)", "hsl(150, 60%, 40%)", "hsl(30, 80%, 50%)", "hsl(350, 70%, 50%)", "hsl(270, 60%, 50%)"];

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recorrências de Tecnologias</h1>
          <p className="text-sm text-muted-foreground">Registro manual de quedas de integração e análise de recorrência</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Registrar Queda
          </Button>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroTec} onValueChange={setFiltroTec}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tecnologia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {tecnologias.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Queda de Integração</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome da Tecnologia *</label>
              <Input value={formTec} onChange={e => setFormTec(e.target.value)} placeholder="Ex: SASCAR, AUTOTRAC..." list="tec-suggestions" />
              <datalist id="tec-suggestions">
                {tecnologias.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Data da Queda *</label>
                <Input type="date" value={formData} onChange={e => setFormData(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Hora da Queda *</label>
                <Input type="time" value={formHora} onChange={e => setFormHora(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Observação</label>
              <Textarea value={formObs} onChange={e => setFormObs(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : "Registrar Queda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o registro de queda de <strong>{deleteTarget?.tecnologia}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total de Quedas", value: totalOcorrencias, icon: Activity, color: "text-primary" },
          { label: "Tecnologias Registradas", value: tecnologias.length, icon: TrendingUp, color: "text-blue-500" },
          { label: "Tecnologias Críticas", value: criticas, icon: AlertTriangle, color: "text-destructive" },
          { label: "Mais Instável", value: techMaisInstavel, icon: Clock, color: "text-yellow-500" },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <kpi.icon className={`h-8 w-8 ${kpi.color} shrink-0`} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-xl font-bold truncate">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Registros Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quedas Registradas</CardTitle>
          <CardDescription>Registros manuais de quedas de integração (mais recentes primeiro)</CardDescription>
        </CardHeader>
        <CardContent>
          {filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado. Clique em "Registrar Queda" para adicionar.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tecnologia</TableHead>
                    <TableHead>Data/Hora da Queda</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead>Registrado por</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map(r => (
                    <TableRow key={r.id}>
                      {editId === r.id ? (
                        <>
                          <TableCell><Input value={editTec} onChange={e => setEditTec(e.target.value)} className="h-8 w-32" /></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Input type="date" value={editData} onChange={e => setEditData(e.target.value)} className="h-8 w-36" />
                              <Input type="time" value={editHora} onChange={e => setEditHora(e.target.value)} className="h-8 w-24" />
                            </div>
                          </TableCell>
                          <TableCell><Input value={editObs} onChange={e => setEditObs(e.target.value)} className="h-8" /></TableCell>
                          <TableCell>{r.registrado_por_nome || "—"}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button size="icon" variant="ghost" onClick={handleEditSave}><Save className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{r.tecnologia}</TableCell>
                          <TableCell>{format(new Date(r.data_hora_queda), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{r.observacao || "—"}</TableCell>
                          <TableCell>{r.registrado_por_nome || "—"}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Edit className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(r)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      {stats.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Evolução Temporal de Falhas</CardTitle>
                <CardDescription>Tendência mensal de quedas registradas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                    {trendTechs.map((t, i) => (
                      <Line key={t} type="monotone" dataKey={t} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking de Quedas</CardTitle>
                <CardDescription>Tecnologias com mais ocorrências no período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={rankingData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="nome" fontSize={12} width={90} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="ocorrencias" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Quedas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Heatmap Operacional</CardTitle>
              <CardDescription>Dias e horários com maior incidência de quedas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(24, minmax(24px, 1fr))` }}>
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="text-center text-[10px] text-muted-foreground font-mono">{h}h</div>
                  ))}
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia, dIdx) => (
                    <div key={`row-${dIdx}`} className="contents">
                      <div className="text-xs text-muted-foreground flex items-center">{dia}</div>
                      {Array.from({ length: 24 }, (_, h) => {
                        const cell = heatmapData.find(c => c.dia === dia && c.hora === h);
                        const val = cell?.valor || 0;
                        const intensity = val / maxHeat;
                        return (
                          <div
                            key={`${dIdx}-${h}`}
                            className="aspect-square rounded-sm border border-border/30 flex items-center justify-center text-[9px] font-mono"
                            style={{
                              backgroundColor: val > 0
                                ? `hsl(215, 80%, ${65 - intensity * 35}%)`
                                : "hsl(var(--muted) / 0.3)",
                              color: intensity > 0.5 ? "white" : "hsl(var(--muted-foreground))",
                            }}
                            title={`${dia} ${h}h: ${val} ocorrências`}
                          >
                            {val > 0 ? val : ""}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classification Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Classificação por Tecnologia</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tecnologia</TableHead>
                    <TableHead className="text-center">Total de Quedas</TableHead>
                    <TableHead className="text-center">Intervalo Médio (dias)</TableHead>
                    <TableHead className="text-center">Classificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map(s => {
                    const cfg = CLASSIF_CONFIG[s.classificacao];
                    return (
                      <TableRow key={s.nome}>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell className="text-center">{s.totalOcorrencias}</TableCell>
                        <TableCell className="text-center">
                          {s.intervaloMedioDias !== null ? `${s.intervaloMedioDias.toFixed(1)}` : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`${cfg.bg} ${cfg.color} border`}>
                            {cfg.emoji} {cfg.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
