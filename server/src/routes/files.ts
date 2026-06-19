import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { resolveWorkspace } from "../workspace/paths.js";

interface ArtifactTree {
  lessons: string[];
  records: string[];
  mission: boolean;
  glossary: boolean;
  resources: boolean;
}

async function listDir(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.sort();
  } catch {
    return [];
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function filesRouter(workspacesDir: string) {
  const router = Router({ mergeParams: true });

  router.get("/:slug/tree", async (req, res) => {
    let workspaceDir: string;
    try {
      workspaceDir = resolveWorkspace(workspacesDir, req.params.slug);
    } catch {
      res.status(400).json({ error: "invalid slug" });
      return;
    }

    try {
      const lessonsDir = path.join(workspaceDir, "lessons");
      const recordsDir = path.join(workspaceDir, "learning-records");

      const [lessonFiles, recordFiles, hasMission, hasGlossary, hasResources] =
        await Promise.all([
          listDir(lessonsDir).then((files) => files.filter((f) => f.endsWith(".html"))),
          listDir(recordsDir).then((files) => files.filter((f) => f.endsWith(".md"))),
          fileExists(path.join(workspaceDir, "MISSION.md")),
          fileExists(path.join(workspaceDir, "reference", "GLOSSARY.md")),
          fileExists(path.join(workspaceDir, "RESOURCES.md")),
        ]);

      const tree: ArtifactTree = {
        lessons: lessonFiles.map((f) => `lessons/${f}`),
        records: recordFiles.map((f) => `learning-records/${f}`),
        mission: hasMission,
        glossary: hasGlossary,
        resources: hasResources,
      };
      res.json(tree);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:slug/files/*", async (req, res) => {
    let workspaceDir: string;
    try {
      workspaceDir = resolveWorkspace(workspacesDir, req.params.slug);
    } catch {
      res.status(400).json({ error: "invalid slug" });
      return;
    }

    // Express captures the wildcard (*) as params[0]; cast through unknown for TS compat
    const rel = (req.params as unknown as Record<string, string>)[0];
    if (!rel) {
      res.status(400).end();
      return;
    }

    const abs = path.resolve(workspaceDir, rel);
    if (!abs.startsWith(workspaceDir + path.sep)) {
      res.status(403).end();
      return;
    }

    try {
      const body = await fs.readFile(abs);
      if (abs.endsWith(".html")) res.type("html");
      else if (abs.endsWith(".md")) res.type("text/markdown");
      else res.type("application/octet-stream");
      res.send(body);
    } catch {
      res.status(404).end();
    }
  });

  return router;
}
