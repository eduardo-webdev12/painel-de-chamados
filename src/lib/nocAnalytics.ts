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

// ─── Score de Confiabilidade ─────────────────────────────
export type ScoreClassificacao = "excelente" | "bom" | "instavel" | "critico";

export interface TecnologiaScore {
  nome: string;
  score: number;
  classificacao: ScoreClassificacao;
  totalFalhas: number;
  totalPlacas: number;
  taxaTravamento: number;       // falhas / placas
  tempoMedioResolucao: number;  // minutes
  taxaRecorrencia: number;      // recorrencias / chamados
  mtbf: number | null;          // minutes
  recorrencias: number;
}

export const SCORE_CONFIG: Record<ScoreClassificacao, { label: string; color: string; bg: string; icon: string }> = {
  excelente: { label: "Excelente", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-400/30", icon: "🟢" },
  bom:       { label: "Bom",       color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-500/10 border-blue-400/30",    icon: "🟡" },
  instavel:  { label: "Instável",  color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-400/30", icon: "🟠" },
  critico:   { label: "Crítico",   color: "text-destructive",                     bg: "bg-destructive/10 border-destructive/30", icon: "🔴" },
};

function classificarScore(score: number): ScoreClassificacao {
  if (score >= 85) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 50) return "instavel";
  return "critico";
}

/**
 * Score de Confiabilidade (0-100)
 * Weights: taxa travamento 35%, MTTR 25%, recorrência 25%, MTBF 15%
 */
export function calcularScoreConfiabilidade(chamados: ChamadoDB[]): TecnologiaScore[] {
  if (chamados.length === 0) return [];

  const tecMap = new Map<string, ChamadoDB[]>();
  const placasPorTec = new Map<string, Set<string>>();

  chamados.forEach(c => {
    const tec = c.tecnologia;
    if (!tecMap.has(tec)) { tecMap.set(tec, []); placasPorTec.set(tec, new Set()); }
    tecMap.get(tec)!.push(c);
    placasPorTec.get(tec)!.add(c.placa.trim().toUpperCase());
  });

  // Global maxes for normalization
  let maxTaxaTrav = 0, maxMTTR = 0, maxTaxaRec = 0;
  const rawData: Array<{ nome: string; ocs: ChamadoDB[]; placas: number; taxaTrav: number; mttr: number; taxaRec: number; mtbf: number | null; recorrencias: number }> = [];

  tecMap.forEach((ocs, nome) => {
    const placas = placasPorTec.get(nome)!.size || 1;
    const taxaTrav = ocs.length / placas;

    const resolvidos = ocs.filter(o => o.data_resolucao && o.hora_travou);
    const tempos = resolvidos.map(o => Math.max(0, differenceInMinutes(parseISO(o.data_resolucao!), parseISO(o.hora_travou!))));
    const mttr = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

    const recorrencias = ocs.filter(o => o.recorrente).length;
    const taxaRec = ocs.length > 0 ? recorrencias / ocs.length : 0;

    const mtbf = calcularMTBF(ocs);

    maxTaxaTrav = Math.max(maxTaxaTrav, taxaTrav);
    maxMTTR = Math.max(maxMTTR, mttr);
    maxTaxaRec = Math.max(maxTaxaRec, taxaRec);

    rawData.push({ nome, ocs, placas, taxaTrav, mttr, taxaRec, mtbf, recorrencias });
  });

  // Normalize and compute score
  return rawData.map(d => {
    // Lower is better for these → invert: score_component = 1 - (value / max)
    const normTrav = maxTaxaTrav > 0 ? 1 - (d.taxaTrav / maxTaxaTrav) : 1;
    const normMTTR = maxMTTR > 0 ? 1 - (d.mttr / maxMTTR) : 1;
    const normRec  = maxTaxaRec > 0 ? 1 - (d.taxaRec / maxTaxaRec) : 1;

    // Higher MTBF is better → normalize directly
    // Use 7 days as reference ceiling
    const mtbfRef = 10080; // 7 days in minutes
    const normMTBF = d.mtbf !== null ? Math.min(d.mtbf / mtbfRef, 1) : 0.5;

    const score = Math.round(
      normTrav * 35 + normMTTR * 25 + normRec * 25 + normMTBF * 15
    );

    const clampedScore = Math.max(0, Math.min(100, score));

    return {
      nome: d.nome,
      score: clampedScore,
      classificacao: classificarScore(clampedScore),
      totalFalhas: d.ocs.length,
      totalPlacas: d.placas,
      taxaTravamento: d.taxaTrav,
      tempoMedioResolucao: d.mttr,
      taxaRecorrencia: d.taxaRec,
      mtbf: d.mtbf,
      recorrencias: d.recorrencias,
    };
  }).sort((a, b) => b.score - a.score);
}

// ─── Score por Placa ─────────────────────────────────────
export interface PlacaScore {
  placa: string;
  score: number;
  classificacao: ScoreClassificacao;
  totalOcorrencias: number;
  recorrencias: number;
  tempoTotalTravada: number; // minutes
  tecnologias: string[];
}

export function calcularScorePlacas(chamados: ChamadoDB[]): PlacaScore[] {
  if (chamados.length === 0) return [];
  const map = new Map<string, ChamadoDB[]>();
  chamados.forEach(c => {
    const k = c.placa.trim().toUpperCase();
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  });

  let maxOc = 0, maxRec = 0, maxTempo = 0;
  const raw: Array<{ placa: string; ocs: ChamadoDB[]; totalRec: number; tempoTotal: number }> = [];

  map.forEach((ocs, placa) => {
    const totalRec = ocs.reduce((s, c) => s + c.contagem_recorrencia, 0);
    const tempoTotal = ocs.filter(o => o.data_resolucao && o.hora_travou)
      .reduce((s, o) => s + Math.max(0, differenceInMinutes(parseISO(o.data_resolucao!), parseISO(o.hora_travou!))), 0);
    maxOc = Math.max(maxOc, ocs.length);
    maxRec = Math.max(maxRec, totalRec);
    maxTempo = Math.max(maxTempo, tempoTotal);
    raw.push({ placa, ocs, totalRec, tempoTotal });
  });

  return raw.map(d => {
    const nOc = maxOc > 0 ? 1 - (d.ocs.length / maxOc) : 1;
    const nRec = maxRec > 0 ? 1 - (d.totalRec / maxRec) : 1;
    const nTempo = maxTempo > 0 ? 1 - (d.tempoTotal / maxTempo) : 1;
    const score = Math.max(0, Math.min(100, Math.round(nOc * 40 + nRec * 35 + nTempo * 25)));
    return {
      placa: d.placa,
      score,
      classificacao: classificarScore(score),
      totalOcorrencias: d.ocs.length,
      recorrencias: d.totalRec,
      tempoTotalTravada: d.tempoTotal,
      tecnologias: [...new Set(d.ocs.map(c => c.tecnologia))],
    };
  }).sort((a, b) => b.score - a.score);
}
