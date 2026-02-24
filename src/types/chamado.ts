export type StatusChamado = "Aberto" | "Em Tratativa" | "Resolvido";

export interface Chamado {
  id: string;
  placa: string;
  transportadora: string;
  tecnologia: string;
  descricao: string;
  observacao: string;
  tempoTravada: string;
  dataAbertura: string;
  status: StatusChamado;
  dataResolucao?: string;
}
