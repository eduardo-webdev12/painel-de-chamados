import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChamados } from "@/hooks/useChamados";
import { FileSpreadsheet, FileText } from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { toast } from "@/hooks/use-toast";
import logoVX from "@/assets/logo-vx.png";

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

  const loadLogoAsBase64 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = logoVX;
    });
  };

  const exportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape" });

    // Add logo
    try {
      const logoData = await loadLogoAsBase64();
      doc.addImage(logoData, "PNG", 14, 8, 40, 15);
    } catch {
      console.warn("Logo não carregado");
    }

    doc.setFontSize(14);
    doc.text("PLATAFORMA SAC VX INTEGRAÇÕES", 60, 16);
    doc.setFontSize(10);
    doc.text("Relatório de Chamados", 60, 22);
    doc.setFontSize(8);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} | ${filtrados.length} registros`, 14, 30);

    autoTable(doc, {
      startY: 35,
      head: [["Placa", "Transp.", "Tecnologia", "Status", "Criado por", "Cargo", "Finalizado por", "Cargo (Fin.)", "Retorno Sinal", "Tempo", "Abertura"]],
      body: filtrados.map((c) => [
        c.placa,
        c.transportadora,
        c.tecnologia,
        c.status,
        c.created_by_name || "—",
        c.created_by_role || "—",
        c.finalizado_por_nome || "—",
        c.finalizado_por_cargo || "—",
        c.data_hora_retorno_sinal ? format(parseISO(c.data_hora_retorno_sinal), "dd/MM/yy HH:mm") : "—",
        c.tempo_travada,
        format(parseISO(c.data_abertura), "dd/MM/yy HH:mm"),
      ]),
      styles: { fontSize: 7 },
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
