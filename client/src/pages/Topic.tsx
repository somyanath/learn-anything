import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChatPanel } from "../components/ChatPanel";
import { ArtifactPanel } from "../components/ArtifactPanel";

export function Topic() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!slug) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Topics
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-700">{slug}</span>
      </header>

      <div className="flex-1 min-h-0 flex">
        <div className="w-1/2 border-r border-gray-200 min-h-0">
          <ChatPanel
            slug={slug}
            model="claude-sonnet-4-6"
            onTurnComplete={() => setRefreshTrigger((n) => n + 1)}
          />
        </div>
        <div className="w-1/2 min-h-0">
          <ArtifactPanel slug={slug} refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
}
