import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      Cargo: c.created_by_role || "—",
      Recorrente: c.recorrente ? `Sim (${c.contagem_recorrencia}x)` : "Não",
      "Tempo Travada": c.tempo_travada,
      "Data Abertura": format(parseISO(c.data_abertura), "dd/MM/yyyy HH:mm"),
      "Data Resolução": c.data_resolucao ? format(parseISO(c.data_resolucao), "dd/MM/yyyy HH:mm") : "—",
      Descrição: c.descricao,
      Observação: c.observacao || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chamados");
    XLSX.writeFile(wb, `relatorio-chamados-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Excel exportado com sucesso" });
  };

  const exportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Relatório de Chamados — Plataforma SAC VX Integrações", 14, 15);
    doc.setFontSize(9);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} | ${filtrados.length} registros`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Placa", "Transportadora", "Tecnologia", "Status", "Recorrente", "Tempo", "Abertura", "Resolução"]],
      body: filtrados.map((c) => [
        c.placa,
        c.transportadora,
        c.tecnologia,
        c.status,
        c.recorrente ? `Sim (${c.contagem_recorrencia}x)` : "Não",
        c.tempo_travada,
        format(parseISO(c.data_abertura), "dd/MM/yy HH:mm"),
        c.data_resolucao ? format(parseISO(c.data_resolucao), "dd/MM/yy HH:mm") : "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 124] },
    });

    doc.save(`relatorio-chamados-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF exportado com sucesso" });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Exporte os dados dos chamados em Excel ou PDF</p>
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
              <h3 className="font-semibold">Exportar PDF</h3>
              <p className="text-sm text-muted-foreground">Relatório profissional em PDF</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
