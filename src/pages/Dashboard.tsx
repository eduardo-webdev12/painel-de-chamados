import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useChamados, ChamadoDB } from "@/hooks/useChamados";
import { normalizarStatusChamado } from "@/lib/chamadoWorkflow";
import { analisarPlacas, calcularMTBFGlobal, gerarAlertasTempo, RISCO_CONFIG, type NivelRisco } from "@/lib/nocAnalytics";
import { motion } from "framer-motion";
import {
  PlusCircle, AlertTriangle, Clock, CheckCircle2, Inbox, RotateCcw,
  TrendingUp, Percent, Truck, Cpu, User, CalendarDays, Timer,
  ShieldOff, Lock, Bell, Activity, BarChart3, Target, Zap,
  TrendingDown, Award, Flame, Eye, Gauge, Shield, Radio
} from "lucide-react";
import { format, isToday, isYesterday, subDays, parseISO, isAfter, differenceInMinutes, differenceInHours, getHours, startOfMonth, subMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar
} from "recharts";

// ─── Constants ─────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Aberto: "hsl(0, 72%, 51%)",
  "Em Tratativa": "hsl(45, 93%, 47%)",
  Resolvido: "hsl(142, 71%, 45%)",
  "Encerrado — Continua travado": "hsl(25, 95%, 53%)",
  "Encerrado — Sem cobertura": "hsl(220, 10%, 50%)",
};

const HEATMAP_HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Periodo = "hoje" | "ontem" | "7dias" | "30dias" | "90dias" | "custom";

const ALERT_THRESHOLDS = { emTratativa: 5, continuaTravado: 3, abertos: 10 };
const PLACA_CRITICA_THRESHOLDS = { ocorrencias: 3, minutosTravada: 120 };

// ─── Animated Counter ──────────────────────────────────────
function AnimatedValue({ value, suffix = "" }: { value: string | number; suffix?: string }) {
  return (
    <motion.span
      key={String(value)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="inline-block"
    >
      {value}{suffix}
    </motion.span>
  );
}

// ─── Custom Tooltips ───────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label, labelKey }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="text-sm font-semibold text-card-foreground">{label || payload[0]?.payload?.[labelKey]}</p>
      <p className="text-sm text-muted-foreground">Ocorrências: <span className="font-bold text-foreground">{payload[0]?.value}</span></p>
    </div>
  );
};

