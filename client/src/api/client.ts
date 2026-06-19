import type { Session } from "../types";

export async function getTopics(): Promise<Session[]> {
  const res = await fetch("/api/topics");
  if (!res.ok) throw new Error(`Failed to fetch topics: ${res.status}`);
  return res.json();
}

export async function createTopic(title: string): Promise<Session> {
  const res = await fetch("/api/topics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to create topic: ${res.status}`);
  return res.json();
}

export async function sendMessage(
  slug: string,
  message: string,
  model?: string
): Promise<{ reply: string; sdkSessionId: string }> {
  const res = await fetch(`/api/topics/${slug}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, model }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Chat failed: ${res.status}`);
  }
  return res.json();
}
