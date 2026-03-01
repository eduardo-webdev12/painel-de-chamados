import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { useChamados, ChamadoDB } from "@/hooks/useChamados";
import {
  PlusCircle, AlertTriangle, Clock, CheckCircle2, Inbox, RotateCcw,
  TrendingUp, Percent, Truck, Cpu, User, CalendarDays, Timer,
  ShieldOff, Lock, Bell
} from "lucide-react";
import { format, isToday, isYesterday, subDays, parseISO, isAfter, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Aberto: "hsl(0, 72%, 51%)",
  "Em Tratativa": "hsl(45, 93%, 47%)",
  Resolvido: "hsl(142, 71%, 45%)",
  "Encerrado — Continua travado": "hsl(25, 95%, 53%)",
  "Encerrado — Sem cobertura": "hsl(220, 10%, 50%)",
};

type Periodo = "hoje" | "ontem" | "7dias" | "30dias" | "custom";

// Alert thresholds (configurable)
const ALERT_THRESHOLDS = {
  emTratativa: 5,
  continuaTravado: 3,
  abertos: 10,
};

// Custom tooltip for bar charts
const CustomBarTooltip = ({ active, payload, label, labelKey }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-semibold">{label || payload[0]?.payload?.[labelKey]}</p>
      <p className="text-sm text-muted-foreground">Ocorrências: <span className="font-bold text-foreground">{payload[0]?.value}</span></p>
    </div>
  );
};

