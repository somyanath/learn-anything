export interface Session {
  slug: string;
  title: string;
  model: string;
  createdAt: string;
  cost: { topicTotalUsd: number; inputTokens: number; outputTokens: number };
  transcript: Array<{ role: "user" | "assistant"; content: string; ts: string }>;
  sdkSessionId?: string;
}
