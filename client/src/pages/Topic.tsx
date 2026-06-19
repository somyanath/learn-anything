import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChatPanel } from "../components/ChatPanel";
import { ArtifactPanel } from "../components/ArtifactPanel";
import { ModelPicker } from "../components/ModelPicker";
import { CostMeter } from "../components/CostMeter";
import { getTopic } from "../api/client";
import type { Session } from "../types";

export function Topic() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sessionCostUsd, setSessionCostUsd] = useState(0);

  useEffect(() => {
    if (!slug) return;
    getTopic(slug).then(setSession).catch(() => navigate("/"));
  }, [slug, navigate]);

  if (!slug) return null;

  const model = session?.model ?? "claude-sonnet-4-6";

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Topics
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-700 truncate max-w-xs">
          {session?.title ?? slug}
        </span>
        <div className="flex-1" />
        <ModelPicker
          slug={slug}
          currentModel={model}
          onModelChange={(m) => setSession((s) => s ? { ...s, model: m } : s)}
        />
        <span className="text-gray-200">|</span>
        <CostMeter
          sessionCostUsd={sessionCostUsd}
          topicTotalUsd={session?.cost.topicTotalUsd ?? 0}
        />
      </header>

      <div className="flex-1 min-h-0 flex">
        <div className="w-1/2 border-r border-gray-200 min-h-0">
          <ChatPanel
            slug={slug}
            model={model}
            onTurnComplete={(costUsd) => {
              setSessionCostUsd((prev) => prev + costUsd);
              setSession((s) =>
                s ? { ...s, cost: { ...s.cost, topicTotalUsd: s.cost.topicTotalUsd + costUsd } } : s
              );
              setRefreshTrigger((n) => n + 1);
            }}
          />
        </div>
        <div className="w-1/2 min-h-0">
          <ArtifactPanel slug={slug} refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
}
