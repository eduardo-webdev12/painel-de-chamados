import { differenceInMinutes, differenceInHours, parseISO } from "date-fns";
import type { ChamadoDB } from "@/hooks/useChamados";
import { normalizarStatusChamado } from "./chamadoWorkflow";

// ─── Risk Classification ──────────────────────────────────
export type NivelRisco = "baixo" | "medio" | "alto" | "critico";

export interface PlacaRisco {
  placa: string;
  nivel: NivelRisco;
  totalOcorrencias: number;
  recorrencias: number;
  mtbfMinutos: number | null; // Mean Time Between Failures
  tempoTravadaAtual: number; // minutes if currently stuck
  tecnologias: string[];
  transportadoras: string[];
}

export function classificarRiscoPlaca(ocorrencias: ChamadoDB[]): NivelRisco {
  const total = ocorrencias.length;
  const recorrentes = ocorrencias.filter(c => c.recorrente).length;
  const totalRecorrencia = ocorrencias.reduce((sum, c) => sum + c.contagem_recorrencia, 0);

  // Check if currently stuck for a long time
  const ativos = ocorrencias.filter(c => {
    const s = normalizarStatusChamado(c.status);
    return s === "Aberto" || s === "Em Tratativa";
  });
  const tempoMaxAtivo = ativos.reduce((max, c) => {
    if (!c.hora_travou) return max;
    const mins = differenceInMinutes(new Date(), parseISO(c.hora_travou));
    return Math.max(max, mins);
  }, 0);

  if (total >= 5 || totalRecorrencia >= 4 || tempoMaxAtivo >= 240) return "critico";
  if (total >= 3 || totalRecorrencia >= 2 || tempoMaxAtivo >= 120) return "alto";
  if (total >= 2 || recorrentes >= 1) return "medio";
  return "baixo";
}

export function calcularMTBF(ocorrencias: ChamadoDB[]): number | null {
  if (ocorrencias.length < 2) return null;
  const sorted = [...ocorrencias].sort(
    (a, b) => new Date(a.data_abertura).getTime() - new Date(b.data_abertura).getTime()
  );
  let totalGap = 0;
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = differenceInMinutes(parseISO(sorted[i].data_abertura), parseISO(sorted[i - 1].data_abertura));
    if (gap > 0) { totalGap += gap; gaps++; }
  }
  return gaps > 0 ? totalGap / gaps : null;
}

export function analisarPlacas(chamados: ChamadoDB[]): PlacaRisco[] {
  const map = new Map<string, ChamadoDB[]>();
  chamados.forEach(c => {
    const key = c.placa.trim().toUpperCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  });

  return Array.from(map.entries()).map(([placa, ocs]) => {
    const nivel = classificarRiscoPlaca(ocs);
    const mtbfMinutos = calcularMTBF(ocs);
    const ativos = ocs.filter(c => {
      const s = normalizarStatusChamado(c.status);
      return s === "Aberto" || s === "Em Tratativa";
    });
    const tempoTravadaAtual = ativos.reduce((max, c) => {
      if (!c.hora_travou) return max;
      return Math.max(max, differenceInMinutes(new Date(), parseISO(c.hora_travou)));
    }, 0);

    return {
      placa,
      nivel,
      totalOcorrencias: ocs.length,
      recorrencias: ocs.reduce((s, c) => s + c.contagem_recorrencia, 0),
      mtbfMinutos,
      tempoTravadaAtual,
      tecnologias: [...new Set(ocs.map(c => c.tecnologia))],
      transportadoras: [...new Set(ocs.map(c => c.transportadora))],
    };
  }).sort((a, b) => {
    const order: Record<NivelRisco, number> = { critico: 0, alto: 1, medio: 2, baixo: 3 };
    return order[a.nivel] - order[b.nivel] || b.totalOcorrencias - a.totalOcorrencias;
  });
}

// ─── Technology Ranking ───────────────────────────────────
export interface TecnologiaStats {
  nome: string;
  totalFalhas: number;
  percentual: number;
  tempoMedioResolucao: number; // minutes
  recorrencias: number;
  mtbf: number | null;
}

export function rankingTecnologias(chamados: ChamadoDB[]): TecnologiaStats[] {
  const totalGeral = chamados.length || 1;
  const map = new Map<string, ChamadoDB[]>();
  chamados.forEach(c => {
    if (!map.has(c.tecnologia)) map.set(c.tecnologia, []);
    map.get(c.tecnologia)!.push(c);
  });

  return Array.from(map.entries()).map(([nome, ocs]) => {
    const resolvidos = ocs.filter(o => o.data_resolucao && o.hora_travou);
    const tempos = resolvidos.map(o => differenceInMinutes(parseISO(o.data_resolucao!), parseISO(o.hora_travou!)));
    const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
    return {
      nome,
      totalFalhas: ocs.length,
      percentual: (ocs.length / totalGeral) * 100,
      tempoMedioResolucao: tempoMedio,
      recorrencias: ocs.filter(o => o.recorrente).length,
      mtbf: calcularMTBF(ocs),
    };
  }).sort((a, b) => b.totalFalhas - a.totalFalhas);
}

// ─── Time-based Alerts ────────────────────────────────────
export type AlertLevel = "amarelo" | "vermelho" | "critico";

export interface AlertaPlaca {
  chamadoId: string;
  placa: string;
  minutosTravada: number;
  level: AlertLevel;
  tecnologia: string;
  transportadora: string;
}

export function gerarAlertasTempo(chamados: ChamadoDB[]): AlertaPlaca[] {
  return chamados
    .filter(c => {
      const s = normalizarStatusChamado(c.status);
      return (s === "Aberto" || s === "Em Tratativa") && c.hora_travou;
    })
    .map(c => {
      const mins = differenceInMinutes(new Date(), parseISO(c.hora_travou!));
      let level: AlertLevel = "amarelo";
      if (mins >= 120) level = "critico";
      else if (mins >= 60) level = "vermelho";
      else if (mins >= 30) level = "amarelo";
      else return null;
      return { chamadoId: c.id, placa: c.placa, minutosTravada: mins, level, tecnologia: c.tecnologia, transportadora: c.transportadora };
    })
    .filter(Boolean) as AlertaPlaca[];
}

// ─── MTBF Global ──────────────────────────────────────────
export function calcularMTBFGlobal(chamados: ChamadoDB[]): string {
  const placaMap = new Map<string, ChamadoDB[]>();
  chamados.forEach(c => {
    const key = c.placa.trim().toUpperCase();
    if (!placaMap.has(key)) placaMap.set(key, []);
    placaMap.get(key)!.push(c);
  });

  const mtbfs: number[] = [];
  placaMap.forEach(ocs => {
    const m = calcularMTBF(ocs);
    if (m !== null) mtbfs.push(m);
  });

  if (mtbfs.length === 0) return "—";
  const avg = mtbfs.reduce((a, b) => a + b, 0) / mtbfs.length;
  if (avg < 60) return `${Math.round(avg)} min`;
  if (avg < 1440) return `${(avg / 60).toFixed(1)} h`;
  return `${(avg / 1440).toFixed(1)} dias`;
}

// ─── Criticality Colors ──────────────────────────────────
export const RISCO_CONFIG: Record<NivelRisco, { label: string; color: string; bg: string; icon: string }> = {
  critico: { label: "Crítico", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: "🔴" },
  alto: { label: "Alto", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-400/30", icon: "🟠" },
  medio: { label: "Atenção", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10 border-yellow-400/30", icon: "🟡" },
  baixo: { label: "Normal", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-400/30", icon: "🟢" },
};
