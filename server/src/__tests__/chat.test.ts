import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../app.js";
import { readSession } from "../workspace/session.js";
import type { AgentRunner, RunArgs } from "../agent/runTeach.js";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

// Parse SSE response body into ordered events
function parseSSE(body: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  let currentEvent = "";
  for (const line of body.split("\n")) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      events.push({ event: currentEvent, data: JSON.parse(line.slice(6)) });
      currentEvent = "";
    }
  }
  return events;
}

function makeBetaMessage(text: string) {
  return {
    id: "msg_fake",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    model: "claude-sonnet-4-6",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  };
}

function fakeAgent(
  reply: string,
  sessionId: string,
  costUsd = 0.002,
  toolName?: string
): AgentRunner {
  return async function* (_args: RunArgs): AsyncIterable<SDKMessage> {
    if (toolName) {
      yield {
        type: "tool_progress",
        tool_use_id: "tool-1",
        tool_name: toolName,
        parent_tool_use_id: null,
        elapsed_time_seconds: 0.5,
        uuid: "00000000-0000-0000-0000-000000000000" as any,
        session_id: sessionId,
      } as unknown as SDKMessage;
    }
    yield {
      type: "assistant",
      message: makeBetaMessage(reply),
      parent_tool_use_id: null,
      uuid: "00000000-0000-0000-0000-000000000001" as any,
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
      uuid: "00000000-0000-0000-0000-000000000002" as any,
    } as unknown as SDKMessage;
  };
}

function errorAgent(errorSubtype: string, sessionId: string): AgentRunner {
  return async function* (_args: RunArgs): AsyncIterable<SDKMessage> {
    yield {
      type: "result",
      subtype: errorSubtype,
      is_error: true,
      errors: ["scripted failure"],
      session_id: sessionId,
      total_cost_usd: 0,
      num_turns: 0,
      duration_ms: 1,
      duration_api_ms: 1,
      stop_reason: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: { web_search_requests: 0 },
      },
      modelUsage: {},
      permission_denials: [],
      uuid: "00000000-0000-0000-0000-000000000003" as any,
    } as unknown as SDKMessage;
  };
}

function throwingAgent(msg: string): AgentRunner {
  return async function* (_args: RunArgs): AsyncIterable<SDKMessage> {
    throw new Error(msg);
    yield {} as SDKMessage; // satisfy TS generator type
  };
}

