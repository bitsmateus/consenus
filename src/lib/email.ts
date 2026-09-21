/**
 * Envio de e-mail do próprio sistema (hoje, só a redefinição de senha).
 *
 * Não confundir com a AR Online, que entrega a Carta-Convite: aqui é o
 * SMTP da câmara, configurado por SMTP_* e EMAIL_REMETENTE (.env.example).
 * Sem SMTP_HOST o recurso simplesmente fica desligado, como as demais
 * integrações opcionais.
 */
import nodemailer from "nodemailer";

export function emailAtivo(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export async function enviarEmail(mensagem: {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}): Promise<void> {
  const porta = Number(process.env.SMTP_PORT || 587);

  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    // 465 é TLS direto; 587 começa em texto e sobe para TLS (STARTTLS)
    secure: porta === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await transporte.sendMail({
    from: process.env.EMAIL_REMETENTE || "nao-responda@consensusone.com.br",
    to: mensagem.para,
    subject: mensagem.assunto,
    text: mensagem.texto,
    html: mensagem.html,
  });
}
