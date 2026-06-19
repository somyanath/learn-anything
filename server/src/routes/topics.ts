import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { scaffoldWorkspace } from "../workspace/scaffold.js";
import { readSession } from "../workspace/session.js";

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
