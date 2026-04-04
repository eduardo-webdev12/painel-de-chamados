import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChamados } from "@/hooks/useChamados";
import { normalizarTecnologia } from "@/lib/tecnologiaNormalizacao";
import { calcularMTBF } from "@/lib/nocAnalytics";
import { differenceInMinutes, differenceInDays, parseISO, subDays, format, getDay, getHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Activity, AlertTriangle, TrendingUp, Clock, Download } from "lucide-react";
import { motion } from "framer-motion";

type Classificacao = "estavel" | "atencao" | "critica";

interface TecRecorrencia {
  nome: string;
  totalOcorrencias: number;
  recorrencias: number;
  taxaRecorrencia: number;
  intervaloMedioDias: number | null;
  tempoMedioIndisponibilidade: number;
  classificacao: Classificacao;
}

const CLASSIF_CONFIG: Record<Classificacao, { label: string; color: string; bg: string; emoji: string }> = {
  estavel: { label: "Estável", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-400/30", emoji: "🟢" },
  atencao: { label: "Atenção", color: "text-yellow-600", bg: "bg-yellow-500/10 border-yellow-400/30", emoji: "🟡" },
  critica: { label: "Crítica", color: "text-red-600", bg: "bg-destructive/10 border-destructive/30", emoji: "🔴" },
};

function classificar(taxa: number, intervalo: number | null): Classificacao {
  if (taxa >= 0.3 || (intervalo !== null && intervalo < 3)) return "critica";
  if (taxa >= 0.15 || (intervalo !== null && intervalo < 7)) return "atencao";
  return "estavel";
}

const PERIODOS = [
  { label: "7 dias", value: "7" },
  { label: "30 dias", value: "30" },
  { label: "90 dias", value: "90" },
  { label: "Total", value: "all" },
];

export default function RecorrenciasTecnologias() {
  const { chamados } = useChamados();
  const [periodo, setPeriodo] = useState("30");
  const [filtroTec, setFiltroTec] = useState("all");

  const filtrados = useMemo(() => {
    if (periodo === "all") return chamados;
    const dias = parseInt(periodo);
    const corte = subDays(new Date(), dias);
    return chamados.filter((c) => new Date(c.data_abertura) >= corte);
  }, [chamados, periodo]);

  const tecnologias = useMemo(() => [...new Set(chamados.map((c) => normalizarTecnologia(c.tecnologia)))].sort(), [chamados]);

  const stats = useMemo((): TecRecorrencia[] => {
    const map = new Map<string, typeof filtrados>();
    filtrados.forEach((c) => {
      const tec = normalizarTecnologia(c.tecnologia);
      if (!map.has(tec)) map.set(tec, []);
      map.get(tec)!.push(c);
    });

    return Array.from(map.entries()).map(([nome, ocs]) => {
      const recorrencias = ocs.filter((o) => o.recorrente).length;
      const taxa = ocs.length > 0 ? recorrencias / ocs.length : 0;
      const mtbfMin = calcularMTBF(ocs);
      const intervaloMedioDias = mtbfMin !== null ? mtbfMin / 1440 : null;

      const resolvidos = ocs.filter((o) => o.data_resolucao && o.hora_travou);
      const tempos = resolvidos.map((o) => Math.max(0, differenceInMinutes(parseISO(o.data_resolucao!), parseISO(o.hora_travou!))));
      const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

      return {
        nome,
        totalOcorrencias: ocs.length,
        recorrencias,
        taxaRecorrencia: taxa,
        intervaloMedioDias,
        tempoMedioIndisponibilidade: tempoMedio,
        classificacao: classificar(taxa, intervaloMedioDias),
      };
    }).sort((a, b) => b.totalOcorrencias - a.totalOcorrencias);
  }, [filtrados]);

  const statsFiltradas = filtroTec === "all" ? stats : stats.filter((s) => s.nome === filtroTec);

  // Trend data: monthly occurrences per tech
  const trendData = useMemo(() => {
    const months = new Map<string, Map<string, number>>();
    filtrados.forEach((c) => {
      const tec = normalizarTecnologia(c.tecnologia);
      const mes = format(new Date(c.data_abertura), "MMM/yy", { locale: ptBR });
      if (!months.has(mes)) months.set(mes, new Map());
      const m = months.get(mes)!;
      m.set(tec, (m.get(tec) || 0) + 1);
    });
    const allTechs = tecnologias;
    return Array.from(months.entries()).map(([mes, m]) => {
      const item: Record<string, string | number> = { mes };
      allTechs.forEach((t) => { item[t] = m.get(t) || 0; });
      return item;
    });
  }, [filtrados, tecnologias]);

  // Ranking bar data
  const rankingData = statsFiltradas.map((s) => ({
    nome: s.nome,
    ocorrencias: s.totalOcorrencias,
    recorrencias: s.recorrencias,
  }));

  // Heatmap: day of week x hour
  const heatmapData = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    const source = filtroTec === "all" ? filtrados : filtrados.filter((c) => normalizarTecnologia(c.tecnologia) === filtroTec);
    source.forEach((c) => {
      const d = new Date(c.data_abertura);
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
  }, [filtrados, filtroTec]);

  const maxHeat = Math.max(1, ...heatmapData.map((h) => h.valor));

  // KPI summary
  const totalOcorrencias = statsFiltradas.reduce((s, t) => s + t.totalOcorrencias, 0);
  const totalRecorrencias = statsFiltradas.reduce((s, t) => s + t.recorrencias, 0);
  const criticas = statsFiltradas.filter((s) => s.classificacao === "critica").length;
  const taxaMedia = totalOcorrencias > 0 ? (totalRecorrencias / totalOcorrencias) * 100 : 0;

  const COLORS = ["hsl(215, 80%, 50%)", "hsl(150, 60%, 40%)", "hsl(30, 80%, 50%)", "hsl(350, 70%, 50%)", "hsl(270, 60%, 50%)"];

  const trendTechs = useMemo(() => {
    if (filtroTec !== "all") return [filtroTec];
    return stats.slice(0, 5).map((s) => s.nome);
  }, [stats, filtroTec]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recorrências de Tecnologias</h1>
          <p className="text-sm text-muted-foreground">Análise de frequência, padrões de falha e classificação de risco</p>
        </div>
        <div className="flex gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroTec} onValueChange={setFiltroTec}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tecnologia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {tecnologias.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total de Ocorrências", value: totalOcorrencias, icon: Activity, color: "text-primary" },
          { label: "Recorrências", value: totalRecorrencias, icon: TrendingUp, color: "text-orange-500" },
          { label: "Taxa de Recorrência", value: `${taxaMedia.toFixed(1)}%`, icon: AlertTriangle, color: "text-yellow-500" },
          { label: "Tecnologias Críticas", value: criticas, icon: Clock, color: "text-destructive" },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <kpi.icon className={`h-8 w-8 ${kpi.color} shrink-0`} />
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Line */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução Temporal de Falhas</CardTitle>
            <CardDescription>Tendência mensal de ocorrências por tecnologia</CardDescription>
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

        {/* Ranking Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking de Ocorrências</CardTitle>
            <CardDescription>Tecnologias com mais falhas no período</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rankingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="nome" fontSize={12} width={90} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="ocorrencias" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Ocorrências" />
                <Bar dataKey="recorrencias" fill="hsl(30, 80%, 50%)" radius={[0, 4, 4, 0]} name="Recorrências" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Heatmap Operacional</CardTitle>
          <CardDescription>Dias e horários com maior incidência de falhas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(24, minmax(24px, 1fr))` }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-center text-[10px] text-muted-foreground font-mono">{h}h</div>
              ))}
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia, dIdx) => (
                <>
                  <div key={`l-${dIdx}`} className="text-xs text-muted-foreground flex items-center">{dia}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = heatmapData.find((c) => c.dia === dia && c.hora === h);
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
                </>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intervalo médio entre falhas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Intervalo Médio entre Falhas (dias)</CardTitle>
          <CardDescription>Quanto menor, mais instável a tecnologia</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statsFiltradas.filter((s) => s.intervaloMedioDias !== null).map((s) => ({ nome: s.nome, dias: Math.round(s.intervaloMedioDias! * 10) / 10 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="dias" fill="hsl(150, 60%, 40%)" radius={[4, 4, 0, 0]} name="Dias entre falhas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhamento por Tecnologia</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tecnologia</TableHead>
                <TableHead className="text-center">Ocorrências</TableHead>
                <TableHead className="text-center">Recorrências</TableHead>
                <TableHead className="text-center">Taxa (%)</TableHead>
                <TableHead className="text-center">Intervalo (dias)</TableHead>
                <TableHead className="text-center">Tempo Médio Indisp.</TableHead>
                <TableHead className="text-center">Classificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statsFiltradas.map((s) => {
                const cfg = CLASSIF_CONFIG[s.classificacao];
                return (
                  <TableRow key={s.nome}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell className="text-center">{s.totalOcorrencias}</TableCell>
                    <TableCell className="text-center">{s.recorrencias}</TableCell>
                    <TableCell className="text-center">{(s.taxaRecorrencia * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-center">
                      {s.intervaloMedioDias !== null ? `${s.intervaloMedioDias.toFixed(1)}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.tempoMedioIndisponibilidade < 60
                        ? `${Math.round(s.tempoMedioIndisponibilidade)} min`
                        : `${(s.tempoMedioIndisponibilidade / 60).toFixed(1)} h`}
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
    </div>
  );
}
