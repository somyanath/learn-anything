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
