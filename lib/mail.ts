import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

function transporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS are not set.");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user, pass },
  });
}

export async function sendAccountCredentialsEmail(input: {
  to: string;
  fullName: string;
  username: string;
  password: string;
  loginUrl: string;
}) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) {
    throw new Error("SMTP_FROM or SMTP_USER is required.");
  }

  await transporter().sendMail({
    from,
    to: input.to,
    subject: "Your HRMS login credentials",
    text: [
      `Hi ${input.fullName},`,
      "",
      "An administrator created your HRMS account.",
      `Username (email): ${input.username}`,
      `Temporary password: ${input.password}`,
      "",
      "Sign in at ${input.loginUrl}",
      "",
      "You must change this password the first time you sign in.",
    ].join("\n"),
  });

  logger.info("mail.credentials_sent", { to: input.to });
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
