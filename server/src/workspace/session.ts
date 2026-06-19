import fs from "node:fs/promises";
import path from "node:path";

export interface Session {
  slug: string;
  title: string;
  model: string;
  createdAt: string;
  cost: { topicTotalUsd: number; inputTokens: number; outputTokens: number };
  transcript: Array<{ role: "user" | "assistant"; content: string; ts: string }>;
  sdkSessionId?: string;
}

export async function readSession(workspaceDir: string): Promise<Session> {
  const raw = await fs.readFile(path.join(workspaceDir, ".session.json"), "utf-8");
  return JSON.parse(raw) as Session;
}

export async function writeSession(workspaceDir: string, session: Session): Promise<void> {
  await fs.writeFile(
    path.join(workspaceDir, ".session.json"),
    JSON.stringify(session, null, 2),
    "utf-8"
  );
}
