import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_TOOL_STEPS, DEFAULT_PORT, loadConfig } from "../src/config";
import { createContainer, selectProvider } from "../src/container";

describe("loadConfig", () => {
  it("defaults to the stub provider on the project port", () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      port: DEFAULT_PORT,
      provider: "stub",
      maxToolSteps: DEFAULT_MAX_TOOL_STEPS,
      corsOrigins: ["*"],
    });
  });

  it("parses an allow-list of origins", () => {
    expect(
      loadConfig({ CORS_ORIGINS: "http://a.test, http://b.test" }).corsOrigins,
    ).toEqual(["http://a.test", "http://b.test"]);
  });

  it("rejects a non-integer port", () => {
    expect(() => loadConfig({ PORT: "eight" })).toThrow(
      /PORT must be a positive integer/,
    );
  });

  it("rejects an unknown provider", () => {
    expect(() => loadConfig({ MODEL_PROVIDER: "llama" })).toThrow(/MODEL_PROVIDER/);
  });
});

describe("selectProvider", () => {
  it("returns the stub by default with no warnings", () => {
    const { provider, warnings } = selectProvider(loadConfig({}));
    expect(provider.id).toBe("stub");
    expect(warnings).toEqual([]);
  });

  it("returns the OpenAI provider when a key is present", () => {
    const { provider } = selectProvider(
      loadConfig({ MODEL_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" }),
    );
    expect(provider.id).toBe("openai");
  });

  it("degrades to the stub with a warning when the key is missing", () => {
    const { provider, warnings } = selectProvider(
      loadConfig({ MODEL_PROVIDER: "openai", OPENAI_API_KEY: "" }),
    );
    expect(provider.id).toBe("stub");
    expect(warnings[0]).toContain("falling back to the deterministic stub");
  });
});

describe("createContainer", () => {
  it("wires the API client to the in-process MCP server", () => {
    const container = createContainer(loadConfig({}));
    expect(container.mcpClient.label).toBe("in-memory:mcp-mastra-tools");
    expect(container.mcpServer.registry.size()).toBe(3);
  });
});
