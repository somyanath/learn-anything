import path from "node:path";

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "topic"
  );
}

export function resolveWorkspace(workspacesDir: string, slug: string): string {
  const safe = path.resolve(workspacesDir);
  const resolved = path.resolve(safe, slug);
  if (!resolved.startsWith(safe + path.sep)) {
    throw new Error(`Path traversal detected for slug: ${slug}`);
  }
  return resolved;
}
