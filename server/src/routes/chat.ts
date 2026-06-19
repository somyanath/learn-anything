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

    try {
      let reply = "";
      let sdkSessionId = session.sdkSessionId;
      let costUsd = 0;
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const msg of agentRunner({
        workspaceDir,
        model: activeModel,
        userMessage: message.trim(),
        resumeSessionId: session.sdkSessionId,
      })) {
        if (msg.type === "result") {
          if (msg.subtype === "success") {
            reply = msg.result;
            sdkSessionId = msg.session_id;
            costUsd = msg.total_cost_usd;
            inputTokens = msg.usage.input_tokens;
            outputTokens = msg.usage.output_tokens;
          } else {
            res.status(502).json({ error: `agent error: ${msg.subtype}` });
            return;
          }
        }
      }

      const assistantTs = new Date().toISOString();
      session.transcript.push({ role: "user", content: message.trim(), ts: userTs });
      session.transcript.push({ role: "assistant", content: reply, ts: assistantTs });
      session.cost.topicTotalUsd += costUsd;
      session.cost.inputTokens += inputTokens;
      session.cost.outputTokens += outputTokens;
      session.sdkSessionId = sdkSessionId;

      await writeSession(workspaceDir, session);

      res.json({ reply, sdkSessionId });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
