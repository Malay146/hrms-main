import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { aiProviderConfig } from "./provider";

const KEYS = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL", "OPENAI_API_KEY"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("aiProviderConfig", () => {
  it("uses OpenAI when only OPENAI_API_KEY is set", () => {
    setEnv({ OPENAI_API_KEY: "sk-openai" });
    const config = aiProviderConfig();
    assert.equal(config.provider, "openai");
    assert.equal(config.configured, true);
  });

  it("switches to a compatible provider once its key is set", () => {
    setEnv({
      OPENAI_API_KEY: "sk-openai",
      AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      AI_MODEL: "gemini-2.5-flash",
      AI_API_KEY: "gemini-key",
    });
    const config = aiProviderConfig();
    assert.equal(config.provider, "compatible");
    assert.equal(config.apiKey, "gemini-key");
    assert.equal(config.modelId, "gemini-2.5-flash");
  });

  it("never sends the OpenAI key to another provider", () => {
    setEnv({
      OPENAI_API_KEY: "sk-openai",
      AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
    const config = aiProviderConfig();
    assert.equal(config.provider, "openai");
    assert.equal(config.baseURL, undefined);
  });

  it("allows keyless local servers", () => {
    setEnv({ AI_BASE_URL: "http://localhost:11434/v1", AI_MODEL: "qwen3:8b" });
    const config = aiProviderConfig();
    assert.equal(config.provider, "compatible");
    assert.equal(config.configured, true);
  });

  it("is unconfigured with no keys", () => {
    setEnv({});
    assert.equal(aiProviderConfig().configured, false);
  });
});
