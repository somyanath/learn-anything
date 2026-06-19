import express from "express";
import { topicsRouter } from "./routes/topics.js";
import { chatRouter } from "./routes/chat.js";
import { runTeach } from "./agent/runTeach.js";
import type { AppConfig } from "./config.js";
import type { AgentRunner } from "./agent/runTeach.js";

export function createApp(
  cfg: Pick<AppConfig, "workspacesDir" | "defaultModel"> & {
    agentRunner?: AgentRunner;
  }
) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/topics", topicsRouter(cfg.workspacesDir, cfg.defaultModel));
  app.use("/api/topics", chatRouter(cfg.workspacesDir, cfg.agentRunner ?? runTeach));

  return app;
}
