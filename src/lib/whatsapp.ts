import { z } from "zod";

const whatsappNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{12,14}$/, "Número WhatsApp inválido. Use país+DDD+número.");

const whatsappMessageSchema = z
  .string()
  .trim()
  .min(10, "Mensagem vazia")
  .max(1800, "Mensagem muito longa para WhatsApp.");

const horaTravouSchema = z.string().trim().min(1);

const saudacaoPorHorario = (agora = new Date()) => {
  const hora = agora.getHours();
  if (hora >= 5 && hora < 12) return "Bom dia, tudo bem?";
  if (hora >= 12 && hora < 18) return "Boa tarde, tudo bem?";
  return "Boa noite, tudo bem?";
};

export function gerarMensagemWhatsApp(
  placa: string,
  horaTravou: string,
  operadorNome?: string,
  tecnologia?: string,
): string {
  const saudacao = saudacaoPorHorario();
  const horaFormatada = horaTravouSchema.safeParse(horaTravou).success ? horaTravou : "horário não informado";
  const nome = (operadorNome || "Eduardo").trim();
  const tecnologiaLinha = tecnologia ? `Tecnologia: ${tecnologia}\n` : "";

  return [
    "*SAC VX INTEGRAÇÕES VX:*",
    "",
    saudacao,
    "",
    `${nome} do SAC VX.",
    `Placa: ${placa}`,
    tecnologiaLinha.trimEnd(),
    `A placa travou às ${horaFormatada}.`,
    "Poderiam verificar por gentileza se está vindo na integração ou se ocorreu alguma falha no rastreador?",
  ]
    .filter(Boolean)
    .join("\n");
}

export function abrirWhatsApp(numero: string, mensagem: string) {
  const numeroParsed = whatsappNumberSchema.safeParse(numero.replace(/\D/g, ""));
  if (!numeroParsed.success) {
    throw new Error(numeroParsed.error.errors[0]?.message || "Número inválido");
  }

  const mensagemParsed = whatsappMessageSchema.safeParse(mensagem);
  if (!mensagemParsed.success) {
    throw new Error(mensagemParsed.error.errors[0]?.message || "Mensagem inválida");
  }

  const url = `https://wa.me/${numeroParsed.data}?text=${encodeURIComponent(mensagemParsed.data)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
