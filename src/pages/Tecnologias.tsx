import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useChamados } from "@/hooks/useChamados";
import { rankingTecnologias } from "@/lib/nocAnalytics";
import { Cpu, TrendingUp, Clock, Zap, RotateCcw, Timer, Percent } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { motion } from "framer-motion";

export default function Tecnologias() {
  const { chamados, loading } = useChamados();

  const ranking = useMemo(() => rankingTecnologias(chamados), [chamados]);

  const chartData = ranking.slice(0, 10).map(d => ({
    name: d.nome.length > 16 ? d.nome.slice(0, 14) + "…" : d.nome,
    falhas: d.totalFalhas,
    recorrencias: d.recorrencias,
  }));

  const radarData = ranking.slice(0, 7).map(d => ({
    name: d.nome.length > 12 ? d.nome.slice(0, 10) + "…" : d.nome,
    falhas: d.totalFalhas,
    tempoMedio: Math.round(d.tempoMedioResolucao / 60),
    recorrencias: d.recorrencias,
  }));

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ranking de Tecnologias</h1>
        <p className="text-sm text-muted-foreground">Análise comparativa de queda de sinal por tecnologia de rastreamento</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {ranking.slice(0, 4).map((d, i) => (
          <motion.div key={d.nome} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={i === 0 ? "border-destructive/30 bg-destructive/5" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-bold text-muted-foreground">#{i + 1}</span>
                  <Cpu className={`h-4 w-4 ${i === 0 ? "text-destructive" : "text-primary"}`} />
                </div>
                <p className="font-semibold text-sm truncate">{d.nome}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{d.totalFalhas}</span>
                  <span className="flex items-center gap-1"><Percent className="h-3 w-3" />{d.percentual.toFixed(1)}%</span>
                  <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{d.tempoMedioResolucao < 60 ? `${Math.round(d.tempoMedioResolucao)}m` : `${(d.tempoMedioResolucao / 60).toFixed(1)}h`}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Falhas por Tecnologia</CardTitle>
            <CardDescription className="text-xs">Total de placas travadas por tecnologia de rastreamento</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="falhas" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name="Falhas" />
                <Bar dataKey="recorrencias" fill="hsl(25, 95%, 53%)" radius={[0, 4, 4, 0]} name="Recorrências" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Radar de Instabilidade</CardTitle>
            <CardDescription className="text-xs">Comparativo multidimensional</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis tick={{ fontSize: 9 }} />
                <Radar name="Falhas" dataKey="falhas" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.15} />
                <Radar name="Tempo (h)" dataKey="tempoMedio" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detail List */}
      <div className="space-y-3">
        {ranking.map((d, i) => (
          <motion.div key={d.nome} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className={i === 0 ? "border-l-4 border-l-destructive" : ""}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-8">#{i + 1}</span>
                  <Cpu className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{d.nome}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>MTTR: {d.tempoMedioResolucao < 60 ? `${Math.round(d.tempoMedioResolucao)} min` : `${(d.tempoMedioResolucao / 60).toFixed(1)} h`}</span>
                      {d.mtbf !== null && <span>MTBF: {d.mtbf < 60 ? `${Math.round(d.mtbf)} min` : d.mtbf < 1440 ? `${(d.mtbf / 60).toFixed(1)} h` : `${(d.mtbf / 1440).toFixed(1)} dias`}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 font-medium"><Zap className="h-4 w-4 text-destructive" />{d.totalFalhas}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><Percent className="h-3 w-3" />{d.percentual.toFixed(1)}%</span>
                  {d.recorrencias > 0 && <span className="flex items-center gap-1 text-orange-500"><RotateCcw className="h-4 w-4" />{d.recorrencias}</span>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {ranking.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum dado disponível.</p>}
      </div>
    </div>
  );
}
