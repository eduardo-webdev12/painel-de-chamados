import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useChamados } from "@/hooks/useChamados";
import { toast } from "@/hooks/use-toast";
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { normalizarTecnologia } from "@/lib/tecnologiaNormalizacao";

interface RowData {
  placa: string;
  transportadora: string;
  tecnologia: string;
  dataHoraFalha: string;
  dataHoraISO: string | null;
  dataHoraWarning?: string;
  observacao: string;
  valid: boolean;
  error?: string;
}

function parseDataHoraFlexivel(raw: string): { display: string; iso: string | null; warning?: string } {
  if (!raw || raw === "undefined" || raw === "null") {
    return { display: "", iso: null };
  }

  // Handle Excel serial date numbers
  if (/^\d{5}(\.\d+)?$/.test(raw.trim())) {
    const serial = parseFloat(raw.trim());
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const fractionalDay = serial - Math.floor(serial);
    const totalSeconds = Math.round(fractionalDay * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const date = new Date(utcValue * 1000);
    date.setUTCHours(hours, minutes, 0, 0);
    if (!isNaN(date.getTime())) {
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = date.getUTCFullYear();
      const hh = String(hours).padStart(2, "0");
      const min = String(minutes).padStart(2, "0");
      return { display: `${dd}/${mm}/${yyyy} ${hh}:${min}`, iso: date.toISOString() };
    }
  }

  // Normalize separators
  let normalized = raw.trim().replace(/-/g, "/");

  // Try YYYY/MM/DD HH:mm pattern (ISO-like)
  const isoMatch = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s*(\d{1,2})?:?(\d{1,2})?/);
  if (isoMatch) {
    const [, yyyy, mm, dd, hh = "0", min = "0"] = isoMatch;
    const date = new Date(+yyyy, +mm - 1, +dd, +hh, +min);
    if (!isNaN(date.getTime())) {
      const dStr = String(date.getDate()).padStart(2, "0");
      const mStr = String(date.getMonth() + 1).padStart(2, "0");
      return {
        display: `${dStr}/${mStr}/${yyyy} ${String(+hh).padStart(2, "0")}:${String(+min).padStart(2, "0")}`,
        iso: date.toISOString(),
      };
    }
  }

  // Try DD/MM/YYYY or MM/DD/YYYY patterns
  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2})?:?(\d{1,2})?/);
  if (slashMatch) {
    const [, p1, p2, yyyy, hh = "0", min = "0"] = slashMatch;
    const n1 = +p1, n2 = +p2;

    // If p1 > 12, it must be DD/MM/YYYY
    // If p2 > 12, it must be MM/DD/YYYY
    // Otherwise assume DD/MM/YYYY (Brazilian standard)
    let dd: number, mm: number;
    if (n1 > 12) {
      dd = n1; mm = n2;
    } else if (n2 > 12) {
      mm = n1; dd = n2;
    } else {
      // Ambiguous — assume Brazilian DD/MM/YYYY
      dd = n1; mm = n2;
    }

    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const date = new Date(+yyyy, mm - 1, dd, +hh, +min);
      if (!isNaN(date.getTime()) && date.getDate() === dd) {
        const dStr = String(dd).padStart(2, "0");
        const mStr = String(mm).padStart(2, "0");
        const warning = (n1 <= 12 && n2 <= 12) ? "Data ambígua — interpretada como DD/MM/AAAA" : undefined;
        return {
          display: `${dStr}/${mStr}/${yyyy} ${String(+hh).padStart(2, "0")}:${String(+min).padStart(2, "0")}`,
          iso: date.toISOString(),
          warning,
        };
      }
    }
  }

  // Last resort: try native Date parse
  const fallback = new Date(raw.trim());
  if (!isNaN(fallback.getTime())) {
    const dd = String(fallback.getDate()).padStart(2, "0");
    const mm = String(fallback.getMonth() + 1).padStart(2, "0");
    const yyyy = fallback.getFullYear();
    const hh = String(fallback.getHours()).padStart(2, "0");
    const min = String(fallback.getMinutes()).padStart(2, "0");
    return {
      display: `${dd}/${mm}/${yyyy} ${hh}:${min}`,
      iso: fallback.toISOString(),
      warning: "Data interpretada automaticamente — verifique",
    };
  }

  return { display: raw, iso: null, warning: "Data não reconhecida — será ignorada" };
}

