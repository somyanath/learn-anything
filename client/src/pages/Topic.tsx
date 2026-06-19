import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChatPanel } from "../components/ChatPanel";
import { ArtifactPanel } from "../components/ArtifactPanel";
import { ModelPicker } from "../components/ModelPicker";
import { CostMeter } from "../components/CostMeter";
import { ToastContainer, useToast } from "../components/Toast";
import { getTopic } from "../api/client";
import type { Session } from "../types";

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-px bg-gray-200" />
      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}

export function Topic() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sessionCostUsd, setSessionCostUsd] = useState(0);
  const { toasts, addToast } = useToast();

  useEffect(() => {
    if (!slug) return;
    setLoadingSession(true);
    getTopic(slug)
      .then(setSession)
      .catch(() => {
        addToast("Failed to load topic. Returning home.");
        setTimeout(() => navigate("/"), 2000);
      })
      .finally(() => setLoadingSession(false));
  }, [slug, navigate, addToast]);

  if (!slug) return null;

  const model = session?.model ?? "claude-sonnet-4-6";

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-gray-600 text-sm shrink-0"
        >
          ← Topics
        </button>
        <span className="text-gray-300">|</span>
        {loadingSession ? (
          <HeaderSkeleton />
        ) : (
          <>
            <span className="text-sm font-medium text-gray-700 truncate max-w-xs">
              {session?.title ?? slug}
            </span>
            <div className="flex-1" />
            <ModelPicker
              slug={slug}
              currentModel={model}
              onModelChange={(m) => setSession((s) => (s ? { ...s, model: m } : s))}
            />
            <span className="text-gray-200">|</span>
            <CostMeter
              sessionCostUsd={sessionCostUsd}
              topicTotalUsd={session?.cost.topicTotalUsd ?? 0}
            />
          </>
        )}
      </header>

      <div className="flex-1 min-h-0 flex">
        <div className="w-1/2 border-r border-gray-200 min-h-0">
          <ChatPanel
            slug={slug}
            model={model}
            onTurnComplete={(costUsd) => {
              setSessionCostUsd((prev) => prev + costUsd);
              setSession((s) =>
                s
                  ? { ...s, cost: { ...s.cost, topicTotalUsd: s.cost.topicTotalUsd + costUsd } }
                  : s
              );
              setRefreshTrigger((n) => n + 1);
            }}
          />
        </div>
        <div className="w-1/2 min-h-0">
          {loadingSession ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-gray-400 text-sm">Loading workspace…</div>
            </div>
          ) : (
            <ArtifactPanel slug={slug} refreshTrigger={refreshTrigger} />
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
