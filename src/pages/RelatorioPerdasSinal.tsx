import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Upload, FileSpreadsheet, BarChart3, Activity, AlertTriangle,
  TrendingUp, Wifi, WifiOff, MapPin, Clock, Truck, Shield,
  Download, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { normalizarTecnologia } from "@/lib/tecnologiaNormalizacao";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─── Constants ─── */
const TECNOLOGIAS_CONVENCIONAIS = ["ONIXSAT", "MAXTRACK", "SIGHRA", "SASCAR", "AUTOTRAC", "POSITRON"];
const MOSAIC_KEYWORDS = ["mosaic", "uberaba"];
const CHART_COLORS_ABM = ["#3b82f6", "#6366f1", "#0ea5e9", "#8b5cf6", "#06b6d4", "#4f46e5"];
const CHART_COLORS_VX = ["#a855f7", "#d946ef", "#c084fc", "#e879f9", "#9333ea", "#7c3aed"];

/* ─── Types ─── */
interface VeiculoAnalise {
  cliente: string;
  placa: string;
  frota: string;
  motorista: string;
  serial: string;
  tecnologia: string;
  tecnologiaOriginal: string;
  dataHoraDisplay: string;
  dataHoraDate: Date | null;
  ignicao: string;
  referencia: string;
  velocidade: string;
  temperatura: string;
  ultimaMacro: string;
  sm: string;
  atrasoMinutos: number | null;
  grupo: "abm" | "vx";
  tipoLocal: string;
  classificacao: string;
  localizacao: string;
}

