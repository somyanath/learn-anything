import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { scaffoldWorkspace } from "../workspace/scaffold.js";
import { readSession, writeSession } from "../workspace/session.js";
import { resolveWorkspace } from "../workspace/paths.js";
import { ALLOWED_MODELS } from "../config.js";

export function topicsRouter(workspacesDir: string, defaultModel: string) {
  const router = Router();

  router.post("/", async (req, res) => {
    const { title } = req.body as { title?: string };
    if (!title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    try {
      const { dir } = await scaffoldWorkspace(title.trim(), workspacesDir, defaultModel);
      const session = await readSession(dir);
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:slug", async (req, res) => {
    let workspaceDir: string;
    try {
      workspaceDir = resolveWorkspace(workspacesDir, req.params.slug);
    } catch {
      res.status(400).json({ error: "invalid slug" });
      return;
    }
    try {
      const session = await readSession(workspaceDir);
      res.json(session);
    } catch {
      res.status(404).json({ error: "topic not found" });
    }
  });

  router.patch("/:slug/model", async (req, res) => {
    const { model } = req.body as { model?: string };
    if (!model || !ALLOWED_MODELS.includes(model as (typeof ALLOWED_MODELS)[number])) {
      res.status(400).json({ error: `model must be one of: ${ALLOWED_MODELS.join(", ")}` });
      return;
    }
    let workspaceDir: string;
    try {
      workspaceDir = resolveWorkspace(workspacesDir, req.params.slug);
    } catch {
      res.status(400).json({ error: "invalid slug" });
      return;
    }
    try {
      const session = await readSession(workspaceDir);
      session.model = model;
      await writeSession(workspaceDir, session);
      res.json({ model });
    } catch {
      res.status(404).json({ error: "topic not found" });
    }
  });

  router.get("/", async (_req, res) => {
    try {
      const abs = path.resolve(workspacesDir);
      let slugs: string[] = [];
      try {
        const dirents = await fs.readdir(abs, { withFileTypes: true });
        slugs = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
      } catch {
        // workspaces dir doesn't exist yet — return empty list
      }
      const sessions = (
        await Promise.all(
          slugs.map(async (slug) => {
            try {
              return await readSession(path.join(abs, slug));
            } catch {
              return null;
            }
          })
        )
      ).filter(Boolean);
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
