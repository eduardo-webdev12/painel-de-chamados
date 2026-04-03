import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChamados } from "@/hooks/useChamados";
import {
  calcularScoreConfiabilidade, calcularScorePlacas, calcularEvolucaoMensal,
  SCORE_CONFIG, type TecnologiaScore, type PlacaScore,
} from "@/lib/nocAnalytics";
import { Shield, AlertTriangle, TrendingUp, TrendingDown, Cpu, Car, Timer, RotateCcw, Zap, Award, FileText, FileSpreadsheet, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend, Area, AreaChart, ComposedChart } from "recharts";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [evolView, setEvolView] = useState<"linha" | "barras">("linha");
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);

  const techScores = useMemo(() => calcularScoreConfiabilidade(chamados), [chamados]);
  const placaScores = useMemo(() => calcularScorePlacas(chamados), [chamados]);

  const alertas = useMemo(() => techScores.filter(t => t.score < 60), [techScores]);
  const evolucao = useMemo(() => calcularEvolucaoMensal(chamados, 6), [chamados]);
  const techNames = useMemo(() => techScores.map(t => t.nome), [techScores]);

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

  const exportPDF = useCallback(async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const { getLogoBase64 } = await import("@/lib/logo-base64");
      const { drawCoverPage, drawHeader, drawSectionTitle, drawFooter, getTableStyles, getKpiTableStyles, checkPageBreak } = await import("@/lib/pdfTheme");

      const doc = new jsPDF({ orientation: "landscape" });
      const now = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

      let logo: string | null = null;
      try { logo = await getLogoBase64(); } catch {}

      drawCoverPage({
        doc, logo,
        title: "Score de Confiabilidade",
        subtitle: "Análise de estabilidade das tecnologias de rastreamento",
        periodo: "Acumulado",
        geradoEm: now,
      });

      let y = drawHeader({
        doc, logo,
        title: "Score de Confiabilidade",
        subtitle: "Análise de estabilidade das tecnologias de rastreamento",
        meta: [`Gerado em: ${now}`, `Score Médio: ${avgScore} pts`, `Tecnologias: ${techScores.length}`],
      });

      // Summary KPI
      y = drawSectionTitle(doc, "Resumo Geral", y);
      autoTable(doc, {
        startY: y,
        head: [["Score Médio", "Tecnologias", "Excelentes (≥85)", "Instáveis (<60)"]],
        body: [[
          `${avgScore} pts`,
          techScores.length,
          techScores.filter(t => t.score >= 85).length,
          techScores.filter(t => t.score < 60).length,
        ]],
        ...getKpiTableStyles(),
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Ranking table
      y = checkPageBreak(doc, y, 60);
      y = drawSectionTitle(doc, "Ranking Detalhado por Tecnologia", y);
      autoTable(doc, {
        startY: y,
        head: [["#", "Tecnologia", "Score", "Status", "Placas", "Falhas", "MTTR", "Recorrência %", "MTBF"]],
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

      drawFooter(doc, true);
      doc.save(`confiabilidade-tecnologias-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF exportado com sucesso");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  }, [techScores, avgScore]);

  const exportExcel = useCallback(async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = techScores.map((d, i) => ({
        "#": i + 1,
        Tecnologia: d.nome,
        Score: d.score,
        Status: SCORE_CONFIG[d.classificacao].label,
        Placas: d.totalPlacas,
        Falhas: d.totalFalhas,
        "MTTR": formatTempo(d.tempoMedioResolucao),
        "Recorrência %": `${(d.taxaRecorrencia * 100).toFixed(1)}%`,
        "MTBF": d.mtbf !== null ? formatTempo(d.mtbf) : "—",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 4 }, { wch: 18 }, { wch: 7 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Confiabilidade");
      XLSX.writeFile(wb, `confiabilidade-tecnologias-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Excel exportado com sucesso");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar Excel");
    }
  }, [techScores]);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Score de Confiabilidade
          </h1>
          <p className="text-sm text-muted-foreground">Índice analítico de estabilidade das tecnologias de rastreamento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
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

      {/* Evolução Mensal — Redesign Executivo */}
      {evolucao.length > 0 && (() => {
        const TECH_COLORS = [
          "hsl(142, 71%, 45%)", "hsl(217, 91%, 60%)", "hsl(25, 95%, 53%)",
          "hsl(0, 84%, 60%)", "hsl(262, 83%, 58%)", "hsl(180, 70%, 45%)",
        ];

        // Compute average per month
        const evolWithAvg = evolucao.map((row: any) => {
          const vals = techNames.map(n => row[n]).filter((v: any) => typeof v === "number" && v > 0);
          return { ...row, _media: vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0 };
        });

        // Determine which techs to show (user-selected or top 3)
        const visibleTechs = selectedTechs.length > 0
          ? selectedTechs
          : techNames.slice(0, 3);

        // Trend cards data
        const lastMonth = evolWithAvg[evolWithAvg.length - 1];
        const prevMonth = evolWithAvg.length > 1 ? evolWithAvg[evolWithAvg.length - 2] : null;
        const avgCurrent = lastMonth?._media ?? 0;
        const avgPrev = prevMonth?._media ?? 0;
        const trendDiff = avgCurrent - avgPrev;

        const bestTech = techScores[0];
        const worstTech = techScores[techScores.length - 1];

        // Bar chart data for current month
        const barData = techNames.map(name => ({
          name: name.length > 10 ? name.slice(0, 9) + "…" : name,
          score: lastMonth?.[name] ?? 0,
          fill: scoreColor(lastMonth?.[name] ?? 0),
        }));

        return (
          <div className="space-y-4">
            {/* Executive Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Score Médio Atual</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold">{avgCurrent}</span>
                    <span className="text-xs text-muted-foreground mb-1">/ 100</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {trendDiff > 0 ? <TrendingUp className="h-3.5 w-3.5 text-green-500" /> : trendDiff < 0 ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className={`text-xs font-medium ${trendDiff > 0 ? "text-green-600" : trendDiff < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {trendDiff > 0 ? "+" : ""}{trendDiff} pts vs mês anterior
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Tendência</p>
                  <div className="flex items-center gap-2">
                    {trendDiff > 0 ? (
                      <><TrendingUp className="h-6 w-6 text-green-500" /><span className="text-lg font-semibold text-green-600">Subindo</span></>
                    ) : trendDiff < 0 ? (
                      <><TrendingDown className="h-6 w-6 text-red-500" /><span className="text-lg font-semibold text-red-600">Caindo</span></>
                    ) : (
                      <><Minus className="h-6 w-6 text-muted-foreground" /><span className="text-lg font-semibold">Estável</span></>
                    )}
                  </div>
                  <Progress value={avgCurrent} className="mt-2 h-1.5" />
                </CardContent>
              </Card>
              <Card className="border-green-200/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-1">🏆 Melhor Tecnologia</p>
                  <p className="text-lg font-bold truncate">{bestTech?.nome ?? "—"}</p>
                  <p className="text-sm text-green-600 font-semibold">{bestTech?.score ?? 0} pts</p>
                </CardContent>
              </Card>
              <Card className="border-red-200/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-1">⚠️ Pior Tecnologia</p>
                  <p className="text-lg font-bold truncate">{worstTech?.nome ?? "—"}</p>
                  <p className="text-sm text-red-600 font-semibold">{worstTech?.score ?? 0} pts</p>
                </CardContent>
              </Card>
            </div>

            {/* Chart with controls */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Evolução Mensal do Score
                    </CardTitle>
                    <CardDescription className="text-xs">Últimos 6 meses — selecione tecnologias para comparar</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={evolView} onValueChange={(v) => setEvolView(v as any)}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linha">Linha</SelectItem>
                        <SelectItem value="barras">Barras Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Tech filter chips */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <button
                    onClick={() => setSelectedTechs([])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedTechs.length === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-accent"}`}
                  >
                    Top 3
                  </button>
                  {techNames.map((name, i) => {
                    const active = selectedTechs.includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          if (active) setSelectedTechs(prev => prev.filter(t => t !== name));
                          else if (selectedTechs.length < 3) setSelectedTechs(prev => [...prev, name]);
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${active ? "text-white border-transparent" : "bg-muted text-muted-foreground border-border hover:bg-accent"}`}
                        style={active ? { backgroundColor: TECH_COLORS[i % TECH_COLORS.length] } : {}}
                      >
                        {name}
                      </button>
                    );
                  })}
                  {selectedTechs.length >= 3 && (
                    <span className="text-xs text-muted-foreground self-center ml-1">máx. 3</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="h-[360px] pt-2">
                {evolView === "linha" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={evolWithAvg} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="mes" fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} tickMargin={8} />
                      <YAxis domain={[0, 100]} fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} tickMargin={6} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                        formatter={(v: number, name: string) => [`${v} pts`, name === "_media" ? "Média Geral" : name]}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      />
                      {/* Average area */}
                      <Area type="monotone" dataKey="_media" fill="url(#avgFill)" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Média Geral" />
                      {/* Selected tech lines */}
                      {visibleTechs.map((name, i) => {
                        const globalIdx = techNames.indexOf(name);
                        return (
                          <Line
                            key={name}
                            type="monotone"
                            dataKey={name}
                            stroke={TECH_COLORS[globalIdx % TECH_COLORS.length]}
                            strokeWidth={2.5}
                            dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }}
                            activeDot={{ r: 6, strokeWidth: 2 }}
                          />
                        );
                      })}
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} tickMargin={8} />
                      <YAxis domain={[0, 100]} fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        formatter={(v: number) => [`${v} pts`, "Score"]}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]} name="Score Mensal">
                        {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}

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
