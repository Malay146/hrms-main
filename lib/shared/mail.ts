import nodemailer from "nodemailer";
import { logger } from "./logger";

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

async function sendMail(options: { to: string; subject: string; text: string }) {
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

export async function sendPayslipEmail(input: {
  to: string;
  fullName: string;
  periodLabel: string;
  net: number;
  lines: { name: string; amount: number }[];
}) {
  const lineText = input.lines
    .map((line) => `${line.name}: ₹${line.amount.toLocaleString("en-IN")}`)
    .join("\n");

  await sendMail({
    to: input.to,
    subject: `Your payslip for ${input.periodLabel}`,
    text: [
      `Hi ${input.fullName},`,
      "",
      `Please find your payslip summary for ${input.periodLabel}.`,
      "",
      lineText,
      "",
      `Net salary: ₹${input.net.toLocaleString("en-IN")}`,
      "",
      "This is a system-generated message from HRMS.",
    ].join("\n"),
  });

  logger.info("mail.payslip_sent", { to: input.to });
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
