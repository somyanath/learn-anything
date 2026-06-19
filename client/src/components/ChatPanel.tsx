import { useState, useRef, useEffect } from "react";
import { streamChat } from "../api/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface ToolActivity {
  toolName: string;
}

interface ChatPanelProps {
  slug: string;
  model: string;
  onTurnComplete?: () => void;
}

export function ChatPanel({ slug, model, onTurnComplete }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolActivity]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setToolActivity(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    // Placeholder for streaming assistant reply
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    await streamChat(slug, text, model, {
      onText: (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant" && last.streaming) {
            updated[updated.length - 1] = { ...last, content: chunk };
          }
          return updated;
        });
        setToolActivity(null);
      },
      onTool: (toolName) => {
        setToolActivity({ toolName });
      },
      onDone: () => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.streaming) {
            updated[updated.length - 1] = { ...last, streaming: false };
          }
          return updated;
        });
        setToolActivity(null);
        setLoading(false);
        onTurnComplete?.();
      },
      onError: (msg) => {
        setError(msg);
        // Remove the streaming placeholder
        setMessages((prev) => prev.filter((m) => !m.streaming));
        setToolActivity(null);
        setLoading(false);
      },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <p className="text-gray-400 text-sm text-center mt-8">
            Send a message to start learning.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-800"
              } ${msg.streaming && !msg.content ? "animate-pulse" : ""}`}
            >
              {msg.content || (msg.streaming ? "…" : "")}
            </div>
          </div>
        ))}
        {toolActivity && (
          <div className="flex justify-start">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
              Using {toolActivity.toolName}…
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-500 text-sm text-center bg-red-50 rounded-lg p-2">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your tutor… (Enter to send, Shift+Enter for newline)"
            disabled={loading}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
