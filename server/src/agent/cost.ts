import { ALLOWED_MODELS, PRICING, type Model } from "../config.js";

export function calcCost(inputTokens: number, outputTokens: number, model: string): number {
  if (!ALLOWED_MODELS.includes(model as Model)) return 0;
  const { inputPer1M, outputPer1M } = PRICING[model as Model];
  return (inputTokens / 1_000_000) * inputPer1M + (outputTokens / 1_000_000) * outputPer1M;
}
