import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../app.js";
import { readSession } from "../workspace/session.js";
import type { AgentRunner, RunArgs } from "../agent/runTeach.js";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

function fakeAgent(reply: string, sessionId: string, costUsd = 0.001): AgentRunner {
  return async function* (_args: RunArgs): AsyncIterable<SDKMessage> {
    yield {
      type: "result",
      subtype: "success",
      result: reply,
      session_id: sessionId,
      total_cost_usd: costUsd,
      is_error: false,
      num_turns: 1,
      duration_ms: 10,
      duration_api_ms: 8,
      stop_reason: "end_turn",
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: { web_search_requests: 0 },
      },
      modelUsage: {},
      permission_denials: [],
      uuid: "00000000-0000-0000-0000-000000000001" as any,
    } as unknown as SDKMessage;
  };
}

let tmpDir: string;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "teach-chat-"));
  const app = createApp({
    workspacesDir: tmpDir,
    defaultModel: "claude-sonnet-4-6",
    agentRunner: fakeAgent("Hello! I'm your tutor.", "sdk-session-abc", 0.002),
  });
  request = supertest(app);
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("POST /api/topics/:slug/chat", () => {
  it("returns reply and updates session on disk", async () => {
    const create = await request.post("/api/topics").send({ title: "Rust Ownership" });
    expect(create.status).toBe(201);
    const { slug } = create.body as { slug: string };

    const chat = await request
      .post(`/api/topics/${slug}/chat`)
      .send({ message: "Hi, let's start!" });

    expect(chat.status).toBe(200);
    expect(chat.body.reply).toBe("Hello! I'm your tutor.");
    expect(chat.body.sdkSessionId).toBe("sdk-session-abc");

    const session = await readSession(join(tmpDir, slug));
    expect(session.transcript).toHaveLength(2);
    expect(session.transcript[0]).toMatchObject({ role: "user", content: "Hi, let's start!" });
    expect(session.transcript[1]).toMatchObject({ role: "assistant", content: "Hello! I'm your tutor." });
    expect(session.cost.topicTotalUsd).toBeCloseTo(0.002);
    expect(session.cost.inputTokens).toBe(100);
    expect(session.cost.outputTokens).toBe(50);
    expect(session.sdkSessionId).toBe("sdk-session-abc");
  });

  it("passes resumeSessionId on subsequent turns", async () => {
    const seenResumeIds: (string | undefined)[] = [];
    const trackingAgent: AgentRunner = async function* (args: RunArgs) {
      seenResumeIds.push(args.resumeSessionId);
      yield {
        type: "result",
        subtype: "success",
        result: "Turn reply",
        session_id: "sdk-session-xyz",
        total_cost_usd: 0.001,
        is_error: false,
        num_turns: 1,
        duration_ms: 5,
        duration_api_ms: 4,
        stop_reason: "end_turn",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          server_tool_use: { web_search_requests: 0 },
        },
        modelUsage: {},
        permission_denials: [],
        uuid: "00000000-0000-0000-0000-000000000002" as any,
      } as unknown as SDKMessage;
    };

    const app2 = createApp({
      workspacesDir: tmpDir,
      defaultModel: "claude-sonnet-4-6",
      agentRunner: trackingAgent,
    });
    const req2 = supertest(app2);

    const create = await req2.post("/api/topics").send({ title: "Python Basics" });
    const { slug } = create.body as { slug: string };

    await req2.post(`/api/topics/${slug}/chat`).send({ message: "First message" });
    await req2.post(`/api/topics/${slug}/chat`).send({ message: "Second message" });

    expect(seenResumeIds[0]).toBeUndefined();
    expect(seenResumeIds[1]).toBe("sdk-session-xyz");
  });

  it("returns 400 for missing message", async () => {
    const create = await request.post("/api/topics").send({ title: "Empty Test" });
    const { slug } = create.body as { slug: string };

    const res = await request.post(`/api/topics/${slug}/chat`).send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 for whitespace-only message", async () => {
    const create = await request.post("/api/topics").send({ title: "Whitespace Test" });
    const { slug } = create.body as { slug: string };

    const res = await request.post(`/api/topics/${slug}/chat`).send({ message: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown slug", async () => {
    const res = await request
      .post("/api/topics/no-such-topic/chat")
      .send({ message: "Hello" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for path-traversal slug", async () => {
    const res = await request
      .post("/api/topics/../../../etc/chat")
      .send({ message: "Hello" });
    expect([400, 404]).toContain(res.status);
  });
});
