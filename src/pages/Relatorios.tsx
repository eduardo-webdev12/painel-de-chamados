import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChamados } from "@/hooks/useChamados";
import { FileSpreadsheet, FileText } from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { toast } from "@/hooks/use-toast";


export default function Relatorios() {
  const { chamados, loading } = useChamados();
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
      "Data da Posição": (c as any).data_posicao ? format(parseISO((c as any).data_posicao), "dd/MM/yyyy HH:mm") : "—",
      Descrição: c.descricao,
      Observação: c.observacao || "",
      "Observação Técnica": (c as any).observacao_tecnica || "",
      "Link Acompanhamento": (c as any).link_acompanhamento || "",
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
    const { drawHeader, drawSectionTitle, drawFooter, getTableStyles } = await import("@/lib/pdfTheme");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const now = new Date();

    let logo: string | null = null;
    try { logo = await getLogoBase64(); } catch {}

    const periodoStr = dataInicio || dataFim
      ? `${dataInicio || "—"} a ${dataFim || "—"}`
      : "Todos os períodos";

    let y = drawHeader({
      doc, logo,
      title: "Relatório de Posição",
      subtitle: "Plataforma SAC VX Integrações — Relatório Corporativo",
      meta: [
        `Gerado em: ${format(now, "dd/MM/yyyy 'às' HH:mm")}`,
        `Período: ${periodoStr}`,
        `Registros: ${filtrados.length}`,
      ],
    });

    y = drawSectionTitle(doc, "Listagem de Chamados", y);

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
        c.observacao ? c.observacao.substring(0, 40) : "",
      ]),
      ...getTableStyles(),
      styles: {
        ...getTableStyles().styles,
        fontSize: 6.5,
      },
      columnStyles: {
        0: { cellWidth: 20, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 30 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 22, halign: "center" },
        7: { cellWidth: 25 },
        8: { cellWidth: 25 },
        9: { cellWidth: "auto" },
      },
    });

    drawFooter(doc);
    doc.save(`relatorio-posicao-${format(now, "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF exportado com sucesso" });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Exporte os dados dos chamados em Excel ou PDF (Relatório de Posição)</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <FileSpreadsheet className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Exportar Excel</h3>
              <p className="text-sm text-muted-foreground">Planilha .xlsx com todos os dados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={exportPDF}>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold">Exportar PDF — Relatório de Posição</h3>
              <p className="text-sm text-muted-foreground">Relatório corporativo com logo e padrão oficial</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
