import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calcCost } from "../agent/cost.js";
import { createApp } from "../app.js";
import { readSession } from "../workspace/session.js";
import type { AgentRunner, RunArgs } from "../agent/runTeach.js";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

// Unit tests for calcCost
describe("calcCost", () => {
  it("calculates Sonnet 4.6 cost correctly", () => {
    // $3/1M input, $15/1M output
    const cost = calcCost(1_000_000, 1_000_000, "claude-sonnet-4-6");
    expect(cost).toBeCloseTo(18); // $3 + $15
  });

  it("calculates Opus 4.8 cost correctly", () => {
    // $5/1M input, $25/1M output
    const cost = calcCost(1_000_000, 1_000_000, "claude-opus-4-8");
    expect(cost).toBeCloseTo(30); // $5 + $25
  });

  it("calculates Haiku 4.5 cost correctly", () => {
    // $1/1M input, $5/1M output
    const cost = calcCost(1_000_000, 1_000_000, "claude-haiku-4-5");
    expect(cost).toBeCloseTo(6); // $1 + $5
  });

  it("calculates partial token cost correctly", () => {
    const cost = calcCost(500_000, 200_000, "claude-sonnet-4-6");
    // $3 * 0.5 + $15 * 0.2 = $1.5 + $3 = $4.5
    expect(cost).toBeCloseTo(4.5);
  });

  it("returns 0 for unknown model", () => {
    expect(calcCost(1_000_000, 1_000_000, "unknown-model")).toBe(0);
  });
});

// Integration tests for model persistence and cost accumulation
function makeAgent(
  reply: string,
  sessionId: string,
  costUsd: number,
  inputTokens = 100,
  outputTokens = 50
): AgentRunner {
  return async function* (_args: RunArgs): AsyncIterable<SDKMessage> {
    yield {
      type: "assistant",
      message: {
        id: "msg",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: reply }],
        model: "claude-sonnet-4-6",
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: inputTokens, output_tokens: outputTokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
      parent_tool_use_id: null,
      uuid: "00000000-0000-0000-0000-aaaaaaaaaaaa" as any,
      session_id: sessionId,
    } as unknown as SDKMessage;
    yield {
      type: "result",
      subtype: "success",
      result: reply,
      session_id: sessionId,
      total_cost_usd: costUsd,
      is_error: false,
      num_turns: 1,
      duration_ms: 5,
      duration_api_ms: 4,
      stop_reason: "end_turn",
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: { web_search_requests: 0 },
      },
      modelUsage: {},
      permission_denials: [],
      uuid: "00000000-0000-0000-0000-bbbbbbbbbbbb" as any,
    } as unknown as SDKMessage;
  };
}

let tmpDir: string;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "teach-cost-"));
  const app = createApp({
    workspacesDir: tmpDir,
    defaultModel: "claude-sonnet-4-6",
    agentRunner: makeAgent("reply", "sess-1", 0.003, 100, 50),
  });
  request = supertest(app);
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

const doChat = (req: ReturnType<typeof supertest>, slug: string, msg = "hi") =>
  req
    .post(`/api/topics/${slug}/chat`)
    .send({ message: msg })
    .buffer(true)
    .parse((res, cb) => {
      let d = "";
      res.on("data", (c: Buffer) => { d += c.toString(); });
      res.on("end", () => cb(null, d));
    });

describe("cost accumulation over multiple turns", () => {
  it("accumulates cost correctly over two turns", async () => {
    const create = await request.post("/api/topics").send({ title: "Cost Test" });
    const { slug } = create.body as { slug: string };

    await doChat(request, slug, "First");
    await doChat(request, slug, "Second");

    const session = await readSession(join(tmpDir, slug));
    expect(session.cost.topicTotalUsd).toBeCloseTo(0.006);
    expect(session.cost.inputTokens).toBe(200);
    expect(session.cost.outputTokens).toBe(100);
  });
});

describe("PATCH /api/topics/:slug/model", () => {
  it("persists model selection per topic", async () => {
    const create = await request.post("/api/topics").send({ title: "Model Picker Test" });
    const { slug } = create.body as { slug: string };

    const patch = await request.patch(`/api/topics/${slug}/model`).send({ model: "claude-opus-4-8" });
    expect(patch.status).toBe(200);
    expect(patch.body.model).toBe("claude-opus-4-8");

    const session = await readSession(join(tmpDir, slug));
    expect(session.model).toBe("claude-opus-4-8");
  });

  it("returns 400 for invalid model", async () => {
    const create = await request.post("/api/topics").send({ title: "Bad Model Test" });
    const { slug } = create.body as { slug: string };

    const patch = await request.patch(`/api/topics/${slug}/model`).send({ model: "gpt-4" });
    expect(patch.status).toBe(400);
  });

  it("persists model via chat request body", async () => {
    const app2 = createApp({
      workspacesDir: tmpDir,
      defaultModel: "claude-sonnet-4-6",
      agentRunner: makeAgent("reply", "sess-2", 0.001),
    });
    const req2 = supertest(app2);

    const create = await req2.post("/api/topics").send({ title: "Chat Model Persist" });
    const { slug } = create.body as { slug: string };

    await req2
      .post(`/api/topics/${slug}/chat`)
      .send({ message: "Hello", model: "claude-haiku-4-5" })
      .buffer(true)
      .parse((res, cb) => {
        let d = "";
        res.on("data", (c: Buffer) => { d += c.toString(); });
        res.on("end", () => cb(null, d));
      });

    const session = await readSession(join(tmpDir, slug));
    expect(session.model).toBe("claude-haiku-4-5");
  });
});

describe("GET /api/topics/:slug", () => {
  it("returns the topic session", async () => {
    const create = await request.post("/api/topics").send({ title: "Get Topic Test" });
    const { slug } = create.body as { slug: string };

    const res = await request.get(`/api/topics/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(slug);
    expect(res.body.model).toBe("claude-sonnet-4-6");
  });

  it("returns 404 for unknown slug", async () => {
    const res = await request.get("/api/topics/nonexistent");
    expect(res.status).toBe(404);
  });
});
