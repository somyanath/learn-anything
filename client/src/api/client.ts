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

export interface ChatCallbacks {
  onText: (text: string) => void;
  onTool: (toolName: string) => void;
  onDone: (data: { usage: { inputTokens: number; outputTokens: number; costUsd: number }; sdkSessionId: string }) => void;
  onError: (message: string) => void;
}

export async function streamChat(
  slug: string,
  message: string,
  model: string,
  callbacks: ChatCallbacks
): Promise<void> {
  const res = await fetch(`/api/topics/${slug}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, model }),
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    callbacks.onError(body.error ?? `Request failed: ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  function processBuffer() {
    // SSE frames: "event: X\ndata: {...}\n\n"
    let boundary: number;
    while ((boundary = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, boundary);
      buf = buf.slice(boundary + 2);

      let eventName = "";
      let dataStr = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event: ")) eventName = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataStr = line.slice(6);
      }
      if (!dataStr) continue;

      try {
        const data = JSON.parse(dataStr);
        if (eventName === "text") callbacks.onText(data.text);
        else if (eventName === "tool") callbacks.onTool(data.toolName);
        else if (eventName === "done") callbacks.onDone(data);
        else if (eventName === "error") callbacks.onError(data.message);
      } catch {
        // malformed frame — skip
      }
    }
  }

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    processBuffer();
  }
  buf += decoder.decode();
  processBuffer();
}
