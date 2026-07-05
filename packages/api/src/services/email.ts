import nodemailer from 'nodemailer';
import { env } from '../env.js';

interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface MailTransport {
  sendMail(message: MailMessage): Promise<unknown>;
}

interface SentResetEmail {
  to: string;
  resetUrl: string;
}

let lastResetEmail: SentResetEmail | null = null;

export function getLastResetEmail(): SentResetEmail | null {
  return lastResetEmail;
}

function buildTransport(): MailTransport {
  if (!env.SMTP_HOST) {
    return {
      async sendMail({ to, text }) {
        // dev: sem SMTP configurado, o link vai pro log em vez de um e-mail real (M21-09)
        console.log(`[email] to=${to}\n${text}`);
      },
    };
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

const transport = buildTransport();

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = 'Redefinir sua senha — KAOS';
  const text = `Você pediu para redefinir sua senha.

Abra o link abaixo para escolher uma nova senha (expira em 60 minutos):

${resetUrl}

Se não foi você, ignore este e-mail.`;
  const html = `<p>Você pediu para redefinir sua senha.</p>
<p>Abra o link abaixo para escolher uma nova senha (expira em 60 minutos):</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>Se não foi você, ignore este e-mail.</p>`;

  await transport.sendMail({ from: env.SMTP_FROM, to, subject, text, html });

  if (process.env.NODE_ENV === 'test') {
    lastResetEmail = { to, resetUrl };
  }
}
