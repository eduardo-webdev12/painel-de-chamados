import { Chamado } from "@/types/chamado";

const STORAGE_KEY = "vx-sac-chamados";

export function getChamados(): Chamado[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveChamados(chamados: Chamado[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chamados));
}

export function addChamado(chamado: Chamado) {
  const chamados = getChamados();
  chamados.unshift(chamado);
  saveChamados(chamados);
  return chamados;
}

export function updateChamado(id: string, updates: Partial<Chamado>) {
  const chamados = getChamados();
  const index = chamados.findIndex((c) => c.id === id);
  if (index !== -1) {
    chamados[index] = { ...chamados[index], ...updates };
    saveChamados(chamados);
  }
  return chamados;
}

export function getChamadoById(id: string): Chamado | undefined {
  return getChamados().find((c) => c.id === id);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
