import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";

const app = createApp({ workspacesDir: "/tmp/teach-test", defaultModel: "claude-sonnet-4-6" });

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await supertest(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
