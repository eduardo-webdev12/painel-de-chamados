import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useChamados } from "@/hooks/useChamados";
import {
  calcularScoreConfiabilidade, calcularMTBFGlobal, rankingTecnologias,
  analisarPlacas, gerarAlertasTempo, SCORE_CONFIG, RISCO_CONFIG,
  type TecnologiaScore,
} from "@/lib/nocAnalytics";
import { normalizarStatusChamado } from "@/lib/chamadoWorkflow";
import {
  Shield, Activity, Clock, Timer, RotateCcw, AlertTriangle, TrendingUp,
  CheckCircle2, Cpu, Car, Truck, Zap, Award, BarChart3, FileText,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, LineChart, Line, Legend,
} from "recharts";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { differenceInMinutes, parseISO, format, subDays, subWeeks, startOfWeek, endOfWeek, isAfter, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatTempo(mins: number) {
  if (mins < 60) return `${Math.round(mins)} min`;
  if (mins < 1440) return `${(mins / 60).toFixed(1)} h`;
  return `${(mins / 1440).toFixed(1)} dias`;
}

function scoreColor(score: number) {
  if (score >= 85) return "hsl(142, 71%, 45%)";
  if (score >= 70) return "hsl(217, 91%, 60%)";
  if (score >= 50) return "hsl(25, 95%, 53%)";
  return "hsl(0, 84%, 60%)";
}

const KpiCard = ({ icon: Icon, label, value, sub, className = "" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; className?: string;
}) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs font-medium">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  </motion.div>
);

