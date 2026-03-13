import { differenceInMinutes, format, parseISO } from "date-fns";
import { z } from "zod";

export type EncerrarOpcao = "destravou" | "continua_travado" | "sem_cobertura";

const dataHoraSchema = z
  .string()
  .trim()
  .min(1, "Informe data/hora.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Data/hora inválida.");

export const normalizarStatusChamado = (status: string) =>
  status
    .replace("Encerrado - Continua travado", "Encerrado — Continua travado")
    .replace("Encerrado - Sem cobertura", "Encerrado — Sem cobertura");

export function montarPayloadEncerramento(params: {
  opcao: EncerrarOpcao;
  dataRetornoSinal: string;
  horaTravou?: string | null;
}) {
  const { opcao, dataRetornoSinal, horaTravou } = params;

  if (opcao === "destravou") {
    const parsed = dataHoraSchema.safeParse(dataRetornoSinal);
    if (!parsed.success) {
      return {
        ok: false as const,
        error: "Informe a data e hora que a placa destravou.",
      };
    }

    const retornoDate = new Date(parsed.data);
    const updates: Record<string, unknown> = {
      status: "Resolvido",
      data_hora_retorno_sinal: retornoDate.toISOString(),
    };

    if (horaTravou) {
      const diff = differenceInMinutes(retornoDate, parseISO(horaTravou));
      updates.tempo_travada = diff < 60 ? `${diff} min` : `${(diff / 60).toFixed(1)} h`;
    }

    return {
      ok: true as const,
      updates,
      historicoAcao: "Chamado encerrado — Resolvido",
      historicoDetalhes: `Retorno do sinal: ${format(retornoDate, "dd/MM/yyyy HH:mm")}`,
    };
  }

  if (opcao === "continua_travado") {
    return {
      ok: true as const,
      updates: {
        status: "Encerrado — Continua travado",
        data_hora_retorno_sinal: null,
      },
      historicoAcao: "Chamado encerrado — Continua travado",
      historicoDetalhes: "Placa permanece sem sinal",
    };
  }

  return {
    ok: true as const,
    updates: {
      status: "Encerrado — Sem cobertura",
      data_hora_retorno_sinal: null,
    },
    historicoAcao: "Chamado encerrado — Sem cobertura",
    historicoDetalhes: "Região ou placa sem cobertura de sinal",
  };
}

export function montarPayloadRecorrencia(dataHoraRecorrencia: string, contagemAtual: number) {
  const parsed = dataHoraSchema.safeParse(dataHoraRecorrencia);
  if (!parsed.success) {
    return { ok: false as const, error: "Informe data e hora válidas para recorrência." };
  }

  const momento = new Date(parsed.data);
  const contagem = contagemAtual + 1;

  return {
    ok: true as const,
    updates: {
      status: "Em Tratativa",
      data_resolucao: null,
      recorrente: true,
      contagem_recorrencia: contagem,
      hora_travou: momento.toISOString(),
      tempo_travada: "0 min",
      finalizado_por_nome: null,
      finalizado_por_email: null,
      finalizado_por_cargo: null,
      finalizado_em: null,
      data_hora_retorno_sinal: null,
    },
    historicoAcao: "Placa voltou a travar",
    historicoDetalhes: `Recorrência ${contagem}x registrada para ${format(momento, "dd/MM/yyyy HH:mm")}`,
    contagem,
  };
}
