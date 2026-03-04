// WhatsApp message generator based on time of day
export function gerarMensagemWhatsApp(placa: string, horaTravou: string): string {
  const hora = new Date().getHours();
  let saudacao: string;

  if (hora >= 6 && hora < 12) {
    saudacao = "Bom dia, tudo bem?";
  } else if (hora >= 12 && hora < 18) {
    saudacao = "Boa tarde, tudo bem?";
  } else {
    saudacao = "Boa noite, tudo bem?";
  }

  const horaFormatada = horaTravou || "horário não informado";

  if (hora >= 6 && hora < 12) {
    return `${saudacao}\nEduardo do SAC VX.\nPlaca: ${placa}\nA placa travou às ${horaFormatada}.\nSegue em anexo o print do sistema.\nPode verificar se está vindo na integração ou o que pode ter ocorrido?`;
  } else if (hora >= 12 && hora < 18) {
    return `${saudacao}\nEduardo do SAC VX.\nPlaca: ${placa}\nA placa travou às ${horaFormatada}.\nSegue print em anexo.\nPode verificar por favor?`;
  } else {
    return `${saudacao}\nEduardo do SAC VX.\nPlaca: ${placa}\nA placa travou às ${horaFormatada}.\nPode verificar para nós?`;
  }
}

export function abrirWhatsApp(numero: string, mensagem: string) {
  // Remove non-digits
  const cleaned = numero.replace(/\D/g, "");
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
}
