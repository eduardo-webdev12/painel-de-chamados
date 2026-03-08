import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChamados } from "@/hooks/useChamados";
import { useAuth } from "@/hooks/useAuth";
import { FileSpreadsheet, FileText } from "lucide-react";
import { format, parseISO, isAfter, isBefore, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { normalizarStatusChamado } from "@/lib/chamadoWorkflow";

export default function Relatorios() {
  const { chamados, loading } = useChamados();
  const { profile } = useAuth();
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const filtrados = chamados.filter((c) => {
    const d = parseISO(c.data_abertura);
    if (dataInicio && isBefore(d, new Date(dataInicio))) return false;
    if (dataFim && isAfter(d, new Date(dataFim + "T23:59:59"))) return false;
    return true;
  });

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const data = filtrados.map((c) => ({
      Placa: c.placa,
      Transportadora: c.transportadora,
      Tecnologia: c.tecnologia,
      Status: c.status,
      "Criado por": c.created_by_name || "—",
      "Cargo (criador)": c.created_by_role || "—",
      "Finalizado por": c.finalizado_por_nome || "—",
      "Cargo (finalizador)": c.finalizado_por_cargo || "—",
      "Finalizado em": c.finalizado_em ? format(parseISO(c.finalizado_em), "dd/MM/yyyy HH:mm") : "—",
      "Retorno do Sinal": c.data_hora_retorno_sinal ? format(parseISO(c.data_hora_retorno_sinal), "dd/MM/yyyy HH:mm") : "—",
      Recorrente: c.recorrente ? `Sim (${c.contagem_recorrencia}x)` : "Não",
      "Hora que Travou": c.hora_travou ? format(parseISO(c.hora_travou), "dd/MM/yyyy HH:mm") : "—",
      "Tempo Travada": c.tempo_travada,
      "Data Abertura": format(parseISO(c.data_abertura), "dd/MM/yyyy HH:mm"),
      "Data Resolução": c.data_resolucao ? format(parseISO(c.data_resolucao), "dd/MM/yyyy HH:mm") : "—",
      Descrição: c.descricao,
      Observação: c.observacao || "",
      "Observação Técnica": c.observacao_tecnica || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chamados");
    XLSX.writeFile(wb, `relatorio-chamados-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Excel exportado com sucesso" });
  };

  const exportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const { getLogoBase64 } = await import("@/lib/logo-base64");
    const {
      drawCoverPage, drawHeader, drawSectionTitle, drawFooter,
      drawKpiCards, getTableStyles, checkPageBreak, BRAND,
    } = await import("@/lib/pdfTheme");
    const {
      calcularScoreConfiabilidade, rankingTecnologias, analisarPlacas,
      gerarAlertasTempo, SCORE_CONFIG, RISCO_CONFIG,
    } = await import("@/lib/nocAnalytics");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const now = new Date();
    const nowStr = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    let logo: string | null = null;
    try { logo = await getLogoBase64(); } catch {}

    const periodoStr = dataInicio || dataFim
      ? `${dataInicio || "—"} a ${dataFim || "—"}`
      : "Todos os períodos";

    // ── COVER PAGE ──
    drawCoverPage({
      doc, logo,
      title: "Relatório de Monitoramento de Placas",
      subtitle: "Análise operacional e estratégica da operação de rastreamento",
      periodo: periodoStr,
      geradoEm: nowStr,
      operador: profile?.nome || profile?.email || "Sistema",
    });

    // ── PAGE 2: EXECUTIVE SUMMARY ──
    let y = drawHeader({
      doc, logo,
      title: "Resumo Executivo",
      subtitle: "Plataforma SAC VX Integrações",
      meta: [`Gerado em: ${nowStr}`, `Período: ${periodoStr}`],
    });

    // Calculate analytics
    const total = filtrados.length;
    const placasUnicas = new Set(filtrados.map(c => c.placa.trim().toUpperCase())).size;
    const resolvidos = filtrados.filter(c => normalizarStatusChamado(c.status) === "Resolvido");
    const comTempo = filtrados.filter(c => c.data_resolucao && c.hora_travou);
    const tempos = comTempo.map(c => Math.max(0, differenceInMinutes(parseISO(c.data_resolucao!), parseISO(c.hora_travou!))));
    const mttr = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
    const totalRec = filtrados.reduce((s, c) => s + c.contagem_recorrencia, 0);
    const techRanking = rankingTecnologias(filtrados);
    const topTech = techRanking[0]?.nome || "—";
    const techScores = calcularScoreConfiabilidade(filtrados);
    const alertas = gerarAlertasTempo(filtrados);

    const fmtTempo = (m: number) => m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} dias`;

    // KPI Cards
    y = drawSectionTitle(doc, "Indicadores Principais", y);
    y = drawKpiCards(doc, [
      { label: "Total de Chamados", value: String(total) },
      { label: "Placas Monitoradas", value: String(placasUnicas) },
      { label: "Chamados Resolvidos", value: String(resolvidos.length) },
      { label: "MTTR (Tempo Médio)", value: fmtTempo(mttr) },
      { label: "Recorrências", value: String(totalRec), highlight: totalRec > 5 },
      { label: "Alertas Ativos", value: String(alertas.length), highlight: alertas.length > 0 },
      { label: "Tecnologia + Falhas", value: topTech },
      { label: "Taxa Resolução", value: total > 0 ? `${((resolvidos.length / total) * 100).toFixed(1)}%` : "—" },
    ], y);

    // ── TECH ANALYSIS SECTION ──
    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "Análise por Tecnologia de Rastreamento", y);
    autoTable(doc, {
      startY: y,
      head: [["Tecnologia", "Falhas", "% do Total", "MTTR", "Recorrências", "MTBF"]],
      body: techRanking.map(t => [
        t.nome,
        t.totalFalhas,
        `${t.percentual.toFixed(1)}%`,
        fmtTempo(t.tempoMedioResolucao),
        t.recorrencias,
        t.mtbf !== null ? fmtTempo(t.mtbf) : "—",
      ]),
      ...getTableStyles(),
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ── SCORE RANKING ──
    if (techScores.length > 0) {
      y = checkPageBreak(doc, y, 60);
      y = drawSectionTitle(doc, "Ranking de Confiabilidade das Tecnologias", y);
      autoTable(doc, {
        startY: y,
        head: [["#", "Tecnologia", "Score", "Status", "Placas", "Falhas", "MTTR", "Recorrência %"]],
        body: techScores.map((d, i) => [
          i + 1,
          d.nome,
          `${d.score} pts`,
          SCORE_CONFIG[d.classificacao].label,
          d.totalPlacas,
          d.totalFalhas,
          fmtTempo(d.tempoMedioResolucao),
          `${(d.taxaRecorrencia * 100).toFixed(1)}%`,
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
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ── PLACAS WITH MOST RECURRENCE ──
    const placasAnalise = analisarPlacas(filtrados);
    const placasProblematicas = placasAnalise.filter(p => p.totalOcorrencias >= 2 || p.recorrencias > 0).slice(0, 15);
    if (placasProblematicas.length > 0) {
      y = checkPageBreak(doc, y, 50);
      y = drawSectionTitle(doc, "Placas com Maior Recorrência", y, { color: BRAND.warning });
      autoTable(doc, {
        startY: y,
        head: [["Placa", "Risco", "Ocorrências", "Recorrências", "Tempo Travada", "Tecnologias"]],
        body: placasProblematicas.map(p => [
          p.placa,
          RISCO_CONFIG[p.nivel].label,
          p.totalOcorrencias,
          p.recorrencias,
          p.tempoTravadaAtual > 0 ? fmtTempo(p.tempoTravadaAtual) : "—",
          p.tecnologias.join(", "),
        ]),
        ...getTableStyles("danger"),
        columnStyles: {
          0: { halign: "center", fontStyle: "bold" },
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "center" },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ── CRITICAL ALERTS ──
    if (alertas.length > 0) {
      y = checkPageBreak(doc, y, 50);
      y = drawSectionTitle(doc, "Alertas Operacionais — Placas Travadas", y, { color: BRAND.danger });
      autoTable(doc, {
        startY: y,
        head: [["Placa", "Nível", "Minutos Travada", "Tecnologia", "Transportadora"]],
        body: alertas.slice(0, 20).map(a => [
          a.placa,
          a.level === "critico" ? "CRÍTICO" : a.level === "vermelho" ? "ALTO" : "ATENÇÃO",
          `${a.minutosTravada} min`,
          a.tecnologia,
          a.transportadora,
        ]),
        ...getTableStyles("danger"),
        columnStyles: {
          0: { halign: "center", fontStyle: "bold" },
          1: { halign: "center" },
          2: { halign: "center" },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ── FULL HISTORY ──
    doc.addPage();
    y = drawHeader({
      doc, logo,
      title: "Histórico Detalhado de Chamados",
      subtitle: `${filtrados.length} registros no período`,
      meta: [`Período: ${periodoStr}`],
    });

    y = drawSectionTitle(doc, "Listagem Completa", y);
    autoTable(doc, {
      startY: y,
      head: [[
        "Placa", "Transportadora", "Tecnologia", "Status",
        "Hora Travou", "Tempo Travado", "Abertura",
        "Criado por", "Finalizado por", "Observações",
      ]],
      body: filtrados.map((c) => [
        c.placa,
        c.transportadora,
        c.tecnologia,
        c.status,
        c.hora_travou ? format(parseISO(c.hora_travou), "dd/MM/yy HH:mm") : "—",
        c.tempo_travada,
        format(parseISO(c.data_abertura), "dd/MM/yy HH:mm"),
        c.created_by_name || "—",
        c.finalizado_por_nome || "—",
        c.observacao ? c.observacao.substring(0, 35) : "",
      ]),
      ...getTableStyles(),
      styles: { ...getTableStyles().styles, fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 20, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 28 },
        2: { cellWidth: 22 },
        3: { cellWidth: 26, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 22, halign: "center" },
        7: { cellWidth: 24 },
        8: { cellWidth: 24 },
        9: { cellWidth: "auto" },
      },
    });

    drawFooter(doc, true); // skip cover page numbering
    doc.save(`relatorio-monitoramento-${format(now, "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF exportado com sucesso" });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Exporte relatórios executivos e analíticos em Excel ou PDF</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Filtro por Período</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Data início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div className="flex items-end">
              <p className="text-sm text-muted-foreground">{filtrados.length} chamados no período</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={exportExcel}>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold">Exportar Excel</h3>
              <p className="text-sm text-muted-foreground">Planilha .xlsx com todos os dados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={exportPDF}>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Exportar PDF — Relatório Executivo</h3>
              <p className="text-sm text-muted-foreground">Relatório BI com capa, KPIs, rankings e análise completa</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
