import express from "express";
import { topicsRouter } from "./routes/topics.js";
import type { AppConfig } from "./config.js";

export function createApp(cfg: Pick<AppConfig, "workspacesDir" | "defaultModel">) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/topics", topicsRouter(cfg.workspacesDir, cfg.defaultModel));

  return app;
}
