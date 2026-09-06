import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/shared/logger";
import { sendPasswordResetEmail } from "@/lib/shared/mail";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendPasswordResetEmail({
          to: user.email,
          fullName: user.name || user.email,
          resetUrl: url,
        });
      } catch (error) {
        // Keep local/demo usable when SMTP is misconfigured: log the link so ops can reset.
        logger.warn("auth.reset_email_failed", {
          email: user.email,
          resetUrl: url,
          reason: error instanceof Error ? error.message : "unknown",
        });
        if (process.env.NODE_ENV === "production") {
          throw error;
        }
        logger.info("auth.reset_url_dev_fallback", { email: user.email, resetUrl: url });
      }
    },
    onPasswordReset: async ({ user }) => {
      await prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: false },
      });
      logger.info("auth.password_reset", { userId: user.id });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "employee",
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  plugins: [nextCookies()],
});