/* ─── Helpers ─── */
function parseABMDateTimeLocal(raw: string | number | null | undefined): { display: string; date: Date | null } {
  if (raw === null || raw === undefined || raw === "") return { display: "", date: null };
  const str = String(raw).trim();
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (match) {
    const [, d, m, y, h, min, sec = "0"] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(sec));
    const display = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y} ${h.padStart(2, "0")}:${min.padStart(2, "0")}`;
    return { display, date };
  }
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

function classificarTecnologia(raw: string): { tecnologia: string; grupo: "abm" | "vx" } {
  const norm = normalizarTecnologia(raw);
  if (!norm) return { tecnologia: "VX CONSULT", grupo: "vx" };
  const found = TECNOLOGIAS_CONVENCIONAIS.find(t => norm === t || norm.includes(t) || t.includes(norm));
  return found ? { tecnologia: found, grupo: "abm" } : { tecnologia: "VX CONSULT", grupo: "vx" };
}

function identificarTipoLocal(referencia: string): { tipo: string; icone: string } {
  const ref = referencia.toLowerCase();
  if (MOSAIC_KEYWORDS.some(k => ref.includes(k))) return { tipo: "Base Operacional (Mosaic)", icone: "🟢" };
  if (/rodovia|br-|mg-|sp-|rj-|ba-|go-|highway|estrada/i.test(ref)) return { tipo: "Rodovia", icone: "🛣️" };
  if (/posto|fuel|combusti|shell|ipiranga|petrobras/i.test(ref)) return { tipo: "Posto", icone: "⛽" };
  if (/industrial|fábrica|fabrica|usina|mineração|mineracao/i.test(ref)) return { tipo: "Área Industrial", icone: "🏭" };
  if (/residencia|resid|casa|bairro|rua\s/i.test(ref)) return { tipo: "Possível Residência", icone: "🏠" };
  if (ref && ref !== "- /" && ref.length > 5) return { tipo: "Localização Identificada", icone: "📍" };
  return { tipo: "Localização não identificada (dados limitados)", icone: "❓" };
}

function classificarRisco(atrasoMin: number | null, tipoLocal: string): string {
  if (atrasoMin === null) return "Indeterminado";
  if (tipoLocal.includes("Mosaic")) return "Seguro — Base Operacional";
  if (atrasoMin < 30) return "Normal";
  if (atrasoMin < 60) return "Atenção";
  if (atrasoMin < 120) return "Alto";
  return "Crítico";
}

function formatAtraso(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return `${h}h ${m}min`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function gerarInsights(abm: VeiculoAnalise[], vx: VeiculoAnalise[]): string[] {
  const insights: string[] = [];
  const abmCriticos = abm.filter(v => v.classificacao === "Crítico").length;
  const vxCriticos = vx.filter(v => v.classificacao === "Crítico").length;
  const abmAtrasados = abm.filter(v => (v.atrasoMinutos ?? 0) >= 30);
  const vxAtrasados = vx.filter(v => (v.atrasoMinutos ?? 0) >= 30);

  if (abm.length > 0) {
    const avgAbm = abm.filter(v => v.atrasoMinutos !== null).reduce((s, v) => s + v.atrasoMinutos!, 0) / (abm.filter(v => v.atrasoMinutos !== null).length || 1);
    insights.push(`Rastreadores ABM apresentam tempo médio sem comunicação de ${formatAtraso(avgAbm)}`);
  }
  if (vx.length > 0) {
    const avgVx = vx.filter(v => v.atrasoMinutos !== null).reduce((s, v) => s + v.atrasoMinutos!, 0) / (vx.filter(v => v.atrasoMinutos !== null).length || 1);
    insights.push(`VX CONSULT apresenta tempo médio sem comunicação de ${formatAtraso(avgVx)}`);
  }
  if (abmCriticos > 0) insights.push(`ABM teve ${abmCriticos} veículo(s) em estado crítico de comunicação`);
  if (vxCriticos > 0) insights.push(`VX CONSULT teve ${vxCriticos} veículo(s) em estado crítico`);
  if (abmCriticos === 0 && abm.length > 0) insights.push("Rastreadores ABM apresentaram padrão estável de comunicação");
  if (vxCriticos === 0 && vx.length > 0) insights.push("VX CONSULT apresentou padrão estável de comunicação");

  const mosaicCount = [...abm, ...vx].filter(v => v.tipoLocal.includes("Mosaic")).length;
  if (mosaicCount > 0) insights.push(`${mosaicCount} veículo(s) operou dentro da base Mosaic (comportamento esperado)`);

  const residencial = [...abm, ...vx].filter(v => v.tipoLocal.includes("Residência") && (v.atrasoMinutos ?? 0) > 60);
  if (residencial.length > 0) insights.push(`Parada prolongada identificada em área residencial para ${residencial.length} veículo(s)`);

  if (abmAtrasados.length > 0 && vxAtrasados.length === 0) insights.push("ABM teve falha recorrente enquanto VX CONSULT permaneceu estável");
  if (vxAtrasados.length > 0 && abmAtrasados.length === 0) insights.push("VX CONSULT apresentou falhas enquanto ABM permaneceu estável");

  return insights;
}

/* ─── Component ─── */
export default function RelatorioPerdasSinal() {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [veiculos, setVeiculos] = useState<VeiculoAnalise[]>([]);
  const [activeTab, setActiveTab] = useState("visao-geral");

  const abm = useMemo(() => veiculos.filter(v => v.grupo === "abm"), [veiculos]);
  const vx = useMemo(() => veiculos.filter(v => v.grupo === "vx"), [veiculos]);

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const calc = (list: VeiculoAnalise[]) => {
      const comAtraso = list.filter(v => v.atrasoMinutos !== null);
      const comFalha = comAtraso.filter(v => v.atrasoMinutos! >= 30);
      const avgAtraso = comAtraso.length > 0 ? comAtraso.reduce((s, v) => s + v.atrasoMinutos!, 0) / comAtraso.length : 0;
      const maxAtraso = comAtraso.reduce((m, v) => Math.max(m, v.atrasoMinutos ?? 0), 0);
      const criticos = list.filter(v => v.classificacao === "Crítico").length;
      const altos = list.filter(v => v.classificacao === "Alto").length;
      const normais = list.filter(v => v.classificacao === "Normal" || v.classificacao === "Seguro — Base Operacional").length;
      const tecMap = new Map<string, number>();
      list.forEach(v => tecMap.set(v.tecnologia, (tecMap.get(v.tecnologia) ?? 0) + 1));
      const score = list.length > 0 ? Math.round(100 - (comFalha.length / list.length) * 100) : 100;
      return { total: list.length, comFalha: comFalha.length, avgAtraso, maxAtraso, criticos, altos, normais, tecMap, score };
    };
    return { abm: calc(abm), vx: calc(vx), total: calc(veiculos) };
  }, [veiculos, abm, vx]);

  const insights = useMemo(() => gerarInsights(abm, vx), [abm, vx]);

  /* ─── Chart data ─── */
  const chartTecnologias = useMemo(() => {
    const map = new Map<string, { nome: string; abm: number; vx: number }>();
    veiculos.forEach(v => {
      const key = v.tecnologia;
      if (!map.has(key)) map.set(key, { nome: key, abm: 0, vx: 0 });
      map.get(key)![v.grupo]++;
    });
    return [...map.values()].sort((a, b) => (b.abm + b.vx) - (a.abm + a.vx));
  }, [veiculos]);

  const chartAtraso = useMemo(() => {
    const faixas = [
      { label: "< 30 min", min: 0, max: 30 },
      { label: "30–60 min", min: 30, max: 60 },
      { label: "1–2h", min: 60, max: 120 },
      { label: "2–4h", min: 120, max: 240 },
      { label: "4–8h", min: 240, max: 480 },
      { label: "> 8h", min: 480, max: Infinity },
    ];
    return faixas.map(f => ({
      faixa: f.label,
      ABM: abm.filter(v => v.atrasoMinutos !== null && v.atrasoMinutos >= f.min && v.atrasoMinutos < f.max).length,
      "VX CONSULT": vx.filter(v => v.atrasoMinutos !== null && v.atrasoMinutos >= f.min && v.atrasoMinutos < f.max).length,
    }));
  }, [abm, vx]);

  const chartClassificacao = useMemo(() => {
    const classes = ["Normal", "Atenção", "Alto", "Crítico", "Seguro — Base Operacional"];
    return classes.map(c => ({
      name: c,
      ABM: abm.filter(v => v.classificacao === c).length,
      "VX CONSULT": vx.filter(v => v.classificacao === c).length,
    })).filter(c => c.ABM > 0 || c["VX CONSULT"] > 0);
  }, [abm, vx]);

  const pieDataAbm = useMemo(() => {
    const map = new Map<string, number>();
    abm.forEach(v => map.set(v.tecnologia, (map.get(v.tecnologia) ?? 0) + 1));
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [abm]);

  const rankingPior = useMemo(() =>
    [...veiculos].filter(v => v.atrasoMinutos !== null).sort((a, b) => b.atrasoMinutos! - a.atrasoMinutos!).slice(0, 15),
    [veiculos]
  );

  /* ─── File handler ─── */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "", header: 1 }) as any[][];

      let headerIdx = -1;
      for (let i = 0; i < Math.min(json.length, 10); i++) {
        if (json[i].map((v: any) => String(v ?? "").trim().toLowerCase()).includes("placa")) { headerIdx = i; break; }
      }
      if (headerIdx === -1) {
        toast({ title: "Cabeçalho 'Placa' não encontrado", variant: "destructive" });
        return;
      }

      const headers = json[headerIdx].map((v: any) => String(v ?? "").trim());
      const col = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

      const iCliente = col("Cliente"), iPlaca = col("Placa"), iFrota = col("Frota");
      const iMotorista = col("Motorista"), iSerial = col("Serial"), iTec = col("Tecnologia");
      const iDH = col("Data/Hora"), iIgnicao = col("Ignição"), iRef = col("Referência");
      const iVel = col("Velocidade"), iTemp = col("Temperatura");
      const iMacro = col("Última Macro"), iSM = col("SM");

      const dataRows = json.slice(headerIdx + 1).filter(r => r.some((v: any) => String(v ?? "").trim()));

      const parsed: VeiculoAnalise[] = dataRows.map(row => {
        const get = (idx: number) => (idx >= 0 && idx < row.length ? String(row[idx] ?? "").trim() : "");
        const placa = get(iPlaca).toUpperCase();
        const rawTec = get(iTec);
        const { tecnologia, grupo } = classificarTecnologia(rawTec);
        const { display, date } = parseABMDateTimeLocal(row[iDH >= 0 ? iDH : -1]);
        const referencia = get(iRef);
        const { tipo: tipoLocal } = identificarTipoLocal(referencia);
        const atraso = date ? (new Date().getTime() - date.getTime()) / 60000 : null;
        const classificacao = classificarRisco(atraso, tipoLocal);
        const localizacao = referencia && referencia !== "- /" ? referencia : "Localização não identificada (dados limitados)";

        return {
          cliente: get(iCliente),
          placa,
          frota: get(iFrota),
          motorista: get(iMotorista),
          serial: get(iSerial),
          tecnologia,
          tecnologiaOriginal: rawTec,
          dataHoraDisplay: display,
          dataHoraDate: date,
          ignicao: get(iIgnicao),
          referencia,
          velocidade: get(iVel),
          temperatura: get(iTemp),
          ultimaMacro: get(iMacro),
          sm: get(iSM),
          atrasoMinutos: atraso,
          grupo,
          tipoLocal,
          classificacao,
          localizacao,
        };
      }).filter(v => v.placa);

      setVeiculos(parsed);
      toast({ title: `${parsed.length} veículos analisados — ${parsed.filter(v => v.grupo === "abm").length} ABM, ${parsed.filter(v => v.grupo === "vx").length} VX CONSULT` });
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ─── PDF Export ─── */
  const exportPDF = async (grupo: "abm" | "vx" | "todos") => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const { getLogoBase64 } = await import("@/lib/logo-base64");
    const { drawCoverPage, drawHeader, drawSectionTitle, drawFooter, drawKpiCards, getTableStyles, checkPageBreak, BRAND } = await import("@/lib/pdfTheme");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const now = new Date();
    const nowStr = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    let logo: string | null = null;
    try { logo = await getLogoBase64(); } catch {}

    const list = grupo === "abm" ? abm : grupo === "vx" ? vx : veiculos;
    const grupoLabel = grupo === "abm" ? "Rastreador ABM (Convencional)" : grupo === "vx" ? "VX CONSULT" : "Completo (ABM + VX)";

    drawCoverPage({ doc, logo, title: "Relatório de Perda de Sinal", subtitle: grupoLabel, periodo: `Análise em tempo real`, geradoEm: nowStr, operador: profile?.nome || "Sistema" });

    let y = drawHeader({ doc, logo, title: `Perda de Sinal — ${grupoLabel}`, subtitle: "Plataforma SAC VX Integrações", meta: [`Gerado: ${nowStr}`, `${list.length} veículos`] });

    const comFalha = list.filter(v => (v.atrasoMinutos ?? 0) >= 30);
    const avgAtraso = list.filter(v => v.atrasoMinutos !== null).reduce((s, v) => s + v.atrasoMinutos!, 0) / (list.filter(v => v.atrasoMinutos !== null).length || 1);
    const score = list.length > 0 ? Math.round(100 - (comFalha.length / list.length) * 100) : 100;

    y = drawSectionTitle(doc, "Indicadores Principais", y);
    y = drawKpiCards(doc, [
      { label: "Total Analisados", value: String(list.length) },
      { label: "Com Falha de Sinal", value: String(comFalha.length), highlight: comFalha.length > 0 },
      { label: "% com Falha", value: `${list.length > 0 ? ((comFalha.length / list.length) * 100).toFixed(1) : 0}%`, highlight: comFalha.length > 3 },
      { label: "Tempo Médio s/ Comunicação", value: formatAtraso(avgAtraso) },
      { label: "Score Operação", value: `${score} pts` },
      { label: "Críticos", value: String(list.filter(v => v.classificacao === "Crítico").length), highlight: true },
    ], y);

    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "Detalhamento por Veículo", y);
    autoTable(doc, {
      startY: y,
      head: [["Placa", "Tecnologia", "Data/Hora", "Atraso", "Localização", "Tipo Local", "Classificação"]],
      body: list.sort((a, b) => (b.atrasoMinutos ?? 0) - (a.atrasoMinutos ?? 0)).map(v => [
        v.placa, v.tecnologia, v.dataHoraDisplay, formatAtraso(v.atrasoMinutos),
        v.localizacao.substring(0, 40), v.tipoLocal, v.classificacao,
      ]),
      ...getTableStyles(),
      styles: { ...getTableStyles().styles, fontSize: 6.5 },
      columnStyles: { 0: { fontStyle: "bold", halign: "center" }, 3: { halign: "center" }, 6: { halign: "center" } },
    });

    drawFooter(doc, true);
    doc.save(`relatorio-perda-sinal-${grupo}-${format(now, "yyyy-MM-dd")}.pdf`);
    toast({ title: `PDF ${grupoLabel} exportado com sucesso` });
  };

  /* ─── KPI Card ─── */
  const KpiCard = ({ label, value, icon: Icon, highlight, subtitle }: { label: string; value: string; icon: any; highlight?: boolean; subtitle?: string }) => (
    <Card className={highlight ? "border-destructive/40 bg-destructive/5" : ""}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${highlight ? "bg-destructive/10" : "bg-primary/10"}`}>
            <Icon className={`h-5 w-5 ${highlight ? "text-destructive" : "text-primary"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className={`text-lg font-bold ${highlight ? "text-destructive" : ""}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  /* ─── Group Panel ─── */
  const GrupoPanel = ({ grupo, dados, colors, label, icon }: { grupo: string; dados: VeiculoAnalise[]; colors: string[]; label: string; icon: string }) => {
    const comFalha = dados.filter(v => (v.atrasoMinutos ?? 0) >= 30);
    const avgAtraso = dados.filter(v => v.atrasoMinutos !== null).reduce((s, v) => s + v.atrasoMinutos!, 0) / (dados.filter(v => v.atrasoMinutos !== null).length || 1);
    const criticos = dados.filter(v => v.classificacao === "Crítico");
    const score = dados.length > 0 ? Math.round(100 - (comFalha.length / dados.length) * 100) : 100;

    const tecPie = useMemo(() => {
      const map = new Map<string, number>();
      dados.forEach(v => map.set(v.tecnologia, (map.get(v.tecnologia) ?? 0) + 1));
      return [...map.entries()].map(([name, value]) => ({ name, value }));
    }, [dados]);

    const localPie = useMemo(() => {
      const map = new Map<string, number>();
      dados.forEach(v => map.set(v.tipoLocal, (map.get(v.tipoLocal) ?? 0) + 1));
      return [...map.entries()].map(([name, value]) => ({ name, value }));
    }, [dados]);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{icon}</span>
          <h3 className="text-lg font-bold">{label}</h3>
          <Badge variant="outline" className="ml-2">{dados.length} veículos</Badge>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Analisados" value={String(dados.length)} icon={Truck} />
          <KpiCard label="Com Falha de Sinal" value={String(comFalha.length)} icon={WifiOff} highlight={comFalha.length > 0} />
          <KpiCard label="Tempo Médio s/ Sinal" value={formatAtraso(avgAtraso)} icon={Clock} />
          <KpiCard label="Score Operação" value={`${score} pts`} icon={Shield} subtitle={score >= 80 ? "Estável" : score >= 60 ? "Atenção" : "Crítico"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {tecPie.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Tecnologia</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={tecPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {tecPie.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {localPie.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tipos de Localização</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={localPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {localPie.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Detailed table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tabela Detalhada — {label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Tecnologia</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Tipo Local</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...dados].sort((a, b) => (b.atrasoMinutos ?? 0) - (a.atrasoMinutos ?? 0)).map((v, i) => (
                    <TableRow key={i} className={v.classificacao === "Crítico" ? "bg-destructive/5" : v.classificacao === "Alto" ? "bg-orange-500/5" : ""}>
                      <TableCell className="font-mono font-medium">{v.placa}</TableCell>
                      <TableCell>{v.tecnologia}</TableCell>
                      <TableCell className="text-xs">{v.dataHoraDisplay}</TableCell>
                      <TableCell className={`font-medium ${v.classificacao === "Crítico" ? "text-destructive" : ""}`}>{formatAtraso(v.atrasoMinutos)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">{v.localizacao}</TableCell>
                      <TableCell className="text-xs">{v.tipoLocal}</TableCell>
                      <TableCell>
                        <Badge variant={v.classificacao === "Crítico" ? "destructive" : v.classificacao === "Alto" ? "default" : "outline"} className="text-xs">
                          {v.classificacao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{v.ignicao || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  /* ─── Render ─── */
  if (veiculos.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📊 Relatório de Perda de Sinal</h1>
          <p className="text-sm text-muted-foreground">Análise avançada com separação automática de tecnologias — Padrão GR</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <FileSpreadsheet className="h-12 w-12 text-primary/60" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Importe a planilha ABM para gerar o relatório de perda de sinal</p>
              <p className="text-xs text-muted-foreground mt-1">Os dados serão separados automaticamente: 🔵 Rastreador ABM × 🟣 VX CONSULT</p>
            </div>
            <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={handleFile} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} size="lg">
              <Upload className="h-4 w-4 mr-2" />Importar Planilha ABM
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📊 Relatório de Perda de Sinal</h1>
          <p className="text-sm text-muted-foreground">
            {veiculos.length} veículos analisados — {abm.length} ABM, {vx.length} VX CONSULT
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setVeiculos([]); }}>Nova Análise</Button>
          <Button variant="outline" size="sm" onClick={() => exportPDF("abm")}><Download className="h-3 w-3 mr-1" />PDF ABM</Button>
          <Button variant="outline" size="sm" onClick={() => exportPDF("vx")}><Download className="h-3 w-3 mr-1" />PDF VX</Button>
          <Button size="sm" onClick={() => exportPDF("todos")}><Download className="h-3 w-3 mr-1" />PDF Completo</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="visao-geral">Visão Executiva</TabsTrigger>
          <TabsTrigger value="abm">🔵 ABM ({abm.length})</TabsTrigger>
          <TabsTrigger value="vx">🟣 VX CONSULT ({vx.length})</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* ─── VISÃO EXECUTIVA ─── */}
        <TabsContent value="visao-geral" className="space-y-6 mt-4">
          {/* Top KPIs */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total de Veículos" value={String(stats.total.total)} icon={Truck} />
            <KpiCard label="% com Falha de Sinal" value={`${stats.total.total > 0 ? ((stats.total.comFalha / stats.total.total) * 100).toFixed(1) : 0}%`} icon={WifiOff} highlight={stats.total.comFalha > 0} />
            <KpiCard label="Tempo Médio s/ Comunicação" value={formatAtraso(stats.total.avgAtraso)} icon={Clock} />
            <KpiCard label="Score Geral da Operação" value={`${stats.total.score} pts`} icon={Shield} subtitle={stats.total.score >= 80 ? "Estável" : stats.total.score >= 60 ? "Atenção" : "Crítico"} />
          </div>

          {/* Comparativo ABM vs VX */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparativo: ABM vs VX CONSULT</CardTitle>
              <CardDescription>Qualidade de sinal, tempo sem atualização e taxa de falhas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground mb-1">Score Qualidade</p>
                  <div className="flex items-center justify-center gap-6">
                    <div>
                      <p className="text-xs text-blue-500 mb-0.5">🔵 ABM</p>
                      <p className="text-2xl font-bold">{stats.abm.score}</p>
                    </div>
                    <span className="text-muted-foreground">vs</span>
                    <div>
                      <p className="text-xs text-purple-500 mb-0.5">🟣 VX</p>
                      <p className="text-2xl font-bold">{stats.vx.score}</p>
                    </div>
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground mb-1">Tempo Médio s/ Sinal</p>
                  <div className="flex items-center justify-center gap-6">
                    <div>
                      <p className="text-xs text-blue-500 mb-0.5">🔵 ABM</p>
                      <p className="text-xl font-bold">{formatAtraso(stats.abm.avgAtraso)}</p>
                    </div>
                    <span className="text-muted-foreground">vs</span>
                    <div>
                      <p className="text-xs text-purple-500 mb-0.5">🟣 VX</p>
                      <p className="text-xl font-bold">{formatAtraso(stats.vx.avgAtraso)}</p>
                    </div>
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground mb-1">Taxa de Falhas</p>
                  <div className="flex items-center justify-center gap-6">
                    <div>
                      <p className="text-xs text-blue-500 mb-0.5">🔵 ABM</p>
                      <p className="text-xl font-bold">{stats.abm.total > 0 ? ((stats.abm.comFalha / stats.abm.total) * 100).toFixed(1) : 0}%</p>
                    </div>
                    <span className="text-muted-foreground">vs</span>
                    <div>
                      <p className="text-xs text-purple-500 mb-0.5">🟣 VX</p>
                      <p className="text-xl font-bold">{stats.vx.total > 0 ? ((stats.vx.comFalha / stats.vx.total) * 100).toFixed(1) : 0}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tempo sem Comunicação — Distribuição</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartAtraso}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ABM" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="VX CONSULT" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Classificação de Risco</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartClassificacao} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ABM" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="VX CONSULT" fill="#a855f7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Ranking pior sinal */}
          {rankingPior.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Ranking — Veículos com Pior Sinal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Tecnologia</TableHead>
                        <TableHead>Atraso</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead>Risco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankingPior.map((v, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-mono font-medium">{v.placa}</TableCell>
                          <TableCell>{v.grupo === "abm" ? "🔵 ABM" : "🟣 VX"}</TableCell>
                          <TableCell>{v.tecnologia}</TableCell>
                          <TableCell className="font-medium">{formatAtraso(v.atrasoMinutos)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs">{v.tipoLocal}</TableCell>
                          <TableCell>
                            <Badge variant={v.classificacao === "Crítico" ? "destructive" : "outline"} className="text-xs">
                              {v.classificacao}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── PAINEL ABM ─── */}
        <TabsContent value="abm" className="mt-4">
          {abm.length > 0 ? (
            <GrupoPanel grupo="abm" dados={abm} colors={CHART_COLORS_ABM} label="Rastreador ABM (Convencional)" icon="🔵" />
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum veículo com tecnologia ABM convencional encontrado</CardContent></Card>
          )}
        </TabsContent>

        {/* ─── PAINEL VX ─── */}
        <TabsContent value="vx" className="mt-4">
          {vx.length > 0 ? (
            <GrupoPanel grupo="vx" dados={vx} colors={CHART_COLORS_VX} label="VX CONSULT" icon="🟣" />
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum veículo VX CONSULT encontrado</CardContent></Card>
          )}
        </TabsContent>

        {/* ─── INSIGHTS ─── */}
        <TabsContent value="insights" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Insights Automáticos — Inteligência Operacional
              </CardTitle>
              <CardDescription>Análise criteriosa ponto a ponto gerada automaticamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.length > 0 ? insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <p className="text-sm">{ins}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Importe dados para gerar insights</p>
              )}
            </CardContent>
          </Card>

          {/* Paradas prolongadas */}
          {veiculos.filter(v => (v.atrasoMinutos ?? 0) >= 120).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Paradas Prolongadas Identificadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {veiculos.filter(v => (v.atrasoMinutos ?? 0) >= 120).sort((a, b) => b.atrasoMinutos! - a.atrasoMinutos!).map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-destructive/5 border border-destructive/20 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{v.placa}</span>
                        <Badge variant="outline" className="text-xs">{v.grupo === "abm" ? "ABM" : "VX"}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{v.tipoLocal}</span>
                        <span className="font-medium text-destructive">{formatAtraso(v.atrasoMinutos)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Padrões repetitivos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Análise de Padrões</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: "🏠", label: "Possível Residência", count: veiculos.filter(v => v.tipoLocal.includes("Residência")).length },
                  { icon: "⛽", label: "Posto", count: veiculos.filter(v => v.tipoLocal.includes("Posto")).length },
                  { icon: "🛣️", label: "Rodovia", count: veiculos.filter(v => v.tipoLocal.includes("Rodovia")).length },
                  { icon: "🏭", label: "Área Industrial", count: veiculos.filter(v => v.tipoLocal.includes("Industrial")).length },
                  { icon: "🟢", label: "Mosaic (Base Segura)", count: veiculos.filter(v => v.tipoLocal.includes("Mosaic")).length },
                  { icon: "❓", label: "Não Identificado", count: veiculos.filter(v => v.tipoLocal.includes("não identificada")).length },
                ].filter(p => p.count > 0).map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <span className="text-sm">{p.icon} {p.label}</span>
                    <Badge variant="outline">{p.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
