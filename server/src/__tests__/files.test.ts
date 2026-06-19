import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../app.js";

let tmpDir: string;
let request: ReturnType<typeof supertest>;
let slug: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "teach-files-"));
  const app = createApp({ workspacesDir: tmpDir, defaultModel: "claude-sonnet-4-6" });
  request = supertest(app);

  // Create a topic
  const res = await supertest(app).post("/api/topics").send({ title: "Artifact Test" });
  slug = (res.body as { slug: string }).slug;
  const workspaceDir = join(tmpDir, slug);

  // Scaffold some workspace files the skill would create
  await mkdir(join(workspaceDir, "lessons"), { recursive: true });
  await mkdir(join(workspaceDir, "learning-records"), { recursive: true });
  await mkdir(join(workspaceDir, "reference"), { recursive: true });
  await writeFile(join(workspaceDir, "lessons", "0001-intro.html"), "<html><body>Hello</body></html>");
  await writeFile(join(workspaceDir, "learning-records", "0001-basics.md"), "# Basics\nLearned the basics.");
  await writeFile(join(workspaceDir, "MISSION.md"), "# Mission\nLearn Rust.");
  await writeFile(join(workspaceDir, "reference", "GLOSSARY.md"), "# Glossary\nOwnership: ...");
  await writeFile(join(workspaceDir, "RESOURCES.md"), "# Resources\n...");
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("GET /api/topics/:slug/tree", () => {
  it("lists all artifact categories", async () => {
    const res = await request.get(`/api/topics/${slug}/tree`);
    expect(res.status).toBe(200);
    expect(res.body.lessons).toEqual(["lessons/0001-intro.html"]);
    expect(res.body.records).toEqual(["learning-records/0001-basics.md"]);
    expect(res.body.mission).toBe(true);
    expect(res.body.glossary).toBe(true);
    expect(res.body.resources).toBe(true);
  });

  it("returns empty lists for workspace with no skill files", async () => {
    const res2 = await request.post("/api/topics").send({ title: "Empty Workspace" });
    const emptySlug = (res2.body as { slug: string }).slug;

    const res = await request.get(`/api/topics/${emptySlug}/tree`);
    expect(res.status).toBe(200);
    expect(res.body.lessons).toEqual([]);
    expect(res.body.records).toEqual([]);
    expect(res.body.mission).toBe(false);
    expect(res.body.glossary).toBe(false);
    expect(res.body.resources).toBe(false);
  });

  it("returns 400 for path-traversal slug", async () => {
    const res = await request.get("/api/topics/../../../etc/tree");
    expect([400, 404]).toContain(res.status);
  });
});

describe("GET /api/topics/:slug/files/*", () => {
  it("serves HTML lesson with correct content type", async () => {
    const res = await request.get(`/api/topics/${slug}/files/lessons/0001-intro.html`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("Hello");
  });

  it("serves Markdown file with correct content type", async () => {
    const res = await request.get(`/api/topics/${slug}/files/MISSION.md`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/markdown/);
    expect(res.text).toContain("Learn Rust");
  });

  it("returns 404 for missing file", async () => {
    const res = await request.get(`/api/topics/${slug}/files/lessons/nonexistent.html`);
    expect(res.status).toBe(404);
  });

  it("rejects path traversal via file path (403 from guard or 404 from URL normalization)", async () => {
    // Express normalizes URLs before routing, so traversal via URL may 404 before
    // reaching the route. The guard handles traversal in raw query params.
    const res = await request.get(`/api/topics/${slug}/files/../../../etc/passwd`);
    expect([403, 404, 400]).toContain(res.status);
  });

  it("returns 400 for path-traversal slug in files route", async () => {
    const res = await request.get("/api/topics/../../../etc/files/passwd");
    expect([400, 404]).toContain(res.status);
  });
});
