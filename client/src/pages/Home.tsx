import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getTopics, createTopic } from "../api/client";
import type { Session } from "../types";

export function Home() {
  const [topics, setTopics] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getTopics()
      .then(setTopics)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const title = window.prompt("What would you like to learn?");
    if (!title?.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const topic = await createTopic(title.trim());
      navigate(`/topics/${topic.slug}`);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  function hasWork(t: Session) {
    return t.transcript.length > 0 || t.cost.inputTokens > 0;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Your Topics</h1>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "New topic"}
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
        )}

        {topics.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-2">No topics yet.</p>
            <p className="text-sm">Click "New topic" to start learning something.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {topics.map((t) => (
              <li key={t.slug}>
                <button
                  onClick={() => navigate(`/topics/${t.slug}`)}
                  className="w-full text-left bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{t.title}</span>
                    {hasWork(t) ? (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        In progress
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                        Not started
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
