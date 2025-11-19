/**
 * Every environment-dependent value in the backend, read once, validated once.
 *
 * Nothing else in `src/` touches `process.env`, so the set of knobs a deployer
 * has to care about is exactly the fields of `AppConfig`.
 */

export const DEFAULT_PORT = 7271;
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_MAX_TOOL_STEPS = 4;
export const SERVER_NAME = "mcp-mastra-tools";
export const SERVER_VERSION = "1.0.0";

export type ProviderId = "stub" | "openai";

export interface AppConfig {
  port: number;
  host: string;
  /** Which model provider the agent loop should use. */
  provider: ProviderId;
  openAiModel: string;
  openAiApiKey?: string;
  maxToolSteps: number;
  /** `*` allows any origin. Otherwise a comma-separated allow-list. */
  corsOrigins: string[];
  nodeEnv: string;
}

function readInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${value}"`);
  }
  return parsed;
}

function readProvider(value: string | undefined): ProviderId {
  const normalised = (value ?? "stub").trim().toLowerCase();
  if (normalised === "stub" || normalised === "openai") return normalised;
  throw new Error(`MODEL_PROVIDER must be "stub" or "openai", got "${value}"`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: readInt(env.PORT, DEFAULT_PORT, "PORT"),
    host: env.HOST?.trim() || "0.0.0.0",
    provider: readProvider(env.MODEL_PROVIDER),
    openAiModel: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    openAiApiKey: env.OPENAI_API_KEY?.trim() || undefined,
    maxToolSteps: readInt(env.MAX_TOOL_STEPS, DEFAULT_MAX_TOOL_STEPS, "MAX_TOOL_STEPS"),
    corsOrigins: (env.CORS_ORIGINS?.trim() || "*")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    nodeEnv: env.NODE_ENV?.trim() || "development",
  };
}