export default function Dashboard() {
  const { chamados, loading } = useChamados();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>("30dias");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const filtrados = useMemo(() => {
    const now = new Date();
    return chamados.filter((c) => {
      const d = parseISO(c.data_abertura);
      switch (periodo) {
        case "hoje": return isToday(d);
        case "ontem": return isYesterday(d);
        case "7dias": return isAfter(d, subDays(now, 7));
        case "30dias": return isAfter(d, subDays(now, 30));
        case "custom":
          if (dataInicio && dataFim) {
            return d >= new Date(dataInicio) && d <= new Date(dataFim + "T23:59:59");
          }
          return true;
        default: return true;
      }
    });
  }, [chamados, periodo, dataInicio, dataFim]);

  const metrics = useMemo(() => {
    const total = filtrados.length;
    const abertos = filtrados.filter((c) => c.status === "Aberto").length;
    const emTratativa = filtrados.filter((c) => c.status === "Em Tratativa").length;
    const resolvidos = filtrados.filter((c) => c.status === "Resolvido").length;
    const continuaTravado = filtrados.filter((c) => c.status === "Encerrado — Continua travado").length;
    const semCobertura = filtrados.filter((c) => c.status === "Encerrado — Sem cobertura").length;
    const recorrentes = filtrados.filter((c) => c.recorrente).length;

    const resolvidosHoje = chamados.filter((c) => c.status === "Resolvido" && c.data_resolucao && isToday(parseISO(c.data_resolucao))).length;
    const chamadosHoje = chamados.filter((c) => isToday(parseISO(c.data_abertura))).length;

    const comResolucao = filtrados.filter((c) => c.status === "Resolvido" && c.data_resolucao);
    let tempoMedioRes = "—";
    if (comResolucao.length > 0) {
      const totalMin = comResolucao.reduce((acc, c) => {
        return acc + differenceInMinutes(parseISO(c.data_resolucao!), parseISO(c.data_abertura));
      }, 0) / comResolucao.length;
      tempoMedioRes = totalMin < 60 ? `${Math.round(totalMin)} min` : `${(totalMin / 60).toFixed(1)} h`;
    }

    const abertosAtivos = filtrados.filter((c) => c.status === "Aberto" || c.status === "Em Tratativa");
    let tempoMedioAberto = "—";
    if (abertosAtivos.length > 0) {
      const totalMin = abertosAtivos.reduce((acc, c) => {
        return acc + differenceInMinutes(new Date(), parseISO(c.data_abertura));
      }, 0) / abertosAtivos.length;
      tempoMedioAberto = totalMin < 60 ? `${Math.round(totalMin)} min` : `${(totalMin / 60).toFixed(1)} h`;
    }

    const placaCount: Record<string, number> = {};
    filtrados.forEach((c) => { placaCount[c.placa] = (placaCount[c.placa] || 0) + 1; });
    const topPlaca = Object.entries(placaCount).sort((a, b) => b[1] - a[1])[0];

    const transpCount: Record<string, number> = {};
    filtrados.forEach((c) => { transpCount[c.transportadora] = (transpCount[c.transportadora] || 0) + 1; });
    const topTransp = Object.entries(transpCount).sort((a, b) => b[1] - a[1])[0];

    const tecCount: Record<string, number> = {};
    filtrados.forEach((c) => { tecCount[c.tecnologia] = (tecCount[c.tecnologia] || 0) + 1; });
    const topTec = Object.entries(tecCount).sort((a, b) => b[1] - a[1])[0];

    const opCount: Record<string, number> = {};
    filtrados.forEach((c) => {
      if (c.finalizado_por_nome) opCount[c.finalizado_por_nome] = (opCount[c.finalizado_por_nome] || 0) + 1;
    });
    const topOp = Object.entries(opCount).sort((a, b) => b[1] - a[1])[0];

    const taxaResolucao = total > 0 ? ((resolvidos / total) * 100).toFixed(1) : "0";
    const taxaRecorrencia = total > 0 ? ((recorrentes / total) * 100).toFixed(1) : "0";

    return {
      total, abertos, emTratativa, resolvidos, continuaTravado, semCobertura, recorrentes,
      chamadosHoje, resolvidosHoje,
      tempoMedioRes, tempoMedioAberto,
      topPlaca: topPlaca ? `${topPlaca[0]} (${topPlaca[1]}x)` : "—",
      topTransp: topTransp ? `${topTransp[0]} (${topTransp[1]}x)` : "—",
      topTec: topTec ? `${topTec[0]} (${topTec[1]}x)` : "—",
      topOp: topOp ? `${topOp[0]} (${topOp[1]})` : "—",
      taxaResolucao, taxaRecorrencia,
    };
  }, [filtrados, chamados]);

  // Alert logic
  const alerts = useMemo(() => {
    const list: { message: string; level: "warn" | "critical" }[] = [];
    if (metrics.emTratativa >= ALERT_THRESHOLDS.emTratativa) {
      list.push({ message: `${metrics.emTratativa} chamados em tratativa (limite: ${ALERT_THRESHOLDS.emTratativa})`, level: "warn" });
    }
    if (metrics.continuaTravado >= ALERT_THRESHOLDS.continuaTravado) {
      list.push({ message: `${metrics.continuaTravado} chamados "Continua Travado" (limite: ${ALERT_THRESHOLDS.continuaTravado})`, level: "critical" });
    }
    if (metrics.abertos >= ALERT_THRESHOLDS.abertos) {
      list.push({ message: `${metrics.abertos} chamados abertos (limite: ${ALERT_THRESHOLDS.abertos})`, level: "critical" });
    }
    return list;
  }, [metrics]);

  // Chart data
  const placasChart = useMemo(() => {
    const count: Record<string, number> = {};
    filtrados.forEach((c) => { count[c.placa] = (count[c.placa] || 0) + 1; });
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([placa, total]) => ({ placa, total }));
  }, [filtrados]);

  const transpChart = useMemo(() => {
    const count: Record<string, number> = {};
    filtrados.forEach((c) => { count[c.transportadora] = (count[c.transportadora] || 0) + 1; });
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total]) => ({ name, total }));
  }, [filtrados]);

  const statusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    filtrados.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filtrados]);

  const evolucaoChart = useMemo(() => {
    const byDay: Record<string, number> = {};
    filtrados.forEach((c) => {
      const day = format(parseISO(c.data_abertura), "dd/MM");
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return Object.entries(byDay).map(([dia, total]) => ({ dia, total }));
  }, [filtrados]);

  const operadorChart = useMemo(() => {
    const count: Record<string, number> = {};
    filtrados.forEach((c) => {
      if (c.finalizado_por_nome) count[c.finalizado_por_nome] = (count[c.finalizado_por_nome] || 0) + 1;
    });
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total]) => ({ name, total }));
  }, [filtrados]);

  // Click handlers for chart bars
  const handlePlacaClick = (data: any) => {
    if (data?.placa) {
      navigate(`/chamados?placa=${encodeURIComponent(data.placa)}`);
    }
  };

  const handleTranspClick = (data: any) => {
    if (data?.name) {
      navigate(`/chamados?transportadora=${encodeURIComponent(data.name)}`);
    }
  };

  const kpiCards = [
    { title: "Chamados Hoje", value: metrics.chamadosHoje, icon: CalendarDays, accent: "text-primary", alert: false },
    { title: "Em Aberto", value: metrics.abertos, icon: AlertTriangle, accent: "text-status-open", alert: metrics.abertos >= ALERT_THRESHOLDS.abertos },
    { title: "Em Tratativa", value: metrics.emTratativa, icon: Clock, accent: "text-status-in-progress", alert: metrics.emTratativa >= ALERT_THRESHOLDS.emTratativa },
    { title: "Resolvidos Hoje", value: metrics.resolvidosHoje, icon: CheckCircle2, accent: "text-status-resolved", alert: false },
    { title: "Continua Travado", value: metrics.continuaTravado, icon: Lock, accent: "text-status-locked", alert: metrics.continuaTravado >= ALERT_THRESHOLDS.continuaTravado },
    { title: "Sem Cobertura", value: metrics.semCobertura, icon: ShieldOff, accent: "text-status-nocoverage", alert: false },
    { title: "Recorrentes", value: metrics.recorrentes, icon: RotateCcw, accent: "text-destructive", alert: false },
    { title: "Tempo Médio Resolução", value: metrics.tempoMedioRes, icon: Timer, accent: "text-muted-foreground", alert: false },
    { title: "Tempo Médio Aberto", value: metrics.tempoMedioAberto, icon: TrendingUp, accent: "text-muted-foreground", alert: false },
    { title: "Placa + Ocorrências", value: metrics.topPlaca, icon: Inbox, accent: "text-primary", alert: false },
    { title: "Top Transportadora", value: metrics.topTransp, icon: Truck, accent: "text-primary", alert: false },
    { title: "Tecnologia + Falhas", value: metrics.topTec, icon: Cpu, accent: "text-primary", alert: false },
    { title: "Top Operador", value: metrics.topOp, icon: User, accent: "text-primary", alert: false },
    { title: "Taxa Resolução", value: `${metrics.taxaResolucao}%`, icon: Percent, accent: "text-status-resolved", alert: false },
    { title: "Taxa Recorrência", value: `${metrics.taxaRecorrencia}%`, icon: Percent, accent: "text-destructive", alert: false },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral — {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="ontem">Ontem</SelectItem>
              <SelectItem value="7dias">Últimos 7 dias</SelectItem>
              <SelectItem value="30dias">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodo === "custom" && (
            <>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-[150px]" />
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[150px]" />
            </>
          )}
          <Button asChild>
            <Link to="/novo-chamado"><PlusCircle className="mr-2 h-4 w-4" />Novo Chamado</Link>
          </Button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium ${
                alert.level === "critical"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-status-in-progress/50 bg-status-in-progress/10 text-status-in-progress"
              }`}
            >
              <Bell className="h-4 w-4 shrink-0" />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((card) => (
          <Card
            key={card.title}
            className={card.alert ? "border-destructive/50 ring-1 ring-destructive/30 animate-pulse" : ""}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 p-4">
              <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">{card.title}</CardTitle>
              <div className="flex items-center gap-1">
                {card.alert && <Bell className="h-3 w-3 text-destructive" />}
                <card.icon className={`h-4 w-4 shrink-0 ${card.accent}`} />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-bold truncate">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 Placas com Mais Falhas</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {placasChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={placasChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="placa" width={85} fontSize={11} />
                  <RechartsTooltip content={<CustomBarTooltip labelKey="placa" />} />
                  <Bar
                    dataKey="total"
                    fill="hsl(0, 72%, 51%)"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(data) => handlePlacaClick(data)}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top Transportadoras com Mais Ocorrências</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {transpChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={transpChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                  <RechartsTooltip content={<CustomBarTooltip labelKey="name" />} />
                  <Bar
                    dataKey="total"
                    fill="hsl(215, 80%, 50%)"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(data) => handleTranspClick(data)}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição por Status</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {statusChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChart} cx="50%" cy="45%" outerRadius={70} dataKey="value" label={({ name, value }) => `${value}`} fontSize={11}>
                    {statusChart.map((entry) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#888"} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução de Chamados</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {evolucaoChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucaoChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" fontSize={11} />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="total" stroke="hsl(215, 80%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Desempenho por Operador</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {operadorChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={operadorChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                  <RechartsTooltip />
                  <Bar dataKey="total" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Chamados Recentes</CardTitle></CardHeader>
        <CardContent>
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum chamado neste período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Tecnologia</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead>Finalizado por</TableHead>
                    <TableHead>Recorrente</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.slice(0, 10).map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/chamados/${c.id}`)}>
                      <TableCell className="font-medium">{c.placa}</TableCell>
                      <TableCell>{c.transportadora}</TableCell>
                      <TableCell>{c.tecnologia}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell>
                        <div className="text-sm">{c.created_by_name || "—"}</div>
                        {c.created_by_role && <div className="text-xs text-muted-foreground">{c.created_by_role}</div>}
                      </TableCell>
                      <TableCell>
                        {c.finalizado_por_nome ? (
                          <>
                            <div className="text-sm">{c.finalizado_por_nome}</div>
                            {c.finalizado_por_cargo && <div className="text-xs text-muted-foreground">{c.finalizado_por_cargo}</div>}
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{c.recorrente ? `Sim (${c.contagem_recorrencia}x)` : "Não"}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{format(parseISO(c.data_abertura), "dd/MM/yy HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
