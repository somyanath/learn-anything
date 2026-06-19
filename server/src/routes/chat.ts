import { Router } from "express";
import { resolveWorkspace } from "../workspace/paths.js";
import { readSession, writeSession } from "../workspace/session.js";
import type { AgentRunner } from "../agent/runTeach.js";

export function chatRouter(workspacesDir: string, agentRunner: AgentRunner) {
  const router = Router({ mergeParams: true });

  router.post("/:slug/chat", async (req, res) => {
    const { message, model } = req.body as { message?: string; model?: string };
    if (!message?.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    let workspaceDir: string;
    try {
      workspaceDir = resolveWorkspace(workspacesDir, req.params.slug);
    } catch {
      res.status(400).json({ error: "invalid slug" });
      return;
    }

    let session;
    try {
      session = await readSession(workspaceDir);
    } catch {
      res.status(404).json({ error: "topic not found" });
      return;
    }

    const activeModel = model ?? session.model;
    const userTs = new Date().toISOString();
    const userMessage = message.trim();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (event: string, data: unknown) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      let finalReply = "";
      let sdkSessionId = session.sdkSessionId;
      let costUsd = 0;
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const msg of agentRunner({
        workspaceDir,
        model: activeModel,
        userMessage,
        resumeSessionId: session.sdkSessionId,
      })) {
        if (msg.type === "assistant") {
          const text = (msg.message.content as Array<{ type: string; text?: string }>)
            .filter((b) => b.type === "text" && typeof b.text === "string")
            .map((b) => b.text as string)
            .join("");
          if (text) {
            finalReply = text;
            send("text", { text });
          }
        } else if (msg.type === "tool_progress") {
          send("tool", { toolName: msg.tool_name, elapsedSeconds: msg.elapsed_time_seconds });
        } else if (msg.type === "result") {
          if (msg.subtype === "success") {
            if (!finalReply) finalReply = msg.result;
            sdkSessionId = msg.session_id;
            costUsd = msg.total_cost_usd;
            inputTokens = msg.usage.input_tokens;
            outputTokens = msg.usage.output_tokens;

            const assistantTs = new Date().toISOString();
            session.transcript.push({ role: "user", content: userMessage, ts: userTs });
            session.transcript.push({ role: "assistant", content: finalReply, ts: assistantTs });
            session.cost.topicTotalUsd += costUsd;
            session.cost.inputTokens += inputTokens;
            session.cost.outputTokens += outputTokens;
            session.sdkSessionId = sdkSessionId;
            if (model) session.model = activeModel;
            await writeSession(workspaceDir, session);

            send("done", {
              usage: { inputTokens, outputTokens, costUsd },
              sdkSessionId,
            });
          } else {
            send("error", { message: `agent error: ${msg.subtype}` });
          }
          return;
        }
      }
    } catch (err) {
      send("error", { message: String(err) });
    } finally {
      res.end();
    }
  });

  return router;
}
