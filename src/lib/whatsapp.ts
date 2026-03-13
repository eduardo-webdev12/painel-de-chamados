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

/**
 * Mensagem padrão para TECNOLOGIA.
 * Texto fixo conforme padrão operacional SAC VX INTEGRAÇÕES.
 */
export function gerarMensagemTecnologia(placa: string): string {
  return `*SAC VX INTEGRAÇÕES:*\n\nestamos com uma perca de sinal dessa placa: ${placa} , motorista está seguindo para o cliente e não realizou nenhuma parada no momento e demais placas estão posicionando sem travamento no mesmo local , por gentileza verificar`;
}

/**
 * Mensagem padrão para TRANSPORTADORA.
 * Texto fixo conforme padrão operacional SAC VX INTEGRAÇÕES.
 */
export function gerarMensagemTransportadora(placa: string): string {
  return `*SAC VX INTEGRAÇÕES:*\n\nplaca: ${placa}\nmotorista travou entraremos em contato com o motorista e tecnologia para ser tratado a perca de sinal em 1h.`;
}

// Keep backward compat
export function gerarMensagemWhatsApp(
  placa: string,
  _horaTravou?: string,
  _operadorNome?: string,
  _tecnologia?: string,
): string {
  return gerarMensagemTecnologia(placa);
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
  if (!params.whatsappNumero?.trim()) erros.push("Número WhatsApp não cadastrado.");
  if (!params.placa?.trim()) erros.push("Placa não informada.");
  if (!params.fotoUrl) erros.push("Nenhuma foto/print anexada ao chamado.");
  return erros;
}

/**
 * Copy an image from URL to clipboard as PNG blob for pasting into WhatsApp.
 */
export async function copiarImagemParaClipboard(imageUrl: string): Promise<void> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  
  // Convert to PNG if needed
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Falha ao converter imagem"));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = imageUrl;
  });

  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": pngBlob }),
  ]);
}