let tmpDir: string;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "teach-chat-"));
  const app = createApp({
    workspacesDir: tmpDir,
    defaultModel: "claude-sonnet-4-6",
    agentRunner: fakeAgent("Hello! I'm your tutor.", "sdk-session-abc"),
  });
  request = supertest(app);
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("POST /api/topics/:slug/chat (SSE)", () => {
  it("streams text → done events and updates session on disk", async () => {
    const create = await request.post("/api/topics").send({ title: "Rust Ownership" });
    expect(create.status).toBe(201);
    const { slug } = create.body as { slug: string };

    const res = await request
      .post(`/api/topics/${slug}/chat`)
      .send({ message: "Hi, let's start!" })
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => cb(null, data));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);

    const events = parseSSE(res.body as string);
    const textEvents = events.filter((e) => e.event === "text");
    const doneEvents = events.filter((e) => e.event === "done");

    expect(textEvents.length).toBeGreaterThan(0);
    expect((textEvents[0].data as any).text).toBe("Hello! I'm your tutor.");
    expect(doneEvents).toHaveLength(1);
    expect((doneEvents[0].data as any).sdkSessionId).toBe("sdk-session-abc");
    expect((doneEvents[0].data as any).usage.costUsd).toBeCloseTo(0.002);

    const session = await readSession(join(tmpDir, slug));
    expect(session.transcript).toHaveLength(2);
    expect(session.transcript[0]).toMatchObject({ role: "user", content: "Hi, let's start!" });
    expect(session.transcript[1]).toMatchObject({ role: "assistant", content: "Hello! I'm your tutor." });
    expect(session.cost.topicTotalUsd).toBeCloseTo(0.002);
    expect(session.cost.inputTokens).toBe(100);
    expect(session.cost.outputTokens).toBe(50);
    expect(session.sdkSessionId).toBe("sdk-session-abc");
  });

  it("emits tool event before text when agent uses a tool", async () => {
    const app2 = createApp({
      workspacesDir: tmpDir,
      defaultModel: "claude-sonnet-4-6",
      agentRunner: fakeAgent("Got it!", "sdk-session-tool", 0.001, "Write"),
    });
    const req2 = supertest(app2);

    const create = await req2.post("/api/topics").send({ title: "Tools Test" });
    const { slug } = create.body as { slug: string };

    const res = await req2
      .post(`/api/topics/${slug}/chat`)
      .send({ message: "Teach me something" })
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => cb(null, data));
      });

    const events = parseSSE(res.body as string);
    const types = events.map((e) => e.event);
    expect(types.indexOf("tool")).toBeLessThan(types.indexOf("text"));
    expect(types.indexOf("text")).toBeLessThan(types.indexOf("done"));
    expect((events.find((e) => e.event === "tool")!.data as any).toolName).toBe("Write");
  });

  it("passes resumeSessionId on subsequent turns", async () => {
    const seenResumeIds: (string | undefined)[] = [];
    const trackingAgent: AgentRunner = async function* (args: RunArgs) {
      seenResumeIds.push(args.resumeSessionId);
      yield {
        type: "assistant",
        message: makeBetaMessage("Turn reply"),
        parent_tool_use_id: null,
        uuid: "00000000-0000-0000-0000-000000000004" as any,
        session_id: "sdk-session-xyz",
      } as unknown as SDKMessage;
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
        uuid: "00000000-0000-0000-0000-000000000005" as any,
      } as unknown as SDKMessage;
    };

    const app3 = createApp({
      workspacesDir: tmpDir,
      defaultModel: "claude-sonnet-4-6",
      agentRunner: trackingAgent,
    });
    const req3 = supertest(app3);

    const create = await req3.post("/api/topics").send({ title: "Resume Test" });
    const { slug } = create.body as { slug: string };

    const doChat = (msg: string) =>
      req3
        .post(`/api/topics/${slug}/chat`)
        .send({ message: msg })
        .buffer(true)
        .parse((res, cb) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          res.on("end", () => cb(null, data));
        });

    await doChat("First message");
    await doChat("Second message");

    expect(seenResumeIds[0]).toBeUndefined();
    expect(seenResumeIds[1]).toBe("sdk-session-xyz");
  });

  it("emits error event and leaves transcript intact on agent error result", async () => {
    const app4 = createApp({
      workspacesDir: tmpDir,
      defaultModel: "claude-sonnet-4-6",
      agentRunner: errorAgent("error_during_execution", "sdk-error-session"),
    });
    const req4 = supertest(app4);

    const create = await req4.post("/api/topics").send({ title: "Error Test" });
    const { slug } = create.body as { slug: string };

    const res = await req4
      .post(`/api/topics/${slug}/chat`)
      .send({ message: "This will fail" })
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => cb(null, data));
      });

    expect(res.status).toBe(200);
    const events = parseSSE(res.body as string);
    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    expect((errorEvents[0].data as any).message).toContain("error_during_execution");

    // transcript must NOT be updated on error
    const session = await readSession(join(tmpDir, slug));
    expect(session.transcript).toHaveLength(0);
  });

  it("emits error event when agent throws", async () => {
    const app5 = createApp({
      workspacesDir: tmpDir,
      defaultModel: "claude-sonnet-4-6",
      agentRunner: throwingAgent("network timeout"),
    });
    const req5 = supertest(app5);

    const create = await req5.post("/api/topics").send({ title: "Throw Test" });
    const { slug } = create.body as { slug: string };

    const res = await req5
      .post(`/api/topics/${slug}/chat`)
      .send({ message: "This throws" })
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => cb(null, data));
      });

    const events = parseSSE(res.body as string);
    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    expect((errorEvents[0].data as any).message).toContain("network timeout");
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
