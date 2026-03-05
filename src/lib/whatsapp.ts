// WhatsApp message generator based on time of day
export function gerarMensagemWhatsApp(placa: string, horaTravou: string, operadorNome?: string): string {
  const hora = new Date().getHours();
  let saudacao: string;

  if (hora >= 5 && hora < 12) {
    saudacao = "Bom dia, tudo bem?";
  } else if (hora >= 12 && hora < 18) {
    saudacao = "Boa tarde, tudo bem?";
  } else {
    saudacao = "Boa noite, tudo bem?";
  }

  const horaFormatada = horaTravou || "horário não informado";
  const nome = operadorNome || "Eduardo";

  return `*SAC VX INTEGRAÇÕES VX:*\n\n${saudacao}\n${nome} do SAC VX.\nPlaca: ${placa}\nA placa travou às ${horaFormatada}.\nPoderiam verificar por gentileza se está vindo na integração ou se ocorreu alguma falha no rastreador?`;
}

export function abrirWhatsApp(numero: string, mensagem: string) {
  // Remove non-digits
  const cleaned = numero.replace(/\D/g, "");
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
}
