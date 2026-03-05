import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChamados } from "@/hooks/useChamados";
import { differenceInMinutes, parseISO } from "date-fns";
import { Truck, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Transportadoras() {
  const { chamados, loading } = useChamados();

  const dados = useMemo(() => {
    const map = new Map<string, typeof chamados>();
    chamados.forEach(c => {
      if (!map.has(c.transportadora)) map.set(c.transportadora, []);
      map.get(c.transportadora)!.push(c);
    });
    return Array.from(map.entries()).map(([nome, ocs]) => {
      const resolvidos = ocs.filter(o => o.status === "Resolvido" || o.status.includes("Encerrado"));
      const tempos = resolvidos.filter(o => o.hora_travou && o.data_resolucao).map(o => differenceInMinutes(parseISO(o.data_resolucao!), parseISO(o.hora_travou!)));
      const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
      const ativos = ocs.filter(o => o.status === "Aberto" || o.status === "Em Tratativa").length;
      return { nome, total: ocs.length, tempoMedio, ativos, recorrentes: ocs.filter(o => o.recorrente).length };
    }).sort((a, b) => b.total - a.total);
  }, [chamados]);

  const chartData = dados.slice(0, 10).map(d => ({
    name: d.nome.length > 20 ? d.nome.slice(0, 18) + "…" : d.nome,
    ocorrencias: d.total,
  }));

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transportadoras</h1>
        <p className="text-sm text-muted-foreground">Ranking e indicadores por transportadora</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Top 10 — Mais Ocorrências</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="ocorrencias" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {dados.map((d, i) => (
          <Card key={d.nome}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-muted-foreground w-8">#{i + 1}</span>
                <Truck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">{d.nome}</p>
                  <p className="text-xs text-muted-foreground">Tempo médio: {d.tempoMedio < 60 ? `${Math.round(d.tempoMedio)} min` : `${(d.tempoMedio / 60).toFixed(1)} h`}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1"><TrendingUp className="h-4 w-4" />{d.total} total</span>
                {d.ativos > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" />{d.ativos} ativos</span>}
                {d.recorrentes > 0 && <span className="flex items-center gap-1 text-orange-500"><Clock className="h-4 w-4" />{d.recorrentes} recorr.</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
