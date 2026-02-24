import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { getChamados } from "@/lib/storage";
import { PlusCircle, AlertTriangle, Clock, CheckCircle2, Inbox, RotateCcw } from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const chamados = getChamados();
  const navigate = useNavigate();

  const metrics = useMemo(() => {
    const hoje = chamados.filter((c) => {
      try { return isToday(parseISO(c.dataAbertura)); } catch { return false; }
    });
    const abertos = chamados.filter((c) => c.status === "Aberto");
    const resolvidosHoje = chamados.filter((c) => {
      if (c.status !== "Resolvido" || !c.dataResolucao) return false;
      try { return isToday(parseISO(c.dataResolucao)); } catch { return false; }
    });

    // Placas recorrentes: placas que aparecem mais de uma vez
    const placaCount: Record<string, number> = {};
    chamados.forEach((c) => {
      placaCount[c.placa] = (placaCount[c.placa] || 0) + 1;
    });
    const recorrentes = Object.values(placaCount).filter((v) => v > 1).length;

    // Tempo médio de resolução
    const resolvidos = chamados.filter((c) => c.status === "Resolvido" && c.dataResolucao);
    let tempoMedio = "—";
    if (resolvidos.length > 0) {
      const totalMinutos = resolvidos.reduce((acc, c) => {
        const abertura = parseISO(c.dataAbertura).getTime();
        const resolucao = parseISO(c.dataResolucao!).getTime();
        return acc + (resolucao - abertura) / 60000;
      }, 0);
      const media = totalMinutos / resolvidos.length;
      if (media < 60) tempoMedio = `${Math.round(media)} min`;
      else tempoMedio = `${(media / 60).toFixed(1)} h`;
    }

    return {
      travadasHoje: hoje.length,
      recorrentes,
      tempoMedio,
      abertos: abertos.length,
      resolvidosHoje: resolvidosHoje.length,
    };
  }, [chamados]);

  const recentes = chamados.slice(0, 8);

  const cards = [
    { title: "Travadas Hoje", value: metrics.travadasHoje, icon: AlertTriangle, accent: "text-status-open" },
    { title: "Recorrentes", value: metrics.recorrentes, icon: RotateCcw, accent: "text-destructive" },
    { title: "Tempo Médio", value: metrics.tempoMedio, icon: Clock, accent: "text-status-in-progress" },
    { title: "Em Aberto", value: metrics.abertos, icon: Inbox, accent: "text-status-open" },
    { title: "Resolvidos Hoje", value: metrics.resolvidosHoje, icon: CheckCircle2, accent: "text-status-resolved" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do turno — {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </p>
        </div>
        <Button asChild>
          <Link to="/novo-chamado">
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Chamado
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.accent}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Chamados Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentes.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum chamado registrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Transportadora</TableHead>
                  <TableHead>Tecnologia</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentes.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/chamados/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.placa}</TableCell>
                    <TableCell>{c.transportadora}</TableCell>
                    <TableCell>{c.tecnologia}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(parseISO(c.dataAbertura), "dd/MM/yy HH:mm")}
                    </TableCell>
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
