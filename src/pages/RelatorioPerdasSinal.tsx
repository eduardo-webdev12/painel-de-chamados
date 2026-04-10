import { useState, useRef, useMemo, useCallback } from "react";
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
  Download, Bell, MessageSquare,
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
interface PontoVeiculo {
  placa: string;
  dataHoraDate: Date | null;
  dataHoraDisplay: string;
  // ABM fields
  cliente: string;
  tecnologia: string;
  tecnologiaOriginal: string;
  referencia: string;
  ignicao: string;
  frota: string;
  motorista: string;
  serial: string;
  velocidade: string;
  temperatura: string;
  ultimaMacro: string;
  sm: string;
  // VX fields
  latitude: string;
  longitude: string;
  deltaTempo: string;
  deltaDistancia: string;
  statusVx: string;
  // Computed
  grupo: "abm" | "vx";
  tipoLocal: string;
  tipoLocalIcone: string;
  localizacao: string;
  fonte: "abm" | "vx";
}

interface GapEvento {
  placa: string;
  grupo: "abm" | "vx";
  tecnologia: string;
  inicio: string;
  inicioDate: Date;
  retorno: string;
  retornoDate: Date;
  gapMinutos: number;
  classificacao: "normal" | "atencao" | "critico";
  tipoLocal: string;
  localizacao: string;
  isMosaic: boolean;
}

interface SessaoPlaca {
  placa: string;
  ultimoDataHora: Date;
}

