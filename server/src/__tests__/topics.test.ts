import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../app.js";

let tmpDir: string;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "teach-topics-"));
  const app = createApp({ workspacesDir: tmpDir, defaultModel: "claude-sonnet-4-6" });
  request = supertest(app);
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("POST /api/topics", () => {
  it("creates workspace with .session.json and correct shape", async () => {
    const res = await request.post("/api/topics").send({ title: "Rust Ownership" });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("rust-ownership");
    expect(res.body.title).toBe("Rust Ownership");
    expect(res.body.model).toBe("claude-sonnet-4-6");
    expect(res.body.transcript).toEqual([]);
    expect(res.body.cost.topicTotalUsd).toBe(0);
  });

  it("workspace contains only .session.json (no pre-filled skill files)", async () => {
    const res = await request.post("/api/topics").send({ title: "Clean Workspace" });
    expect(res.status).toBe(201);
    const entries = await readdir(join(tmpDir, res.body.slug));
    expect(entries).toEqual([".session.json"]);
  });

  it("returns 400 for missing title", async () => {
    const res = await request.post("/api/topics").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 for whitespace-only title", async () => {
    const res = await request.post("/api/topics").send({ title: "   " });
    expect(res.status).toBe(400);
  });

  it("deduplicates slugs for duplicate titles", async () => {
    await request.post("/api/topics").send({ title: "My Topic" });
    const res2 = await request.post("/api/topics").send({ title: "My Topic" });
    expect(res2.status).toBe(201);
    expect(res2.body.slug).toBe("my-topic-1");
    const res3 = await request.post("/api/topics").send({ title: "My Topic" });
    expect(res3.body.slug).toBe("my-topic-2");
  });

  it("slugifies unicode titles safely", async () => {
    const res = await request.post("/api/topics").send({ title: "Café & Co!" });
    expect(res.status).toBe(201);
    expect(res.body.slug).toMatch(/^cafe/);
    expect(res.body.slug).not.toContain(" ");
    expect(res.body.slug).not.toContain("&");
  });

  it("path traversal in title resolves safely inside workspacesDir", async () => {
    const res = await request.post("/api/topics").send({ title: "../../../etc" });
    expect(res.status).toBe(201);
    expect(res.body.slug).not.toContain("..");
    expect(res.body.slug).not.toContain("/");
  });
});

describe("GET /api/topics", () => {
  it("returns array of created topics", async () => {
    const res = await request.get("/api/topics");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("slug");
    expect(res.body[0]).toHaveProperty("title");
  });

  it("returns empty array when workspaces dir is empty", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "teach-empty-"));
    try {
      const emptyApp = createApp({ workspacesDir: emptyDir, defaultModel: "claude-sonnet-4-6" });
      const res = await supertest(emptyApp).get("/api/topics");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  it("returns empty array when workspaces dir does not exist", async () => {
    const noDir = join(tmpdir(), "teach-nonexistent-" + Date.now());
    const app = createApp({ workspacesDir: noDir, defaultModel: "claude-sonnet-4-6" });
    const res = await supertest(app).get("/api/topics");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
