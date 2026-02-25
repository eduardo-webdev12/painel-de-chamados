import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { useChamados, ChamadoDB } from "@/hooks/useChamados";
import { PlusCircle, AlertTriangle, Clock, CheckCircle2, Inbox, RotateCcw, TrendingUp } from "lucide-react";
import { format, isToday, isYesterday, subDays, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(45, 93%, 47%)", "hsl(215, 80%, 50%)", "hsl(142, 71%, 45%)"];

type Periodo = "hoje" | "ontem" | "7dias" | "30dias" | "custom";

export default function Dashboard() {
  const { chamados, loading } = useChamados();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
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
    const abertos = filtrados.filter((c) => c.status === "Aberto").length;
    const emTratativa = filtrados.filter((c) => c.status === "Em Tratativa").length;
    const resolvidos = filtrados.filter((c) => c.status === "Resolvido").length;
    const recorrentes = filtrados.filter((c) => c.recorrente).length;

    // Tempo médio
    const comResolucao = filtrados.filter((c) => c.status === "Resolvido" && c.data_resolucao);
    let tempoMedio = "—";
    if (comResolucao.length > 0) {
      const totalMin = comResolucao.reduce((acc, c) => {
        const diff = (parseISO(c.data_resolucao!).getTime() - parseISO(c.data_abertura).getTime()) / 60000;
        return acc + diff;
      }, 0) / comResolucao.length;
      tempoMedio = totalMin < 60 ? `${Math.round(totalMin)} min` : `${(totalMin / 60).toFixed(1)} h`;
    }

    // Placa mais recorrente
    const placaCount: Record<string, number> = {};
    filtrados.forEach((c) => { placaCount[c.placa] = (placaCount[c.placa] || 0) + 1; });
    const topPlaca = Object.entries(placaCount).sort((a, b) => b[1] - a[1])[0];

    return { total: filtrados.length, abertos, emTratativa, resolvidos, recorrentes, tempoMedio, topPlaca: topPlaca ? `${topPlaca[0]} (${topPlaca[1]}x)` : "—" };
  }, [filtrados]);

  // Chart data
  const placasChart = useMemo(() => {
    const count: Record<string, number> = {};
    filtrados.forEach((c) => { count[c.placa] = (count[c.placa] || 0) + 1; });
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([placa, total]) => ({ placa, total }));
  }, [filtrados]);

  const statusChart = useMemo(() => [
    { name: "Aberto", value: metrics.abertos },
    { name: "Em Tratativa", value: metrics.emTratativa },
    { name: "Resolvido", value: metrics.resolvidos },
  ], [metrics]);

  const evolucaoChart = useMemo(() => {
    const byDay: Record<string, number> = {};
    filtrados.forEach((c) => {
      const day = format(parseISO(c.data_abertura), "dd/MM");
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return Object.entries(byDay).map(([dia, total]) => ({ dia, total }));
  }, [filtrados]);

  const cards = [
    { title: "Total Travadas", value: metrics.total, icon: AlertTriangle, accent: "text-status-open" },
    { title: "Em Andamento", value: metrics.emTratativa, icon: Clock, accent: "text-status-in-progress" },
    { title: "Resolvidas", value: metrics.resolvidos, icon: CheckCircle2, accent: "text-status-resolved" },
    { title: "Recorrentes", value: metrics.recorrentes, icon: RotateCcw, accent: "text-destructive" },
    { title: "Tempo Médio", value: metrics.tempoMedio, icon: TrendingUp, accent: "text-muted-foreground" },
    { title: "Mais Ocorrências", value: metrics.topPlaca, icon: Inbox, accent: "text-primary" },
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.accent}`} />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold truncate">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader><CardTitle className="text-sm">Placas com Mais Problemas</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {placasChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={placasChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="placa" width={80} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(215, 80%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader><CardTitle className="text-sm">Evolução de Chamados</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {evolucaoChart.length === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucaoChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" fontSize={11} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="hsl(215, 80%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader><CardTitle className="text-sm">Status dos Chamados</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {metrics.total === 0 ? <p className="text-center text-sm text-muted-foreground pt-20">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChart} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} fontSize={11}>
                    {statusChart.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Transportadora</TableHead>
                  <TableHead>Tecnologia</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell><StatusBadge status={c.status as any} /></TableCell>
                    <TableCell>{c.recorrente ? `Sim (${c.contagem_recorrencia}x)` : "Não"}</TableCell>
                    <TableCell className="text-muted-foreground">{format(parseISO(c.data_abertura), "dd/MM/yy HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
