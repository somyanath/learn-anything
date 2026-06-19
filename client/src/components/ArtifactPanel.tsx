import { useState, useEffect } from "react";
import { LessonFrame } from "./LessonFrame";

interface ArtifactTree {
  lessons: string[];
  records: string[];
  mission: boolean;
  glossary: boolean;
  resources: boolean;
}

type Tab = "lesson" | "mission" | "glossary" | "resources" | "records";

interface ArtifactPanelProps {
  slug: string;
  refreshTrigger?: number;
}

function MarkdownView({ slug, file }: { slug: string; file: string }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/topics/${slug}/files/${file}`)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent(null));
  }, [slug, file]);

  if (content === null) {
    return <div className="p-4 text-gray-400 text-sm">Loading…</div>;
  }
  return (
    <pre className="p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-auto h-full">
      {content}
    </pre>
  );
}

export function ArtifactPanel({ slug, refreshTrigger = 0 }: ArtifactPanelProps) {
  const [tree, setTree] = useState<ArtifactTree | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("lesson");
  const [activeLesson, setActiveLesson] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/topics/${slug}/tree`)
      .then((r) => r.json())
      .then((t: ArtifactTree) => {
        setTree(t);
        if (t.lessons.length > 0) {
          setActiveLesson(t.lessons[t.lessons.length - 1]);
          setActiveTab("lesson");
        }
      })
      .catch(() => setTree(null));
  }, [slug, refreshTrigger]);

  const tabs: { id: Tab; label: string; available: boolean }[] = [
    { id: "lesson", label: "Lesson", available: (tree?.lessons.length ?? 0) > 0 },
    { id: "mission", label: "Mission", available: tree?.mission ?? false },
    { id: "glossary", label: "Glossary", available: tree?.glossary ?? false },
    { id: "resources", label: "Resources", available: tree?.resources ?? false },
    { id: "records", label: "Records", available: (tree?.records.length ?? 0) > 0 },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.available && setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-600"
                : tab.available
                ? "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                : "border-transparent text-gray-300 cursor-not-allowed"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "lesson" && (
          <div className="h-full flex flex-col">
            {tree && tree.lessons.length > 1 && (
              <div className="flex gap-1 p-2 bg-white border-b border-gray-100 overflow-x-auto">
                {tree.lessons.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveLesson(f)}
                    className={`px-2 py-1 text-xs rounded ${
                      activeLesson === f
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {f.replace("lessons/", "")}
                  </button>
                ))}
              </div>
            )}
            {activeLesson ? (
              <div className="flex-1 min-h-0">
                <LessonFrame slug={slug} file={activeLesson} />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                No lessons yet.
              </div>
            )}
          </div>
        )}

        {activeTab === "mission" && tree?.mission && (
          <MarkdownView slug={slug} file="MISSION.md" />
        )}
        {activeTab === "glossary" && tree?.glossary && (
          <MarkdownView slug={slug} file="reference/GLOSSARY.md" />
        )}
        {activeTab === "resources" && tree?.resources && (
          <MarkdownView slug={slug} file="RESOURCES.md" />
        )}
        {activeTab === "records" && tree && tree.records.length > 0 && (
          <div className="h-full overflow-y-auto">
            {tree.records.map((f) => (
              <details key={f} className="border-b border-gray-100">
                <summary className="px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
                  {f.replace("learning-records/", "")}
                </summary>
                <div className="bg-white">
                  <MarkdownView slug={slug} file={f} />
                </div>
              </details>
            ))}
          </div>
        )}

        {/* Empty state */}
        {activeTab !== "lesson" && !tabs.find((t) => t.id === activeTab)?.available && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Not yet created.
          </div>
        )}
      </div>
    </div>
  );
}
