import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useChamados } from "@/hooks/useChamados";
import { toast } from "@/hooks/use-toast";
import { Upload, CheckCircle, AlertCircle, Loader2, Clock, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { normalizarTecnologia } from "@/lib/tecnologiaNormalizacao";

/* ─── Known technologies ─── */
const TECNOLOGIAS_CONHECIDAS = ["ONIXSAT", "MAXTRACK", "SIGHRA", "SASCAR", "AUTOTRAC", "POSITRON"];

function normalizarTecnologiaABM(raw: string): string {
  const norm = normalizarTecnologia(raw);
  if (!norm) return "VX CONSULT";
  const found = TECNOLOGIAS_CONHECIDAS.find(
    (t) => norm === t || norm.includes(t) || t.includes(norm),
  );
  return found || "VX CONSULT";
}

/* ─── Date parser — preserves exact value, NO timezone conversion ─── */
function parseABMDateTime(raw: string | number | null | undefined): { display: string; date: Date | null } {
  if (raw === null || raw === undefined || raw === "") return { display: "", date: null };

  const str = String(raw).trim();

  // Try DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (match) {
    const [, d, m, y, h, min, sec = "0"] = match;
    const day = Number(d), month = Number(m), year = Number(y);
    const hour = Number(h), minute = Number(min), second = Number(sec);

    // Build date without timezone shift — treat values as local BRT
    const date = new Date(year, month - 1, day, hour, minute, second);
    const display = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return { display, date };
  }

  // Excel serial number
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const parsed = XLSX.SSF.parse_date_code(Number(str));
    if (parsed) {
      const date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
      const display = `${String(parsed.d).padStart(2, "0")}/${String(parsed.m).padStart(2, "0")}/${parsed.y} ${String(parsed.H).padStart(2, "0")}:${String(parsed.M).padStart(2, "0")}`;
      return { display, date };
    }
  }

  return { display: str, date: null };
}

/* ─── Delay calculation ─── */
function calcularAtrasoMinutos(dataPlaca: Date): number {
  const agora = new Date();
  return (agora.getTime() - dataPlaca.getTime()) / 60000;
}

/* ─── Row interface ─── */
interface ABMRow {
  cliente: string;
  placa: string;
  frota: string;
  motorista: string;
  serial: string;
  tecnologia: string;
  dataHoraDisplay: string;
  dataHoraDate: Date | null;
  ignicao: string;
  referencia: string;
  velocidade: string;
  temperatura: string;
  ultimaMacro: string;
  sm: string;
  atrasoMinutos: number | null;
  status: "criar" | "ignorar_atraso" | "ignorar_duplicado" | "ignorar_placa_vazia" | "ignorar_data";
  motivo?: string;
}

