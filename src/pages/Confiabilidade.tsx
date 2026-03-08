import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChamados } from "@/hooks/useChamados";
import {
  calcularScoreConfiabilidade, calcularScorePlacas, calcularEvolucaoMensal,
  SCORE_CONFIG, type TecnologiaScore, type PlacaScore,
} from "@/lib/nocAnalytics";
import { Shield, AlertTriangle, TrendingUp, Cpu, Car, Timer, RotateCcw, Zap, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

function ScoreBadge({ score, classificacao }: { score: number; classificacao: TecnologiaScore["classificacao"] }) {
  const cfg = SCORE_CONFIG[classificacao];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {score}
    </span>
  );
}

function scoreColor(score: number) {
  if (score >= 85) return "hsl(142, 71%, 45%)";
  if (score >= 70) return "hsl(217, 91%, 60%)";
  if (score >= 50) return "hsl(25, 95%, 53%)";
  return "hsl(0, 84%, 60%)";
}

function formatTempo(mins: number) {
  if (mins < 60) return `${Math.round(mins)} min`;
  if (mins < 1440) return `${(mins / 60).toFixed(1)} h`;
  return `${(mins / 1440).toFixed(1)} dias`;
}

export default function Confiabilidade() {
  const { chamados, loading } = useChamados();
  const [tab, setTab] = useState("tecnologias");

  const techScores = useMemo(() => calcularScoreConfiabilidade(chamados), [chamados]);
  const placaScores = useMemo(() => calcularScorePlacas(chamados), [chamados]);

  const alertas = useMemo(() => techScores.filter(t => t.score < 60), [techScores]);

  const chartData = useMemo(() =>
    techScores.map(d => ({
      name: d.nome.length > 14 ? d.nome.slice(0, 12) + "…" : d.nome,
      score: d.score,
      fill: scoreColor(d.score),
    }))
  , [techScores]);

  const avgScore = techScores.length > 0
    ? Math.round(techScores.reduce((s, t) => s + t.score, 0) / techScores.length)
    : 0;

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Score de Confiabilidade
        </h1>
        <p className="text-sm text-muted-foreground">Índice analítico de estabilidade das tecnologias de rastreamento</p>
      </div>

      {/* Alert banner */}
      {alertas.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                {alertas.map(a => (
                  <p key={a.nome} className="text-sm">
                    A tecnologia <strong>{a.nome}</strong> apresentou queda no índice de confiabilidade ({a.score} pts) — {SCORE_CONFIG[a.classificacao].label}.
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* KPI summary */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs font-medium"><Award className="h-3.5 w-3.5" /> Score Médio</div>
              <p className="text-2xl font-bold">{avgScore}</p>
              <Progress value={avgScore} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs font-medium"><Cpu className="h-3.5 w-3.5" /> Tecnologias</div>
              <p className="text-2xl font-bold">{techScores.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{techScores.filter(t => t.score >= 85).length} excelentes</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs font-medium"><TrendingUp className="h-3.5 w-3.5" /> Melhor Score</div>
              <p className="text-2xl font-bold">{techScores[0]?.score ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{techScores[0]?.nome ?? "—"}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className={alertas.length > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Instáveis</div>
              <p className="text-2xl font-bold">{alertas.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Score &lt; 60</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Score Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Ranking de Confiabilidade</CardTitle>
          <CardDescription className="text-xs">Score de 0-100 baseado em taxa de travamento, MTTR, recorrência e MTBF</CardDescription>
        </CardHeader>
        <CardContent className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(value: number) => [`${value} pts`, "Score"]}
              />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} name="Score">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabs: Tecnologias / Placas */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tecnologias" className="gap-1.5"><Cpu className="h-3.5 w-3.5" /> Tecnologias</TabsTrigger>
          <TabsTrigger value="placas" className="gap-1.5"><Car className="h-3.5 w-3.5" /> Placas</TabsTrigger>
        </TabsList>

        <TabsContent value="tecnologias" className="space-y-3 mt-4">
          {techScores.map((d, i) => (
            <motion.div key={d.nome} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className={d.score < 50 ? "border-l-4 border-l-destructive" : d.score < 70 ? "border-l-4 border-l-orange-400" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-8">#{i + 1}</span>
                      <Cpu className="h-5 w-5 text-primary" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{d.nome}</p>
                          <ScoreBadge score={d.score} classificacao={d.classificacao} />
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span className="flex items-center gap-1"><Car className="h-3 w-3" />{d.totalPlacas} placas</span>
                          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{d.totalFalhas} falhas</span>
                          <span className="flex items-center gap-1"><Timer className="h-3 w-3" />MTTR: {formatTempo(d.tempoMedioResolucao)}</span>
                          <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" />Rec: {(d.taxaRecorrencia * 100).toFixed(0)}%</span>
                          {d.mtbf !== null && <span>MTBF: {formatTempo(d.mtbf)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Progress value={d.score} className="w-24 h-2" />
                      <p className="text-xs text-muted-foreground mt-1">{SCORE_CONFIG[d.classificacao].label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {techScores.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum dado disponível.</p>}
        </TabsContent>

        <TabsContent value="placas" className="space-y-3 mt-4">
          {placaScores.slice(0, 30).map((d, i) => (
            <motion.div key={d.placa} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
              <Card className={d.score < 50 ? "border-l-4 border-l-destructive" : ""}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-8">#{i + 1}</span>
                    <Car className="h-4 w-4 text-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-medium text-sm">{d.placa}</p>
                        <ScoreBadge score={d.score} classificacao={d.classificacao} />
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{d.totalOcorrencias} ocorrências</span>
                        <span>{d.recorrencias} recorrências</span>
                        <span>Travada: {formatTempo(d.tempoTotalTravada)}</span>
                        <span>{d.tecnologias.join(", ")}</span>
                      </div>
                    </div>
                  </div>
                  <Progress value={d.score} className="w-20 h-2" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {placaScores.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum dado disponível.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