export default function ImportarPlanilha() {
  const { user, profile } = useAuth();
  const { chamados } = useChamados();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ criados: number; ignorados: number } | null>(null);

  const handleDownloadModelo = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Placa", "Transportadora", "Tecnologia", "Data/Hora Falha", "Observação"],
      ["ABC1D23", "TRANSPORTADORA X", "OMNILINK", "2026-04-03 14:00", "Placa travada na BR-101"],
    ]);
    ws["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_importacao_chamados.xlsx");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      const placasAbertas = new Set(
        chamados.filter(c => !["Resolvido", "Encerrado — Continua travado", "Encerrado — Sem cobertura"].includes(c.status))
          .map(c => c.placa.toUpperCase().trim())
      );

      const parsed: RowData[] = json.map((row: any) => {
        const placa = String(row["Placa"] || row["placa"] || "").toUpperCase().trim();
        const transportadora = String(row["Transportadora"] || row["transportadora"] || "").trim();
        const tecnologia = normalizarTecnologia(String(row["Tecnologia"] || row["tecnologia"] || ""));
        const rawData = String(row["Data/Hora Falha"] || row["data_hora_falha"] || row["DataHoraFalha"] || "").trim();
        const observacao = String(row["Observação"] || row["observacao"] || row["Observacao"] || "").trim();

        const dataParsed = parseDataHoraFlexivel(rawData);
        const dataHoraFalha = dataParsed.display;
        const dataHoraISO = dataParsed.iso;
        const dataHoraWarning = dataParsed.warning;

        let valid = true;
        let error = "";
        if (!placa) { valid = false; error = "Placa vazia"; }
        else if (!transportadora) { valid = false; error = "Transportadora vazia"; }
        else if (!tecnologia) { valid = false; error = "Tecnologia vazia"; }
        else if (placasAbertas.has(placa)) { valid = false; error = "Chamado já aberto"; }

        return { placa, transportadora, tecnologia, dataHoraFalha, dataHoraISO, dataHoraWarning, observacao, valid, error };
      });

      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    const validos = rows.filter(r => r.valid);
    if (validos.length === 0) {
      toast({ title: "Nenhuma linha válida para importar", variant: "destructive" });
      return;
    }
    setImporting(true);
    let criados = 0;
    let ignorados = 0;

    for (const row of validos) {
      const { error } = await supabase.from("chamados").insert({
        placa: row.placa,
        transportadora: row.transportadora,
        tecnologia: row.tecnologia,
        descricao: `Importado via planilha${row.observacao ? `: ${row.observacao}` : ""}`,
        tempo_travada: "A verificar",
        status: "Em Tratativa",
        criado_por: user?.id,
        created_by_name: profile?.nome,
        created_by_email: profile?.email,
        created_by_role: profile?.cargo,
        observacao: row.observacao || null,
        hora_travou: row.dataHoraFalha ? new Date(row.dataHoraFalha).toISOString() : null,
      });
      if (error) { ignorados++; } else { criados++; }
    }

    const totalIgnorados = ignorados + rows.filter(r => !r.valid).length;
    setResult({ criados, ignorados: totalIgnorados });
    setImporting(false);
    toast({ title: `Importação concluída: ${criados} criados, ${totalIgnorados} ignorados` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Planilha</h1>
        <p className="text-sm text-muted-foreground">Crie chamados em lote a partir de arquivo Excel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <FileSpreadsheet className="h-12 w-12 text-primary/60" />
            <p className="text-sm text-muted-foreground text-center">Baixe o modelo antes de importar</p>
            <Button variant="outline" onClick={handleDownloadModelo}><Download className="h-4 w-4 mr-2" />Baixar Modelo de Planilha</Button>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Upload className="h-12 w-12 text-primary/60" />
            <p className="text-sm text-muted-foreground text-center">Selecione o arquivo .xlsx preenchido</p>
            <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={handleFile} className="hidden" />
            <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Importar Planilha</Button>
          </CardContent>
        </Card>
      </div>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização ({rows.filter(r => r.valid).length} válidos / {rows.filter(r => !r.valid).length} inválidos)</CardTitle>
            <CardDescription>Revise os dados antes de importar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Transportadora</TableHead>
                  <TableHead>Tecnologia</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={!r.valid ? "opacity-60" : ""}>
                    <TableCell>
                      {r.valid
                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="h-4 w-4" />{r.error}</span>}
                    </TableCell>
                    <TableCell className="font-mono font-medium">{r.placa}</TableCell>
                    <TableCell>{r.transportadora}</TableCell>
                    <TableCell>{r.tecnologia}</TableCell>
                    <TableCell>{r.dataHoraFalha}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.observacao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setRows([]); setResult(null); }}>Limpar</Button>
              <Button onClick={handleImport} disabled={importing || rows.filter(r => r.valid).length === 0}>
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</> : `Criar ${rows.filter(r => r.valid).length} Chamados`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6 flex items-center gap-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Importação concluída</p>
              <p className="text-sm text-green-700">{result.criados} chamados criados • {result.ignorados} ignorados (erro ou duplicado)</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