export default function PainelExecutivo() {
  const { chamados, loading } = useChamados();

  const [periodo, setPeriodo] = useState<7 | 30 | 90 | null>(30);

  const filtered = useMemo(() => {
    if (!periodo) return chamados;
    const corte = subDays(new Date(), periodo);
    return chamados.filter(c => isAfter(parseISO(c.data_abertura), corte));
  }, [chamados, periodo]);

  const kpis = useMemo(() => {
    const hoje = new Date();
    const seteDias = subDays(hoje, 7);
    const total = filtered.length;
    const abertos = filtered.filter(c => {
      const s = normalizarStatusChamado(c.status);
      return s === "Aberto" || s === "Em Tratativa";
    });
    const resolvidosTotal = filtered.filter(c => normalizarStatusChamado(c.status) === "Resolvido");
    const resolvidosSemana = resolvidosTotal.filter(c => c.data_resolucao && isAfter(parseISO(c.data_resolucao), seteDias));

    const comTempo = filtered.filter(c => c.data_resolucao && c.hora_travou);
    const tempos = comTempo.map(c => Math.max(0, differenceInMinutes(parseISO(c.data_resolucao!), parseISO(c.hora_travou!))));
    const mttr = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

    const taxaResolucao = total > 0 ? (resolvidosTotal.length / total) * 100 : 0;

    const totalRecorrencias = filtered.reduce((s, c) => s + c.contagem_recorrencia, 0);
    const taxaRecorrencia = total > 0 ? (filtered.filter(c => c.recorrente).length / total) * 100 : 0;

    const placasUnicas = new Set(filtered.map(c => c.placa.trim().toUpperCase())).size;

    return { total, abertos: abertos.length, resolvidosSemana: resolvidosSemana.length, mttr, taxaResolucao, totalRecorrencias, taxaRecorrencia, placasUnicas };
  }, [filtered]);

  const techScores = useMemo(() => calcularScoreConfiabilidade(filtered), [filtered]);
  const mtbfGlobal = useMemo(() => calcularMTBFGlobal(filtered), [filtered]);
  const alertas = useMemo(() => gerarAlertasTempo(filtered), [filtered]);
  const placasRisco = useMemo(() => analisarPlacas(filtered).filter(p => p.nivel === "critico" || p.nivel === "alto"), [filtered]);

  const avgScore = techScores.length > 0 ? Math.round(techScores.reduce((s, t) => s + t.score, 0) / techScores.length) : 0;

  // Chart data: score ranking
  const scoreChartData = techScores.map(d => ({
    name: d.nome.length > 14 ? d.nome.slice(0, 12) + "…" : d.nome,
    score: d.score,
    fill: scoreColor(d.score),
  }));

  // Chart data: status distribution
  const statusDist = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(c => {
      const s = normalizarStatusChamado(c.status);
      map[s] = (map[s] || 0) + 1;
    });
    const colors: Record<string, string> = {
      "Aberto": "hsl(0, 84%, 60%)",
      "Em Tratativa": "hsl(45, 93%, 47%)",
      "Resolvido": "hsl(142, 71%, 45%)",
    };
    return Object.entries(map).map(([name, value]) => ({
      name, value, fill: colors[name] || "hsl(217, 91%, 60%)",
    }));
  }, [filtered]);

  const topTransp = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(c => map.set(c.transportadora, (map.get(c.transportadora) || 0) + 1));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, falhas]) => ({ name: name.length > 16 ? name.slice(0, 14) + "…" : name, falhas }));
  }, [filtered]);

  // Weekly evolution: abertos vs resolvidos
  const weeklyEvolution = useMemo(() => {
    const weeks = 8;
    const data: { semana: string; abertos: number; resolvidos: number }[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const label = format(weekStart, "dd/MM");
      const abertos = filtered.filter(c => {
        try { return isWithinInterval(parseISO(c.data_abertura), { start: weekStart, end: weekEnd }); } catch { return false; }
      }).length;
      const resolvidos = filtered.filter(c => {
        if (!c.data_resolucao) return false;
        try { return isWithinInterval(parseISO(c.data_resolucao), { start: weekStart, end: weekEnd }); } catch { return false; }
      }).length;
      data.push({ semana: label, abertos, resolvidos });
    }
    return data;
  }, [filtered]);

  const exportPDF = useCallback(async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const { getLogoBase64 } = await import("@/lib/logo-base64");
      const { drawCoverPage, drawHeader, drawSectionTitle, drawFooter, drawKpiCards, getTableStyles, getKpiTableStyles, checkPageBreak, BRAND } = await import("@/lib/pdfTheme");

      const doc = new jsPDF({ orientation: "landscape" });
      const now = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
      const periodoLabel = periodo ? `Últimos ${periodo} dias` : "Todos os períodos";

      let logo: string | null = null;
      try { logo = await getLogoBase64(); } catch {}

      drawCoverPage({
        doc, logo,
        title: "Painel Executivo",
        subtitle: "Visão consolidada da operação de monitoramento",
        periodo: periodoLabel,
        geradoEm: now,
      });

      let y = drawHeader({
        doc, logo,
        title: "Painel Executivo",
        subtitle: "Indicadores operacionais e estratégicos",
        meta: [`Gerado em: ${now}`, `Período: ${periodoLabel}`, `Chamados: ${kpis.total}`],
      });

      // KPIs
      y = drawSectionTitle(doc, "Indicadores Operacionais (KPIs)", y);
      autoTable(doc, {
        startY: y,
        head: [["Score Médio", "MTTR Global", "MTBF Global", "Taxa Resolução", "Abertos / Total", "Placas", "Recorrência", "Alertas"]],
        body: [[
          `${avgScore} pts`,
          formatTempo(kpis.mttr),
          mtbfGlobal,
          `${kpis.taxaResolucao.toFixed(1)}%`,
          `${kpis.abertos} / ${kpis.total}`,
          kpis.placasUnicas,
          `${kpis.taxaRecorrencia.toFixed(1)}%`,
          alertas.length,
        ]],
        ...getKpiTableStyles(),
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Score ranking
      y = checkPageBreak(doc, y, 60);
      y = drawSectionTitle(doc, "Ranking de Confiabilidade das Tecnologias", y);
      autoTable(doc, {
        startY: y,
        head: [["#", "Tecnologia", "Score", "Status", "Placas", "Falhas", "MTTR", "Recorrência", "MTBF"]],
        body: techScores.map((d, i) => [
          i + 1,
          d.nome,
          `${d.score} pts`,
          SCORE_CONFIG[d.classificacao].label,
          d.totalPlacas,
          d.totalFalhas,
          formatTempo(d.tempoMedioResolucao),
          `${(d.taxaRecorrencia * 100).toFixed(1)}%`,
          d.mtbf !== null ? formatTempo(d.mtbf) : "—",
        ]),
        ...getTableStyles(),
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          2: { halign: "center", fontStyle: "bold" },
          3: { halign: "center" },
          4: { halign: "center" },
          5: { halign: "center" },
          6: { halign: "center" },
          7: { halign: "center" },
          8: { halign: "center" },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Placas em risco
      if (placasRisco.length > 0) {
        y = checkPageBreak(doc, y, 50);
        y = drawSectionTitle(doc, "Placas em Risco Operacional", y, { color: BRAND.danger });
        autoTable(doc, {
          startY: y,
          head: [["Placa", "Nível de Risco", "Ocorrências", "Recorrências", "Tecnologias"]],
          body: placasRisco.slice(0, 15).map(p => [
            p.placa,
            RISCO_CONFIG[p.nivel].label,
            p.totalOcorrencias,
            p.recorrencias,
            p.tecnologias.join(", "),
          ]),
          ...getTableStyles("danger"),
          columnStyles: {
            0: { halign: "center", fontStyle: "bold" },
            1: { halign: "center" },
            2: { halign: "center" },
            3: { halign: "center" },
          },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Weekly evolution
      if (weeklyEvolution.length > 0) {
        y = checkPageBreak(doc, y, 50);
        y = drawSectionTitle(doc, "Evolução Semanal — Abertos vs Resolvidos", y);
        autoTable(doc, {
          startY: y,
          head: [["Semana", "Chamados Abertos", "Chamados Resolvidos"]],
          body: weeklyEvolution.map(w => [w.semana, w.abertos, w.resolvidos]),
          ...getTableStyles(),
          styles: { ...getTableStyles().styles, halign: "center", fontSize: 8 },
        });
      }

      drawFooter(doc, true);
      doc.save(`painel-executivo-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF exportado com sucesso");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  }, [techScores, kpis, avgScore, mtbfGlobal, alertas, placasRisco, weeklyEvolution, periodo]);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Painel Executivo
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada da operação — {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([7, 30, 90] as const).map(d => (
            <Button key={d} size="sm" variant={periodo === d ? "default" : "outline"} onClick={() => setPeriodo(d)}>
              {d}d
            </Button>
          ))}
          <Button size="sm" variant={periodo === null ? "default" : "outline"} onClick={() => setPeriodo(null)}>
            Tudo
          </Button>
          <Button size="sm" variant="outline" onClick={exportPDF} className="gap-1.5 ml-2">
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Award} label="Score Médio" value={avgScore} sub={`de ${techScores.length} tecnologias`} />
        <KpiCard icon={Clock} label="MTTR Global" value={formatTempo(kpis.mttr)} sub="Tempo médio de resolução" />
        <KpiCard icon={Timer} label="MTBF Global" value={mtbfGlobal} sub="Tempo médio entre falhas" />
        <KpiCard icon={CheckCircle2} label="Taxa de Resolução" value={`${kpis.taxaResolucao.toFixed(1)}%`} sub={`${kpis.resolvidosSemana} resolvidos esta semana`} />
      </div>

      {/* KPI Row 2 */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Activity} label="Chamados Abertos" value={kpis.abertos} sub={`de ${kpis.total} total`} className={kpis.abertos > 10 ? "border-destructive/30 bg-destructive/5" : ""} />
        <KpiCard icon={Car} label="Placas Monitoradas" value={kpis.placasUnicas} />
        <KpiCard icon={RotateCcw} label="Taxa Recorrência" value={`${kpis.taxaRecorrencia.toFixed(1)}%`} sub={`${kpis.totalRecorrencias} recorrências total`} />
        <KpiCard icon={AlertTriangle} label="Alertas Ativos" value={alertas.length} sub={`${placasRisco.length} placas em risco`} className={alertas.length > 0 ? "border-orange-400/30 bg-orange-500/5" : ""} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Score Ranking */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Ranking de Confiabilidade</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => [`${v} pts`, "Score"]} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                  {scoreChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {statusDist.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Evolution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Evolução Semanal</CardTitle>
          <CardDescription className="text-xs">Chamados abertos vs resolvidos nas últimas 8 semanas</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyEvolution} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="semana" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="abertos" name="Abertos" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolvidos" name="Resolvidos" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Transportadoras */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Top 5 Transportadoras (Falhas)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTransp} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="falhas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Placas em Risco */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Placas em Risco</CardTitle>
            <CardDescription className="text-xs">{placasRisco.length} placas com risco alto ou crítico</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[260px] overflow-y-auto space-y-2">
            {placasRisco.slice(0, 10).map((p, i) => {
              const cfg = RISCO_CONFIG[p.nivel];
              return (
                <div key={p.placa} className={`flex items-center justify-between rounded-lg border p-2.5 ${cfg.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cfg.icon}</span>
                    <div>
                      <p className="font-mono text-sm font-medium">{p.placa}</p>
                      <p className="text-xs text-muted-foreground">{p.tecnologias.join(", ")} • {p.totalOcorrencias} oc.</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                </div>
              );
            })}
            {placasRisco.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma placa em risco no momento.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Tech Detail Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Cpu className="h-4 w-4" /> Detalhamento por Tecnologia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {techScores.map((d, i) => {
              const cfg = SCORE_CONFIG[d.classificacao];
              return (
                <motion.div key={d.nome} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
                  <div className={`rounded-xl border p-4 ${cfg.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{d.nome}</p>
                      <span className={`text-xs font-bold ${cfg.color}`}>{cfg.icon} {d.score}</span>
                    </div>
                    <Progress value={d.score} className="h-1.5 mb-3" />
                    <div className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                      <span>Placas: <strong className="text-foreground">{d.totalPlacas}</strong></span>
                      <span>Falhas: <strong className="text-foreground">{d.totalFalhas}</strong></span>
                      <span>MTTR: <strong className="text-foreground">{formatTempo(d.tempoMedioResolucao)}</strong></span>
                      <span>MTBF: <strong className="text-foreground">{d.mtbf !== null ? formatTempo(d.mtbf) : "—"}</strong></span>
                      <span>Recorrência: <strong className="text-foreground">{(d.taxaRecorrencia * 100).toFixed(0)}%</strong></span>
                      <span>Status: <strong className={cfg.color}>{cfg.label}</strong></span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