export default function ImportarPlanilhaABM() {
  const { user, profile } = useAuth();
  const { chamados } = useChamados();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ABMRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ criados: number; ignorados: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "", header: 1 }) as any[][];

      // Find header row (row containing "Placa")
      let headerIdx = -1;
      for (let i = 0; i < Math.min(json.length, 10); i++) {
        const rowVals = json[i].map((v: any) => String(v ?? "").trim().toLowerCase());
        if (rowVals.includes("placa")) { headerIdx = i; break; }
      }
      if (headerIdx === -1) {
        toast({ title: "Planilha inválida — cabeçalho 'Placa' não encontrado", variant: "destructive" });
        return;
      }

      const headers = json[headerIdx].map((v: any) => String(v ?? "").trim());
      const colIdx = (name: string) => {
        const lower = name.toLowerCase();
        return headers.findIndex((h) => h.toLowerCase() === lower);
      };

      const iCliente = colIdx("Cliente");
      const iPlaca = colIdx("Placa");
      const iFrota = colIdx("Frota");
      const iMotorista = colIdx("Motorista");
      const iSerial = colIdx("Serial");
      const iTecnologia = colIdx("Tecnologia");
      const iDataHora = colIdx("Data/Hora");
      const iIgnicao = colIdx("Ignição");
      const iReferencia = colIdx("Referência");
      const iVelocidade = colIdx("Velocidade");
      const iTemperatura = colIdx("Temperatura");
      const iUltimaMacro = colIdx("Última Macro");
      const iSM = colIdx("SM");

      const placasAbertas = new Set(
        chamados
          .filter((c) => !["Resolvido", "Encerrado — Continua travado", "Encerrado — Sem cobertura"].includes(c.status))
          .map((c) => c.placa.toUpperCase().trim()),
      );

      const dataRows = json.slice(headerIdx + 1).filter((r) => r.some((v: any) => v !== null && v !== undefined && String(v).trim() !== ""));

      const parsed: ABMRow[] = dataRows.map((row) => {
        const get = (idx: number) => (idx >= 0 && idx < row.length ? String(row[idx] ?? "").trim() : "");
        const placa = get(iPlaca).toUpperCase();
        const tecnologia = normalizarTecnologiaABM(get(iTecnologia));
        const { display: dataHoraDisplay, date: dataHoraDate } = parseABMDateTime(row[iDataHora >= 0 ? iDataHora : -1]);

        let atrasoMinutos: number | null = null;
        let status: ABMRow["status"] = "criar";
        let motivo = "";

        if (!placa) {
          status = "ignorar_placa_vazia";
          motivo = "Placa vazia";
        } else if (placasAbertas.has(placa)) {
          status = "ignorar_duplicado";
          motivo = "Chamado já aberto";
        } else if (!dataHoraDate) {
          status = "ignorar_data";
          motivo = "Data/Hora inválida";
        } else {
          atrasoMinutos = calcularAtrasoMinutos(dataHoraDate);
          if (atrasoMinutos < 30) {
            status = "ignorar_atraso";
            motivo = `Atraso: ${Math.round(atrasoMinutos)} min (< 30 min)`;
          }
        }

        return {
          cliente: get(iCliente),
          placa,
          frota: get(iFrota),
          motorista: get(iMotorista),
          serial: get(iSerial),
          tecnologia,
          dataHoraDisplay,
          dataHoraDate,
          ignicao: get(iIgnicao),
          referencia: get(iReferencia),
          velocidade: get(iVelocidade),
          temperatura: get(iTemperatura),
          ultimaMacro: get(iUltimaMacro),
          sm: get(iSM),
          atrasoMinutos,
          status,
          motivo,
        };
      });

      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const criarRows = rows.filter((r) => r.status === "criar");
  const ignorarRows = rows.filter((r) => r.status !== "criar");

  const handleImport = async () => {
    if (criarRows.length === 0) {
      toast({ title: "Nenhum registro elegível para importar", variant: "destructive" });
      return;
    }
    setImporting(true);
    let criados = 0;
    let ignorados = 0;

    for (const row of criarRows) {
      // Build ISO without timezone conversion — use exact values from the spreadsheet
      const horaISO = row.dataHoraDate
        ? `${row.dataHoraDate.getFullYear()}-${String(row.dataHoraDate.getMonth() + 1).padStart(2, "0")}-${String(row.dataHoraDate.getDate()).padStart(2, "0")}T${String(row.dataHoraDate.getHours()).padStart(2, "0")}:${String(row.dataHoraDate.getMinutes()).padStart(2, "0")}:${String(row.dataHoraDate.getSeconds()).padStart(2, "0")}-03:00`
        : null;

      const descParts = [`Importado via ABM`];
      if (row.motorista) descParts.push(`Motorista: ${row.motorista}`);
      if (row.referencia && row.referencia !== "- /") descParts.push(`Ref: ${row.referencia}`);
      if (row.ignicao) descParts.push(`Ignição: ${row.ignicao}`);

      const { error } = await supabase.from("chamados").insert({
        placa: row.placa,
        transportadora: row.cliente || "A DEFINIR",
        tecnologia: row.tecnologia,
        descricao: descParts.join(" | "),
        tempo_travada: row.atrasoMinutos !== null ? `${Math.round(row.atrasoMinutos)} min` : "A verificar",
        status: "Em Tratativa",
        criado_por: user?.id,
        created_by_name: profile?.nome,
        created_by_email: profile?.email,
        created_by_role: profile?.cargo,
        observacao: row.referencia && row.referencia !== "- /" ? row.referencia : null,
        hora_travou: horaISO,
        data_posicao: horaISO,
      });
      if (error) { ignorados++; } else { criados++; }
    }

    const totalIgnorados = ignorados + ignorarRows.length;
    setResult({ criados, ignorados: totalIgnorados });
    setImporting(false);
    toast({ title: `Importação ABM concluída: ${criados} criados, ${totalIgnorados} ignorados` });
  };

  const formatAtraso = (min: number | null) => {
    if (min === null) return "—";
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${m}min`;
  };

  const statusIcon = (row: ABMRow) => {
    if (row.status === "criar") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (row.status === "ignorar_atraso") return <Clock className="h-4 w-4 text-blue-400" />;
    return <AlertCircle className="h-4 w-4 text-red-400" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Planilha ABM</h1>
        <p className="text-sm text-muted-foreground">
          Importe planilhas ABM M3Risk — chamados são abertos automaticamente para placas com atraso ≥ 30 min
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-6 flex flex-col items-center gap-4">
          <FileSpreadsheet className="h-12 w-12 text-primary/60" />
          <p className="text-sm text-muted-foreground text-center">
            Selecione o arquivo .xlsx exportado do ABM M3Risk
          </p>
          <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={handleFile} className="hidden" />
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />Importar Planilha ABM
          </Button>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Pré-visualização — {criarRows.length} chamados a criar / {ignorarRows.length} ignorados
            </CardTitle>
            <CardDescription>
              Registros com atraso &lt; 30 min, placas já abertas ou dados inválidos são ignorados automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Status</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Tecnologia</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={r.status !== "criar" ? "opacity-50" : ""}>
                      <TableCell>{statusIcon(r)}</TableCell>
                      <TableCell className="font-mono font-medium">{r.placa || "—"}</TableCell>
                      <TableCell>{r.tecnologia}</TableCell>
                      <TableCell>{r.dataHoraDisplay || "—"}</TableCell>
                      <TableCell>{formatAtraso(r.atrasoMinutos)}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{r.cliente || "—"}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{r.motorista || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.referencia || "—"}</TableCell>
                      <TableCell className="text-xs">{r.motivo || "OK"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setRows([]); setResult(null); }}>Limpar</Button>
              <Button onClick={handleImport} disabled={importing || criarRows.length === 0}>
                {importing
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                  : `Criar ${criarRows.length} Chamados`}
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
              <p className="font-semibold text-green-800">Importação ABM concluída</p>
              <p className="text-sm text-green-700">
                {result.criados} chamados criados • {result.ignorados} ignorados (atraso &lt; 30 min, duplicado ou erro)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
