import nodemailer from 'nodemailer';

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * @param {{ to: string; subject: string; text: string; html?: string }} opts
 */
export async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@exam-flow.local';
  const transport = getTransport();

  if (!transport) {
    console.warn('[email] SMTP not configured (set SMTP_HOST). Would send to', to, ':', subject);
    return { skipped: true };
  }

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, '<br/>'),
  });
  return { sent: true };
}