// ─── KPI Card Component ────────────────────────────────────
function KPICard({ title, value, icon: Icon, accent, alert, subtitle, delay = 0 }: {
  title: string; value: string | number; icon: any; accent: string; alert?: boolean; subtitle?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-md ${alert ? "border-destructive/50 ring-1 ring-destructive/20" : "hover:border-primary/30"}`}>
        {alert && <div className="absolute top-0 left-0 right-0 h-0.5 bg-destructive animate-pulse" />}
        <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 p-4">
          <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight uppercase tracking-wider">{title}</CardTitle>
          <div className="flex items-center gap-1">
            {alert && <Bell className="h-3 w-3 text-destructive animate-pulse" />}
            <Icon className={`h-4 w-4 shrink-0 ${accent}`} />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-xl font-bold truncate"><AnimatedValue value={value} /></div>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Heatmap Component ─────────────────────────────────────
function HeatmapChart({ data }: { data: { day: number; hour: number; count: number }[] }) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="flex gap-0.5 mb-1">
          <div className="w-10" />
          {HEATMAP_HOURS.map((h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{String(h).padStart(2, "0")}</div>
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
          <div key={day} className="flex gap-0.5 mb-0.5">
            <div className="w-10 text-[10px] text-muted-foreground flex items-center">{WEEKDAYS[day]}</div>
            {HEATMAP_HOURS.map((hour) => {
              const cell = data.find((d) => d.day === day && d.hour === hour);
              const count = cell?.count || 0;
              const intensity = count / maxCount;
              return (
                <div
                  key={hour}
                  className="flex-1 aspect-square rounded-sm transition-colors"
                  style={{
                    backgroundColor: count === 0
                      ? "hsl(var(--muted))"
                      : `hsl(0, 72%, ${Math.max(30, 80 - intensity * 50)}%)`,
                  }}
                  title={`${WEEKDAYS[day]} ${String(hour).padStart(2, "0")}h: ${count} ocorrência${count !== 1 ? "s" : ""}`}
                />
              );
            })}
          </div>
        ))}
        <div className="flex items-center justify-end gap-2 mt-2">
          <span className="text-[9px] text-muted-foreground">Menos</span>
          {[0, 0.25, 0.5, 0.75, 1].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: i === 0 ? "hsl(var(--muted))" : `hsl(0, 72%, ${Math.max(30, 80 - i * 50)}%)` }}
            />
          ))}
          <span className="text-[9px] text-muted-foreground">Mais</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────
export default function Dashboard() {
  const { chamados, loading } = useChamados();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>("30dias");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [viewMode, setViewMode] = useState<"executivo" | "operacional">("executivo");

  // ─── Filtered data ─────────────────────────────────────
  const filtrados = useMemo(() => {
    const now = new Date();
    return chamados.filter((c) => {
      const d = parseISO(c.data_abertura);
      switch (periodo) {
        case "hoje": return isToday(d);
        case "ontem": return isYesterday(d);
        case "7dias": return isAfter(d, subDays(now, 7));
        case "30dias": return isAfter(d, subDays(now, 30));
        case "90dias": return isAfter(d, subDays(now, 90));
        case "custom":
          if (dataInicio && dataFim) return d >= new Date(dataInicio) && d <= new Date(dataFim + "T23:59:59");
          return true;
        default: return true;
      }
    });
  }, [chamados, periodo, dataInicio, dataFim]);

  // ─── Core Metrics ──────────────────────────────────────
  const metrics = useMemo(() => {
    const total = filtrados.length;
    const withStatus = filtrados.map((c) => ({ ...c, statusNormalizado: normalizarStatusChamado(c.status) }));
    const abertos = withStatus.filter((c) => c.statusNormalizado === "Aberto").length;
    const emTratativa = withStatus.filter((c) => c.statusNormalizado === "Em Tratativa").length;
    const resolvidos = withStatus.filter((c) => c.statusNormalizado === "Resolvido").length;
    const continuaTravado = withStatus.filter((c) => c.statusNormalizado === "Encerrado — Continua travado").length;
    const semCobertura = withStatus.filter((c) => c.statusNormalizado === "Encerrado — Sem cobertura").length;
    const recorrentes = filtrados.filter((c) => c.recorrente).length;
    const resolvidosHoje = chamados.filter((c) => normalizarStatusChamado(c.status) === "Resolvido" && c.data_resolucao && isToday(parseISO(c.data_resolucao))).length;
    const chamadosHoje = chamados.filter((c) => isToday(parseISO(c.data_abertura))).length;

    // MTTR - Mean Time To Resolve (only resolved)
    const comResolucao = withStatus.filter((c) => c.statusNormalizado === "Resolvido" && c.data_resolucao);
    let mttr = "—";
    let mttrMinutos = 0;
    if (comResolucao.length > 0) {
      mttrMinutos = comResolucao.reduce((acc, c) =>
        acc + differenceInMinutes(parseISO(c.data_resolucao!), parseISO(c.data_abertura)), 0) / comResolucao.length;
      mttr = mttrMinutos < 60 ? `${Math.round(mttrMinutos)} min` : `${(mttrMinutos / 60).toFixed(1)} h`;
    }

    // Tempo médio em aberto
    const abertosAtivos = withStatus.filter((c) => c.statusNormalizado === "Aberto" || c.statusNormalizado === "Em Tratativa");
    let tempoMedioAberto = "—";
    if (abertosAtivos.length > 0) {
      const totalMin = abertosAtivos.reduce((acc, c) =>
        acc + differenceInMinutes(new Date(), parseISO(c.data_abertura)), 0) / abertosAtivos.length;
      tempoMedioAberto = totalMin < 60 ? `${Math.round(totalMin)} min` : `${(totalMin / 60).toFixed(1)} h`;
    }

    // Taxa resolução mesmo dia
    const resolvidosMesmoDia = comResolucao.filter((c) => {
      const abertura = parseISO(c.data_abertura);
      const resolucao = parseISO(c.data_resolucao!);
      return differenceInHours(resolucao, abertura) <= 24;
    }).length;
    const taxaMesmoDia = comResolucao.length > 0 ? ((resolvidosMesmoDia / comResolucao.length) * 100).toFixed(1) : "0";

    // Top rankings
    const placaCount: Record<string, number> = {};
    const transpCount: Record<string, number> = {};
    const tecCount: Record<string, number> = {};
    const opCount: Record<string, number> = {};
    filtrados.forEach((c) => {
      placaCount[c.placa] = (placaCount[c.placa] || 0) + 1;
      transpCount[c.transportadora] = (transpCount[c.transportadora] || 0) + 1;
      tecCount[c.tecnologia] = (tecCount[c.tecnologia] || 0) + 1;
      if (c.finalizado_por_nome) opCount[c.finalizado_por_nome] = (opCount[c.finalizado_por_nome] || 0) + 1;
    });
    const topPlaca = Object.entries(placaCount).sort((a, b) => b[1] - a[1])[0];
    const topTransp = Object.entries(transpCount).sort((a, b) => b[1] - a[1])[0];
    const topTec = Object.entries(tecCount).sort((a, b) => b[1] - a[1])[0];
    const topOp = Object.entries(opCount).sort((a, b) => b[1] - a[1])[0];

    const placasCriticas = Object.entries(placaCount)
      .filter(([, totalOcorrencias]) => totalOcorrencias >= PLACA_CRITICA_THRESHOLDS.ocorrencias)
      .map(([placa]) => placa);

    const placasAbertasMuitoTempo = withStatus
      .filter((c) => (c.statusNormalizado === "Aberto" || c.statusNormalizado === "Em Tratativa") && c.hora_travou)
      .filter((c) => differenceInMinutes(new Date(), parseISO(c.hora_travou!)) >= PLACA_CRITICA_THRESHOLDS.minutosTravada)
      .map((c) => c.placa);

    const placasCriticasSet = new Set([...placasCriticas, ...placasAbertasMuitoTempo]);

    const taxaResolucao = total > 0 ? ((resolvidos / total) * 100).toFixed(1) : "0";
    const taxaRecorrencia = total > 0 ? ((recorrentes / total) * 100).toFixed(1) : "0";

    // MTBF global
    const mtbfGlobal = calcularMTBFGlobal(filtrados);

    // Predictive risk analysis
    const placasAnalise = analisarPlacas(filtrados);
    const placasCriticasPreditivo = placasAnalise.filter(p => p.nivel === "critico").length;
    const placasAltoPreditivo = placasAnalise.filter(p => p.nivel === "alto").length;
    const placasMedioPreditivo = placasAnalise.filter(p => p.nivel === "medio").length;

    // Time-based alerts
    const alertasTempo = gerarAlertasTempo(filtrados);

    // SLA per transportadora (avg resolve time)
    const slaTransp: Record<string, { total: number; count: number }> = {};
    comResolucao.forEach((c) => {
      const mins = differenceInMinutes(parseISO(c.data_resolucao!), parseISO(c.data_abertura));
      if (!slaTransp[c.transportadora]) slaTransp[c.transportadora] = { total: 0, count: 0 };
      slaTransp[c.transportadora].total += mins;
      slaTransp[c.transportadora].count += 1;
    });

    // SLA per tecnologia
    const slaTec: Record<string, { total: number; count: number }> = {};
    comResolucao.forEach((c) => {
      const mins = differenceInMinutes(parseISO(c.data_resolucao!), parseISO(c.data_abertura));
      if (!slaTec[c.tecnologia]) slaTec[c.tecnologia] = { total: 0, count: 0 };
      slaTec[c.tecnologia].total += mins;
      slaTec[c.tecnologia].count += 1;
    });

    // Monthly comparison
    const now = new Date();
    const mesAtual = chamados.filter((c) => isSameMonth(parseISO(c.data_abertura), now)).length;
    const mesAnterior = chamados.filter((c) => isSameMonth(parseISO(c.data_abertura), subMonths(now, 1))).length;
    const variacaoMensal = mesAnterior > 0 ? (((mesAtual - mesAnterior) / mesAnterior) * 100).toFixed(0) : "—";

    // Risk indicator
    const risco = abertos >= ALERT_THRESHOLDS.abertos || continuaTravado >= ALERT_THRESHOLDS.continuaTravado ? "Alto"
      : emTratativa >= ALERT_THRESHOLDS.emTratativa ? "Médio" : "Baixo";

    return {
      total, abertos, emTratativa, resolvidos, continuaTravado, semCobertura, recorrentes,
      chamadosHoje, resolvidosHoje, mttr, tempoMedioAberto,
      topPlaca: topPlaca ? `${topPlaca[0]} (${topPlaca[1]}x)` : "—",
      topTransp: topTransp ? `${topTransp[0]} (${topTransp[1]}x)` : "—",
      topTec: topTec ? `${topTec[0]} (${topTec[1]}x)` : "—",
      topOp: topOp ? `${topOp[0]} (${topOp[1]})` : "—",
      taxaResolucao, taxaRecorrencia, taxaMesmoDia,
      slaTransp, slaTec,
      mesAtual, mesAnterior, variacaoMensal, risco,
      placaCount, transpCount, tecCount, opCount,
      placasCriticasCount: placasCriticasSet.size,
      placasCriticasList: Array.from(placasCriticasSet).slice(0, 5),
      mtbfGlobal,
      placasCriticasPreditivo,
      placasAltoPreditivo,
      placasMedioPreditivo,
      alertasTempo,
      placasAnalise,
    };
  }, [filtrados, chamados]);

  // ─── Alerts ────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: { message: string; level: "warn" | "critical" }[] = [];
    if (metrics.abertos >= ALERT_THRESHOLDS.abertos) list.push({ message: `⚠ ${metrics.abertos} chamados abertos — acima do limite de ${ALERT_THRESHOLDS.abertos}`, level: "critical" });
    if (metrics.continuaTravado >= ALERT_THRESHOLDS.continuaTravado) list.push({ message: `🔒 ${metrics.continuaTravado} chamados "Continua Travado" — ação necessária`, level: "critical" });
    if (metrics.emTratativa >= ALERT_THRESHOLDS.emTratativa) list.push({ message: `🕐 ${metrics.emTratativa} chamados em tratativa — acima do limite de ${ALERT_THRESHOLDS.emTratativa}`, level: "warn" });
    if (metrics.placasCriticasCount > 0) {
      const preview = metrics.placasCriticasList.join(", ");
      list.push({
        message: `⚠ Placa crítica detectada (${metrics.placasCriticasCount}) — ${preview}${metrics.placasCriticasCount > metrics.placasCriticasList.length ? "..." : ""}`,
        level: "critical",
      });
    }
    return list;
  }, [metrics]);

  // ─── Chart data ────────────────────────────────────────
  const placasChart = useMemo(() =>
    Object.entries(metrics.placaCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([placa, total]) => ({ placa, total })),
    [metrics.placaCount]);

  const transpChart = useMemo(() =>
    Object.entries(metrics.transpCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total]) => ({ name, total })),
    [metrics.transpCount]);

  const statusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    filtrados.forEach((c) => {
      const status = normalizarStatusChamado(c.status);
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filtrados]);

  const evolucaoChart = useMemo(() => {
    const byDay: Record<string, { abertura: number; resolucao: number }> = {};
    filtrados.forEach((c) => {
      const day = format(parseISO(c.data_abertura), "dd/MM");
      if (!byDay[day]) byDay[day] = { abertura: 0, resolucao: 0 };
      byDay[day].abertura += 1;
    });
    filtrados.filter((c) => c.data_resolucao).forEach((c) => {
      const day = format(parseISO(c.data_resolucao!), "dd/MM");
      if (!byDay[day]) byDay[day] = { abertura: 0, resolucao: 0 };
      byDay[day].resolucao += 1;
    });
    return Object.entries(byDay).map(([dia, v]) => ({ dia, abertos: v.abertura, resolvidos: v.resolucao }));
  }, [filtrados]);

  const operadorChart = useMemo(() =>
    Object.entries(metrics.opCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total]) => ({ name, total })),
    [metrics.opCount]);

  const tecInstabilidade = useMemo(() =>
    Object.entries(metrics.tecCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, total]) => ({ name, total })),
    [metrics.tecCount]);

  const slaTranspChart = useMemo(() =>
    Object.entries(metrics.slaTransp).map(([name, v]) => {
      const avg = v.total / v.count;
      return { name, sla: Number((avg / 60).toFixed(1)) };
    }).sort((a, b) => a.sla - b.sla).slice(0, 8),
    [metrics.slaTransp]);

  const heatmapData = useMemo(() => {
    const grid: Record<string, number> = {};
    filtrados.forEach((c) => {
      const d = parseISO(c.data_abertura);
      const key = `${d.getDay()}-${getHours(d)}`;
      grid[key] = (grid[key] || 0) + 1;
    });
    return Object.entries(grid).map(([key, count]) => {
      const [day, hour] = key.split("-").map(Number);
      return { day, hour, count };
    });
  }, [filtrados]);

  // Click handlers
  const handlePlacaClick = (data: any) => {
    if (data?.placa) navigate(`/chamados?placa=${encodeURIComponent(data.placa)}`);
  };
  const handleTranspClick = (data: any) => {
    if (data?.name) navigate(`/chamados?transportadora=${encodeURIComponent(data.name)}`);
  };

  // Truncate label for chart
  const truncateLabel = (label: string, max = 18) => label.length > max ? label.substring(0, max) + "…" : label;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })} · {metrics.total} chamados no período
          </p>
        </motion.div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="mr-2">
            <TabsList className="h-8">
              <TabsTrigger value="executivo" className="text-xs px-3 h-7"><Eye className="h-3 w-3 mr-1" />Executivo</TabsTrigger>
              <TabsTrigger value="operacional" className="text-xs px-3 h-7"><Gauge className="h-3 w-3 mr-1" />Operacional</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="ontem">Ontem</SelectItem>
              <SelectItem value="7dias">Últimos 7 dias</SelectItem>
              <SelectItem value="30dias">Últimos 30 dias</SelectItem>
              <SelectItem value="90dias">Últimos 90 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodo === "custom" && (
            <>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-[140px] h-8 text-xs" />
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[140px] h-8 text-xs" />
            </>
          )}
          <Button size="sm" asChild className="h-8">
            <Link to="/novo-chamado"><PlusCircle className="mr-1 h-3.5 w-3.5" />Novo Chamado</Link>
          </Button>
        </div>
      </div>

      {/* ─── Alerts ─────────────────────────────────────── */}
      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium ${
                alert.level === "critical"
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-status-in-progress/40 bg-status-in-progress/5 text-status-in-progress"
              }`}
            >
              <Bell className="h-4 w-4 shrink-0" />
              <span>{alert.message}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* ─── Risk Indicator ─────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <Card className={`border-l-4 ${metrics.risco === "Alto" ? "border-l-destructive" : metrics.risco === "Médio" ? "border-l-status-in-progress" : "border-l-status-resolved"}`}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Flame className={`h-5 w-5 ${metrics.risco === "Alto" ? "text-destructive" : metrics.risco === "Médio" ? "text-status-in-progress" : "text-status-resolved"}`} />
              <div>
                <p className="text-sm font-semibold">Risco Operacional: {metrics.risco}</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.risco === "Alto" ? "Ações imediatas necessárias" : metrics.risco === "Médio" ? "Monitorar de perto" : "Operação estável"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span>Mês atual: <strong className="text-foreground">{metrics.mesAtual}</strong></span>
              <span>Mês anterior: <strong className="text-foreground">{metrics.mesAnterior}</strong></span>
              {metrics.variacaoMensal !== "—" && (
                <span className={Number(metrics.variacaoMensal) > 0 ? "text-destructive" : "text-status-resolved"}>
                  {Number(metrics.variacaoMensal) > 0 ? "↑" : "↓"} {Math.abs(Number(metrics.variacaoMensal))}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Executive KPI Cards ────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard title="Chamados Hoje" value={metrics.chamadosHoje} icon={CalendarDays} accent="text-primary" delay={0} />
        <KPICard title="Em Aberto" value={metrics.abertos} icon={AlertTriangle} accent="text-status-open" alert={metrics.abertos >= ALERT_THRESHOLDS.abertos} delay={0.05} />
        <KPICard title="Em Tratativa" value={metrics.emTratativa} icon={Clock} accent="text-status-in-progress" alert={metrics.emTratativa >= ALERT_THRESHOLDS.emTratativa} delay={0.1} />
        <KPICard title="Resolvidos Hoje" value={metrics.resolvidosHoje} icon={CheckCircle2} accent="text-status-resolved" delay={0.15} />
        <KPICard title="Continua Travado" value={metrics.continuaTravado} icon={Lock} accent="text-status-locked" alert={metrics.continuaTravado >= ALERT_THRESHOLDS.continuaTravado} delay={0.2} />
        <KPICard title="Sem Cobertura" value={metrics.semCobertura} icon={ShieldOff} accent="text-status-nocoverage" delay={0.25} />
        <KPICard title="Recorrentes" value={metrics.recorrentes} icon={RotateCcw} accent="text-destructive" subtitle={`${metrics.taxaRecorrencia}% do total`} delay={0.3} />
        <KPICard title="MTTR" value={metrics.mttr} icon={Timer} accent="text-primary" subtitle="Tempo médio de resolução" delay={0.35} />
        <KPICard title="MTBF" value={metrics.mtbfGlobal} icon={Shield} accent="text-primary" subtitle="Tempo médio entre falhas" delay={0.38} />
        <KPICard title="Taxa Resolução" value={`${metrics.taxaResolucao}%`} icon={Target} accent="text-status-resolved" delay={0.4} />
        <KPICard title="Resolução ≤24h" value={`${metrics.taxaMesmoDia}%`} icon={Zap} accent="text-primary" subtitle="Resolvidos no mesmo dia" delay={0.45} />
      </div>

      {/* ─── Criticality Panel ──────────────────────────── */}
      {(metrics.placasCriticasPreditivo > 0 || metrics.placasAltoPreditivo > 0) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Radio className="h-4 w-4 text-destructive" />
                Painel de Criticidade de Placas
              </CardTitle>
              <CardDescription className="text-xs">Classificação preditiva baseada em histórico, recorrência e tempo travada</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                {(["critico", "alto", "medio"] as const).map(nivel => {
                  const count = nivel === "critico" ? metrics.placasCriticasPreditivo : nivel === "alto" ? metrics.placasAltoPreditivo : metrics.placasMedioPreditivo;
                  const cfg = RISCO_CONFIG[nivel];
                  return (
                    <div key={nivel} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.bg}`}>
                      <span>{cfg.icon}</span>
                      <span className={`text-sm font-bold ${cfg.color}`}>{count}</span>
                      <span className="text-xs text-muted-foreground">{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
              {metrics.placasAnalise.filter((p: any) => p.nivel === "critico" || p.nivel === "alto").slice(0, 5).map((p: any) => {
                const cfg = RISCO_CONFIG[p.nivel as NivelRisco];
                return (
                  <div key={p.placa} className={`flex items-center justify-between py-2 px-3 rounded-md mb-1 border ${cfg.bg}`}>
                    <div className="flex items-center gap-3">
                      <span>{cfg.icon}</span>
                      <span className="font-mono font-bold text-sm">{p.placa}</span>
                      <span className="text-xs text-muted-foreground">{p.tecnologias.join(", ")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>{p.totalOcorrencias} ocs</span>
                      {p.recorrencias > 0 && <span className="text-orange-500">{p.recorrencias}x recorr.</span>}
                      {p.tempoTravadaAtual > 0 && <span className="text-destructive font-medium">⏱ {p.tempoTravadaAtual < 60 ? `${p.tempoTravadaAtual}min` : `${(p.tempoTravadaAtual / 60).toFixed(1)}h`}</span>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Time Alerts ────────────────────────────────── */}
      {metrics.alertasTempo.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas de Tempo — Placas Travadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {metrics.alertasTempo.slice(0, 8).map((a: any) => (
                <div
                  key={a.chamadoId}
                  className={`flex items-center justify-between py-2 px-3 rounded-md cursor-pointer hover:bg-muted/50 ${
                    a.level === "critico" ? "bg-destructive/5 border border-destructive/20" :
                    a.level === "vermelho" ? "bg-orange-500/5 border border-orange-400/20" :
                    "bg-yellow-500/5 border border-yellow-400/20"
                  }`}
                  onClick={() => navigate(`/chamados/${a.chamadoId}`)}
                >
                  <div className="flex items-center gap-3">
                    <span>{a.level === "critico" ? "🔴" : a.level === "vermelho" ? "🟠" : "🟡"}</span>
                    <span className="font-mono font-bold text-sm">{a.placa}</span>
                    <span className="text-xs text-muted-foreground">{a.tecnologia} • {a.transportadora}</span>
                  </div>
                  <span className={`text-sm font-bold ${a.level === "critico" ? "text-destructive" : a.level === "vermelho" ? "text-orange-500" : "text-yellow-600"}`}>
                    {a.minutosTravada < 60 ? `${a.minutosTravada} min` : `${(a.minutosTravada / 60).toFixed(1)} h`}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {viewMode === "executivo" ? (
        <>
          {/* ─── Executive Rankings ─────────────────────── */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KPICard title="Placa Crítica" value={metrics.topPlaca} icon={Inbox} accent="text-primary" delay={0.5} />
            <KPICard title="Top Transportadora" value={metrics.topTransp} icon={Truck} accent="text-primary" delay={0.55} />
            <KPICard title="Tecnologia + Falhas" value={metrics.topTec} icon={Cpu} accent="text-primary" delay={0.6} />
            <KPICard title="Top Operador" value={metrics.topOp} icon={Award} accent="text-primary" delay={0.65} />
          </div>

          {/* ─── Charts Row 1 ──────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução — Abertos vs Resolvidos</CardTitle></CardHeader>
                <CardContent className="h-[260px]">
                  {evolucaoChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucaoChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="dia" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis allowDecimals={false} fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Line type="monotone" dataKey="abertos" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 2 }} name="Abertos" />
                        <Line type="monotone" dataKey="resolvidos" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 2 }} name="Resolvidos" />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Distribuição por Status</CardTitle></CardHeader>
                <CardContent className="h-[260px]">
                  {statusChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusChart} cx="50%" cy="45%" outerRadius={75} innerRadius={40} dataKey="value" label={({ value }) => value} fontSize={11} paddingAngle={2}>
                          {statusChart.map((entry) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#888"} />)}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ─── Heatmap ───────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Mapa de Calor — Incidência por Dia/Hora</CardTitle></CardHeader>
              <CardContent>
                <HeatmapChart data={heatmapData} />
              </CardContent>
            </Card>
          </motion.div>
        </>
      ) : (
        <>
          {/* ─── Operational View ──────────────────────── */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KPICard title="Tempo Médio Aberto" value={metrics.tempoMedioAberto} icon={TrendingUp} accent="text-muted-foreground" delay={0.5} />
            <KPICard title="Taxa Recorrência" value={`${metrics.taxaRecorrencia}%`} icon={Percent} accent="text-destructive" delay={0.55} />
            <KPICard title="Total no Período" value={metrics.total} icon={BarChart3} accent="text-primary" delay={0.6} />
            <KPICard title="Variação Mensal" value={metrics.variacaoMensal !== "—" ? `${metrics.variacaoMensal}%` : "—"} icon={Number(metrics.variacaoMensal) > 0 ? TrendingUp : TrendingDown} accent={Number(metrics.variacaoMensal) > 0 ? "text-destructive" : "text-status-resolved"} delay={0.65} />
          </div>
        </>
      )}

      {/* ─── Charts Row 2 — Always visible ─────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 10 Placas com Mais Falhas</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
              {placasChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={placasChart} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="placa" width={90} fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <RechartsTooltip content={<CustomBarTooltip labelKey="placa" />} />
                    <Bar dataKey="total" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]} cursor="pointer" onClick={handlePlacaClick} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top Transportadoras com Mais Ocorrências</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
              {transpChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={transpChart} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      fontSize={10}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => truncateLabel(v, 22)}
                    />
                    <RechartsTooltip content={<CustomBarTooltip labelKey="name" />} />
                    <Bar dataKey="total" fill="hsl(215, 80%, 50%)" radius={[0, 4, 4, 0]} cursor="pointer" onClick={handleTranspClick} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Charts Row 3 ──────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Desempenho por Operador</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              {operadorChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operadorChart} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} fontSize={10} />
                    <YAxis type="category" dataKey="name" width={100} fontSize={10} tickFormatter={(v) => truncateLabel(v, 16)} />
                    <RechartsTooltip content={<CustomBarTooltip labelKey="name" />} />
                    <Bar dataKey="total" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Instabilidade por Tecnologia</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              {tecInstabilidade.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tecInstabilidade} margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={9} tick={{ fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" height={50} tickFormatter={(v) => truncateLabel(v, 12)} />
                    <YAxis allowDecimals={false} fontSize={10} />
                    <RechartsTooltip content={<CustomBarTooltip labelKey="name" />} />
                    <Bar dataKey="total" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">SLA Médio por Transportadora (h)</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              {slaTranspChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={slaTranspChart} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} unit="h" />
                    <YAxis type="category" dataKey="name" width={120} fontSize={10} tickFormatter={(v) => truncateLabel(v, 18)} />
                    <RechartsTooltip formatter={(value: number) => [`${value} h`, "SLA Médio"]} />
                    <Bar dataKey="sla" fill="hsl(215, 80%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Recent Table ──────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Chamados Recentes</CardTitle></CardHeader>
          <CardContent>
            {filtrados.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nenhum chamado neste período.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Placa</TableHead>
                      <TableHead className="text-xs">Transportadora</TableHead>
                      <TableHead className="text-xs">Tecnologia</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Criado por</TableHead>
                      <TableHead className="text-xs">Finalizado por</TableHead>
                      <TableHead className="text-xs">Recorrente</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.slice(0, 10).map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/chamados/${c.id}`)}>
                        <TableCell className="font-medium text-xs">{c.placa}</TableCell>
                        <TableCell className="text-xs">{c.transportadora}</TableCell>
                        <TableCell className="text-xs">{c.tecnologia}</TableCell>
                        <TableCell><StatusBadge status={c.status} /></TableCell>
                        <TableCell>
                          <div className="text-xs">{c.created_by_name || "—"}</div>
                          {c.created_by_role && <div className="text-[10px] text-muted-foreground">{c.created_by_role}</div>}
                        </TableCell>
                        <TableCell>
                          {c.finalizado_por_nome ? (
                            <>
                              <div className="text-xs">{c.finalizado_por_nome}</div>
                              {c.finalizado_por_cargo && <div className="text-[10px] text-muted-foreground">{c.finalizado_por_cargo}</div>}
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{c.recorrente ? `Sim (${c.contagem_recorrencia}x)` : "Não"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(parseISO(c.data_abertura), "dd/MM/yy HH:mm")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
