import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const ALLOWED_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-8",
  "claude-haiku-4-5",
] as const;

export type Model = (typeof ALLOWED_MODELS)[number];

export const PRICING: Record<Model, { inputPer1M: number; outputPer1M: number }> = {
  "claude-sonnet-4-6": { inputPer1M: 3, outputPer1M: 15 },
  "claude-opus-4-8": { inputPer1M: 5, outputPer1M: 25 },
  "claude-haiku-4-5": { inputPer1M: 1, outputPer1M: 5 },
};

export interface AppConfig {
  port: number;
  workspacesDir: string;
  defaultModel: Model;
  anthropicApiKey: string;
  anthropicBaseUrl?: string;
}

export function getConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 8787),
    workspacesDir: process.env.WORKSPACES_DIR ?? "./workspaces",
    defaultModel: (process.env.DEFAULT_MODEL ?? "claude-sonnet-4-6") as Model,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL,
  };
}
