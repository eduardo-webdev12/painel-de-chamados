import { z } from "zod";

const whatsappNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{12,14}$/, "Número WhatsApp inválido. Use país+DDD+número.");

const whatsappMessageSchema = z
  .string()
  .trim()
  .min(10, "Mensagem vazia")
  .max(2500, "Mensagem muito longa para WhatsApp.");

const saudacaoPorHorario = (agora = new Date()) => {
  const hora = agora.getHours();
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
};

/**
 * Gera mensagem no formato corporativo SAC VX INTEGRAÇÕES.
 * O formato é texto corrido conforme padrão operacional.
 */
export function gerarMensagemWhatsApp(
  placa: string,
  horaTravou: string,
  operadorNome?: string,
  tecnologia?: string,
): string {
  const saudacao = saudacaoPorHorario();
  return `SAC VX INTEGRAÇÕES: ${saudacao} , Tudo Bem? Estamos com uma perca de sinal dessa placa: ${placa} , conseguem verificar o motivo de ter travado ? o motorista está a caminho do cliente ou existe alguma falha na integração que os dados não estão vindo pra gente ?`;
}

/**
 * Valida e abre WhatsApp Web com a mensagem.
 */
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

/**
 * Validates WhatsApp send prerequisites and returns errors if any.
 */
export function validarPreEnvioWhatsApp(params: {
  whatsappNumero: string;
  placa: string;
  fotoUrl: string | null;
}): string[] {
  const erros: string[] = [];
  if (!params.whatsappNumero?.trim()) erros.push("Número WhatsApp não cadastrado para esta tecnologia.");
  if (!params.placa?.trim()) erros.push("Placa não informada.");
  if (!params.fotoUrl) erros.push("Nenhuma foto/print anexada ao chamado.");
  return erros;
}
