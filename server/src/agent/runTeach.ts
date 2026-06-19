import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { ORCHESTRATION_NOTE } from "./systemPrompt.js";

export interface RunArgs {
  workspaceDir: string;
  model: string;
  userMessage: string;
  resumeSessionId?: string;
}

export type AgentRunner = (args: RunArgs) => AsyncIterable<SDKMessage>;

export async function* runTeach(args: RunArgs): AsyncIterable<SDKMessage> {
  const iterator = query({
    prompt: args.userMessage,
    options: {
      model: args.model,
      cwd: args.workspaceDir,
      settingSources: ["project"],
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: ORCHESTRATION_NOTE,
      },
      allowedTools: [
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "WebSearch",
        "WebFetch",
        "Task",
      ],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      resume: args.resumeSessionId,
    },
  });
  for await (const message of iterator) {
    yield message;
  }
}