/* ─── Helpers ─── */
function parseDateTimeLocal(raw: string | number | null | undefined): { display: string; date: Date | null } {
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
  // try ISO-like
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (isoMatch) {
    const [, y, m, d, h, min, sec = "0"] = isoMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(sec));
    const display = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y} ${h.padStart(2, "0")}:${min.padStart(2, "0")}`;
    return { display, date };
  }
  return { display: str, date: null };
}

function classificarTecnologia(raw: string): { tecnologia: string; grupo: "abm" | "vx" } {
  const norm = normalizarTecnologia(raw);
  if (!norm) return { tecnologia: "VX CONSULT", grupo: "vx" };
  const found = TECNOLOGIAS_CONVENCIONAIS.find(t => norm === t || norm.includes(t) || t.includes(norm));
  return found ? { tecnologia: found, grupo: "abm" } : { tecnologia: "VX CONSULT", grupo: "vx" };
}

function identificarTipoLocal(referencia: string): { tipo: string; icone: string; isMosaic: boolean } {
  const ref = referencia.toLowerCase();
  if (MOSAIC_KEYWORDS.some(k => ref.includes(k))) return { tipo: "Base Operacional (Mosaic)", icone: "🟢", isMosaic: true };
  if (/rodovia|br-|mg-|sp-|rj-|ba-|go-|highway|estrada/i.test(ref)) return { tipo: "Rodovia", icone: "🛣️", isMosaic: false };
  if (/posto|fuel|combusti|shell|ipiranga|petrobras/i.test(ref)) return { tipo: "Posto", icone: "⛽", isMosaic: false };
  if (/industrial|fábrica|fabrica|usina|mineração|mineracao/i.test(ref)) return { tipo: "Área Industrial", icone: "🏭", isMosaic: false };
  if (/residencia|resid|casa|bairro|rua\s/i.test(ref)) return { tipo: "Possível Residência", icone: "🏠", isMosaic: false };
  if (ref && ref !== "- /" && ref.length > 5) return { tipo: "Localização Identificada", icone: "📍", isMosaic: false };
  return { tipo: "Localização não identificada", icone: "❓", isMosaic: false };
}

function classificarGap(min: number): "normal" | "atencao" | "critico" {
  if (min <= 5) return "normal";
  if (min <= 30) return "atencao";
  return "critico";
}

function formatGap(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return `${h}h ${m}min`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function gapBadgeVariant(c: "normal" | "atencao" | "critico"): "default" | "destructive" | "outline" | "secondary" {
  if (c === "critico") return "destructive";
  if (c === "atencao") return "secondary";
  return "outline";
}

function gapLabel(c: "normal" | "atencao" | "critico"): string {
  if (c === "critico") return "🔴 Crítico";
  if (c === "atencao") return "🟡 Atenção";
  return "🟢 Normal";
}

/* ─── GAP calculation per event ─── */
function calcularGaps(pontos: PontoVeiculo[]): GapEvento[] {
  // Group by plate, sort by time, compute gaps between consecutive points
  const byPlaca = new Map<string, PontoVeiculo[]>();
  pontos.forEach(p => {
    if (!p.dataHoraDate) return;
    const list = byPlaca.get(p.placa) || [];
    list.push(p);
    byPlaca.set(p.placa, list);
  });

  const gaps: GapEvento[] = [];
  byPlaca.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.dataHoraDate!.getTime() - b.dataHoraDate!.getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const diffMin = (next.dataHoraDate!.getTime() - current.dataHoraDate!.getTime()) / 60000;
      if (diffMin <= 0) continue;
      const classificacao = classificarGap(diffMin);
      const { tipo, isMosaic } = identificarTipoLocal(current.referencia || current.localizacao);
      gaps.push({
        placa: current.placa,
        grupo: current.grupo,
        tecnologia: current.tecnologia,
        inicio: current.dataHoraDisplay,
        inicioDate: current.dataHoraDate!,
        retorno: next.dataHoraDisplay,
        retornoDate: next.dataHoraDate!,
        gapMinutos: diffMin,
        classificacao: isMosaic && classificacao === "critico" ? "atencao" : classificacao,
        tipoLocal: tipo,
        localizacao: current.localizacao,
        isMosaic,
      });
    }
  });

  return gaps.sort((a, b) => b.gapMinutos - a.gapMinutos);
}

/* ─── Alerts ─── */
interface Alerta {
  placa: string;
  tipo: "atencao" | "critico";
  mensagem: string;
  gapMinutos: number;
  tecnologia: string;
}

function gerarAlertas(gaps: GapEvento[]): Alerta[] {
  const alertas: Alerta[] = [];
  const seen = new Set<string>();
  gaps.forEach(g => {
    if (g.isMosaic) return;
    if (g.classificacao === "critico" && !seen.has(`critico-${g.placa}`)) {
      seen.add(`critico-${g.placa}`);
      alertas.push({
        placa: g.placa,
        tipo: "critico",
        mensagem: `Placa ${g.placa} está há ${formatGap(g.gapMinutos)} sem sinal, estaremos entrando em contato com o motorista, tecnologia para tratar a perda de sinal em 1h.`,
        gapMinutos: g.gapMinutos,
        tecnologia: g.tecnologia,
      });
    } else if (g.classificacao === "atencao" && g.gapMinutos >= 15 && !seen.has(`atencao-${g.placa}`)) {
      seen.add(`atencao-${g.placa}`);
      alertas.push({
        placa: g.placa,
        tipo: "atencao",
        mensagem: `Placa ${g.placa} com intervalo de ${formatGap(g.gapMinutos)} sem comunicação — monitorar.`,
        gapMinutos: g.gapMinutos,
        tecnologia: g.tecnologia,
      });
    }
  });
  return alertas.sort((a, b) => b.gapMinutos - a.gapMinutos);
}

/* ─── Insights ─── */
function gerarInsights(gapsAbm: GapEvento[], gapsVx: GapEvento[], pontosAbm: PontoVeiculo[], pontosVx: PontoVeiculo[]): string[] {
  const insights: string[] = [];
  const abmCriticos = gapsAbm.filter(g => g.classificacao === "critico" && !g.isMosaic);
  const vxCriticos = gapsVx.filter(g => g.classificacao === "critico" && !g.isMosaic);

  if (pontosAbm.length > 0) {
    const avgGap = gapsAbm.length > 0 ? gapsAbm.reduce((s, g) => s + g.gapMinutos, 0) / gapsAbm.length : 0;
    insights.push(`Rastreadores ABM apresentam GAP médio entre pontos de ${formatGap(avgGap)}`);
  }
  if (pontosVx.length > 0) {
    const avgGap = gapsVx.length > 0 ? gapsVx.reduce((s, g) => s + g.gapMinutos, 0) / gapsVx.length : 0;
    insights.push(`VX CONSULT apresenta GAP médio entre pontos de ${formatGap(avgGap)}`);
  }
  if (abmCriticos.length > 0) insights.push(`ABM teve ${abmCriticos.length} GAP(s) crítico(s) fora de área segura`);
  if (vxCriticos.length > 0) insights.push(`VX CONSULT teve ${vxCriticos.length} GAP(s) crítico(s)`);
  if (abmCriticos.length === 0 && pontosAbm.length > 0) insights.push("Rastreadores ABM apresentaram padrão estável de comunicação");
  if (vxCriticos.length === 0 && pontosVx.length > 0) insights.push("VX CONSULT apresentou padrão estável de comunicação");

  const allGaps = [...gapsAbm, ...gapsVx];
  const mosaicGaps = allGaps.filter(g => g.isMosaic);
  if (mosaicGaps.length > 0) insights.push(`${mosaicGaps.length} intervalo(s) registrado(s) na base Mosaic — operação normal esperada`);

  const residGaps = allGaps.filter(g => g.tipoLocal.includes("Residência") && g.classificacao === "critico");
  if (residGaps.length > 0) insights.push(`Parada prolongada em área residencial detectada para ${new Set(residGaps.map(g => g.placa)).size} placa(s)`);

  const suspeitosGaps = allGaps.filter(g => g.classificacao === "critico" && !g.isMosaic && g.tipoLocal.includes("não identificada"));
  if (suspeitosGaps.length > 0) insights.push(`GAP crítico em ${suspeitosGaps.length} área(s) suspeita(s) sem referência conhecida`);

  if (abmCriticos.length > 0 && vxCriticos.length === 0 && pontosVx.length > 0) insights.push("ABM teve falha recorrente enquanto VX CONSULT permaneceu estável");
  if (vxCriticos.length > 0 && abmCriticos.length === 0 && pontosAbm.length > 0) insights.push("VX CONSULT apresentou falhas enquanto ABM permaneceu estável");

  return insights;
}

/* ─── Component ─── */
export default function RelatorioPerdasSinal() {
  const { profile } = useAuth();
  const fileRefAbm = useRef<HTMLInputElement>(null);
  const fileRefVx = useRef<HTMLInputElement>(null);
  const [pontos, setPontos] = useState<PontoVeiculo[]>([]);
  const [sessoes, setSessoes] = useState<SessaoPlaca[]>([]);
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [importStats, setImportStats] = useState<{ total: number; novos: number; ignorados: number } | null>(null);

  const pontosAbm = useMemo(() => pontos.filter(p => p.grupo === "abm"), [pontos]);
  const pontosVx = useMemo(() => pontos.filter(p => p.grupo === "vx"), [pontos]);

  const allGaps = useMemo(() => calcularGaps(pontos), [pontos]);
  const gapsAbm = useMemo(() => allGaps.filter(g => g.grupo === "abm"), [allGaps]);
  const gapsVx = useMemo(() => allGaps.filter(g => g.grupo === "vx"), [allGaps]);

  const alertas = useMemo(() => gerarAlertas(allGaps), [allGaps]);
  const insights = useMemo(() => gerarInsights(gapsAbm, gapsVx, pontosAbm, pontosVx), [gapsAbm, gapsVx, pontosAbm, pontosVx]);

  /* ─── Session continuity logic ─── */
  const filterDuplicates = useCallback((newPontos: PontoVeiculo[]): PontoVeiculo[] => {
    const currentSessoes = new Map(sessoes.map(s => [s.placa, s.ultimoDataHora]));
    const accepted: PontoVeiculo[] = [];
    const updatedSessoes = new Map(currentSessoes);

    newPontos.forEach(p => {
      if (!p.dataHoraDate) { accepted.push(p); return; }
      const lastDate = updatedSessoes.get(p.placa);
      if (lastDate && p.dataHoraDate.getTime() <= lastDate.getTime()) return; // skip duplicate
      accepted.push(p);
      const current = updatedSessoes.get(p.placa);
      if (!current || p.dataHoraDate.getTime() > current.getTime()) {
        updatedSessoes.set(p.placa, p.dataHoraDate);
      }
    });

    setSessoes([...updatedSessoes.entries()].map(([placa, ultimoDataHora]) => ({ placa, ultimoDataHora })));
    return accepted;
  }, [sessoes]);

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const calcGrupo = (gaps: GapEvento[], totalPontos: number) => {
      const criticos = gaps.filter(g => g.classificacao === "critico" && !g.isMosaic).length;
      const atencao = gaps.filter(g => g.classificacao === "atencao").length;
      const normais = gaps.filter(g => g.classificacao === "normal").length;
      const avgGap = gaps.length > 0 ? gaps.reduce((s, g) => s + g.gapMinutos, 0) / gaps.length : 0;
      const maxGap = gaps.reduce((m, g) => Math.max(m, g.gapMinutos), 0);
      const placasUnicas = new Set(gaps.map(g => g.placa)).size;
      const placasCriticas = new Set(gaps.filter(g => g.classificacao === "critico" && !g.isMosaic).map(g => g.placa)).size;
      const score = gaps.length > 0 ? Math.round(100 - (criticos / gaps.length) * 100) : 100;
      return { criticos, atencao, normais, avgGap, maxGap, totalPontos, placasUnicas, placasCriticas, score, totalGaps: gaps.length };
    };
    return {
      abm: calcGrupo(gapsAbm, pontosAbm.length),
      vx: calcGrupo(gapsVx, pontosVx.length),
      total: calcGrupo(allGaps, pontos.length),
    };
  }, [allGaps, gapsAbm, gapsVx, pontos, pontosAbm, pontosVx]);

  /* ─── Chart data ─── */
  const chartGapDistribuicao = useMemo(() => {
    const faixas = [
      { label: "🟢 ≤5 min", min: 0, max: 5 },
      { label: "🟡 5–30 min", min: 5, max: 30 },
      { label: "🔴 >30 min", min: 30, max: Infinity },
    ];
    return faixas.map(f => ({
      faixa: f.label,
      ABM: gapsAbm.filter(g => g.gapMinutos > f.min && g.gapMinutos <= (f.max === Infinity ? 999999 : f.max)).length,
      "VX CONSULT": gapsVx.filter(g => g.gapMinutos > f.min && g.gapMinutos <= (f.max === Infinity ? 999999 : f.max)).length,
    }));
  }, [gapsAbm, gapsVx]);

  const chartGapDetalhado = useMemo(() => {
    const faixas = [
      { label: "< 5 min", min: 0, max: 5 },
      { label: "5–15 min", min: 5, max: 15 },
      { label: "15–30 min", min: 15, max: 30 },
      { label: "30–60 min", min: 30, max: 60 },
      { label: "1–2h", min: 60, max: 120 },
      { label: "2–4h", min: 120, max: 240 },
      { label: "> 4h", min: 240, max: Infinity },
    ];
    return faixas.map(f => ({
      faixa: f.label,
      ABM: gapsAbm.filter(g => g.gapMinutos > f.min && g.gapMinutos <= (f.max === Infinity ? 999999 : f.max)).length,
      "VX CONSULT": gapsVx.filter(g => g.gapMinutos > f.min && g.gapMinutos <= (f.max === Infinity ? 999999 : f.max)).length,
    }));
  }, [gapsAbm, gapsVx]);

  const rankingPior = useMemo(() => allGaps.filter(g => g.classificacao === "critico").slice(0, 20), [allGaps]);

  /* ─── ABM File handler ─── */
  const handleFileAbm = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      if (headerIdx === -1) { toast({ title: "Cabeçalho 'Placa' não encontrado", variant: "destructive" }); return; }

      const headers = json[headerIdx].map((v: any) => String(v ?? "").trim());
      const col = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
      const iCliente = col("Cliente"), iPlaca = col("Placa"), iFrota = col("Frota");
      const iMotorista = col("Motorista"), iSerial = col("Serial"), iTec = col("Tecnologia");
      const iDH = col("Data/Hora"), iIgnicao = col("Ignição"), iRef = col("Referência");
      const iVel = col("Velocidade"), iTemp = col("Temperatura");
      const iMacro = col("Última Macro"), iSM = col("SM");

      const dataRows = json.slice(headerIdx + 1).filter(r => r.some((v: any) => String(v ?? "").trim()));
      const newPontos: PontoVeiculo[] = dataRows.map(row => {
        const get = (idx: number) => (idx >= 0 && idx < row.length ? String(row[idx] ?? "").trim() : "");
        const placa = get(iPlaca).toUpperCase();
        const rawTec = get(iTec);
        const { tecnologia, grupo } = classificarTecnologia(rawTec);
        const { display, date } = parseDateTimeLocal(row[iDH >= 0 ? iDH : -1]);
        const referencia = get(iRef);
        const { tipo, icone } = identificarTipoLocal(referencia);
        const localizacao = referencia && referencia !== "- /" ? referencia : "Localização não identificada";
        return {
          placa, cliente: get(iCliente), tecnologia, tecnologiaOriginal: rawTec,
          dataHoraDisplay: display, dataHoraDate: date, referencia,
          ignicao: get(iIgnicao), frota: get(iFrota), motorista: get(iMotorista),
          serial: get(iSerial), velocidade: get(iVel), temperatura: get(iTemp),
          ultimaMacro: get(iMacro), sm: get(iSM),
          latitude: "", longitude: "", deltaTempo: "", deltaDistancia: "", statusVx: "",
          grupo, tipoLocal: tipo, tipoLocalIcone: icone, localizacao, fonte: "abm" as const,
        };
      }).filter(v => v.placa);

      const accepted = filterDuplicates(newPontos);
      const ignorados = newPontos.length - accepted.length;
      setPontos(prev => [...prev, ...accepted]);
      setImportStats({ total: newPontos.length, novos: accepted.length, ignorados });
      const abmCount = accepted.filter(p => p.grupo === "abm").length;
      const vxCount = accepted.filter(p => p.grupo === "vx").length;
      toast({ title: `ABM: ${accepted.length} pontos importados (${ignorados} duplicados ignorados) — ${abmCount} ABM, ${vxCount} VX CONSULT` });
    };
    reader.readAsArrayBuffer(file);
    if (fileRefAbm.current) fileRefAbm.current.value = "";
  };

  /* ─── VX File handler ─── */
  const handleFileVx = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      if (headerIdx === -1) { toast({ title: "Cabeçalho 'Placa' não encontrado", variant: "destructive" }); return; }

      const headers = json[headerIdx].map((v: any) => String(v ?? "").trim());
      const col = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
      const iPlaca = col("Placa"), iDH = col("Data/Hora");
      const iLat = col("Latitude"), iLng = col("Longitude");
      const iDT = col("Tempo"), iDD = col("Distância") !== -1 ? col("Distância") : col("Distancia");
      const iStatus = col("Status");

      const dataRows = json.slice(headerIdx + 1).filter(r => r.some((v: any) => String(v ?? "").trim()));
      const newPontos: PontoVeiculo[] = dataRows.map(row => {
        const get = (idx: number) => (idx >= 0 && idx < row.length ? String(row[idx] ?? "").trim() : "");
        const placa = get(iPlaca).toUpperCase();
        const { display, date } = parseDateTimeLocal(row[iDH >= 0 ? iDH : -1]);
        const lat = get(iLat);
        const lng = get(iLng);
        const localizacao = lat && lng ? `${lat}, ${lng}` : "Localização não identificada";
        return {
          placa, cliente: "", tecnologia: "VX CONSULT", tecnologiaOriginal: "VX CONSULT",
          dataHoraDisplay: display, dataHoraDate: date, referencia: "",
          ignicao: "", frota: "", motorista: "", serial: "",
          velocidade: "", temperatura: "", ultimaMacro: "", sm: "",
          latitude: lat, longitude: lng,
          deltaTempo: get(iDT), deltaDistancia: get(iDD), statusVx: get(iStatus),
          grupo: "vx" as const, tipoLocal: "Localização Identificada", tipoLocalIcone: "📍",
          localizacao, fonte: "vx" as const,
        };
      }).filter(v => v.placa);

      const accepted = filterDuplicates(newPontos);
      const ignorados = newPontos.length - accepted.length;
      setPontos(prev => [...prev, ...accepted]);
      setImportStats({ total: newPontos.length, novos: accepted.length, ignorados });
      toast({ title: `VX: ${accepted.length} pontos importados (${ignorados} duplicados ignorados)` });
    };
    reader.readAsArrayBuffer(file);
    if (fileRefVx.current) fileRefVx.current.value = "";
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

    const gapList = grupo === "abm" ? gapsAbm : grupo === "vx" ? gapsVx : allGaps;
    const grupoLabel = grupo === "abm" ? "Rastreador ABM" : grupo === "vx" ? "VX CONSULT" : "Completo (ABM + VX)";
    const s = grupo === "abm" ? stats.abm : grupo === "vx" ? stats.vx : stats.total;

    drawCoverPage({ doc, logo, title: "Relatório de Perda de Sinal", subtitle: grupoLabel, periodo: "Análise por GAP de evento", geradoEm: nowStr, operador: profile?.nome || "Sistema" });

    let y = drawHeader({ doc, logo, title: `Perda de Sinal — ${grupoLabel}`, subtitle: "SAC VX Integrações", meta: [`Gerado: ${nowStr}`, `${s.totalGaps} GAPs analisados`] });

    y = drawSectionTitle(doc, "Indicadores Principais", y);
    y = drawKpiCards(doc, [
      { label: "Total de Pontos", value: String(s.totalPontos) },
      { label: "GAPs Analisados", value: String(s.totalGaps) },
      { label: "GAPs Críticos (>30min)", value: String(s.criticos), highlight: s.criticos > 0 },
      { label: "GAP Médio", value: formatGap(s.avgGap) },
      { label: "Maior GAP", value: formatGap(s.maxGap), highlight: s.maxGap > 30 },
      { label: "Score Operação", value: `${s.score} pts` },
    ], y);

    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "Tabela de GAPs", y);
    const criticos = gapList.filter(g => g.gapMinutos > 5);
    autoTable(doc, {
      startY: y,
      head: [["Placa", "Início", "Retorno", "GAP", "Classificação", "Local", "Grupo"]],
      body: criticos.slice(0, 80).map(g => [
        g.placa, g.inicio, g.retorno, formatGap(g.gapMinutos),
        g.classificacao === "critico" ? "🔴 Crítico" : "🟡 Atenção",
        g.localizacao.substring(0, 35),
        g.grupo === "abm" ? "ABM" : "VX CONSULT",
      ]),
      ...getTableStyles(),
      styles: { ...getTableStyles().styles, fontSize: 6.5 },
    });

    drawFooter(doc, true);
    doc.save(`relatorio-gap-sinal-${grupo}-${format(now, "yyyy-MM-dd")}.pdf`);
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

  /* ─── GAP Table Component ─── */
  const GapTable = ({ gaps, label }: { gaps: GapEvento[]; label: string }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tabela de GAP — {label}</CardTitle>
        <CardDescription>{gaps.length} intervalos detectados</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Retorno</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Local</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gaps.map((g, i) => (
                <TableRow key={i} className={g.classificacao === "critico" && !g.isMosaic ? "bg-destructive/5" : g.classificacao === "atencao" ? "bg-yellow-500/5" : ""}>
                  <TableCell className="font-mono font-medium">{g.placa}</TableCell>
                  <TableCell className="text-xs">{g.inicio}</TableCell>
                  <TableCell className="text-xs">{g.retorno}</TableCell>
                  <TableCell className="font-medium">{formatGap(g.gapMinutos)}</TableCell>
                  <TableCell>
                    <Badge variant={gapBadgeVariant(g.classificacao)} className="text-xs">
                      {g.isMosaic ? "🟢 Mosaic" : gapLabel(g.classificacao)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{g.localizacao}</TableCell>
                </TableRow>
              ))}
              {gaps.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum GAP detectado — necessário mais de 1 ponto por placa</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  /* ─── ABM Points Table ─── */
  const TabelaPontosAbm = ({ dados }: { dados: PontoVeiculo[] }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Pontos ABM — Detalhamento</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Tecnologia</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Ignição</TableHead>
                <TableHead>Tipo Local</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.map((v, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono font-medium">{v.placa}</TableCell>
                  <TableCell>{v.tecnologia}</TableCell>
                  <TableCell className="text-xs">{v.dataHoraDisplay}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{v.referencia || "—"}</TableCell>
                  <TableCell className="text-xs">{v.ignicao || "—"}</TableCell>
                  <TableCell className="text-xs">{v.tipoLocalIcone} {v.tipoLocal}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  /* ─── VX Points Table ─── */
  const TabelaPontosVx = ({ dados }: { dados: PontoVeiculo[] }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Pontos VX CONSULT — Detalhamento</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Δ Tempo</TableHead>
                <TableHead>Δ Distância</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.map((v, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono font-medium">{v.placa}</TableCell>
                  <TableCell className="text-xs">{v.dataHoraDisplay}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{v.localizacao}</TableCell>
                  <TableCell className="text-xs">{v.deltaTempo || "—"}</TableCell>
                  <TableCell className="text-xs">{v.deltaDistancia || "—"}</TableCell>
                  <TableCell className="text-xs">{v.statusVx || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  /* ─── Empty state ─── */
  if (pontos.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📊 Relatório de Perda de Sinal</h1>
          <p className="text-sm text-muted-foreground">Análise avançada por GAP de evento com separação automática — Padrão GR</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-dashed border-blue-300">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10">
                <FileSpreadsheet className="h-7 w-7 text-blue-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-blue-700 dark:text-blue-400">🔵 Importar Planilha ABM</p>
                <p className="text-xs text-muted-foreground mt-1">Placa • Tecnologia • Referência • Ignição • Data/Hora</p>
                <p className="text-xs text-muted-foreground">Separação automática: ABM convencional × VX CONSULT</p>
              </div>
              <input type="file" accept=".xlsx,.xls" ref={fileRefAbm} onChange={handleFileAbm} className="hidden" />
              <Button onClick={() => fileRefAbm.current?.click()} className="bg-blue-600 hover:bg-blue-700">
                <Upload className="h-4 w-4 mr-2" />Importar Planilha ABM
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed border-purple-300">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-500/10">
                <FileSpreadsheet className="h-7 w-7 text-purple-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-purple-700 dark:text-purple-400">🟣 Importar Planilha VX</p>
                <p className="text-xs text-muted-foreground mt-1">Placa • Data/Hora • Latitude • Longitude • Δ Tempo • Δ Distância • Status</p>
              </div>
              <input type="file" accept=".xlsx,.xls" ref={fileRefVx} onChange={handleFileVx} className="hidden" />
              <Button onClick={() => fileRefVx.current?.click()} className="bg-purple-600 hover:bg-purple-700">
                <Upload className="h-4 w-4 mr-2" />Importar Planilha VX
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">💡 Como funciona:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>GAP por evento</strong> — calcula o intervalo entre cada ponto consecutivo por placa</li>
              <li>🟢 Normal: até 5 min | 🟡 Atenção: 5–30 min | 🔴 Crítico: acima de 30 min</li>
              <li><strong>Anti-duplicidade</strong> — importações subsequentes ignoram dados já processados</li>
              <li>📍 Mosaic (Uberaba/MG) classificada automaticamente como Ponto Seguro</li>
              <li>⏱️ Frequência ideal de importação: 15–20 minutos</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ─── Main render ─── */
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📊 Relatório de Perda de Sinal</h1>
          <p className="text-sm text-muted-foreground">
            {pontos.length} pontos | {allGaps.length} GAPs analisados — {pontosAbm.length} ABM, {pontosVx.length} VX
            {importStats && <span className="ml-2 text-xs">(última: {importStats.novos} novos, {importStats.ignorados} ignorados)</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="file" accept=".xlsx,.xls" ref={fileRefAbm} onChange={handleFileAbm} className="hidden" />
          <input type="file" accept=".xlsx,.xls" ref={fileRefVx} onChange={handleFileVx} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileRefAbm.current?.click()} className="border-blue-300 text-blue-600">
            <Upload className="h-3 w-3 mr-1" />ABM
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRefVx.current?.click()} className="border-purple-300 text-purple-600">
            <Upload className="h-3 w-3 mr-1" />VX
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setPontos([]); setSessoes([]); setImportStats(null); }}>Nova Análise</Button>
          <Button variant="outline" size="sm" onClick={() => exportPDF("abm")}><Download className="h-3 w-3 mr-1" />PDF ABM</Button>
          <Button variant="outline" size="sm" onClick={() => exportPDF("vx")}><Download className="h-3 w-3 mr-1" />PDF VX</Button>
          <Button size="sm" onClick={() => exportPDF("todos")}><Download className="h-3 w-3 mr-1" />PDF Completo</Button>
        </div>
      </div>

      {/* Alerts banner */}
      {alertas.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-destructive" />
              🚨 Alertas Operacionais ({alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {alertas.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${a.tipo === "critico" ? "bg-destructive/10" : "bg-yellow-500/10"}`}>
                  <span>{a.tipo === "critico" ? "🔴" : "🟡"}</span>
                  <div className="flex-1">
                    <p className="font-medium">{a.mensagem}</p>
                  </div>
                  <Button
                    variant="ghost" size="sm" className="h-6 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(a.mensagem);
                      toast({ title: "Mensagem copiada para envio" });
                    }}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />Copiar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="visao-geral">Visão Executiva</TabsTrigger>
          <TabsTrigger value="gaps">📡 GAPs ({allGaps.filter(g => g.gapMinutos > 5).length})</TabsTrigger>
          <TabsTrigger value="abm">🔵 ABM ({pontosAbm.length})</TabsTrigger>
          <TabsTrigger value="vx">🟣 VX ({pontosVx.length})</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* ─── VISÃO EXECUTIVA ─── */}
        <TabsContent value="visao-geral" className="space-y-6 mt-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Total de Veículos" value={String(new Set(pontos.map(p => p.placa)).size)} icon={Truck} />
            <KpiCard label="Veículos com Falha" value={String(stats.total.placasCriticas)} icon={WifiOff} highlight={stats.total.placasCriticas > 0} />
            <KpiCard label="Maior GAP" value={formatGap(stats.total.maxGap)} icon={AlertTriangle} highlight={stats.total.maxGap > 30} />
            <KpiCard label="GAPs Críticos" value={String(stats.total.criticos)} icon={Activity} highlight={stats.total.criticos > 0} />
            <KpiCard label="GAP Médio" value={formatGap(stats.total.avgGap)} icon={Clock} />
            <KpiCard label="Score Operação" value={`${stats.total.score} pts`} icon={Shield} subtitle={stats.total.score >= 80 ? "Estável" : stats.total.score >= 60 ? "Atenção" : "Crítico"} />
          </div>

          {/* Comparativo ABM vs VX */}
          <Card>
            <CardHeader><CardTitle className="text-base">Comparativo: 🔵 ABM vs 🟣 VX CONSULT</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { label: "Score Qualidade", abm: `${stats.abm.score}`, vx: `${stats.vx.score}` },
                  { label: "GAP Médio", abm: formatGap(stats.abm.avgGap), vx: formatGap(stats.vx.avgGap) },
                  { label: "GAPs Críticos", abm: String(stats.abm.criticos), vx: String(stats.vx.criticos) },
                  { label: "Maior GAP", abm: formatGap(stats.abm.maxGap), vx: formatGap(stats.vx.maxGap) },
                ].map((item, i) => (
                  <div key={i} className="text-center p-3 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <div className="flex items-center justify-center gap-4">
                      <div>
                        <p className="text-xs text-blue-500 mb-0.5">🔵 ABM</p>
                        <p className="text-xl font-bold">{item.abm}</p>
                      </div>
                      <span className="text-muted-foreground text-xs">vs</span>
                      <div>
                        <p className="text-xs text-purple-500 mb-0.5">🟣 VX</p>
                        <p className="text-xl font-bold">{item.vx}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição de GAPs — Classificação</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartGapDistribuicao}>
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
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tempo sem Comunicação — Detalhado</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartGapDetalhado} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="faixa" type="category" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ABM" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="VX CONSULT" fill="#a855f7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Ranking */}
          {rankingPior.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Ranking — Piores GAPs (Críticos)
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
                        <TableHead>Início</TableHead>
                        <TableHead>Retorno</TableHead>
                        <TableHead>GAP</TableHead>
                        <TableHead>Local</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankingPior.map((g, i) => (
                        <TableRow key={i} className="bg-destructive/5">
                          <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-mono font-medium">{g.placa}</TableCell>
                          <TableCell>{g.grupo === "abm" ? "🔵 ABM" : "🟣 VX"}</TableCell>
                          <TableCell className="text-xs">{g.inicio}</TableCell>
                          <TableCell className="text-xs">{g.retorno}</TableCell>
                          <TableCell className="font-medium text-destructive">{formatGap(g.gapMinutos)}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs">{g.isMosaic ? "🟢 Mosaic" : g.localizacao}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── GAPS TAB ─── */}
        <TabsContent value="gaps" className="mt-4 space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total GAPs" value={String(allGaps.length)} icon={Activity} />
            <KpiCard label="🟢 Normal (≤5min)" value={String(stats.total.normais)} icon={Wifi} />
            <KpiCard label="🟡 Atenção (5–30min)" value={String(stats.total.atencao)} icon={Clock} highlight={stats.total.atencao > 5} />
            <KpiCard label="🔴 Crítico (>30min)" value={String(stats.total.criticos)} icon={AlertTriangle} highlight={stats.total.criticos > 0} />
          </div>
          <GapTable gaps={allGaps.filter(g => g.gapMinutos > 5)} label="Todos os GAPs relevantes (>5 min)" />
        </TabsContent>

        {/* ─── PAINEL ABM ─── */}
        <TabsContent value="abm" className="mt-4 space-y-4">
          {pontosAbm.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🔵</span>
                <h3 className="text-lg font-bold">Rastreador ABM (Convencional)</h3>
                <Badge variant="outline">{pontosAbm.length} pontos</Badge>
              </div>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Pontos ABM" value={String(pontosAbm.length)} icon={Truck} />
                <KpiCard label="GAPs Críticos" value={String(stats.abm.criticos)} icon={AlertTriangle} highlight={stats.abm.criticos > 0} />
                <KpiCard label="GAP Médio" value={formatGap(stats.abm.avgGap)} icon={Clock} />
                <KpiCard label="Score" value={`${stats.abm.score} pts`} icon={Shield} />
              </div>
              <GapTable gaps={gapsAbm.filter(g => g.gapMinutos > 5)} label="GAPs ABM (>5 min)" />
              <TabelaPontosAbm dados={pontosAbm} />
            </>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum dado ABM importado</CardContent></Card>
          )}
        </TabsContent>

        {/* ─── PAINEL VX ─── */}
        <TabsContent value="vx" className="mt-4 space-y-4">
          {pontosVx.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🟣</span>
                <h3 className="text-lg font-bold">VX CONSULT</h3>
                <Badge variant="outline">{pontosVx.length} pontos</Badge>
              </div>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Pontos VX" value={String(pontosVx.length)} icon={Truck} />
                <KpiCard label="GAPs Críticos" value={String(stats.vx.criticos)} icon={AlertTriangle} highlight={stats.vx.criticos > 0} />
                <KpiCard label="GAP Médio" value={formatGap(stats.vx.avgGap)} icon={Clock} />
                <KpiCard label="Score" value={`${stats.vx.score} pts`} icon={Shield} />
              </div>
              <GapTable gaps={gapsVx.filter(g => g.gapMinutos > 5)} label="GAPs VX CONSULT (>5 min)" />
              <TabelaPontosVx dados={pontosVx} />
            </>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum dado VX importado</CardContent></Card>
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
            </CardHeader>
            <CardContent>
              {insights.length > 0 ? (
                <div className="space-y-3">
                  {insights.map((txt, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
                      <span className="text-lg">🧠</span>
                      <p className="text-sm">{txt}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-6">Importe dados para gerar insights</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-medium mb-2">⏱️ Frequência de Importação Recomendada</p>
              <div className="grid grid-cols-3 gap-3 text-xs text-center">
                <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                  <p className="font-bold text-green-600">🔥 Ideal</p>
                  <p className="text-muted-foreground">15–20 min</p>
                </div>
                <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                  <p className="font-bold text-yellow-600">⚖️ Aceitável</p>
                  <p className="text-muted-foreground">25 min</p>
                </div>
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                  <p className="font-bold text-red-600">❌ Não recomendado</p>
                  <p className="text-muted-foreground">30+ min</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
