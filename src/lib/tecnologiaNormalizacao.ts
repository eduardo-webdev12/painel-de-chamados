/**
 * Normalização de nomes de tecnologias para evitar duplicidade.
 * Todas as tecnologias são normalizadas para UPPERCASE e trimmed.
 */

// Mapa canônico de tecnologias conhecidas
const TECNOLOGIAS_CANONICAS = [
  "AUTOTRAC",
  "OMNILINK",
  "ONIXSAT",
  "SASCAR",
  "POSITRON",
  "SIGHRA",
  "MAXTRACK",
  "JABUR",
  "COBLI",
] as const;

/**
 * Normaliza um nome de tecnologia: trim + uppercase.
 * Se corresponde a uma tecnologia canônica, retorna o nome canônico.
 */
export function normalizarTecnologia(nome: string): string {
  const cleaned = nome.trim().toUpperCase().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;

  // Busca correspondência canônica
  const match = TECNOLOGIAS_CANONICAS.find(
    (c) => c === cleaned || cleaned.includes(c) || c.includes(cleaned)
  );
  return match || cleaned;
}

/**
 * Dado um array de nomes de tecnologias brutos, retorna a lista
 * deduplicada e normalizada.
 */
export function listarTecnologiasUnicas(nomesBrutos: string[]): string[] {
  const set = new Set<string>();
  nomesBrutos.forEach((n) => {
    const normalizado = normalizarTecnologia(n);
    if (normalizado) set.add(normalizado);
  });
  return [...set].sort();
}
