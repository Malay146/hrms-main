import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` (run on npm install) needs no database, so a missing
    // DATABASE_URL must not break installs. migrate/db commands still fail
    // with a clear connection error when it is unset.
    url: process.env.DATABASE_URL ?? "",
  },
});
