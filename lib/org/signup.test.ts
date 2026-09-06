import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocateOrgSlug, orgSlugFromName } from "@/lib/people/employee-id";
import { firstZodError, signUpSchema } from "@/lib/shared/validations";
import { findApiOperation } from "@/lib/api/v1/operations";
import { buildOpenApiDocument } from "@/lib/api/v1/openapi";

const valid = {
  name: "Jane Doe",
  organizationName: "Acme Inc.",
  organizationEmail: "jane@acme.com",
  password: "Secret123",
  confirmPassword: "Secret123",
};

describe("organization signup validation", () => {
  it("accepts a complete registration payload", () => {
    const parsed = signUpSchema.safeParse(valid);
    assert.equal(parsed.success, true);
  });

  it("rejects mismatched passwords", () => {
    const parsed = signUpSchema.safeParse({ ...valid, confirmPassword: "Other123" });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(firstZodError(parsed.error), "Passwords do not match.");
    }
  });

  it("rejects a password without a number", () => {
    const parsed = signUpSchema.safeParse({
      ...valid,
      password: "Secretword",
      confirmPassword: "Secretword",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects a short organization name", () => {
    const parsed = signUpSchema.safeParse({ ...valid, organizationName: "A" });
    assert.equal(parsed.success, false);
  });
});

describe("organization slug allocation", () => {
  it("uses a 4-letter slug from the company name", () => {
    assert.equal(orgSlugFromName("Acme Inc."), "ACME");
  });

  it("appends a number when the base slug is taken", () => {
    assert.equal(allocateOrgSlug("Oddo", ["ODDO"]), "ODDO2");
  });
});

describe("organization register API catalog", () => {
  it("exposes public POST /organizations", () => {
    const op = findApiOperation("POST", "/organizations");
    assert.equal(op?.operation.operationId, "registerOrganization");
    assert.equal(op?.operation.public, true);
    const spec = buildOpenApiDocument();
    assert.ok(spec.paths["/api/v1/organizations"]?.post);
  });
});
