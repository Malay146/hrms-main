import nodemailer from "nodemailer";
import { logger } from "./logger";
import { buildPayslipEmailHtml, buildPayslipEmailText, type PayslipEmailInput } from "./payslip-email";

export function normalizeSmtpPassword(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function smtpErrorMessage(error: unknown) {
  const err = error as { code?: string; responseCode?: number; message?: string };
  if (err.code === "EAUTH" || err.responseCode === 535) {
    return "Gmail rejected SMTP_USER/SMTP_PASS. Create a new App Password at https://myaccount.google.com/apppasswords (2-Step Verification must be on), update .env and .env.local, then restart the dev server.";
  }
  return error instanceof Error ? error.message : "Could not send email.";
}

function transporter() {
  const user = process.env.SMTP_USER?.trim();
  const pass = normalizeSmtpPassword(process.env.SMTP_PASS ?? "");
  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS are not set.");
  }
  if (
    (process.env.SMTP_HOST ?? "smtp.gmail.com").includes("gmail") &&
    pass.length !== 16
  ) {
    throw new Error(
      `Gmail SMTP_PASS must be a 16-character App Password (got ${pass.length} after removing spaces). Create one at https://myaccount.google.com/apppasswords`,
    );
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    requireTLS: port === 587,
    family: 4,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" },
  });
}

function smtpFrom() {
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();
  if (!from) {
    throw new Error("SMTP_FROM or SMTP_USER is required.");
  }
  return from;
}

async function sendMail(options: { to: string; subject: string; text: string; html?: string }) {
  try {
    await transporter().sendMail({
      from: smtpFrom(),
      ...options,
    });
  } catch (error) {
    throw new Error(smtpErrorMessage(error));
  }
}

export async function sendAccountCredentialsEmail(input: {
  to: string;
  fullName: string;
  username: string;
  password: string;
  loginUrl: string;
}) {
  await sendMail({
    to: input.to,
    subject: "Your HRMS login credentials",
    text: [
      `Hi ${input.fullName},`,
      "",
      "An administrator created your HRMS account.",
      `Username (email): ${input.username}`,
      `Temporary password: ${input.password}`,
      "",
      `Sign in at ${input.loginUrl}`,
      "",
      "You must change this password the first time you sign in.",
    ].join("\n"),
  });

  logger.info("mail.credentials_sent", { to: input.to });
}

export async function sendPayslipEmail(input: PayslipEmailInput & { to: string }) {
  const subject = `Your payslip for ${input.periodLabel}`;
  await sendMail({
    to: input.to,
    subject,
    text: buildPayslipEmailText(input),
    html: buildPayslipEmailHtml(input),
  });

  logger.info("mail.payslip_sent", { to: input.to });
}

export async function sendNotificationEmail(input: { to: string; title: string; body: string }) {
  await sendMail({
    to: input.to,
    subject: `HRMS: ${input.title}`,
    text: input.body,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  fullName: string;
  resetUrl: string;
}) {
  await sendMail({
    to: input.to,
    subject: "Reset your HRMS password",
    text: [
      `Hi ${input.fullName},`,
      "",
      "We received a request to reset your HRMS password.",
      "Open this link to choose a new password (expires in 1 hour):",
      input.resetUrl,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: [
      `<p>Hi ${escapeHtml(input.fullName)},</p>`,
      `<p>We received a request to reset your HRMS password.</p>`,
      `<p><a href="${escapeHtml(input.resetUrl)}">Reset your password</a></p>`,
      `<p style="color:#71717a;font-size:12px">This link expires in 1 hour. If you did not request this, ignore this email.</p>`,
    ].join(""),
  });

  logger.info("mail.password_reset_sent", { to: input.to });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let password = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  if (!/\d/.test(password)) {
    password = `${password.slice(0, 11)}4`;
  }
  return password;
}
