# Personal "Teach" Learning Web App — Build Spec

> **Purpose of this document.** A complete, self-contained context + build specification for an AI agent (Claude Code) to build a personal learning web app that runs Matt Pocock's `/teach` skill through a browser UI, using your own Anthropic API key. Hand this whole file to Claude Code as the starting context.
>
> **Status:** Design finalized via a grilling session. Every "Decision" below is locked. The "Open questions" section at the end lists the few things deliberately deferred.
>
> **Author intent:** personal, single-user, local-first. Faithful to the `/teach` skill, cheaper than skilletweb (you pay per-token on your own key, default to Sonnet).

---

## 1. Background: what we're cloning and why

### 1.1 Skilletweb (the inspiration)

[skilletweb.com](https://skilletweb.com/) — by Paperplane Labs — is **"a web home for Claude skills"**: it makes Claude AI *skills* usable in a browser with no install and no terminal, for people who won't open a CLI.

Key facts about how it works:
- It runs the **Claude Agent SDK + Anthropic Managed Agents server-side**. Each skill gets a real workspace, its own session path, and a concrete deliverable — the browser is just a thin client.
- It is **not** a generic chat box. Each skill has its own workflow and produces an artifact.
- Live skills include **Office Hours** (20-min → design doc), **CE Plan** (12-min → action plan), and **Teach** (15-min → a personalized learning workspace).
- It has **spend controls** and is paid when using the Opus model.

The "Teach" tile is described as *"a personalized teacher that adapts to your goals and level"* — i.e. it runs Matt Pocock's teach skill.

**What we take from skilletweb:** the *experience* — a clean browser UI where you talk to a teacher and receive rendered artifacts, with the file-based agent machinery hidden behind the scenes.

**What we do differently:** we run **locally** with **our own API key** (no Managed Agents hosting, no per-use markup), default to **Sonnet** for cost, and we keep the **full multi-session persistence** that the teach skill is designed around (skilletweb's web version is a single short session).

### 1.2 Matt Pocock's `/teach` skill (the engine)

Source: <https://github.com/mattpocock/skills/tree/main/skills/productivity/teach>

This is the crucial thing to understand: **`/teach` is not a prompt — it is a filesystem-based, multi-session learning methodology.** It assumes the agent has real file tools (read/write/edit), can spawn sub-agents, and persists state across sessions as Markdown + HTML files in a workspace directory.

#### Files the skill maintains (per learning topic / "workspace")

| File / dir | Role |
|---|---|
| `MISSION.md` | **Why** you're learning this. *Every* teaching decision — what to teach next, which resources to surface, which exercises to design — traces back to this. Sections: **Why** (concrete real-world outcome, not "to understand X"), **Success looks like** (observable achievements), **Constraints** (time, budget, prior commitments, learning prefs), **Out of scope** (adjacent topics excluded). One mission per workspace. Kept to a single screen — a compass, not a plan. |
| `learning-records/NNNN-slug.md` | ADR-style numbered records of **non-obvious lessons, demonstrated understanding, disclosed prior knowledge, corrected misconceptions, and mission shifts**. These drive the **zone-of-proximal-development** calculation each session. Minimal template: a title + 1–3 sentences on what was learned and why it matters. Optional: `status: active | superseded by LR-NNNN` frontmatter, an **Evidence** note (how the user demonstrated it), and **Implications** (what it unlocks/rules out). Created lazily, only on genuine understanding/disclosure/correction — *not* for mere coverage or session logs. |
| `lessons/*.html` | **Self-contained HTML** lessons, one per tightly-scoped topic. Designed to be **beautiful and revisitable**, good for quick reference. Reusable components live in `lessons/assets/` — *"Reuse is the default, not the exception."* |
| `reference/GLOSSARY.md` | Compressed, opinionated reference language. Each term: tight 1–2 sentence definition + synonyms-to-avoid. **A term is added only once the user understands it** (it's evidence of mastery, not a dictionary). |
| `reference/` (other) | Cheat sheets, syntax guides — compressed reusable knowledge. |
| `RESOURCES.md` | Curated, **high-trust** external sources. Two sections: **Knowledge** (books/articles/papers, each annotated with *when to consult it* — "a bare link is useless in three months") and **Wisdom / Communities**. Plus an explicit **knowledge-gaps** section. *"Knowledge for explainers should be drawn from here, not from parametric guesses."* |
| `NOTES.md` | Learner preferences, for consistent personalization across sessions. |

#### The pedagogy (the rules the agent follows)

- **Session arc:** Assess → Instruct → Practice → Document.
  1. **Assess:** read prior `learning-records/` + `MISSION.md` to find the zone of proximal development.
  2. **Instruct:** deliver one focused lesson, tied directly to the mission. Lessons are short and completable quickly (respect working-memory limits).
  3. **Practice:** interactive feedback loops — **retrieval practice, spacing, interleaving, "desirable difficulty."**
  4. **Document:** record non-obvious insights as a new learning record.
- **"Never trust your parametric knowledge"** — always ground explainers in `RESOURCES.md`.
- **"Difficulty is the enemy"** for *knowledge acquisition*; **"Difficulty is the tool"** for *skill-building*. The balance is per-topic (theory leans knowledge; e.g. yoga leans skill).
- Design quiz answers to be **the same length** so format doesn't leak the answer.
- **Reuse is the default** — build shared components in `assets/` rather than duplicating.

> **Implication for the app:** because state lives in *files*, the agent rebuilds context each session by reading the workspace. We do not need to keep a giant conversation in memory — the workspace *is* the memory. This is what makes a local, multi-session app clean.

---

## 2. Locked decisions (the design)

These came out of a structured design interview. Treat them as requirements.

| # | Decision | Choice |
|---|---|---|
| D1 | **Where the brain runs / where state lives** | **Local app:** Vite + React frontend, small Node/Express backend running the **Claude Agent SDK** against a real workspace folder on disk. API key stays server-side. |
| D2 | **How the backend drives Claude** | **Claude Agent SDK + Skills** (`@anthropic-ai/claude-agent-sdk`). Matt's teach skill is dropped into `.claude/skills/teach/` and loaded natively. File tools, sub-agents, and the agent loop come from the SDK. |
| D3 | **Session model** | **Multi-topic, persistent.** A home screen lists topics; each topic is its own workspace folder with its own MISSION/records/lessons. You return across days; the agent resumes from prior records. |
| D4 | **Session UI** | **Split view:** chat on the left; right-hand panel renders the current HTML lesson in a **sandboxed iframe**, with tabs to browse Mission, Glossary, Resources, and Learning Records. |
| D5 | **Model & cost** | **Claude-only.** Default **Sonnet 4.6**; switchable to **Opus 4.8** and **Haiku 4.5**, per topic. Your own Anthropic console key. A lightweight live token/cost readout per session + cumulative per-topic total. Base URL is configurable in `.env` so other Anthropic-compatible providers (Kimi K2, GLM, etc.) can be added later **without a rewrite** — but no provider-switching UI is built now. |
| D6 | **Web grounding** | **Enabled.** The agent gets `web_search` + `web_fetch` so it curates `RESOURCES.md` from real sources and grounds lessons/glossary in them (honoring "never trust parametric knowledge"). |
| D7 | **Practice loop** | **Chat-based.** The agent quizzes you in the conversation; you answer in chat; it observes evidence and writes learning-records. HTML lessons *may* embed optional self-check quizzes for solo review, but those do **not** report back to the agent (no iframe→app messaging to build). |

### Current Claude model IDs & pricing (for the model picker)

| Model | ID | Input $/1M | Output $/1M | Use |
|---|---|---|---|---|
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | $3 | $15 | **Default** — strong agent, good value |
| Claude Opus 4.8 | `claude-opus-4-8` | $5 | $25 | Escalate for hard topics |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1 | $5 | Cheap / light topics / sub-agents |

> Verify IDs/pricing against current Anthropic docs at build time; these were correct as of this spec.

---

## 3. Architecture & data flow

```
┌─────────────────────────────────────────────────────────────┐
│  Browser — React (Vite)                                      │
│                                                              │
│  Home: topic list ──▶ Topic view:                            │
│    ┌───────────────┬───────────────────────────┐            │
│    │  Chat panel   │  Artifact panel            │            │
│    │  (stream)     │  [Lesson|Glossary|Mission| │            │
│    │               │   Resources|Records]       │            │
│    │  model picker │  <iframe sandbox> lesson   │            │
│    │  cost meter   │                            │            │
│    └───────────────┴───────────────────────────┘            │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP + SSE (localhost)
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Node / Express backend                                      │
│   • POST /api/topics            create topic (workspace)     │
│   • GET  /api/topics            list topics                  │
│   • POST /api/topics/:slug/chat run agent, stream SSE        │
│   • GET  /api/topics/:slug/files/*  serve workspace files    │
│   • GET  /api/topics/:slug/tree     list artifacts           │
│                                                              │
│   Claude Agent SDK  ── query() ──▶ Anthropic API            │
│     loads .claude/skills/teach/                              │
│     tools: Read/Write/Edit/Glob/Grep + web_search/web_fetch │
│     cwd = ./workspaces/<slug>/                               │
│     ANTHROPIC_API_KEY from .env (never sent to browser)      │
└───────────────┬─────────────────────────────────────────────┘
                ▼
   ./workspaces/<slug>/        ← the teach skill's workspace (per topic)
       MISSION.md
       NOTES.md
       RESOURCES.md
       learning-records/0001-*.md
       lessons/*.html  +  lessons/assets/
       reference/GLOSSARY.md
       .session.json           ← our metadata: title, model, cost totals, transcript
```

**Why this shape:** the Agent SDK *is* the engine behind Claude Code, so dropping Matt's skill into `.claude/skills/` makes it load natively with real file tools and sub-agents — maximum fidelity, least custom code. State persists as real files, so multi-session resumption is "just read the workspace."

---

## 4. Application file tree (target)

```
matt-teach-web-app/
├── TEACH-WEBAPP-BUILD-SPEC.md        ← this file
├── package.json                       ← root scripts (concurrently run client+server)
├── .env.example
├── .gitignore                         ← ignore .env, workspaces/, node_modules
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                           ← ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL?, PORT, WORKSPACES_DIR
│   ├── src/
│   │   ├── index.ts                   ← Express app, route mounting, static client serve (prod)
│   │   ├── config.ts                  ← env loading, model allow-list, pricing table
│   │   ├── routes/
│   │   │   ├── topics.ts              ← CRUD for topics/workspaces
│   │   │   ├── chat.ts                ← SSE endpoint: runs the agent, streams events
│   │   │   └── files.ts              ← safe workspace file serving (artifacts)
│   │   ├── agent/
│   │   │   ├── runTeach.ts            ← wraps Claude Agent SDK query() for a topic
│   │   │   ├── systemPrompt.ts        ← thin orchestration prompt around the skill
│   │   │   └── cost.ts                ← token→$ accounting from result usage
│   │   ├── workspace/
│   │   │   ├── paths.ts               ← slugify, resolve + sandbox workspace paths
│   │   │   ├── scaffold.ts            ← create a new empty workspace
│   │   │   └── session.ts             ← read/write .session.json (transcript, model, cost)
│   │   └── types.ts
│   └── .claude/
│       └── skills/
│           └── teach/                 ← Matt Pocock's skill, copied verbatim
│               ├── SKILL.md
│               ├── MISSION-FORMAT.md
│               ├── LEARNING-RECORD-FORMAT.md
│               ├── GLOSSARY-FORMAT.md
│               └── RESOURCES-FORMAT.md
│
├── client/
│   ├── package.json
│   ├── vite.config.ts                 ← dev proxy /api → server
│   ├── index.html
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                    ← router: Home / Topic
│       ├── api/client.ts              ← fetch helpers + SSE consumer
│       ├── pages/
│       │   ├── Home.tsx               ← topic list + "New topic"
│       │   └── Topic.tsx              ← split view container
│       ├── components/
│       │   ├── ChatPanel.tsx          ← message list + composer + streaming
│       │   ├── MessageBubble.tsx
│       │   ├── ToolActivity.tsx       ← shows "writing lessons/0001-...html" etc.
│       │   ├── ArtifactPanel.tsx      ← tabs: Lesson|Glossary|Mission|Resources|Records
│       │   ├── LessonFrame.tsx        ← sandboxed iframe for HTML lessons
│       │   ├── MarkdownView.tsx       ← render .md artifacts
│       │   ├── ModelPicker.tsx        ← Sonnet/Opus/Haiku
│       │   └── CostMeter.tsx          ← session + topic cost
│       ├── hooks/
│       │   ├── useChatStream.ts       ← drives SSE, accumulates messages
│       │   └── useArtifacts.ts        ← polls /tree after each turn
│       └── styles/
└── workspaces/                        ← created at runtime; one folder per topic (gitignored)
```

---

## 5. Workspace & skill layout (per topic)

When a topic is created, scaffold an empty workspace and let the **skill** create the files on first interaction (the skill creates `MISSION.md`, records, etc. lazily — don't pre-fill them with placeholder content beyond an empty dir).

```
workspaces/<slug>/
├── .session.json           ← OUR metadata (not part of the skill). Shape:
│     {
│       "slug": "rust-ownership",
│       "title": "Rust ownership & borrowing",
│       "model": "claude-sonnet-4-6",
│       "createdAt": "...",
│       "cost": { "topicTotalUsd": 3.10, "inputTokens": ..., "outputTokens": ... },
│       "transcript": [ { "role": "user"|"assistant", "content": "...", "ts": ... } ]
│     }
├── MISSION.md              ← created by the skill
├── NOTES.md                ← created by the skill
├── RESOURCES.md            ← created by the skill
├── learning-records/
│     └── 0001-slug.md
├── lessons/
│     ├── 0001-ownership-basics.html
│     └── assets/           ← shared CSS/JS/components for lessons
└── reference/
      └── GLOSSARY.md
```

**Dropping in the skill:** copy the four `*-FORMAT.md` files and `SKILL.md` from the GitHub repo verbatim into `server/.claude/skills/teach/`. Do **not** paraphrase them — the skill's wording is load-bearing. The Agent SDK discovers skills from the `.claude/skills/` directory relative to its working/settings directory; verify the exact discovery rule against the current SDK docs and configure `settingSources` / `cwd` accordingly.

> ⚠️ **Two different `.claude` directories.** `server/.claude/skills/teach/` holds the skill *definition* (shared across all topics). `workspaces/<slug>/` is the per-topic *working directory* (`cwd`) where the skill writes MISSION/records/lessons. Keep them separate.

---

## 6. Key code stubs

> These stubs are **illustrative**. The Claude Agent SDK's exact API (option names, message shapes) evolves — **verify against the current `@anthropic-ai/claude-agent-sdk` docs/types before relying on a field name.** The shape below reflects the SDK's `query()` async-iterator pattern.

### 6.1 Backend — run the teach skill for a topic (`server/src/agent/runTeach.ts`)

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "node:path";

export interface RunArgs {
  workspaceDir: string;          // absolute path to workspaces/<slug>
  skillsDir: string;             // absolute path to server/.claude (parent of skills/)
  model: string;                 // claude-sonnet-4-6 | claude-opus-4-8 | claude-haiku-4-5
  userMessage: string;
  resumeSessionId?: string;      // optional: SDK session resume within a topic
}

// Emits normalized events the SSE route forwards to the browser.
export async function* runTeach(args: RunArgs) {
  const iterator = query({
    prompt: args.userMessage,
    options: {
      model: args.model,
      cwd: args.workspaceDir,            // the topic workspace = the skill's filesystem
      // Make the teach skill + file/web tools available:
      settingSources: ["project"],       // so .claude/skills/teach is discovered
      allowedTools: [
        "Read", "Write", "Edit", "Glob", "Grep",
        "WebSearch", "WebFetch",         // D6: web grounding
        "Task",                          // sub-agents
      ],
      permissionMode: "bypassPermissions", // single local user; no interactive prompts
      // Optionally a thin orchestration system prompt (see 6.2):
      // systemPrompt: { type: "preset", preset: "claude_code", append: ORCHESTRATION_NOTE },
      resume: args.resumeSessionId,
    },
  });

  for await (const message of iterator) {
    // message kinds (verify names): "assistant" (text + tool_use), "tool"/"tool_result",
    // "result" (final, carries usage + session_id). Normalize and yield:
    yield message;
  }
}
```

### 6.2 Thin orchestration note (`server/src/agent/systemPrompt.ts`)

Keep this *small*. The skill carries the methodology; this only frames the app context. Do **not** restate the pedagogy — let `SKILL.md` own it.

```ts
export const ORCHESTRATION_NOTE = `
You are running inside a personal learning web app. The user interacts with you
through a browser chat panel; HTML lessons you write to ./lessons/ are rendered
in a side panel. Use the "teach" skill for all teaching. Persist everything to
the workspace files as the skill specifies. Keep practice in the chat so you can
observe the user's answers and write learning-records from real evidence.
`;
```

### 6.3 Backend — SSE chat route (`server/src/routes/chat.ts`)

```ts
import { Router } from "express";
import { runTeach } from "../agent/runTeach";
import { resolveWorkspace } from "../workspace/paths";
import { loadSession, appendTurn, addCost } from "../workspace/session";
import { ORCHESTRATION_NOTE } from "../agent/systemPrompt";

export const chat = Router();

chat.post("/:slug/chat", async (req, res) => {
  const { message, model } = req.body;
  const ws = resolveWorkspace(req.params.slug);     // throws on path escape
  const session = await loadSession(ws);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  await appendTurn(ws, { role: "user", content: message });

  try {
    for await (const ev of runTeach({
      workspaceDir: ws.dir,
      skillsDir: ws.skillsDir,
      model: model ?? session.model,
      userMessage: message,
      resumeSessionId: session.sdkSessionId,
    })) {
      if (ev.type === "assistant") send("text", ev);       // stream text deltas
      else if (ev.type === "tool") send("tool", ev);       // "writing lessons/..."
      else if (ev.type === "result") {
        await addCost(ws, ev.usage, model ?? session.model);
        await appendTurn(ws, { role: "assistant", content: ev.text });
        send("done", { usage: ev.usage, sdkSessionId: ev.session_id });
      }
    }
  } catch (err) {
    send("error", { message: String(err) });
  } finally {
    res.end();
  }
});
```

### 6.4 Backend — safe artifact serving (`server/src/routes/files.ts`)

```ts
import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { resolveWorkspace } from "../workspace/paths";

export const files = Router();

// GET /api/topics/:slug/files/lessons/0001-x.html  → returns the file
files.get("/:slug/files/*", async (req, res) => {
  const ws = resolveWorkspace(req.params.slug);
  const rel = req.params[0];                            // "lessons/0001-x.html"
  const abs = path.resolve(ws.dir, rel);
  if (!abs.startsWith(ws.dir + path.sep)) return res.status(403).end(); // no traversal
  try {
    const body = await fs.readFile(abs);
    if (abs.endsWith(".html")) res.type("html");
    else if (abs.endsWith(".md")) res.type("text/markdown");
    res.send(body);
  } catch { res.status(404).end(); }
});
```

### 6.5 Frontend — sandboxed lesson frame (`client/src/components/LessonFrame.tsx`)

```tsx
// Lessons are self-contained HTML and may include their own <script> (self-check
// quizzes). Sandbox to allow scripts but NOT same-origin, so a lesson can't read
// app cookies / the workspace. Served from the backend file route.
export function LessonFrame({ slug, file }: { slug: string; file: string }) {
  const src = `/api/topics/${slug}/files/${file}`;
  return (
    <iframe
      title="lesson"
      src={src}
      sandbox="allow-scripts"
      className="w-full h-full border-0 rounded-lg bg-white"
    />
  );
}
```

### 6.6 Frontend — chat stream hook (`client/src/hooks/useChatStream.ts`)

```ts
// Consume the SSE stream from POST /api/topics/:slug/chat.
// Use fetch + ReadableStream (EventSource can't POST a body).
export async function streamChat(slug: string, body: object, on: {
  text: (e: any) => void; tool: (e: any) => void;
  done: (e: any) => void; error: (e: any) => void;
}) {
  const res = await fetch(`/api/topics/${slug}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    // parse "event: X\ndata: {...}\n\n" frames out of buf and dispatch to on[X]
  }
}
```

### 6.7 `.env.example`

```dotenv
# server/.env
ANTHROPIC_API_KEY=sk-ant-...        # your console key — server-side only
# ANTHROPIC_BASE_URL=               # leave blank for Anthropic; set later for BYO providers
PORT=8787
WORKSPACES_DIR=./workspaces
DEFAULT_MODEL=claude-sonnet-4-6
```

---

## 7. Phased build plan

Build in vertical slices so there's something runnable early.

### Phase 0 — Scaffold (½ day)
- Root `package.json` with `concurrently` running `client` (Vite) + `server` (tsx/nodemon).
- `server`: Express + TypeScript + dotenv; health route. Install `@anthropic-ai/claude-agent-sdk`.
- `client`: Vite + React + TS + Tailwind; Vite dev proxy `/api → http://localhost:8787`.
- Copy Matt's `teach` skill into `server/.claude/skills/teach/` (verbatim).
- **Milestone:** `npm run dev` serves an empty app + reachable `/api/health`.

### Phase 1 — Topics & workspaces (½ day)
- `workspace/paths.ts` (slugify + traversal-safe resolve), `scaffold.ts`, `session.ts`.
- Routes: `POST/GET /api/topics`.
- `Home.tsx`: list topics, "New topic" (asks for a title → creates workspace).
- **Milestone:** create a topic; an empty `workspaces/<slug>/` appears with `.session.json`.

### Phase 2 — Agent round-trip, non-streaming (1 day)
- `agent/runTeach.ts` wrapping `query()` with `cwd = workspace`, skill loaded, tools allow-listed (incl. `WebSearch`/`WebFetch`).
- `POST /api/topics/:slug/chat` returns the final text (no streaming yet).
- `Topic.tsx` + `ChatPanel.tsx`: send a message, show the reply.
- **Milestone:** ask the agent to start; it creates `MISSION.md` etc. in the workspace. Confirm files appear on disk.

### Phase 3 — Streaming + tool activity (1 day)
- Convert chat route to **SSE**; `useChatStream.ts` consumes it.
- `ToolActivity.tsx`: surface tool events ("writing `lessons/0001-...html`", "searching the web").
- Persist transcript + `sdkSessionId` to `.session.json`; resume within a topic.
- **Milestone:** watch the agent think, search, and write files live.

### Phase 4 — Artifact panel (1–1.5 days)
- `GET /api/topics/:slug/tree` (list MISSION, RESOURCES, GLOSSARY, lessons, records).
- `GET /api/topics/:slug/files/*` (safe serve).
- `ArtifactPanel.tsx` with tabs; `LessonFrame.tsx` (sandboxed iframe); `MarkdownView.tsx` for `.md`.
- Auto-refresh the tree after each `done` event; auto-open the newest lesson.
- **Milestone:** full split view — chat left, rendered lesson + browsable Mission/Glossary/Resources/Records right.

### Phase 5 — Model picker + cost meter (½ day)
- `ModelPicker.tsx` (Sonnet default / Opus / Haiku), persisted per topic.
- `agent/cost.ts`: convert `result.usage` → $ via the pricing table; accumulate `topicTotalUsd`.
- `CostMeter.tsx`: session $ + topic total.
- **Milestone:** switch models; see live + cumulative cost.

### Phase 6 — Polish (ongoing)
- Empty states, loading/skeletons, error toasts, keyboard send.
- Optional: rename/delete topic, export a topic workspace as a zip.
- Optional: a tiny web-animation pass on transitions (see notes).

---

## 8. Non-functional requirements & guardrails

- **Security:** API key only in `server/.env`; never expose it to the browser. Path-traversal guard on all workspace file access (Section 6.4). Lesson iframes are `sandbox="allow-scripts"` only (no `allow-same-origin`).
- **Single user, local:** no auth. Bind the server to `localhost`. `permissionMode: bypassPermissions` is acceptable *only* because it's your machine and your key.
- **Cost control:** default Sonnet; show running cost; (optional) a soft per-topic cap that warns before continuing.
- **Persistence:** everything important is a file on disk — workspaces are portable and backup-able. `.session.json` holds app metadata + transcript so a topic resumes exactly.
- **Fidelity to the skill:** never paraphrase `SKILL.md` or the `*-FORMAT.md` files; keep the orchestration system prompt minimal so the skill stays in control.
- **Don't truncate** content sent to the agent; if a workspace grows large, rely on the SDK's context handling rather than silently cutting files.

---

## 9. Open questions (deliberately deferred)

These were left out of v1 on purpose; revisit if wanted:

1. **Cost cap behavior** — soft warn vs hard stop at a per-topic dollar threshold. (v1: display only.)
2. **Interactive quizzes reporting back** — wiring self-grading lesson quizzes through an iframe `postMessage` protocol so the agent auto-writes learning-records. (v1: practice stays in chat.)
3. **Bring-your-own-model UI** — provider profiles (Kimi K2, GLM, etc.) via base-URL swap, and/or a LiteLLM/claude-code-router proxy for OpenAI/Gemini. (v1: Claude-only; base URL is config-only, no UI.)
4. **Hosting/multi-device** — currently local-only. A hosted version would reintroduce auth, a DB, and likely Managed Agents (skilletweb's model).
5. **Spaced-repetition surfacing** — the skill records what you've learned; a future "review due" view could schedule retrieval across topics.

---

## 10. Quick reference for the builder

- **Engine:** `@anthropic-ai/claude-agent-sdk` `query()` — verify current option/message field names against its docs; this spec uses the documented async-iterator shape.
- **Skill source (copy verbatim):** <https://github.com/mattpocock/skills/tree/main/skills/productivity/teach> → `server/.claude/skills/teach/`.
- **Models:** `claude-sonnet-4-6` (default), `claude-opus-4-8`, `claude-haiku-4-5`.
- **Tools to allow:** `Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, Task`.
- **Per topic:** `cwd = workspaces/<slug>/`; the skill owns the files; we own `.session.json`.
- **Start at Phase 0** and keep each phase runnable.
```
