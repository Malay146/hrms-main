import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appUrl, trustedAppOrigins } from "./app-url";

describe("appUrl", () => {
  it("prefers an explicit URL and strips the trailing slash", () => {
    assert.equal(appUrl({ BETTER_AUTH_URL: "https://hr.example.com/" }), "https://hr.example.com");
  });

  it("uses the production domain on Vercel production", () => {
    assert.equal(
      appUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "hrms-main.vercel.app", VERCEL_URL: "hrms-main-abc.vercel.app" }),
      "https://hrms-main.vercel.app",
    );
  });

  it("uses the deployment URL on previews", () => {
    assert.equal(
      appUrl({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "hrms-main.vercel.app", VERCEL_URL: "hrms-main-abc.vercel.app" }),
      "https://hrms-main-abc.vercel.app",
    );
  });

  it("falls back to localhost", () => {
    assert.equal(appUrl({}), "http://localhost:3000");
  });

  it("trusts every Vercel host for this deployment", () => {
    const origins = trustedAppOrigins({
      VERCEL_ENV: "preview",
      VERCEL_URL: "a.vercel.app",
      VERCEL_BRANCH_URL: "b.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "c.vercel.app",
    });
    assert.deepEqual(origins.sort(), ["https://a.vercel.app", "https://b.vercel.app", "https://c.vercel.app"]);
  });
});
