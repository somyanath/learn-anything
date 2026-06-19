import fs from "node:fs/promises";
import path from "node:path";
import { slugify } from "./paths.js";
import { writeSession } from "./session.js";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function scaffoldWorkspace(
  title: string,
  workspacesDir: string,
  defaultModel: string = "claude-sonnet-4-6"
): Promise<{ slug: string; dir: string }> {
  const abs = path.resolve(workspacesDir);
  await fs.mkdir(abs, { recursive: true });

  const base = slugify(title);
  let slug = base;
  let counter = 1;
  while (await exists(path.join(abs, slug))) {
    slug = `${base}-${counter++}`;
  }

  const dir = path.join(abs, slug);
  await fs.mkdir(dir, { recursive: true });
  await writeSession(dir, {
    slug,
    title,
    model: defaultModel,
    createdAt: new Date().toISOString(),
    cost: { topicTotalUsd: 0, inputTokens: 0, outputTokens: 0 },
    transcript: [],
  });

  return { slug, dir };
}
